/*
 * Quote-mark refinement: longer tails that flow into the sparkle, a centred pair, and the amber
 * used where it does work rather than as decoration.
 *
 * Usage: node tools/logo-quotes.mjs
 * Output: assets/logo-concepts/<slug>.svg and test-results/logo-quotes.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svgDir = join(root, 'assets', 'logo-concepts');
const sheetPath = join(root, 'test-results', 'logo-quotes.png');

const INK = '#18181b';
const PAPER = '#fafafa';
const AMBER = '#f59e0b';

const tile = (inner, bg = INK) =>
  `<rect x="4" y="4" width="120" height="120" rx="30" fill="${bg}" />${inner}`;

const sparkle = (cx, cy, r, fill = AMBER) =>
  `<path d="M${cx} ${cy - r} Q ${cx + r * 0.14} ${cy - r * 0.14} ${cx + r} ${cy} Q ${cx + r * 0.14} ${cy + r * 0.14} ${cx} ${cy + r} Q ${cx - r * 0.14} ${cy + r * 0.14} ${cx - r} ${cy} Q ${cx - r * 0.14} ${cy - r * 0.14} ${cx} ${cy - r} Z" fill="${fill}" />`;

/**
 * One quotation mark. `mirrored` points the tail down-right, which is the opening quote — the
 * tails then lead the eye toward the sparkle instead of away from it.
 */
function comma(cx, cy, r, fill, { mirrored = false } = {}) {
  const mark = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />
    <path d="M${cx - r * 0.24} ${cy + r * 0.62}
             C ${cx - r * 1.15} ${cy + r * 1.35} ${cx - r * 1.7} ${cy + r * 1.85} ${cx - r * 1.9} ${cy + r * 2.45}
             C ${cx - r * 0.8} ${cy + r * 2.2} ${cx + r * 0.5} ${cy + r * 1.55} ${cx + r * 0.95} ${cy + r * 0.8} Z"
          fill="${fill}" />`;

  return mirrored
    ? `<g transform="translate(${cx * 2} 0) scale(-1 1)">${mark}</g>`
    : mark;
}

const pair = (fillA, fillB, r = 16) =>
  comma(48, 50, r, fillA, { mirrored: true }) + comma(82, 50, r, fillB, { mirrored: true });

const concepts = [
  {
    slug: 'q1-opening-sparkle',
    label: 'Opening quote + sparkle',
    mark: `${tile(pair(PAPER, PAPER))}${sparkle(105, 33, 10)}`,
  },
  {
    slug: 'q2-closing-sparkle',
    label: 'Closing quote + sparkle',
    mark: `${tile(
      comma(48, 50, 16, PAPER) + comma(82, 50, 16, PAPER),
    )}${sparkle(105, 33, 10)}`,
  },
  {
    slug: 'q3-over-line',
    label: 'Quote over a line',
    mark: `${tile(
      pair(PAPER, PAPER) + `<rect x="30" y="94" width="68" height="10" rx="5" fill="${AMBER}" />`,
    )}`,
  },
  {
    slug: 'q4-amber-second',
    label: 'Second mark in amber',
    mark: `${tile(pair(PAPER, AMBER))}${sparkle(105, 33, 10, PAPER)}`,
  },
  {
    slug: 'q5-monochrome',
    label: 'Monochrome (accent dropped)',
    mark: `${tile(pair(PAPER, PAPER))}`,
  },
  {
    slug: 'q6-light',
    label: 'On a light surface',
    mark: `${tile(pair(INK, INK), '#ffffff')}${sparkle(105, 33, 10)}`,
  },
];

mkdirSync(svgDir, { recursive: true });
mkdirSync(join(root, 'test-results'), { recursive: true });

const svgFor = (mark, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}" role="img">${mark}</svg>`;

for (const concept of concepts) {
  writeFileSync(join(svgDir, `${concept.slug}.svg`), svgFor(concept.mark, 128));
}

const cells = concepts
  .map(
    (concept) => `
      <figure>
        <div class="big">${svgFor(concept.mark, 96)}</div>
        <div class="small">${svgFor(concept.mark, 16)}</div>
        <figcaption>${concept.label}</figcaption>
      </figure>`,
  )
  .join('');

const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
  body { margin: 0; padding: 28px; background: #f4f4f5; font: 13px/1.4 system-ui, sans-serif; color: #18181b; }
  .grid { display: grid; grid-template-columns: repeat(3, 170px); gap: 26px 20px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  figcaption { font-size: 11px; color: #52525b; text-align: center; }
  .small { height: 20px; display: flex; align-items: center; }
  h1 { font-size: 15px; margin: 0 0 20px; }
</style></head><body>
  <h1>Meant — quote mark, refined (96px, and at 16px)</h1>
  <div class="grid">${cells}</div>
</body></html>`;

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 620, height: 520 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.screenshot({ path: sheetPath, fullPage: true });
  console.log(`${concepts.length} variants → assets/logo-concepts/, sheet → test-results/logo-quotes.png`);
} finally {
  await browser.close();
}
