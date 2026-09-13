import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { StreamRequest, TransformTransport } from '../providers/types';
import { textDeltas } from './stream';

export function openAICompatibleTransport(): TransformTransport {
  return {
    id: 'openai-compatible',
    async *stream({ prompt, model, signal }: StreamRequest) {
      // This transport has no default endpoint — a provider without one cannot be called, and
      // saying so beats a request to nowhere.
      if (!model.baseURL) {
        throw new Error(`${model.providerId} has no base URL configured. Add one in Settings.`);
      }

      const provider = createOpenAICompatible({
        name: model.providerId,
        baseURL: model.baseURL,
        apiKey: model.apiKey,
        headers: model.headers,
      });

      const result = streamText({
        model: provider.chatModel(model.modelId),
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
