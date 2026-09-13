import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

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

    // Point at the slow local endpoint, so the working state is real rather than a frame.
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

    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    await field.selectText();

    const tabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    });
    if (tabId === undefined) throw new Error('no tab');

    await worker.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'invoke-bar' }), tabId);

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

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '5-options.png'), fullPage: true });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '6-popup.png') });
  } finally {
    await context.close();
  }
});
