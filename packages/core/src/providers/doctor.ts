import { z } from 'zod';
import { ErrorKindSchema, classifyError, errorCopy, signalsFromError } from './errors';
import { resolveModel, type ProviderEntry } from './resolve';
import { EffortSchema } from '../register/schemas';
import type { Effort } from '../register/types';
import type { CompiledPrompt } from '../prompt/compile';
import type { TierRefs } from './registry';
import type { ResolvedModel, TransformTransport } from './types';

export const DoctorResultSchema = z.object({
  ok: z.boolean(),
  kind: ErrorKindSchema.optional(),
  message: z.string().min(1),
  text: z.string().optional(),
});

export type DoctorResult = z.infer<typeof DoctorResultSchema>;

export const DoctorCheckResultSchema = z.object({
  label: z.string().min(1),
  efforts: z.array(EffortSchema),
  ok: z.boolean(),
  kind: ErrorKindSchema.optional(),
  message: z.string().min(1),
});

export const DoctorReportSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1),
  checks: z.array(DoctorCheckResultSchema),
});

export type DoctorReport = z.infer<typeof DoctorReportSchema>;

const PING_PROMPT: CompiledPrompt = {
  system: 'Reply with the single word: ok',
  user: 'ping',
};

/** A probe, not a transform: stop reading even if a broken provider starts monologuing. */
const MAX_PROBE_CHARS = 64;

/**
 * One minimal call through the configured transport, so "why doesn't my key work" has an answer
 * instead of a guess. It reports the classified failure, not the raw provider error.
 */
export async function runDoctor(
  transport: TransformTransport,
  model: ResolvedModel,
  signal?: AbortSignal,
): Promise<DoctorResult> {
  try {
    let text = '';
    for await (const delta of transport.stream({ prompt: PING_PROMPT, model, signal })) {
      text += delta;
      if (text.length >= MAX_PROBE_CHARS) break;
    }

    const answer = text.trim();
    if (answer.length === 0) {
      return {
        ok: false,
        kind: 'model_missing',
        message: `${model.providerId} answered with nothing. Check the model id.`,
      };
    }

    return {
      ok: true,
      message: `Reached ${model.providerId} · ${model.modelId}.`,
      text: answer,
    };
  } catch (error) {
    const { kind } = classifyError(signalsFromError(error));
    return { ok: false, kind, message: errorCopy(kind, model.providerId) };
  }
}

export interface DoctorCheck {
  model: ResolvedModel;
  /** Every Effort that resolves to this model, so a shared fallback is reported once, honestly. */
  efforts: Effort[];
}

export interface DoctorPlanInput {
  refs: TierRefs;
  providers: Record<string, ProviderEntry> | undefined;
  secrets: Record<string, string>;
  disabledProviders?: readonly string[];
}

/**
 * One check per model the configuration actually reaches. A key is rarely the thing that is
 * wrong — a mistyped model id is — and that only shows up when the model is called.
 */
export function planDoctorChecks(input: DoctorPlanInput): DoctorCheck[] {
  const byModel = new Map<string, DoctorCheck>();

  for (const effort of ['quick', 'balanced', 'deep'] as const) {
    const model = resolveModel({ ...input, effort });
    if (!model) continue;

    const id = `${model.providerId}/${model.modelId}`;
    const existing = byModel.get(id);

    if (existing) existing.efforts.push(effort);
    else byModel.set(id, { model, efforts: [effort] });
  }

  return [...byModel.values()];
}

const EFFORT_LABEL: Record<Effort, string> = {
  quick: 'Quick',
  balanced: 'Balanced',
  deep: 'Deep',
};

function labelFor(check: DoctorCheck): string {
  const tiers =
    check.efforts.length === 3
      ? 'All tiers'
      : check.efforts.map((effort) => EFFORT_LABEL[effort]).join(' + ');

  return `${tiers} · ${check.model.providerId} · ${check.model.modelId}`;
}

export async function runDoctorReport(
  checks: readonly DoctorCheck[],
  transportFor: (model: ResolvedModel) => TransformTransport,
  signal?: AbortSignal,
): Promise<DoctorReport> {
  if (checks.length === 0) {
    return { ok: false, message: 'No provider is configured yet.', checks: [] };
  }

  const results: DoctorReport['checks'] = [];

  for (const check of checks) {
    const result = await runDoctor(transportFor(check.model), check.model, signal);
    const entry: DoctorReport['checks'][number] = {
      label: labelFor(check),
      efforts: [...check.efforts],
      ok: result.ok,
      message: result.message,
    };

    if (result.kind) entry.kind = result.kind;
    results.push(entry);
  }

  const failed = results.filter((result) => !result.ok).length;

  return {
    ok: failed === 0,
    message:
      failed === 0
        ? `All ${results.length} models answered.`
        : `${failed} of ${results.length} models failed.`,
    checks: results,
  };
}
