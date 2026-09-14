import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type Worker } from '@playwright/test';

const EXTENSION_PATH = join(process.cwd(), 'apps', 'extension', '.output', 'chrome-mv3');
const FIXTURE = 'http://localhost:3123/fixture.html';
const SHOTS = join(process.cwd(), 'test-results', 'screens');

mkdirSync(SHOTS, { recursive: true });

// A look-at-it tool, not an assertion: run it with SCREENS=1 to capture the surfaces.
test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture screenshots');

test('look at the bar', async () => {
  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'meant-screens-')),
    {
      channel: 'chromium',
      viewport: { width: 1100, height: 800 },
      deviceScaleFactor: 2,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    },
  );

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;

    // Two saved configs, so the menu has something to switch between, and the slow local endpoint
    // as the live one so the working state is real rather than a frame.
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        'meant.configs': {
          fixture: {
            name: 'Fixture endpoint',
            config: {
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
          },
          ollama: {
            name: 'Ollama (local)',
            config: {
              model: 'ollama/qwen3-coder',
              provider: {
                ollama: {
                  npm: '@ai-sdk/openai-compatible',
                  name: 'Ollama (local)',
                  options: { baseURL: 'http://localhost:11434/v1' },
                  models: { 'qwen3-coder': { name: 'Qwen3 Coder' } },
                },
              },
            },
          },
        },
        'meant.activeConfig': 'fixture',
        'meant.secrets': { fixture: 'sk-fixture' },
      });
    });

    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    await field.selectText();
    await invokeActiveTab(worker);

    const bar = page.locator('meant-bar');
    await expect(bar).toHaveAttribute('data-state', 'idle');

    await page.screenshot({ path: join(SHOTS, '1-collapsed.png') });

    // Options are visible by default now; nothing is called until the primary action is pressed.
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('data-state', 'streaming');
    await page.screenshot({ path: join(SHOTS, '2-working.png') });

    await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.screenshot({ path: join(SHOTS, '3-result.png') });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(SHOTS, '4-accepted.png') });

    // The config menu, its tabs, and the add dialog.
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '5-options.png'), fullPage: true });

    await page.getByRole('button', { name: '+ Add config' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, '6-add-config.png'), fullPage: true });

    await page.keyboard.press('Escape');

    // A chip open, which is the affordance the complaint was about. A fresh page: coming back to
    // one we navigated away from does not restore focus, and an unfocused frame opens no bar.
    const second = await context.newPage();
    await second.goto(FIXTURE);
    await second.locator('#plain').selectText();
    await invokeActiveTab(worker);

    const secondBar = second.locator('meant-bar');
    await expect(secondBar).toHaveAttribute('data-state', 'idle');

    // Tab order is ours: the dialog hands the first Tab to the recipe, then primary, Dismiss, Who.
    for (let stop = 0; stop < 4; stop += 1) await second.keyboard.press('Tab');
    await second.keyboard.press('Enter');
    await second.waitForTimeout(200);
    await second.screenshot({ path: join(SHOTS, '7-chip-open.png') });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '8-popup.png') });

    // The error path, which is the other thing the bar has to make legible.
    await worker.evaluate(() => chrome.storage.local.clear());

    const third = await context.newPage();
    await third.goto(FIXTURE);
    await third.locator('#plain').selectText();
    await invokeActiveTab(worker);

    const thirdBar = third.locator('meant-bar');
    await expect(thirdBar).toHaveAttribute('data-state', 'idle');
    await third.keyboard.press('Enter');
    await expect(thirdBar).toHaveAttribute('data-state', 'error');
    await third.screenshot({ path: join(SHOTS, '9-error.png') });

    // Dark, on both surfaces. The bar is read per invoke, so this needs a fresh one.
    await worker.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        'meant.configs': {
          fixture: {
            name: 'Fixture endpoint',
            config: {
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
          },
        },
        'meant.activeConfig': 'fixture',
        'meant.secrets': { fixture: 'sk-fixture' },
        'meant.theme': 'dark',
      });
    });

    const dark = await context.newPage();
    await dark.goto(FIXTURE);
    await dark.locator('#plain').selectText();
    await invokeActiveTab(worker);

    const darkBar = dark.locator('meant-bar');
    await expect(darkBar).toHaveAttribute('data-state', 'idle');
    await dark.screenshot({ path: join(SHOTS, '10-bar-dark.png') });

    await dark.keyboard.press('Enter');
    await expect(darkBar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await dark.screenshot({ path: join(SHOTS, '11-bar-dark-result.png') });

    await dark.goto(`chrome-extension://${extensionId}/options.html`);
    await dark.waitForTimeout(400);
    await dark.screenshot({ path: join(SHOTS, '12-options-dark.png'), fullPage: true });

    await dark.goto(`chrome-extension://${extensionId}/popup.html`);
    await dark.waitForTimeout(400);
    await dark.screenshot({ path: join(SHOTS, '13-popup-dark.png') });
  } finally {
    await context.close();
  }
});

/** The bar opens in the focused frame only, so the invoke has to go to the tab in front. */
async function invokeActiveTab(worker: Worker): Promise<void> {
  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  });

  if (tabId === undefined) throw new Error('no active tab to invoke');

  await worker.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'invoke-bar' }), tabId);
}
