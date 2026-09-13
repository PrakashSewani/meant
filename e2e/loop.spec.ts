import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

const EXTENSION_PATH = join(process.cwd(), 'apps', 'extension', '.output', 'chrome-mv3');
const FIXTURE = 'http://localhost:3123/fixture.html';

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'meant-e2e-')), {
    // The headless shell cannot load extensions; the full Chromium build can.
    channel: 'chromium',
    viewport: { width: 900, height: 700 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('polish, accept, and one native undo puts the original text back', async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);

  const field = page.locator('#plain');
  const original = await field.inputValue();
  await field.selectText();

  await invokeBar(context);

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

  // Keyboard only: the bar takes focus when it opens, so ⏎ accepts the result.
  await page.keyboard.press('Enter');

  await expect(field).not.toHaveValue(original);

  // The whole point of the write helper: Chromium recorded the edit, so ⌘Z gives the words back.
  await page.evaluate(() => document.execCommand('undo'));

  await expect(field).toHaveValue(original);
});

test('the command path reaches one frame, not every frame', async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);

  await page.locator('#plain').selectText();
  await invokeBar(context);

  await expect(page.locator('meant-bar')).toHaveCount(1);
});

test('the bar’s stylesheet is where the bar script looks for it', async () => {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

  // A silently unstyled bar is exactly the kind of thing unit tests cannot see.
  const status = await worker.evaluate(async () => {
    const response = await fetch(chrome.runtime.getURL('assets/bar-styles.css'));
    return response.status;
  });

  expect(status).toBe(200);
});

test('a configured endpoint is called for real, through the same pipeline', async () => {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

  // What the custom-provider form writes, by hand: an OpenAI-compatible endpoint on this machine.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'meant.config': {
        model: 'fixture/fixture-model',
        provider: {
          fixture: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Fixture',
            options: { baseURL: 'http://localhost:3123/v1' },
            models: { 'fixture-model': { name: 'fixture-model' } },
          },
        },
      },
      'meant.secrets': { fixture: 'sk-fixture' },
    });
  });

  try {
    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    await field.selectText();
    await invokeBar(context);

    const bar = page.locator('meant-bar');
    await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.keyboard.press('Enter');

    // Mirrors PROVIDER_REPLY in the fixture server: proof the answer came from the endpoint.
    await expect(field).toHaveValue('Deploy slipped a day. We are on it, fix by EOD.', {
      timeout: 10_000,
    });
  } finally {
    await worker.evaluate(() => chrome.storage.local.clear());
  }
});

/**
 * Drives the same path the browser command does: the worker tells the tab to open the bar. The
 * command itself is a browser-level shortcut, which is not ours to test.
 */
async function invokeBar(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  });

  if (tabId === undefined) throw new Error('no active tab to invoke');

  await worker.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'invoke-bar' }), tabId);
}
