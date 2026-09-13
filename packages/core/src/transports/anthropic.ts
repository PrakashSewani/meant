import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { StreamRequest, TransformTransport } from '../providers/types';
import { textDeltas } from './stream';

const BROWSER_ACCESS_HEADER = 'anthropic-dangerous-direct-browser-access';

export function anthropicTransport(): TransformTransport {
  return {
    id: 'anthropic',
    async *stream({ prompt, model, signal }: StreamRequest) {
      const provider = createAnthropic({
        apiKey: model.apiKey,
        baseURL: model.baseURL,
        // Anthropic refuses browser origins unless the request opts in. The caller here is the
        // extension worker, not a page, and the key never leaves it.
        headers: { [BROWSER_ACCESS_HEADER]: 'true', ...model.headers },
      });

      const result = streamText({
        model: provider(model.modelId),
        system: prompt.system,
        prompt: prompt.user,
        abortSignal: signal,
        // Retry policy belongs to the worker, where it can be seen and explained (ARCHITECTURE §2).
        maxRetries: 0,
      });

      yield* textDeltas(result.fullStream);
    },
  };
}
