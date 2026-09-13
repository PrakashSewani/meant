import { z } from 'zod';
import type { Register } from './register/types';
import type { ChipKey, TransformEvent } from './events';
import { CHIP_KEYS } from './events';

export interface Prior {
  value: string | string[];
  count: number;
  at: number;
}

const PriorSchema = z.object({
  value: z.union([z.string(), z.array(z.string())]),
  count: z.number().int().nonnegative(),
  at: z.number(),
});

const PriorsSchema = z.record(z.string(), z.record(z.string(), PriorSchema));

/** Keyed by surface and field role: the same site, the same kind of box. */
export type Priors = Record<string, Partial<Record<ChipKey, Prior>>>;

/** One correction is an accident; two in the same place is a preference. */
export const PRIOR_MIN_OBSERVATIONS = 2;

/** Older evidence fades: a year-old correction should not outrank this week's. */
const PRIOR_WINDOW_MS = 1000 * 60 * 60 * 24 * 180;

/** Anything unreadable in storage is treated as "has learned nothing", never as a crash. */
export function readPriors(raw: unknown): Priors {
  const parsed = PriorsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function priorKey(surface: string, fieldRole?: string): string {
  return fieldRole ? `${surface}:${fieldRole}` : surface;
}

/**
 * Reads the user's own corrections back out of the event log. Only the corrections count: a
 * transform accepted as-inferred says the inference was right, which is already the default.
 */
export function derivePriors(events: readonly TransformEvent[], now = Date.now()): Priors {
  const candidates: Record<string, Partial<Record<ChipKey, Record<string, Prior>>>> = {};

  for (const event of events) {
    if (now - event.at > PRIOR_WINDOW_MS) continue;
    if (event.corrections.length === 0) continue;

    const key = priorKey(event.surface, event.fieldRole);
    candidates[key] ??= {};

    for (const chip of event.corrections) {
      const value = event.sent[chip];
      if (value === undefined) continue;

      const signature = JSON.stringify(value);
      const perChip = (candidates[key][chip] ??= {});
      const existing = perChip[signature];

      perChip[signature] = existing
        ? { value, count: existing.count + 1, at: Math.max(existing.at, event.at) }
        : { value, count: 1, at: event.at };
    }
  }

  const priors: Priors = {};

  for (const [key, chips] of Object.entries(candidates)) {
    for (const chip of CHIP_KEYS) {
      const options = Object.values(chips[chip] ?? {});
      const best = options
        .filter((option) => option.count >= PRIOR_MIN_OBSERVATIONS)
        .sort((a, b) => b.count - a.count || b.at - a.at)[0];

      if (best) {
        priors[key] ??= {};
        priors[key][chip] = best;
      }
    }
  }

  return priors;
}

export interface LearnedRegister {
  register: Partial<Register>;
  learned: ChipKey[];
}

/** What the priors say about this surface, ready to sit over inference. */
export function learnedRegister(priors: Priors, key: string): LearnedRegister {
  const chips = priors[key];
  if (!chips) return { register: {}, learned: [] };

  const register: Partial<Register> = {};
  const learned: ChipKey[] = [];

  for (const chip of CHIP_KEYS) {
    const prior = chips[chip];
    if (!prior) continue;

    if (chip === 'tone') register.tone = Array.isArray(prior.value) ? prior.value : [prior.value];
    else register[chip] = prior.value as never;

    learned.push(chip);
  }

  return { register, learned };
}

export function withoutPrior(priors: Priors, key: string, chip: ChipKey): Priors {
  const next: Priors = { ...priors };
  const chips = { ...(next[key] ?? {}) };

  delete chips[chip];
  if (Object.keys(chips).length === 0) delete next[key];
  else next[key] = chips;

  return next;
}
