import type { ResolvedModel, TransformTransport } from '../providers/types';
import { anthropicTransport } from './anthropic';
import { openAICompatibleTransport } from './openai-compatible';

/**
 * Transports sit behind their own entry point so the content script never pulls the SDK in:
 * only the worker (and the doctor) may reach a provider.
 */
export function selectTransport(model: ResolvedModel): TransformTransport {
  return model.transport === 'anthropic' ? anthropicTransport() : openAICompatibleTransport();
}

export { anthropicTransport, openAICompatibleTransport };
