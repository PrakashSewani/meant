import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

const EXTENSION_PATH = join(process.cwd(), 'apps', 'extension', '.output', 'chrome-mv3');
const FIXTURE = 'http://localhost:3123/fixture.html';

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sayable-e2e-')), {
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

  const bar = page.locator('sayable-bar');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

  // Keyboard only: the bar takes focus when it opens, then disclosure, then Accept.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
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

  await expect(page.locator('sayable-bar')).toHaveCount(1);
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
