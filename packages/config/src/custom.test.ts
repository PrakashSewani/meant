import { describe, expect, it } from 'vitest';
import { customProviderConfig, isValidProviderId, originPatternFor } from './custom.ts';
import { validateConfig } from './schema.ts';

const INPUT = {
  id: 'commandcode',
  name: 'Command Code',
  baseURL: 'https://api.commandcode.ai/v1',
  models: { main: 'gpt-5.2', fast: 'gpt-5-mini' },
};

describe('customProviderConfig', () => {
  it('builds a config the schema accepts', () => {
    const result = validateConfig(customProviderConfig(INPUT));

    expect(result.ok).toBe(true);
  });

  it('points the tiers at the provider the user described', () => {
    const config = customProviderConfig(INPUT);

    expect(config.model).toBe('commandcode/gpt-5.2');
    expect(config.small_model).toBe('commandcode/gpt-5-mini');
    expect(config.reasoning_model).toBeUndefined();
    expect(config.provider?.commandcode?.options?.baseURL).toBe('https://api.commandcode.ai/v1');
    expect(config.provider?.commandcode?.npm).toBe('@ai-sdk/openai-compatible');
  });

  it('registers every model id it was given, so the picker can show them', () => {
    const config = customProviderConfig({
      ...INPUT,
      models: { main: 'gpt-5.2', fast: 'gpt-5-mini', reasoning: 'o3' },
    });

    expect(Object.keys(config.provider?.commandcode?.models ?? {})).toEqual([
      'gpt-5.2',
      'gpt-5-mini',
      'o3',
    ]);
    expect(config.reasoning_model).toBe('commandcode/o3');
  });
});

describe('isValidProviderId', () => {
  it('accepts what a model ref can carry', () => {
    expect(isValidProviderId('commandcode')).toBe(true);
    expect(isValidProviderId('my-gateway')).toBe(true);
  });

  it('rejects ids that would break a ref or a config key', () => {
    expect(isValidProviderId('Command Code')).toBe(false);
    expect(isValidProviderId('9lives')).toBe(false);
    expect(isValidProviderId('has/slash')).toBe(false);
    expect(isValidProviderId('')).toBe(false);
  });
});

describe('originPatternFor', () => {
  it('turns a base URL into the origin to request', () => {
    expect(originPatternFor('https://api.commandcode.ai/v1')).toBe('https://api.commandcode.ai/*');
    expect(originPatternFor('http://localhost:11434/v1')).toBe('http://localhost/*');
  });
});
