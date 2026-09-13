import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  PROVIDER_ORIGINS,
  defaultConfigFor,
  presetFor,
  presetOrigin,
  tierRefsFor,
} from './presets.ts';
import { validateConfig } from './schema.ts';

describe('presets', () => {
  it('uses unique lowercase ids', () => {
    const ids = PRESETS.map((preset) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('generates a config that parses, for every preset', () => {
    for (const preset of PRESETS) {
      const result = validateConfig(defaultConfigFor(preset));
      expect(result.ok, `${preset.id} should generate a valid config`).toBe(true);
    }
  });

  it('keeps every origin https or loopback', () => {
    for (const preset of PRESETS) {
      const origin = presetOrigin(preset);
      const loopback = /^http:\/\/(localhost|127\.0\.0\.1)\/\*$/.test(origin);

      expect(origin.startsWith('https://') || loopback, `${preset.id} → ${origin}`).toBe(true);
    }
  });

  it('marks local presets as local, keyless, and loopback', () => {
    for (const preset of PRESETS.filter((candidate) => candidate.local)) {
      expect(preset.auth).toBe('none');
      expect(presetOrigin(preset)).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)\/\*$/);
    }
  });

  it('gives hosted presets a key and at least one model', () => {
    for (const preset of PRESETS.filter((candidate) => !candidate.local)) {
      expect(preset.auth).toBe('apiKey');
      expect(preset.models.length).toBeGreaterThan(0);
    }
  });

  it('points tier refs at the preset itself', () => {
    for (const preset of PRESETS) {
      for (const ref of Object.values(tierRefsFor(preset))) {
        expect(ref?.startsWith(`${preset.id}/`)).toBe(true);
      }
    }
  });

  it('declares each origin once — a manifest may not repeat itself', () => {
    expect(new Set(PROVIDER_ORIGINS).size).toBe(PROVIDER_ORIGINS.length);
    expect(PROVIDER_ORIGINS.length).toBeGreaterThan(0);
    expect(PROVIDER_ORIGINS).toContain('http://localhost/*');
    expect(PROVIDER_ORIGINS).toContain('https://api.anthropic.com/*');
  });

  it('finds presets by id', () => {
    expect(presetFor('groq')?.name).toBe('Groq');
    expect(presetFor('nope')).toBeUndefined();
  });

  it('never ranks a provider above another — order is curated, not commercial', () => {
    expect(PRESETS[0]?.id).toBe('anthropic');
    expect(PRESETS.map((preset) => preset.id)).toEqual([
      'anthropic',
      'openai',
      'openrouter',
      'groq',
      'gemini',
      'deepseek',
      'ollama',
      'lmstudio',
      'llamacpp',
    ]);
  });
});
