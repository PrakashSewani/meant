/*
 * Renders the app icon from assets/logo.svg into the sizes the extension needs.
 *
 * Chromium is already a dependency for the browser tests, so it does the rasterising: no image
 * toolchain to install, and the icons cannot drift from the source SVG.
 *
 * Usage: node tools/render-icons.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 96, 128];
const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'assets', 'logo.svg'), 'utf8');
const outDir = join(root, 'apps', 'extension', 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: join(outDir, `${size}.png`), omitBackground: true });
    await page.close();
    console.log(`icons/${size}.png`);
  }
} finally {
  await browser.close();
}
