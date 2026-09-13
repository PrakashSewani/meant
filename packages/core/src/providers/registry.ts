import type { Effort, Tier } from '../register/types';

export interface TierRefs {
  fast?: string;
  main?: string;
  reasoning?: string;
}

export const TIER_FOR_EFFORT: Record<Effort, Tier> = {
  quick: 'fast',
  balanced: 'main',
  deep: 'reasoning',
};

const FALLBACK_ORDER: Record<Tier, readonly Tier[]> = {
  fast: ['fast', 'main', 'reasoning'],
  main: ['main', 'fast', 'reasoning'],
  reasoning: ['reasoning', 'main', 'fast'],
};

export function parseModelRef(ref: string): { providerId: string; modelId: string } | undefined {
  const separator = ref.indexOf('/');
  if (separator <= 0 || separator === ref.length - 1) return undefined;

  return { providerId: ref.slice(0, separator), modelId: ref.slice(separator + 1) };
}

export function formatModelRef(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

export function resolveTierRef(effort: Effort, refs: TierRefs): string | undefined {
  for (const tier of FALLBACK_ORDER[TIER_FOR_EFFORT[effort]]) {
    const ref = refs[tier];
    if (ref) return ref;
  }
  return undefined;
}
