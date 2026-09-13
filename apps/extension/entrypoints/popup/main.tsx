import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mark } from '@meant/ui';
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
import { validateConfig, type MeantConfig } from '@meant/config';

const CONFIG_KEY = 'meant.config';
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
  const [hasKey, setHasKey] = useState(false);
  const [shortcut, setShortcut] = useState<string>();
  const [tab, setTab] = useState<TabInfo>();
  const [here, setHere] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [summary, setSummary] = useState<EventSummary>();

  useEffect(() => {
    void readStatus();
  }, []);

  async function readStatus() {
    const stored = await browser.storage.local.get([CONFIG_KEY, SECRETS_KEY, EVENTS_KEY]);
    const parsed = validateConfig(stored[CONFIG_KEY] as MeantConfig | undefined);

    if (parsed.ok && parsed.config.model) {
      const parts = parseModelRef(parsed.config.model);
      setModel(parts ? `${parts.providerId} · ${parts.modelId}` : parsed.config.model);
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
    <main className="w-72 p-4 text-sm text-neutral-800">
      <div className="flex items-center gap-2">
        <Mark size={22} className="text-neutral-900 [--meant-mark-cut:white]" />
        <h1 className="text-base font-medium">{BRAND.name}</h1>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{BRAND.tagline}</p>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Model</dt>
          <dd>{model ?? 'not configured'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Key</dt>
          <dd>{hasKey ? 'saved' : 'missing'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Shortcut</dt>
          <dd>{shortcut}</dd>
        </div>
      </dl>

      {shortcut === 'unassigned' ? (
        <p className="mt-3 text-xs text-neutral-600">
          Chrome left the shortcut unassigned — something else owns it. Set one at{' '}
          <span className="select-all">chrome://extensions/shortcuts</span>, or right-click any text
          box and pick {BRAND.name}.
        </p>
      ) : null}

      {!hasKey || !model ? (
        <p className="mt-3 text-xs text-neutral-600">
          Add a key or run a local model — takes a minute.
        </p>
      ) : null}

      <section className="mt-4 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">
            {tab?.host ? `On ${tab.host}` : 'This page'}
          </span>
          <span className="text-xs">{here ? 'on' : 'off'}</span>
        </div>

        {!tab ? (
          <p className="mt-2 text-xs text-neutral-500">This page cannot be enabled.</p>
        ) : tab.origin && isCuratedHost(tab.host ?? '') ? (
          <p className="mt-2 text-xs text-neutral-500">Always available here.</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void (here ? disableHere() : enableHere())}
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            {here ? 'Turn off here' : 'Enable on this site'}
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void (everywhere ? disableEverywhere() : enableEverywhere())}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {everywhere ? 'Turn off on all sites' : 'Enable on all sites'}
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          {everywhere
            ? 'Working everywhere you browse. Revoke it here whenever you want.'
            : 'Asks once for access to the sites you visit, instead of enabling them one at a time.'}
        </p>

        {note ? <p className="mt-2 text-xs text-neutral-600">{note}</p> : null}
      </section>

      {summary && summary.shown > 0 ? (
        <section className="mt-4 border-t border-neutral-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">Accepted this week</span>
            <span className="text-xs">
              {summary.accepted} of {summary.shown}
              {summary.acceptRate !== undefined
                ? ` · ${Math.round(summary.acceptRate * 100)}%`
                : ''}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400">On this device, never sent.</span>
            <button
              type="button"
              onClick={() => void clearEvents()}
              className="text-xs text-neutral-500 underline"
            >
              Clear
            </button>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => browser.runtime.openOptionsPage()}
        className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
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
