import { z } from 'zod';
import { EffortSchema, RegisterSchema } from './register/schemas';
import type { Register } from './register/types';

export const CHIP_KEYS = ['who', 'tone', 'format', 'length'] as const;

export type ChipKey = (typeof CHIP_KEYS)[number];

/**
 * Register metadata only — never the text. It exists so accept rate is a number rather than a
 * feeling, and so corrections can become priors (D-005). Local, capped, wipeable, never sent.
 */
export const TransformEventSchema = z.object({
  at: z.number().int().nonnegative(),
  surface: z.string().min(1),
  fieldRole: z.string().min(1).optional(),
  recipeId: z.string().min(1).optional(),
  effort: EffortSchema,
  inferred: RegisterSchema,
  sent: RegisterSchema,
  accepted: z.boolean(),
  corrections: z.array(z.enum(CHIP_KEYS)),
});

export type TransformEvent = z.infer<typeof TransformEventSchema>;

export const RecordEventMessageSchema = z.object({
  type: z.literal('event'),
  event: TransformEventSchema,
});

export const EVENTS_LIMIT = 200;

export const EventLogSchema = z.array(TransformEventSchema);

/** Anything unreadable in the log is treated as an empty log, never as a crash. */
export function readEvents(raw: unknown): TransformEvent[] {
  const parsed = EventLogSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export interface EventSummary {
  shown: number;
  accepted: number;
  acceptRate?: number;
  corrections: Partial<Record<ChipKey, number>>;
}

export function correctionsBetween(inferred: Register, sent: Register): ChipKey[] {
  return CHIP_KEYS.filter((key) => normalize(inferred[key]) !== normalize(sent[key]));
}

export function appendEvent(
  events: readonly TransformEvent[],
  event: TransformEvent,
): TransformEvent[] {
  return [...events, event].slice(-EVENTS_LIMIT);
}

export function summarizeEvents(events: readonly TransformEvent[], since = 0): EventSummary {
  const recent = events.filter((event) => event.at >= since);
  const accepted = recent.filter((event) => event.accepted).length;
  const corrections: Partial<Record<ChipKey, number>> = {};

  for (const event of recent) {
    for (const key of event.corrections) corrections[key] = (corrections[key] ?? 0) + 1;
  }

  return {
    shown: recent.length,
    accepted,
    acceptRate: recent.length > 0 ? accepted / recent.length : undefined,
    corrections,
  };
}

function normalize(value: string | string[] | undefined): string {
  // Tone is a set: reordering it is not a correction, and neither is case.
  const text = Array.isArray(value) ? [...value].sort().join(',') : (value ?? '');
  return text.trim().toLowerCase();
}
