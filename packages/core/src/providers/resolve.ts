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
 * Why a model could not be produced. Each one is a different situation with a different fix, and
 * collapsing them into "no model" is what turns a misconfigured provider into a silent fake answer.
 */
export type ModelResolution =
  | { ok: true; model: ResolvedModel }
  | { ok: false; reason: 'not-configured' | 'no-model' }
  | { ok: false; reason: 'bad-ref'; ref: string }
  | { ok: false; reason: 'unknown-provider'; providerId: string };

/**
 * Turns stored configuration into the single model a transform will use, or says what is missing.
 * This is the only place that joins a key to a model, and it runs in the worker — never in a
 * content script.
 */
export function resolveModelOrReason(input: ResolveModelInput): ModelResolution {
  const { refs, providers, disabledProviders = [] } = input;
  const ref = resolveTierRef(input.effort, usableRefs(refs, disabledProviders));

  if (!ref) {
    // A fresh install and a provider the user has not finished setting up are both "no ref", and
    // telling them apart is the difference between an honest demo and a fabricated answer.
    return providers && Object.keys(providers).length > 0
      ? { ok: false, reason: 'no-model' }
      : { ok: false, reason: 'not-configured' };
  }

  const parts = parseModelRef(ref);
  if (!parts) return { ok: false, reason: 'bad-ref', ref };

  const provider = providers?.[parts.providerId];
  // Without a provider block there is no base URL to call, so a model ref alone is not a model.
  if (!provider) return { ok: false, reason: 'unknown-provider', providerId: parts.providerId };

  return { ok: true, model: modelFor(parts, provider, input) };
}

export function resolveModel(input: ResolveModelInput): ResolvedModel | undefined {
  const resolution = resolveModelOrReason(input);

  return resolution.ok ? resolution.model : undefined;
}

export function modelFailureCopy(failure: Extract<ModelResolution, { ok: false }>): string {
  switch (failure.reason) {
    case 'not-configured':
      return 'No provider is configured yet. Add a key or run a local model in Settings.';
    case 'no-model':
      return 'No model is set for this effort. Add a model id in Settings.';
    case 'bad-ref':
      return `“${failure.ref}” is not a provider/model reference. Fix it in Settings.`;
    case 'unknown-provider':
      return `No provider named “${failure.providerId}” is configured. Add it in Settings.`;
  }
}

export function transportFor(providerId: string, npm?: string): TransportId {
  if (npm === '@ai-sdk/anthropic') return 'anthropic';
  if (npm === '@ai-sdk/openai-compatible') return 'openai-compatible';

  return providerId === 'anthropic' ? 'anthropic' : 'openai-compatible';
}

function modelFor(
  parts: { providerId: string; modelId: string },
  provider: ProviderEntry,
  { secrets, effort }: ResolveModelInput,
): ResolvedModel {
  const model: ResolvedModel = {
    providerId: parts.providerId,
    modelId: parts.modelId,
    tier: TIER_FOR_EFFORT[effort],
    transport: transportFor(parts.providerId, provider.npm),
  };

  if (provider.options?.baseURL) model.baseURL = provider.options.baseURL;
  if (provider.options?.headers) model.headers = provider.options.headers;

  const apiKey = secrets[parts.providerId];
  if (apiKey) model.apiKey = apiKey;

  return model;
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
