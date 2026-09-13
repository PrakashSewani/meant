import { describe, expect, it } from 'vitest';
import { lintConfig, validateConfig } from './schema.ts';

const OPENCODE_SAMPLE = {
  $schema: 'https://opencode.ai/config.json',
  model: 'anthropic/claude-sonnet-5',
  small_model: 'anthropic/claude-haiku-4-5',
  reasoning_model: 'anthropic/claude-opus-5',
  provider: {
    anthropic: {
      options: { baseURL: 'https://api.anthropic.com/v1' },
      models: {
        'claude-sonnet-5': { name: 'Claude Sonnet 5', limit: { context: 200000, output: 8192 } },
      },
    },
  },
  mcp: { some: 'server' },
} as const;

describe('validateConfig', () => {
  it('accepts an OpenCode-shaped config, including the extension key', () => {
    const result = validateConfig(OPENCODE_SAMPLE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.reasoning_model).toBe('anthropic/claude-opus-5');
      expect(result.config.model).toBe('anthropic/claude-sonnet-5');
    }
  });

  it('rejects a baseURL that is not a URL', () => {
    const result = validateConfig({
      provider: { broken: { options: { baseURL: 'api.example.com' } } },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(' ')).toContain('provider.broken.options.baseURL');
  });

  it('rejects a negative context limit', () => {
    const result = validateConfig({
      provider: { p: { models: { m: { name: 'M', limit: { context: -1 } } } } },
    });

    expect(result.ok).toBe(false);
  });
});

describe('lintConfig', () => {
  it('flags a literal key in the shareable config', () => {
    const warnings = lintConfig({
      provider: { openai: { options: { apiKey: 'sk-live-abc' } } },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('key-in-config');
    expect(warnings[0]?.path).toBe('provider.openai.options.apiKey');
  });

  it('says out loud which OpenCode keys were ignored', () => {
    const warnings = lintConfig({ mcp: {}, agent: {} });

    expect(warnings.map((warning) => warning.path)).toEqual(['mcp', 'agent']);
    expect(warnings[0]?.message).toContain('ignores');
  });

  it('stays quiet for a clean config', () => {
    expect(
      lintConfig({ provider: { anthropic: { options: { baseURL: 'https://x.dev' } } } }),
    ).toEqual([]);
  });

  it('survives nonsense input', () => {
    expect(lintConfig(null)).toEqual([]);
    expect(lintConfig('nope')).toEqual([]);
    expect(lintConfig({ provider: 'nope' })).toEqual([]);
  });
});
