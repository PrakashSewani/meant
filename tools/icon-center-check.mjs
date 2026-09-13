/*
 * Draws the icon with guides through the tile's centre, so "is it centred?" is measured rather
 * than squinted at. The mark being off-centre by four units is invisible until it isn't.
 *
 * Usage: node tools/icon-center-check.mjs
 * Output: test-results/center-check.png
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'assets', 'logo.svg'), 'utf8');

mkdirSync(join(root, 'test-results'), { recursive: true });

const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 420, height: 200 },
    deviceScaleFactor: 3,
  });

  await page.setContent(`
    <style>
      body { margin: 0; display: flex; gap: 24px; align-items: center; padding: 20px; background: #f4f4f5; }
      .box { position: relative; }
      .box svg { display: block; width: 128px; height: 128px; }
      .v, .h { position: absolute; background: #22d3ee; }
      .v { left: 64px; top: 0; width: 1px; height: 128px; }
      .h { top: 64px; left: 0; height: 1px; width: 128px; }
      .label { font: 12px system-ui; color: #52525b; }
    </style>
    <div class="box">${svg}<div class="v"></div><div class="h"></div></div>
    <div class="label">cyan = tile centre (64,64)</div>`);

  await page.screenshot({ path: join(root, 'test-results', 'center-check.png') });
  console.log('test-results/center-check.png');
} finally {
  await browser.close();
}
