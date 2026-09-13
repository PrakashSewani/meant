import { classifyError, signalsFromError } from './errors';
import type { CompiledPrompt } from '../prompt/compile';
import type { ResolvedModel, TransformTransport } from './types';

export interface StreamOptions {
  transport: TransformTransport;
  prompt: CompiledPrompt;
  model: ResolvedModel;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  /** Injected so tests do not wait in real time. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const RETRY_DELAYS = [500, 1500] as const;

/**
 * The transports deliberately run with retries off, so the policy lives here where it can be seen
 * and explained. Two things matter: only transient failures are retried, and never after text has
 * been shown — a retry would append a second copy of an answer the user is already reading.
 */
export async function streamWithRetries({
  transport,
  prompt,
  model,
  signal,
  onChunk,
  wait = delay,
}: StreamOptions): Promise<void> {
  let streamed = false;
  let attempt = 0;

  for (;;) {
    try {
      for await (const chunk of transport.stream({ prompt, model, signal })) {
        streamed = true;
        onChunk(chunk);
      }
      return;
    } catch (error) {
      const { kind, retryable } = classifyError(signalsFromError(error));
      const giveUp = streamed || !retryable || attempt >= RETRY_DELAYS.length;

      if (giveUp) {
        throw Object.assign(error instanceof Error ? error : new Error(kind), { kind });
      }

      await wait(RETRY_DELAYS[attempt] ?? 1500, signal);
      attempt += 1;
    }
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }

    setTimeout(resolve, ms);
  });
}
