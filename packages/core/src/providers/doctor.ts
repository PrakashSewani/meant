import { z } from 'zod';
import { ErrorKindSchema, classifyError, errorCopy, signalsFromError } from './errors';
import type { CompiledPrompt } from '../prompt/compile';
import type { ResolvedModel, TransformTransport } from './types';

export const DoctorResultSchema = z.object({
  ok: z.boolean(),
  kind: ErrorKindSchema.optional(),
  message: z.string().min(1),
  text: z.string().optional(),
});

export type DoctorResult = z.infer<typeof DoctorResultSchema>;

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
