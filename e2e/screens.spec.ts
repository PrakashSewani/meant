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
    await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

    await page.screenshot({ path: join(SHOTS, '1-collapsed.png') });

    const active = () =>
      page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? 'none');
    console.log('focus when ready:', await active());
    console.log(
      'bar focus claim:',
      await bar.getAttribute('data-focus'),
      await bar.getAttribute('data-focus-later'),
      await bar.getAttribute('data-focusLater'),
    );

    // Keyboard reaches the bar: the recipe picker is the first control, the disclosure is next.
    // Tab reaches the recipe picker, then the disclosure; Space opens it, Enter would accept.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.screenshot({ path: join(SHOTS, '2-expanded.png') });

    // The host has no box of its own (the bar inside is fixed), so clip around the selection.
    await page.screenshot({
      path: join(SHOTS, '2c-closeup.png'),
      clip: { x: 190, y: 250, width: 620, height: 330 },
    });

    // And the result, with the field it came from.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(SHOTS, '2b-accepted.png') });

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '3-options.png'), fullPage: true });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, '4-popup.png') });
  } finally {
    await context.close();
  }
});
