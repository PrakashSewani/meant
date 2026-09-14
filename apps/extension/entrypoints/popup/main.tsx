import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
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
import '@/lib/app.css';
import {
  BRAND,
  PingResponseSchema,
  isCuratedHost,
  parseModelRef,
  readEvents,
  summarizeEvents,
  type EventSummary,
} from '@meant/core';
import {
  ACTIVE_CONFIG_KEY,
  CONFIGS_KEY,
  LEGACY_CONFIG_KEY,
  configLibrary,
  readActiveConfig,
} from '@meant/config';

const SECRETS_KEY = 'meant.secrets';
const EVENTS_KEY = 'meant.events';
const CONTENT_SCRIPT = '/content-scripts/content.js';
const ALL_SITES_ID = 'meant-all-sites';
const ALL_SITES_ORIGIN = 'https://*/*';
const PING = { type: 'meant-ping' } as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface TabInfo {
  id?: number;
  origin?: string;
  host?: string;
}

function Popup() {
  const [model, setModel] = useState<string>();
  const [configName, setConfigName] = useState<string>();
  const [hasKey, setHasKey] = useState(false);
  const [shortcut, setShortcut] = useState<string>();
  const [tab, setTab] = useState<TabInfo>();
  const [here, setHere] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [summary, setSummary] = useState<EventSummary>();
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    void readStatus();
  }, []);

  useEffect(() => {
    const paint = (chosen: Theme) =>
      applyTheme(document.documentElement, isDark(chosen, systemPrefersDark()));
    paint(theme);

    return theme === 'system' ? watchSystemTheme(() => paint('system')) : undefined;
  }, [theme]);

  useEffect(() => {
    function onChanged(changes: Record<string, { newValue?: unknown }>) {
      const next = changes[THEME_KEY];
      if (next) setTheme(readTheme(next.newValue));
    }

    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  async function chooseTheme(next: Theme) {
    setTheme(next);
    await browser.storage.local.set({ [THEME_KEY]: next });
  }

  async function readStatus() {
    const stored = await browser.storage.local.get([
      CONFIGS_KEY,
      ACTIVE_CONFIG_KEY,
      LEGACY_CONFIG_KEY,
      SECRETS_KEY,
      EVENTS_KEY,
      THEME_KEY,
    ]);
    setTheme(readTheme(stored[THEME_KEY]));
    const active = readActiveConfig(stored);

    if (active.ok && active.config.model) {
      const parts = parseModelRef(active.config.model);
      setModel(parts ? `${parts.providerId} · ${parts.modelId}` : active.config.model);
    }

    if (active.ok && active.source === 'library') {
      const entry = configLibrary(stored).find(
        (candidate) => candidate.id === stored[ACTIVE_CONFIG_KEY],
      );
      setConfigName(entry?.name);
    }

    const secrets = stored[SECRETS_KEY];
    setHasKey(typeof secrets === 'object' && secrets !== null && Object.keys(secrets).length > 0);

    setSummary(summarizeEvents(readEvents(stored[EVENTS_KEY]), Date.now() - WEEK_MS));

    const commands = await browser.commands.getAll();
    const invoke = commands.find((command) => command.name === 'invoke-register-bar');
    setShortcut(invoke?.shortcut || 'unassigned');

    setEverywhere(await browser.permissions.contains({ origins: [ALL_SITES_ORIGIN] }));

    const [current] = await browser.tabs.query({ active: true, currentWindow: true });
    const info = describeTab(current);
    setTab(info);
    setHere(await isPresent(info?.id));
  }

  async function clearEvents() {
    await browser.storage.local.remove(EVENTS_KEY);
    setSummary(undefined);
  }

  async function enableHere() {
    if (!tab?.id || !tab.origin) return;

    setBusy(true);
    setNote(undefined);

    try {
      const granted = await browser.permissions.request({ origins: [`${tab.origin}/*`] });
      if (!granted) {
        setNote('The permission was declined, so nothing was enabled.');
        return;
      }

      await unregisterSite(tab.origin);
      await browser.scripting.registerContentScripts([
        {
          id: scriptId(tab.origin),
          matches: [`${tab.origin}/*`],
          js: [CONTENT_SCRIPT],
          runAt: 'document_idle',
          allFrames: true,
          persistAcrossSessions: true,
        },
      ]);
      await browser.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: [CONTENT_SCRIPT],
      });

      setHere(true);
      setNote('Enabled here.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not enable this site.');
    } finally {
      setBusy(false);
    }
  }

  async function disableHere() {
    if (!tab?.origin) return;

    setBusy(true);
    try {
      await unregisterSite(tab.origin);
      await browser.permissions.remove({ origins: [`${tab.origin}/*`] });

      setHere(false);
      setNote('Turned off here. Reload the page to unload it.');
    } finally {
      setBusy(false);
    }
  }

  /** One prompt, every site: the alternative to enabling them one at a time. */
  async function enableEverywhere() {
    setBusy(true);
    setNote(undefined);

    try {
      const granted = await browser.permissions.request({ origins: ['https://*/*'] });
      if (!granted) {
        setNote('The permission was declined, so nothing was enabled.');
        return;
      }

      await browser.scripting
        .unregisterContentScripts({ ids: [ALL_SITES_ID] })
        .catch(() => undefined);
      await browser.scripting.registerContentScripts([
        {
          id: ALL_SITES_ID,
          matches: ['https://*/*'],
          js: [CONTENT_SCRIPT],
          runAt: 'document_idle',
          allFrames: true,
          persistAcrossSessions: true,
        },
      ]);

      setEverywhere(true);
      setHere(true);
      setNote('Enabled on all sites. Reload a page you already had open to use it there.');
    } finally {
      setBusy(false);
    }
  }

  async function disableEverywhere() {
    setBusy(true);

    try {
      await browser.scripting
        .unregisterContentScripts({ ids: [ALL_SITES_ID] })
        .catch(() => undefined);
      await browser.permissions.remove({ origins: ['https://*/*'] });

      setEverywhere(false);
      setHere(false);
      setNote('Turned off everywhere.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="w-80 bg-white p-4 text-sm text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-center gap-2">
        <Mark size={22} className="text-neutral-900 dark:text-neutral-100" />
        <h1 className="text-base font-medium">{BRAND.name}</h1>
        <ThemeSwitch
          className="ml-auto"
          theme={theme}
          onChange={(next) => void chooseTheme(next)}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{BRAND.tagline}</p>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500 dark:text-neutral-400">Config</dt>
          <dd className="truncate">{configName ?? (model ? 'not saved' : 'none')}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500 dark:text-neutral-400">Model</dt>
          <dd className="truncate">{model ?? 'not configured'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500 dark:text-neutral-400">Key</dt>
          <dd>{hasKey ? 'saved' : 'missing'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500 dark:text-neutral-400">Shortcut</dt>
          <dd>{shortcut}</dd>
        </div>
      </dl>

      {shortcut === 'unassigned' ? (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">
          Chrome left the shortcut unassigned — something else owns it. Set one at{' '}
          <span className="select-all">chrome://extensions/shortcuts</span>, or right-click any text
          box and pick {BRAND.name}.
        </p>
      ) : null}

      {!hasKey || !model ? (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">
          Add a key or run a local model — takes a minute.
        </p>
      ) : null}

      <section className="mt-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {tab?.host ? `On ${tab.host}` : 'This page'}
          </span>
          <span className="text-xs">{here ? 'on' : 'off'}</span>
        </div>

        {!tab ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            This page cannot be enabled.
          </p>
        ) : tab.origin && isCuratedHost(tab.host ?? '') ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Always available here.
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void (here ? disableHere() : enableHere())}
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium transition-colors hover:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            {here ? 'Turn off here' : 'Enable on this site'}
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void (everywhere ? disableEverywhere() : enableEverywhere())}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {everywhere ? 'Turn off on all sites' : 'Enable on all sites'}
        </button>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {everywhere
            ? 'Working everywhere you browse. Revoke it here whenever you want.'
            : 'Asks once for access to the sites you visit, instead of enabling them one at a time.'}
        </p>

        {note ? (
          <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">{note}</p>
        ) : null}
      </section>

      {summary && summary.shown > 0 ? (
        <section className="mt-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Accepted this week
            </span>
            <span className="text-xs">
              {summary.accepted} of {summary.shown}
              {summary.acceptRate !== undefined
                ? ` · ${Math.round(summary.acceptRate * 100)}%`
                : ''}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              On this device, never sent.
            </span>
            <button
              type="button"
              onClick={() => void clearEvents()}
              className="text-xs text-neutral-500 underline dark:text-neutral-400"
            >
              Clear
            </button>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => browser.runtime.openOptionsPage()}
        className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        Open settings
      </button>
    </main>
  );
}

function describeTab(tab: { id?: number; url?: string } | undefined): TabInfo | undefined {
  if (!tab?.id || !tab.url) return undefined;

  try {
    const url = new URL(tab.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;

    return { id: tab.id, origin: url.origin, host: url.hostname };
  } catch {
    return undefined;
  }
}

function scriptId(origin: string): string {
  return `site-${origin.replace(/[^a-z0-9]/gi, '-')}`;
}

async function unregisterSite(origin: string): Promise<void> {
  await browser.scripting
    .unregisterContentScripts({ ids: [scriptId(origin)] })
    .catch(() => undefined);
}

async function isPresent(tabId: number | undefined): Promise<boolean> {
  if (tabId === undefined) return false;

  try {
    const response = await browser.tabs.sendMessage(tabId, PING);
    return PingResponseSchema.safeParse(response).success;
  } catch {
    return false;
  }
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Popup />);
