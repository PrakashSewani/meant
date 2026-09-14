import type { MeantConfig } from './schema.ts';
import { validateConfig } from './schema.ts';

/** The library of saved configurations, keyed by id. */
export const CONFIGS_KEY = 'meant.configs';
/** Which library entry is live. */
export const ACTIVE_CONFIG_KEY = 'meant.activeConfig';
/** The pre-library key. Still read, so a config saved before this existed keeps working. */
export const LEGACY_CONFIG_KEY = 'meant.config';

/** One saved configuration, as the app reads it. */
export interface ConfigEntry {
  id: string;
  name: string;
  config: MeantConfig;
}

/** One saved configuration, as it is written. Keys never live here — they are shared by provider id. */
export interface StoredConfigEntry {
  name: string;
  config: MeantConfig;
}

/** The storage these functions read: `meant.configs`, `meant.activeConfig`, and `meant.config`. */
export type StoredConfigs = Record<string, unknown>;

export type ActiveConfigResult =
  | { ok: true; config: MeantConfig; source: 'library' | 'legacy' }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'invalid'; issues: readonly string[] }
  | { ok: false; reason: 'no-active' };

export function readActiveConfig(stored: StoredConfigs): ActiveConfigResult {
  const raw = stored[CONFIGS_KEY];
  const hasLibrary = isRecord(raw) && Object.keys(raw).length > 0;

  if (hasLibrary) {
    const id = stored[ACTIVE_CONFIG_KEY];
    if (typeof id !== 'string' || id.length === 0) return { ok: false, reason: 'no-active' };

    const entry = configLibrary(stored).find((candidate) => candidate.id === id);
    if (entry) return { ok: true, config: entry.config, source: 'library' };

    // An id that points at an entry which exists but does not parse is a different problem from an
    // id that points at nothing, and only one of them is answered by "pick a config".
    const issues = brokenEntry(stored, id);
    return issues ? { ok: false, reason: 'invalid', issues } : { ok: false, reason: 'no-active' };
  }

  const legacy = stored[LEGACY_CONFIG_KEY];
  if (legacy === undefined) return { ok: false, reason: 'missing' };

  const parsed = validateConfig(legacy);
  if (!parsed.ok) return { ok: false, reason: 'invalid', issues: parsed.issues };

  return { ok: true, config: parsed.config, source: 'legacy' };
}

/**
 * Every usable entry in the library, in the order it was saved. An entry whose config will not
 * parse is left out here and reported by `readActiveConfig` when it is the one that is selected.
 */
export function configLibrary(stored: StoredConfigs): ConfigEntry[] {
  const raw = stored[CONFIGS_KEY];
  if (!isRecord(raw)) return [];

  const entries: ConfigEntry[] = [];
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;

    const parsed = validateConfig(value.config);
    if (!parsed.ok) continue;

    entries.push({ id, name: nameOf(value.name, parsed.config), config: parsed.config });
  }

  return entries;
}

/**
 * Takes the single pre-library config into the library, once, so the setup someone already has
 * appears in the menu instead of being invisible. The caller writes the result and removes
 * `meant.config` in the same step: leaving the legacy key behind would resurrect a deleted config.
 */
export function adoptLegacyConfig(
  stored: StoredConfigs,
): { configs: Record<string, StoredConfigEntry>; activeConfig: string } | undefined {
  if (configLibrary(stored).length > 0) return undefined;

  const parsed = validateConfig(stored[LEGACY_CONFIG_KEY]);
  if (!parsed.ok) return undefined;

  const id = 'default';
  return {
    configs: { [id]: { name: nameOf(undefined, parsed.config), config: parsed.config } },
    activeConfig: id,
  };
}

/** A config id that is not taken yet. Ids stay boring: lowercase, dashes, no spaces. */
export function nextConfigId(base: string, taken: readonly string[]): string {
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'config';

  if (!taken.includes(slug)) return slug;

  let suffix = 2;
  while (taken.includes(`${slug}-${suffix}`)) suffix += 1;

  return `${slug}-${suffix}`;
}

function nameOf(raw: unknown, config: MeantConfig): string {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();

  return providerNameOf(config);
}

/** What a config is called when nobody named it: the provider's display name, then its id. */
function providerNameOf(config: MeantConfig): string {
  const [entry] = Object.entries(config.provider ?? {});

  return entry?.[1].name ?? entry?.[0] ?? 'Config';
}

function brokenEntry(stored: StoredConfigs, id: string): readonly string[] | undefined {
  const raw = stored[CONFIGS_KEY];
  if (!isRecord(raw)) return undefined;

  const entry = raw[id];
  if (entry === undefined) return undefined;
  if (!isRecord(entry) || entry.config === undefined) return ['config: missing'];

  const parsed = validateConfig(entry.config);
  return parsed.ok ? undefined : parsed.issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
