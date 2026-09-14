import { describe, expect, it } from 'vitest';
import { modelFailureCopy, resolveModel, resolveModelOrReason, transportFor } from './resolve';

const REFS = {
  fast: 'groq/llama-3.3-70b-versatile',
  main: 'anthropic/claude-sonnet-5',
  reasoning: 'anthropic/claude-opus-5',
};

const PROVIDERS = {
  anthropic: {
    options: { baseURL: 'https://api.anthropic.com/v1' },
    models: {},
  },
  groq: { options: {} },
};

describe('resolveModel', () => {
  it('maps the effort to the tier the config declares', () => {
    const model = resolveModel({ refs: REFS, providers: PROVIDERS, secrets: {}, effort: 'quick' });

    expect(model).toMatchObject({
      providerId: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      tier: 'fast',
    });
  });

  it('carries the base URL, the headers, and the key', () => {
    const model = resolveModel({
      refs: REFS,
      providers: {
        anthropic: {
          options: {
            baseURL: 'https://gateway.example/anthropic',
            headers: { 'x-org': 'acme' },
          },
        },
      },
      secrets: { anthropic: 'sk-ant-test' },
      effort: 'balanced',
    });

    expect(model).toMatchObject({
      providerId: 'anthropic',
      baseURL: 'https://gateway.example/anthropic',
      headers: { 'x-org': 'acme' },
      apiKey: 'sk-ant-test',
      transport: 'anthropic',
    });
  });

  it('leaves the key off a local provider instead of inventing one', () => {
    const model = resolveModel({
      refs: { main: 'ollama/qwen3-coder' },
      providers: { ollama: { options: { baseURL: 'http://localhost:11434/v1' } } },
      secrets: {},
      effort: 'balanced',
    });

    expect(model?.apiKey).toBeUndefined();
    expect(model?.transport).toBe('openai-compatible');
  });

  it('honours the disabled list', () => {
    const model = resolveModel({
      refs: REFS,
      providers: PROVIDERS,
      secrets: {},
      disabledProviders: ['groq'],
      effort: 'quick',
    });

    expect(model?.providerId).toBe('anthropic');
  });

  it('returns nothing when no tier is configured', () => {
    expect(
      resolveModel({ refs: {}, providers: {}, secrets: {}, effort: 'balanced' }),
    ).toBeUndefined();
  });

  it('falls back a tier that is not configured', () => {
    const model = resolveModel({
      refs: { main: 'anthropic/claude-sonnet-5' },
      providers: PROVIDERS,
      secrets: {},
      effort: 'deep',
    });

    expect(model).toMatchObject({ modelId: 'claude-sonnet-5', tier: 'reasoning' });
  });
});

describe('resolveModelOrReason', () => {
  it('says nothing is configured rather than inventing a model', () => {
    expect(
      resolveModelOrReason({ refs: {}, providers: undefined, secrets: {}, effort: 'balanced' }),
    ).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('tells a provider with no model apart from no provider at all', () => {
    // What the LM Studio and llama.cpp presets store: a provider block, and no model ids.
    expect(
      resolveModelOrReason({
        refs: {},
        providers: { lmstudio: { options: { baseURL: 'http://127.0.0.1:1234/v1' } } },
        secrets: {},
        effort: 'balanced',
      }),
    ).toEqual({ ok: false, reason: 'no-model' });
  });

  it('reports a reference that is not provider/model', () => {
    expect(
      resolveModelOrReason({
        refs: { main: 'gpt-5.2' },
        providers: { openai: { options: { baseURL: 'https://api.openai.com/v1' } } },
        secrets: {},
        effort: 'balanced',
      }),
    ).toEqual({ ok: false, reason: 'bad-ref', ref: 'gpt-5.2' });
  });

  it('reports a reference to a provider that is not configured', () => {
    expect(
      resolveModelOrReason({
        refs: { main: 'acme/gpt-5.2' },
        providers: { openai: { options: { baseURL: 'https://api.openai.com/v1' } } },
        secrets: {},
        effort: 'balanced',
      }),
    ).toEqual({ ok: false, reason: 'unknown-provider', providerId: 'acme' });
  });
});

describe('modelFailureCopy', () => {
  it('names the reference the user has to fix', () => {
    expect(modelFailureCopy({ ok: false, reason: 'bad-ref', ref: 'gpt-5.2' })).toContain('gpt-5.2');
    expect(
      modelFailureCopy({ ok: false, reason: 'unknown-provider', providerId: 'acme' }),
    ).toContain('acme');
    expect(modelFailureCopy({ ok: false, reason: 'no-model' })).toContain('Settings');
    expect(modelFailureCopy({ ok: false, reason: 'not-configured' })).toContain('No provider');
  });
});

describe('transportFor', () => {
  it('reads the transport hint the config carries', () => {
    expect(transportFor('custom', '@ai-sdk/anthropic')).toBe('anthropic');
    expect(transportFor('custom', '@ai-sdk/openai-compatible')).toBe('openai-compatible');
  });

  it('assumes the OpenAI shape when there is no hint', () => {
    expect(transportFor('groq')).toBe('openai-compatible');
    expect(transportFor('openrouter')).toBe('openai-compatible');
    expect(transportFor('anthropic')).toBe('anthropic');
  });
});
