import { adapterFor, type Editable, type SelectionInfo } from '@meant/adapters';
import {
  BAR_TAG,
  BarStylesResponseSchema,
  InvokeMessageSchema,
  PingMessageSchema,
  curatedMatchPatterns,
  resolveRegister,
} from '@meant/core';
import { barMount } from '../../lib/bar-bridge';
import type { BarAnchor } from '@meant/ui';

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

  const element = activeEditable(adapter);
  if (!element) {
    showNotice('Click into a text box first, then try again.');
    return;
  }

  const selection = adapter.getSelection(element);
  const intentText = (selection?.text ?? adapter.read(element)).trim();
  if (!intentText) {
    showNotice('Nothing to transform — write something first.');
    return;
  }

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

  const unmount = await mount({
    shadow,
    styles,
    anchor: anchorFor(element.element, selection),
    hints,
    register: resolveRegister({ hints }),
    intentText,
    onState: (state) => {
      host.dataset.state = state;
    },
    onAccept: (text) => {
      if (selection) adapter.replaceSelection(element, selection, text);
      else adapter.write(element, text);
      close();
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
