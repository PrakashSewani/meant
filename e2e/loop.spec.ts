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
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // Keyboard only, and nothing is called until the user asks: ⏎ transforms, then ⏎ accepts.
  await page.keyboard.press('Enter');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  // Assert the answer, not just "something changed": a stray keystroke would satisfy that.
  await expect(field).toHaveValue(/^\[mock\] ugh tell sarah/);

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
    await expect(bar).toHaveAttribute('data-state', 'idle');
    await page.keyboard.press('Enter');
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

test('editing a chip reaches the model, not just the pill', async () => {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(() => chrome.storage.local.remove('meant.events'));

  const page = await context.newPage();
  await page.goto(FIXTURE);
  await page.locator('#plain').selectText();
  await invokeBar(context);

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // Tab order is ours: recipe, primary, close, then the chips. Five stops lands on Tone.
  for (let stop = 0; stop < 5; stop += 1) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.type('direct, warm');
  await page.keyboard.press('Tab');

  // Back to the primary action: Tone, Who, close, primary.
  for (let stop = 0; stop < 4; stop += 1) await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');

  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  const readEvents = () =>
    worker.evaluate(async () => {
      const stored = await chrome.storage.local.get('meant.events');
      return (stored['meant.events'] ?? []) as { sent: { tone?: string[] } }[];
    });

  // The worker writes the event after the accept, so give it a moment rather than racing it.
  await expect.poll(async () => (await readEvents()).length).toBeGreaterThan(0);
  expect((await readEvents()).at(-1)?.sent.tone).toEqual(['direct', 'warm']);
});

test('compose mode writes into an empty field', async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);

  const field = page.locator('#placeholder');
  await expect(field).toHaveValue('');
  await field.click();

  await invokeBar(context);

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // The intent box is inside the bar, so it takes the typing once the bar holds focus.
  await page.keyboard.type('tell sarah the deploy slipped a day');
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

  // In compose mode ⏎ is a newline in the intent box, so the primary action is ⌘⏎ throughout.
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(field).toHaveValue(/^\[mock\] tell sarah the deploy slipped a day/);
});

test('writes into a rich editor that has markup in the way', async () => {
  const page = await context.newPage();
  await page.goto('http://localhost:3123/fixture-rich.html');

  const editor = page.locator('#thread');
  const before = await editor.innerText();

  // Select the rough line inside its paragraph: the write has to land in the middle of markup.
  await editor.locator('p').first().selectText();

  await invokeBar(context);

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Enter');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  // The rest of the thread survives, which is the invariant about transforming only the selection.
  await expect(editor).toContainText('Two tests fail');
  await expect(editor.innerText()).not.toBe(before);

  await page.evaluate(() => document.execCommand('undo'));
  expect(await editor.innerText()).toBe(before);
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
