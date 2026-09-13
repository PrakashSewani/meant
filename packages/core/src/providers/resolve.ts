import type { Effort } from '../register/types';
import { TIER_FOR_EFFORT, parseModelRef, resolveTierRef, type TierRefs } from './registry';
import type { ResolvedModel, TransportId } from './types';

export interface ProviderEntry {
  npm?: string;
  options?: {
    baseURL?: string;
    headers?: Record<string, string>;
  };
}

export interface ResolveModelInput {
  refs: TierRefs;
  providers: Record<string, ProviderEntry> | undefined;
  secrets: Record<string, string>;
  disabledProviders?: readonly string[];
  effort: Effort;
}

/**
 * Turns stored configuration into the single model a transform will use. This is the only place
 * that joins a key to a model, and it runs in the worker — never in a content script.
 */
export function resolveModel({
  refs,
  providers,
  secrets,
  disabledProviders = [],
  effort,
}: ResolveModelInput): ResolvedModel | undefined {
  const ref = resolveTierRef(effort, usableRefs(refs, disabledProviders));
  const parts = ref ? parseModelRef(ref) : undefined;
  if (!parts) return undefined;

  const provider = providers?.[parts.providerId];
  const model: ResolvedModel = {
    providerId: parts.providerId,
    modelId: parts.modelId,
    tier: TIER_FOR_EFFORT[effort],
    transport: transportFor(parts.providerId, provider?.npm),
  };

  if (provider?.options?.baseURL) model.baseURL = provider.options.baseURL;
  if (provider?.options?.headers) model.headers = provider.options.headers;

  const apiKey = secrets[parts.providerId];
  if (apiKey) model.apiKey = apiKey;

  return model;
}

export function transportFor(providerId: string, npm?: string): TransportId {
  if (npm === '@ai-sdk/anthropic') return 'anthropic';
  if (npm === '@ai-sdk/openai-compatible') return 'openai-compatible';

  return providerId === 'anthropic' ? 'anthropic' : 'openai-compatible';
}

/** A disabled provider stops being a candidate, so the tier falls through to the next option. */
function usableRefs(refs: TierRefs, disabled: readonly string[]): TierRefs {
  if (disabled.length === 0) return refs;

  const usable: TierRefs = {};
  for (const tier of ['fast', 'main', 'reasoning'] as const) {
    const ref = refs[tier];
    const providerId = ref ? parseModelRef(ref)?.providerId : undefined;

    if (ref && providerId && !disabled.includes(providerId)) usable[tier] = ref;
  }

  return usable;
}
