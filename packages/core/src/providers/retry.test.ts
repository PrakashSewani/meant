import { describe, expect, it, vi } from 'vitest';
import { streamWithRetries } from './retry';
import type { CompiledPrompt } from '../prompt/compile';
import type { ResolvedModel, TransformTransport } from './types';

const PROMPT: CompiledPrompt = { system: 'rewrite', user: 'ugh the deploy slipped' };
const MODEL: ResolvedModel = {
  providerId: 'test',
  modelId: 'test-model',
  tier: 'main',
  transport: 'openai-compatible',
};

/** Fails the given number of times, then streams. */
function flakyTransport(failures: number, error: unknown): TransformTransport {
  let calls = 0;

  return {
    id: 'openai-compatible',
    async *stream() {
      calls += 1;
      if (calls <= failures) throw error;

      yield 'fixed';
      yield ' up';
    },
  };
}

const noWait = () => Promise.resolve();

describe('streamWithRetries', () => {
  it('retries a transient failure and delivers the answer', async () => {
    const chunks: string[] = [];
    const transport = flakyTransport(
      2,
      Object.assign(new Error('Rate limited'), { statusCode: 429 }),
    );

    await streamWithRetries({
      transport,
      prompt: PROMPT,
      model: MODEL,
      onChunk: (chunk) => chunks.push(chunk),
      wait: noWait,
    });

    expect(chunks.join('')).toBe('fixed up');
  });

  it('gives up on a permanent failure instead of hammering the provider', async () => {
    const wait = vi.fn(noWait);
    const transport = flakyTransport(
      9,
      Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
    );

    await expect(
      streamWithRetries({ transport, prompt: PROMPT, model: MODEL, onChunk: () => {}, wait }),
    ).rejects.toThrow();

    expect(wait).not.toHaveBeenCalled();
  });

  it('stops retrying once text has been shown, rather than starting over', async () => {
    const chunks: string[] = [];
    let calls = 0;

    const transport: TransformTransport = {
      id: 'openai-compatible',
      async *stream() {
        calls += 1;
        yield 'half an answer';
        throw Object.assign(new Error('Failed to fetch'), { code: 'ECONNRESET' });
      },
    };

    await expect(
      streamWithRetries({
        transport,
        prompt: PROMPT,
        model: MODEL,
        onChunk: (chunk) => chunks.push(chunk),
        wait: noWait,
      }),
    ).rejects.toThrow();

    expect(calls).toBe(1);
    expect(chunks).toEqual(['half an answer']);
  });

  it('gives up after the retry budget', async () => {
    const transport = flakyTransport(9, Object.assign(new Error('Failed to fetch'), {}));
    const wait = vi.fn(noWait);

    await expect(
      streamWithRetries({ transport, prompt: PROMPT, model: MODEL, onChunk: () => {}, wait }),
    ).rejects.toThrow();

    expect(wait).toHaveBeenCalledTimes(2);
  });
});
