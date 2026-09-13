import { adapterFor, type Editable, type SelectionInfo } from '@meant/adapters';
import {
  BAR_TAG,
  BarStylesResponseSchema,
  InvokeMessageSchema,
  PingMessageSchema,
  curatedMatchPatterns,
  learnedRegister,
  priorKey,
  readPriors,
  resolveRegister,
} from '@meant/core';
import { barMount } from '../../lib/bar-bridge';
import type { BarAnchor } from '@meant/ui';

const PRIORS_KEY = 'meant.priors';
const SITES_KEY = 'meant.sites';
const GRIP_TAG = 'meant-grip';

export default defineContentScript({
  matches: curatedMatchPatterns(),
  allFrames: true,
  runAt: 'document_idle',
  main() {
    // A site enabled at runtime gets this file injected on demand as well as registered for
    // later navigations, so the frame may already be initialised.
    const frame = globalThis as { __meantLoaded?: boolean };
    if (frame.__meantLoaded) return;
    frame.__meantLoaded = true;

    const adapter = adapterFor(new URL(location.href));
    const site = location.hostname;

    void watchForSelections(adapter, site);

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (PingMessageSchema.safeParse(message).success) {
        sendResponse({ alive: true });
        return undefined;
      }

      if (!InvokeMessageSchema.safeParse(message).success) return undefined;

      void openBar(adapter);
      return undefined;
    });
  },
});

async function openBar(adapter: ReturnType<typeof adapterFor>): Promise<void> {
  // The command reaches every frame in the tab; only the one the user is typing in opens a bar.
  if (!document.hasFocus()) return;

  const site = location.hostname;

  const element = activeEditable(adapter);
  if (!element) {
    showNotice('Click into a text box first, then try again.');
    return;
  }

  const selection = adapter.getSelection(element);
  // With a selection we transform it. Without one the field itself is the subject: empty, this is
  // writing from scratch; not empty, it is the text the user wants reworked.
  const mode = selection ? 'polish' : 'compose';
  const intentText = (selection?.text ?? adapter.read(element)).trim();

  const [mount, styles] = await Promise.all([ensureBar(), ensureStyles()]);
  if (!mount) return;

  const host = document.createElement(BAR_TAG);
  host.dataset.state = 'idle';
  document.documentElement.append(host);

  // Closed: the page cannot reach our markup, and page CSS cannot reach our styles.
  const shadow = host.attachShadow({ mode: 'closed' });

  const close = () => {
    unmount();
    host.remove();
  };

  const hints = adapter.inferContext(element);
  const stored = await browser.storage.local.get(PRIORS_KEY);
  const learned = learnedRegister(
    readPriors(stored[PRIORS_KEY]),
    priorKey(hints.siteId ?? 'page', hints.fieldRole),
  );

  const unmount = await mount({
    shadow,
    styles,
    mode,
    anchor: anchorFor(element.element, selection),
    hints,
    register: { ...resolveRegister({ hints }), ...learned.register },
    learned: learned.learned,
    intentText,
    onState: (state) => {
      host.dataset.state = state;
    },
    onAccept: (text) => {
      if (selection) adapter.replaceSelection(element, selection, text);
      else adapter.write(element, text);
      close();
      void offerGripOnce(site);
    },
    onDismiss: close,
  });
}

/**
 * The bar is injected once per frame, on first use, and reused after that. The worker does the
 * injecting: it has the tab and frame ids, and executeScript lands the bundle in this isolated
 * world rather than the page's.
 */
async function ensureBar(): Promise<ReturnType<typeof barMount>> {
  if (!barMount()) {
    const frame = globalThis as { __meantBarInjected?: Promise<unknown> };
    frame.__meantBarInjected ??= browser.runtime.sendMessage({ type: 'bar-script' });

    await frame.__meantBarInjected;
  }

  const mount = barMount();
  if (!mount) console.error('Meant: the bar script did not load, so the bar cannot open.');

  return mount;
}

/** Fetched once per frame and reused: the worker hands it over, so the page never sees a path. */
async function ensureStyles(): Promise<string> {
  const frame = globalThis as { __meantStyles?: Promise<string> };
  frame.__meantStyles ??= browser.runtime
    .sendMessage({ type: 'bar-styles' })
    .then((response) => BarStylesResponseSchema.parse(response).css)
    .catch(() => '');

  return frame.__meantStyles;
}

interface SiteSettings {
  grip?: boolean;
  gripAsked?: boolean;
}

async function readSite(site: string): Promise<SiteSettings> {
  const stored = await browser.storage.local.get(SITES_KEY);
  const sites = (stored[SITES_KEY] ?? {}) as Record<string, SiteSettings>;

  return sites[site] ?? {};
}

async function writeSite(site: string, settings: SiteSettings): Promise<void> {
  const stored = await browser.storage.local.get(SITES_KEY);
  const sites = (stored[SITES_KEY] ?? {}) as Record<string, SiteSettings>;

  await browser.storage.local.set({
    [SITES_KEY]: { ...sites, [site]: { ...sites[site], ...settings } },
  });
}

async function gripWasOffered(site: string): Promise<boolean> {
  const settings = await readSite(site);
  return settings.gripAsked === true || settings.grip === true;
}

/**
 * The grip is the third way in, and the only one that lives on the page. It is off until asked
 * for, offered exactly once — after a transform the user accepted — and it never appears on a
 * selection until the site has said yes.
 */
async function watchForSelections(
  adapter: ReturnType<typeof adapterFor>,
  site: string,
): Promise<void> {
  if ((await readSite(site)).grip !== true) return;

  let grip: HTMLElement | undefined;

  const clear = () => {
    grip?.remove();
    grip = undefined;
  };

  document.addEventListener('mouseup', (event) => {
    clear();

    const target = event.target;
    if (!(target instanceof Element)) return;

    const element =
      adapter.findEditable(target) ?? adapter.findEditable(target.parentElement ?? target);
    if (!element) return;

    const selection = adapter.getSelection(element);
    if (!selection?.range) return;

    const rect = selection.range.getBoundingClientRect();
    grip = createGripHook(() => {
      clear();
      void openBar(adapter);
    });
    grip.style.left = `${String(Math.min(rect.right + 6, window.innerWidth - 24))}px`;
    grip.style.top = `${String(rect.bottom + 6)}px`;
    document.documentElement.append(grip);
  });

  document.addEventListener('scroll', clear, true);
  document.addEventListener('mousedown', (event) => {
    if (!grip?.contains(event.target as Node)) clear();
  });
}

function createGripHook(onClick: () => void): HTMLElement {
  const host = document.createElement(GRIP_TAG);
  host.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:auto';

  const shadow = host.attachShadow({ mode: 'closed' });
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Meant');
  button.setAttribute(
    'style',
    [
      'display:block',
      'width:14px',
      'height:14px',
      'padding:0',
      'border:0',
      'border-radius:4px',
      'background:transparent',
      'cursor:pointer',
    ].join(';'),
  );
  button.innerHTML = `<svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true"><path d="M16 2 Q 17.6 14 31 16 Q 17.6 18 16 30 Q 14.4 18 1 16 Q 14.4 14 16 2 Z" fill="#f59e0b"/></svg>`;
  button.addEventListener('click', onClick);
  shadow.append(button);

  return host;
}

/** Offered exactly once per site, and only once a transform has proved itself. */
async function offerGripOnce(site: string): Promise<void> {
  if (await gripWasOffered(site)) return;
  offerGrip(site);
}

/** Asked once, after a transform was accepted, and never asked again. */
function offerGrip(site: string): void {
  const host = document.createElement('meant-notice');
  const shadow = host.attachShadow({ mode: 'closed' });
  const box = document.createElement('div');

  box.setAttribute(
    'style',
    [
      'position:fixed',
      'right:24px',
      'bottom:24px',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'padding:10px 12px',
      'border-radius:10px',
      'background:#171717',
      'color:#fafafa',
      'font:13px/1.4 system-ui,sans-serif',
      'box-shadow:0 8px 24px rgb(0 0 0 / 24%)',
    ].join(';'),
  );
  box.textContent = 'Keep a grip here, so you do not have to reach for the shortcut?';

  const answer = (keep: boolean) => {
    void writeSite(site, { grip: keep, gripAsked: true });
    host.remove();
  };

  for (const [label, keep] of [
    ['Keep it', true],
    ['Not here', false],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute(
      'style',
      [
        'border:0',
        'border-radius:6px',
        'padding:4px 8px',
        'font:inherit',
        keep ? 'background:#fafafa' : 'background:transparent',
        keep ? 'color:#171717' : 'color:#a3a3a3',
        'cursor:pointer',
      ].join(';'),
    );
    button.addEventListener('click', () => answer(keep));
    box.append(button);
  }

  shadow.append(box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 12_000);
}

/**
 * A short-lived, self-contained message. It appears only in response to something the user did,
 * and it never blocks the page.
 */
function showNotice(message: string): void {
  const host = document.createElement('meant-notice');
  const shadow = host.attachShadow({ mode: 'closed' });
  const box = document.createElement('div');

  box.textContent = message;
  box.setAttribute(
    'style',
    [
      'position:fixed',
      'right:24px',
      'bottom:24px',
      'z-index:2147483647',
      'max-width:20rem',
      'padding:10px 12px',
      'border-radius:10px',
      'background:#171717',
      'color:#fafafa',
      'font:13px/1.4 system-ui,sans-serif',
      'box-shadow:0 8px 24px rgb(0 0 0 / 24%)',
    ].join(';'),
  );

  shadow.append(box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 4000);
}

/** Where to put the bar: next to the text the user is looking at, in viewport coordinates. */
function anchorFor(element: HTMLElement, selection: SelectionInfo | null): BarAnchor {
  const range = selection?.range;

  if (range) {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }
  }

  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function activeEditable(adapter: ReturnType<typeof adapterFor>): Editable | null {
  const element = document.activeElement;
  if (element) {
    const found = adapter.findEditable(element);
    if (found) return found;
  }

  const anchor = document.getSelection()?.anchorNode;
  const parent = anchor?.parentElement;
  if (parent) return adapter.findEditable(parent);

  return null;
}
