import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LABEL,
  Mark,
  THEME_KEY,
  ThemeSwitch,
  applyTheme,
  isDark,
  readTheme,
  systemPrefersDark,
  watchSystemTheme,
  type Theme,
} from '@meant/ui';
import { ConfigMenu, type NewConfigDraft } from '@meant/ui/config';
import {
  DoctorReportSchema,
  readPriors,
  withoutPrior,
  type ChipKey,
  type DoctorReport,
  type Priors,
} from '@meant/core';
import {
  ACTIVE_CONFIG_KEY,
  CONFIGS_KEY,
  LEGACY_CONFIG_KEY,
  PRESETS,
  adoptLegacyConfig,
  configLibrary,
  customProviderConfig,
  defaultConfigFor,
  nextConfigId,
  originPatternFor,
  presetFor,
  type ConfigEntry,
  type MeantConfig,
  type StoredConfigEntry,
} from '@meant/config';
import '@/lib/app.css';

const SECRETS_KEY = 'meant.secrets';
const PRIORS_KEY = 'meant.priors';

const PRESET_CHOICES = PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  notes: preset.notes,
  transport: preset.transport,
  local: preset.local,
}));

interface Stored {
  entries: ConfigEntry[];
  activeId?: string;
  secrets: Record<string, string>;
}

function Options() {
  const [stored, setStored] = useState<Stored>({ entries: [], secrets: {} });
  const [priors, setPriors] = useState<Priors>({});
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DoctorReport>();
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    void start();
  }, []);

  // `system` follows the OS as it changes; the other two ignore it.
  useEffect(() => {
    const paint = (chosen: Theme) =>
      applyTheme(document.documentElement, isDark(chosen, systemPrefersDark()));
    paint(theme);

    return theme === 'system' ? watchSystemTheme(() => paint('system')) : undefined;
  }, [theme]);

  // The popup can change the theme too, and this page should not sit there disagreeing with it.
  useEffect(() => {
    function onChanged(changes: Record<string, { newValue?: unknown }>) {
      const next = changes[THEME_KEY];
      if (next) setTheme(readTheme(next.newValue));
    }

    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  async function start() {
    // A config saved before the library existed is adopted once, so the menu shows what is
    // already working instead of an empty page.
    const before = await browser.storage.local.get([CONFIGS_KEY, LEGACY_CONFIG_KEY, THEME_KEY]);
    setTheme(readTheme(before[THEME_KEY]));

    const adopted = adoptLegacyConfig(before);
    if (adopted) {
      await browser.storage.local.set({
        [CONFIGS_KEY]: adopted.configs,
        [ACTIVE_CONFIG_KEY]: adopted.activeConfig,
      });
      await browser.storage.local.remove(LEGACY_CONFIG_KEY);
    }

    await refresh();
  }

  async function chooseTheme(next: Theme) {
    setTheme(next);
    await browser.storage.local.set({ [THEME_KEY]: next });
  }

  async function refresh(): Promise<Stored> {
    const raw = await browser.storage.local.get([
      CONFIGS_KEY,
      ACTIVE_CONFIG_KEY,
      SECRETS_KEY,
      PRIORS_KEY,
    ]);

    const next: Stored = {
      entries: configLibrary(raw),
      activeId: typeof raw[ACTIVE_CONFIG_KEY] === 'string' ? raw[ACTIVE_CONFIG_KEY] : undefined,
      secrets: readSecrets(raw[SECRETS_KEY]),
    };

    setStored(next);
    setPriors(readPriors(raw[PRIORS_KEY]));

    return next;
  }

  /**
   * Merges into the stored library rather than rebuilding it, so an entry this page could not
   * parse is left where it is instead of being quietly dropped on someone else's save.
   */
  async function writeLibrary(
    changes: { set?: Record<string, StoredConfigEntry>; remove?: readonly string[] },
    activeId: string | undefined,
  ) {
    const raw = await browser.storage.local.get(CONFIGS_KEY);
    const library: Record<string, unknown> = isRecord(raw[CONFIGS_KEY])
      ? { ...raw[CONFIGS_KEY] }
      : {};

    for (const [id, entry] of Object.entries(changes.set ?? {})) library[id] = entry;
    for (const id of changes.remove ?? []) delete library[id];

    await browser.storage.local.set({ [CONFIGS_KEY]: library });

    if (activeId === undefined) await browser.storage.local.remove(ACTIVE_CONFIG_KEY);
    else await browser.storage.local.set({ [ACTIVE_CONFIG_KEY]: activeId });
  }

  async function activate(id: string) {
    setBusy(true);
    try {
      await browser.storage.local.set({ [ACTIVE_CONFIG_KEY]: id });
      await refresh();
      setStatus('Switched. The next transform uses it.');
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string, entry: StoredConfigEntry) {
    setBusy(true);
    setStatus(undefined);

    try {
      const current = await refresh();
      await writeLibrary({ set: { [id]: entry } }, current.activeId);

      setStatus(await requestOrigin(entry.config));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const current = await refresh();
      const remaining = current.entries.filter((candidate) => candidate.id !== id);
      const activeId =
        current.activeId === id ? remaining[0]?.id : (current.activeId ?? remaining[0]?.id);

      await writeLibrary({ remove: [id] }, activeId);
      await refresh();
      setStatus(remaining.length === 0 ? 'That was the last config.' : 'Deleted.');
    } finally {
      setBusy(false);
    }
  }

  async function create(draft: NewConfigDraft) {
    setBusy(true);
    setStatus(undefined);

    try {
      const current = await refresh();
      const preset = draft.presetId ? presetFor(draft.presetId) : undefined;
      const providerId = preset?.id ?? nextConfigId(draft.name, []);

      const config = preset
        ? defaultConfigFor(preset)
        : customProviderConfig({
            id: providerId,
            name: draft.name,
            baseURL: draft.baseURL ?? '',
            models: { main: draft.model ?? '' },
          });

      // Two configs can share a provider; the provider id is what a key hangs off.
      const providerKey = Object.keys(config.provider ?? {})[0] ?? providerId;
      const id = nextConfigId(
        providerId,
        current.entries.map((entry) => entry.id),
      );

      if (draft.apiKey) await storeSecret(providerKey, draft.apiKey);

      await writeLibrary({ set: { [id]: { name: draft.name, config } } }, current.activeId ?? id);
      await refresh();

      setStatus(
        (await requestOrigin(config)) ??
          `${draft.name} is saved. Use it when you want the bar to call it.`,
      );
      await testConnection();
    } finally {
      setBusy(false);
    }
  }

  async function replaceKey(providerId: string, apiKey: string) {
    await storeSecret(providerId, apiKey);
    await refresh();
    setStatus(`Key saved for ${providerId}.`);
  }

  async function removeKey(providerId: string) {
    const raw = await browser.storage.local.get(SECRETS_KEY);
    const secrets = readSecrets(raw[SECRETS_KEY]);
    delete secrets[providerId];

    await browser.storage.local.set({ [SECRETS_KEY]: secrets });
    await refresh();
    setStatus(`Key removed for ${providerId}.`);
  }

  async function testConnection() {
    setBusy(true);
    setReport(undefined);

    try {
      const raw = await browser.runtime.sendMessage({ type: 'doctor' });
      const parsed = DoctorReportSchema.safeParse(raw);

      setReport(
        parsed.success
          ? parsed.data
          : { ok: false, message: 'The worker did not answer.', checks: [] },
      );
    } finally {
      setBusy(false);
    }
  }

  async function forget(key: string, chip: ChipKey) {
    const next = withoutPrior(priors, key, chip);
    setPriors(next);
    await browser.storage.local.set({ [PRIORS_KEY]: next });
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-8 py-12 text-sm text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <Mark size={28} className="text-neutral-900 dark:text-neutral-100" />
          <h1 className="text-lg font-semibold tracking-tight">Meant settings</h1>
          <ThemeSwitch
            className="ml-auto"
            theme={theme}
            onChange={(next) => void chooseTheme(next)}
          />
        </div>

        <div className="mt-8 space-y-6">
          <ConfigMenu
            entries={stored.entries}
            activeId={stored.activeId}
            presets={PRESET_CHOICES}
            hasKey={(providerId) => Boolean(stored.secrets[providerId])}
            busy={busy}
            note={status}
            onActivate={(id) => void activate(id)}
            onSave={(id, entry) => void save(id, entry)}
            onDelete={(id) => void remove(id)}
            onCreate={(draft) => void create(draft)}
            onReplaceKey={(providerId, apiKey) => void replaceKey(providerId, apiKey)}
            onRemoveKey={(providerId) => void removeKey(providerId)}
            onTest={() => void testConnection()}
          />

          {report ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className={`${LABEL}`}>The live config</h2>
              <p
                className={`mt-1 text-xs ${
                  report.ok
                    ? 'text-neutral-600 dark:text-neutral-300'
                    : 'text-neutral-800 dark:text-neutral-100'
                }`}
              >
                {report.message}
              </p>
              <ul className="mt-4 space-y-1.5">
                {report.checks.map((check) => (
                  <li key={check.label} className="flex gap-2 text-xs">
                    <span
                      aria-hidden
                      className={
                        check.ok
                          ? 'text-neutral-400 dark:text-neutral-500'
                          : 'text-red-700 dark:text-red-300'
                      }
                    >
                      {check.ok ? '✓' : '✗'}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">{check.label}</span>
                    <span
                      className={
                        check.ok
                          ? 'text-neutral-500 dark:text-neutral-400'
                          : 'text-red-700 dark:text-red-300'
                      }
                    >
                      {check.ok ? '' : check.message}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {Object.keys(priors).length > 0 ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className={LABEL}>What it has learned</h2>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Corrections you keep making in the same place, applied next time. Stored on this
                device, and forgettable one chip at a time.
              </p>
              <ul className="mt-3 space-y-1">
                {Object.entries(priors).flatMap(([key, chips]) =>
                  Object.entries(chips).map(([chip, prior]) => (
                    <li
                      key={`${key}:${chip}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {key} · {chip}
                      </span>
                      <span className="flex-1 truncate font-mono">
                        {Array.isArray(prior.value) ? prior.value.join(', ') : prior.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => void forget(key, chip as ChipKey)}
                        className="text-neutral-500 underline dark:text-neutral-400"
                      >
                        Forget
                      </button>
                    </li>
                  )),
                )}
              </ul>
            </section>
          ) : null}

          <p className="pt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            Your keys and configs stay in this browser profile. Nothing is sent anywhere except the
            provider you pick.
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * The endpoint can be an origin we have never seen, so it is granted here, once, from a click
 * (D-004). Returns the note to show when the permission was declined, and nothing when it is fine.
 */
async function requestOrigin(config: MeantConfig): Promise<string | undefined> {
  const providerId = Object.keys(config.provider ?? {})[0];
  const baseURL = providerId ? config.provider?.[providerId]?.options?.baseURL : undefined;
  if (!baseURL) return undefined;

  const origin = originPatternFor(baseURL);
  if (await browser.permissions.contains({ origins: [origin] })) return undefined;

  const granted = await browser.permissions.request({ origins: [origin] });
  return granted
    ? undefined
    : `Saved, but the permission for ${origin} was declined — calls will fail until you allow it.`;
}

async function storeSecret(providerId: string, apiKey: string): Promise<void> {
  const stored = await browser.storage.local.get(SECRETS_KEY);
  const secrets = readSecrets(stored[SECRETS_KEY]);

  await browser.storage.local.set({ [SECRETS_KEY]: { ...secrets, [providerId]: apiKey } });
}

function readSecrets(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {};

  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Options />);
