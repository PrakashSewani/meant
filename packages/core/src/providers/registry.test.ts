import { describe, expect, it } from 'vitest';
import { formatModelRef, parseModelRef, resolveTierRef, TIER_FOR_EFFORT } from './registry';

describe('parseModelRef', () => {
  it('splits provider from model', () => {
    expect(parseModelRef('anthropic/claude-sonnet-5')).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-5',
    });
  });

  it('keeps slugs in the model id intact', () => {
    expect(parseModelRef('openrouter/z-ai/glm-5.1')).toEqual({
      providerId: 'openrouter',
      modelId: 'z-ai/glm-5.1',
    });
  });

  it('rejects refs with no model', () => {
    expect(parseModelRef('anthropic/')).toBeUndefined();
    expect(parseModelRef('/sonnet')).toBeUndefined();
    expect(parseModelRef('sonnet')).toBeUndefined();
  });
});

describe('formatModelRef', () => {
  it('round-trips with parseModelRef', () => {
    const ref = formatModelRef('groq', 'openai/gpt-oss-120b');

    expect(parseModelRef(ref)).toEqual({ providerId: 'groq', modelId: 'openai/gpt-oss-120b' });
  });
});

describe('resolveTierRef', () => {
  it('maps Effort to a tier', () => {
    expect(TIER_FOR_EFFORT).toEqual({ quick: 'fast', balanced: 'main', deep: 'reasoning' });
  });

  it('prefers the tier the effort asked for', () => {
    const refs = { fast: 'groq/llama-3.3-70b-versatile', main: 'anthropic/claude-sonnet-5' };

    expect(resolveTierRef('quick', refs)).toBe(refs.fast);
    expect(resolveTierRef('balanced', refs)).toBe(refs.main);
  });

  it('falls back when a provider has no model for that tier', () => {
    const refs = { fast: 'groq/llama-3.3-70b-versatile', main: 'anthropic/claude-sonnet-5' };

    expect(resolveTierRef('deep', refs)).toBe(refs.main);
  });

  it('returns nothing when no tier is configured', () => {
    expect(resolveTierRef('quick', {})).toBeUndefined();
  });
});
