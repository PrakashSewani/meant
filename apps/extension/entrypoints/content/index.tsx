import { adapterFor, type Editable } from '@meant/adapters';
import {
  BAR_TAG,
  BarStylesResponseSchema,
  InvokeMessageSchema,
  PingMessageSchema,
  curatedMatchPatterns,
  resolveRegister,
} from '@meant/core';
import { barMount } from '../../lib/bar-bridge';

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
  if (!element) return;

  const selection = adapter.getSelection(element);
  const intentText = (selection?.text ?? adapter.read(element)).trim();
  if (!intentText) return;

  const [mount, styles] = await Promise.all([ensureBar(), ensureStyles()]);
  if (!mount) return;

  const host = document.createElement(BAR_TAG);
  host.dataset.state = 'streaming';
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

  // The dialog takes focus when it opens, so the whole loop is reachable by keyboard. React
  // renders on the next frame, so the element is not there to focus yet.
  requestAnimationFrame(() => {
    shadow.querySelector<HTMLElement>('[role="dialog"]')?.focus();
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
