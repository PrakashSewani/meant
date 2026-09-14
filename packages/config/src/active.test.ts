import { describe, expect, it } from 'vitest';
import {
  ACTIVE_CONFIG_KEY,
  CONFIGS_KEY,
  LEGACY_CONFIG_KEY,
  adoptLegacyConfig,
  configLibrary,
  nextConfigId,
  readActiveConfig,
  type MeantConfig,
} from './index.ts';

const ANTHROPIC: MeantConfig = {
  model: 'anthropic/claude-sonnet-5',
  small_model: 'anthropic/claude-haiku-4-5',
  provider: {
    anthropic: {
      name: 'Anthropic',
      options: { baseURL: 'https://api.anthropic.com/v1' },
      models: { 'claude-sonnet-5': { name: 'Claude Sonnet 5' } },
    },
  },
};

const LOCAL: MeantConfig = {
  model: 'ollama/qwen3-coder',
  provider: {
    ollama: {
      name: 'Ollama (local)',
      options: { baseURL: 'http://localhost:11434/v1' },
      models: { 'qwen3-coder': { name: 'Qwen3 Coder' } },
    },
  },
};

function library(...entries: [string, MeantConfig][]): Record<string, unknown> {
  return {
    [CONFIGS_KEY]: Object.fromEntries(entries.map(([id, config]) => [id, { name: id, config }])),
  };
}

describe('readActiveConfig', () => {
  it('reads the entry the active id points at', () => {
    const result = readActiveConfig({
      ...library(['work', ANTHROPIC], ['local', LOCAL]),
      [ACTIVE_CONFIG_KEY]: 'local',
    });

    expect(result).toEqual({ ok: true, config: LOCAL, source: 'library' });
  });

  it('follows the active id rather than the first entry', () => {
    const result = readActiveConfig({
      ...library(['work', ANTHROPIC], ['local', LOCAL]),
      [ACTIVE_CONFIG_KEY]: 'work',
    });

    expect(result.ok && result.config.model).toBe('anthropic/claude-sonnet-5');
  });

  it('falls back to the pre-library config so nothing saved earlier breaks', () => {
    expect(readActiveConfig({ [LEGACY_CONFIG_KEY]: ANTHROPIC })).toEqual({
      ok: true,
      config: ANTHROPIC,
      source: 'legacy',
    });
  });

  it('lets the library win over a config still lying around from before', () => {
    const result = readActiveConfig({
      ...library(['local', LOCAL]),
      [ACTIVE_CONFIG_KEY]: 'local',
      [LEGACY_CONFIG_KEY]: ANTHROPIC,
    });

    expect(result).toEqual({ ok: true, config: LOCAL, source: 'library' });
  });

  it('says nothing is configured rather than nothing is selected', () => {
    expect(readActiveConfig({})).toEqual({ ok: false, reason: 'missing' });
  });

  it('reports an unreadable config as unreadable', () => {
    const result = readActiveConfig({ [LEGACY_CONFIG_KEY]: { model: 42 } });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('invalid');
  });

  it('reports a selected config that no longer parses', () => {
    const result = readActiveConfig({
      [CONFIGS_KEY]: { work: { name: 'Work', config: { model: 42 } } },
      [ACTIVE_CONFIG_KEY]: 'work',
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('invalid');
    expect(result.ok === false && result.reason === 'invalid' && result.issues.length > 0).toBe(
      true,
    );
  });

  it('reports an id that points at nothing as no selection', () => {
    expect(
      readActiveConfig({ ...library(['work', ANTHROPIC]), [ACTIVE_CONFIG_KEY]: 'gone' }),
    ).toEqual({ ok: false, reason: 'no-active' });
  });

  it('reports a library with no selection as no selection', () => {
    expect(readActiveConfig(library(['work', ANTHROPIC]))).toEqual({
      ok: false,
      reason: 'no-active',
    });
  });

  it('treats an empty library as no library at all', () => {
    expect(readActiveConfig({ [CONFIGS_KEY]: {}, [LEGACY_CONFIG_KEY]: ANTHROPIC })).toEqual({
      ok: true,
      config: ANTHROPIC,
      source: 'legacy',
    });
  });
});

describe('configLibrary', () => {
  it('names an entry after its provider when it has no name of its own', () => {
    const [entry] = configLibrary({ [CONFIGS_KEY]: { a: { config: LOCAL } } });

    expect(entry).toMatchObject({ id: 'a', name: 'Ollama (local)', config: LOCAL });
  });

  it('leaves out an entry that will not parse instead of throwing', () => {
    const entries = configLibrary({
      [CONFIGS_KEY]: { good: { config: LOCAL }, bad: { config: { provider: 'nope' } } },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['good']);
  });

  it('shrugs at storage that is not a library', () => {
    expect(configLibrary({ [CONFIGS_KEY]: 'nope' })).toEqual([]);
    expect(configLibrary({})).toEqual([]);
  });
});

describe('adoptLegacyConfig', () => {
  it('takes the saved config into the library under a name', () => {
    expect(adoptLegacyConfig({ [LEGACY_CONFIG_KEY]: ANTHROPIC })).toEqual({
      configs: { default: { name: 'Anthropic', config: ANTHROPIC } },
      activeConfig: 'default',
    });
  });

  it('does nothing when a library already exists', () => {
    expect(
      adoptLegacyConfig({ ...library(['work', ANTHROPIC]), [LEGACY_CONFIG_KEY]: LOCAL }),
    ).toBeUndefined();
  });

  it('does nothing when there is nothing worth adopting', () => {
    expect(adoptLegacyConfig({})).toBeUndefined();
    expect(adoptLegacyConfig({ [LEGACY_CONFIG_KEY]: { model: 42 } })).toBeUndefined();
  });
});

describe('nextConfigId', () => {
  it('slugs the name into something usable as a key', () => {
    expect(nextConfigId('Work Gateway', [])).toBe('work-gateway');
    expect(nextConfigId('  Anthropic  ', [])).toBe('anthropic');
  });

  it('avoids a collision instead of overwriting', () => {
    expect(nextConfigId('ollama', ['ollama'])).toBe('ollama-2');
    expect(nextConfigId('ollama', ['ollama', 'ollama-2'])).toBe('ollama-3');
  });

  it('still produces an id from a name with nothing usable in it', () => {
    expect(nextConfigId('***', [])).toBe('config');
  });
});
