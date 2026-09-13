/*
 * Logo exploration: every concept is drawn in the same 128 box on the same tile, so they can be
 * compared honestly, and each is rendered at 96px and at 16px — the size that kills most marks.
 *
 * Usage: node tools/logo-sheet.mjs
 * Output: assets/logo-concepts/<slug>.svg and test-results/logo-sheet.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svgDir = join(root, 'assets', 'logo-concepts');
const sheetPath = join(root, 'test-results', 'logo-sheet.png');

const INK = '#18181b';
const PAPER = '#fafafa';
const AMBER = '#f59e0b';

const tile = (inner) => `<rect x="4" y="4" width="120" height="120" rx="30" fill="${INK}" />${inner}`;
const sparkle = (cx, cy, r) =>
  `<path d="M${cx} ${cy - r} Q ${cx + r * 0.14} ${cy - r * 0.14} ${cx + r} ${cy} Q ${cx + r * 0.14} ${cy + r * 0.14} ${cx} ${cy + r} Q ${cx - r * 0.14} ${cy + r * 0.14} ${cx - r} ${cy} Q ${cx - r * 0.14} ${cy - r * 0.14} ${cx} ${cy - r} Z" fill="${AMBER}" />`;

const concepts = [
  {
    slug: '01-pen-upright',
    label: 'Pen, upright (current)',
    mark: `${tile(
      `<rect x="47" y="22" width="16" height="46" rx="6" fill="${PAPER}" />
       <rect x="47" y="66" width="16" height="2.5" fill="${INK}" opacity="0.3" />
       <path d="M47 69 C 47 69, 50 92, 55 108 C 60 92, 63 69, 63 69 Z" fill="${PAPER}" />
       <circle cx="55" cy="84" r="2" fill="${INK}" />
       <rect x="54.1" y="88.5" width="1.8" height="16" rx="0.9" fill="${INK}" />`,
    )}${sparkle(95, 36, 13)}`,
  },
  {
    slug: '02-nib-bold',
    label: 'Nib, bold',
    mark: `${tile(
      `<path d="M38 46 C 38 39, 44 34, 64 34 C 84 34, 90 39, 90 46 C 85 68, 73 93, 64 106 C 55 93, 43 68, 38 46 Z" fill="${PAPER}" />
       <circle cx="64" cy="48" r="4.5" fill="${INK}" />
       <rect x="62" y="56" width="4" height="46" rx="2" fill="${INK}" />`,
    )}`,
  },
  {
    slug: '03-pen-diagonal',
    label: 'Pen, diagonal',
    mark: `${tile(
      `<g transform="rotate(42 64 64)">
         <rect x="56" y="16" width="16" height="52" rx="6" fill="${PAPER}" />
         <path d="M56 70 C 56 70, 58.5 92, 64 104 C 69.5 92, 72 70, 72 70 Z" fill="${PAPER}" />
         <circle cx="64" cy="82" r="2.2" fill="${INK}" />
         <rect x="63" y="86" width="2" height="15" rx="1" fill="${INK}" />
       </g>`,
    )}${sparkle(93, 38, 12)}`,
  },
  {
    slug: '04-pencil',
    label: 'Pencil, diagonal',
    mark: `${tile(
      `<g transform="rotate(45 64 64)">
         <rect x="54" y="20" width="20" height="58" rx="3" fill="${PAPER}" />
         <rect x="54" y="34" width="20" height="20" fill="${INK}" opacity="0.25" />
         <path d="M54 78 L74 78 L64 102 Z" fill="${PAPER}" />
         <path d="M60.5 91 L67.5 91 L64 102 Z" fill="${AMBER}" />
       </g>`,
    )}`,
  },
  {
    slug: '05-caret',
    label: 'Text caret + sparkle',
    mark: `${tile(
      `<rect x="34" y="46" width="60" height="10" rx="5" fill="${PAPER}" />
       <rect x="34" y="72" width="60" height="10" rx="5" fill="${PAPER}" />
       <rect x="59" y="34" width="10" height="60" rx="2" fill="${PAPER}" />`,
    )}${sparkle(97, 34, 13)}`,
  },
  {
    slug: '06-quotes',
    label: 'Quotation marks',
    mark: `${tile(
      `<path d="M40 80 C 40 62, 48 50, 62 44 L 66 54 C 57 58, 53 65, 52 72 L 62 72 L 62 92 L 40 80 Z" fill="${PAPER}" />
       <path d="M70 80 C 70 62, 78 50, 92 44 L 96 54 C 87 58, 83 65, 82 72 L 92 72 L 92 92 L 70 80 Z" fill="${AMBER}" opacity="0.9" />`,
    )}`,
  },
  {
    slug: '07-paragraph',
    label: 'Pilcrow',
    mark: `${tile(
      `<circle cx="70" cy="58" r="16" fill="${PAPER}" />
       <rect x="54" y="36" width="10" height="62" rx="2" fill="${PAPER}" />
       <circle cx="70" cy="58" r="7" fill="${INK}" />`,
    )}`,
  },
  {
    slug: '08-squiggle-to-line',
    label: 'Messy → clean',
    mark: `${tile(
      `<path d="M22 72 C 28 56, 34 88, 40 72 C 46 56, 52 88, 58 72" fill="none" stroke="${PAPER}" stroke-width="12" stroke-linecap="round" opacity="0.85" />
       <rect x="64" y="66" width="42" height="12" rx="6" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '09-three-weights',
    label: 'Three weights',
    mark: `${tile(
      `<rect x="34" y="46" width="60" height="8" rx="4" fill="${PAPER}" opacity="0.6" />
       <rect x="34" y="62" width="60" height="15" rx="7" fill="${PAPER}" opacity="0.8" />
       <rect x="34" y="84" width="60" height="22" rx="11" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '10-three-textures',
    label: 'Dotted → solid',
    mark: `${tile(
      `<rect x="34" y="44" width="60" height="12" rx="6" fill="${PAPER}" opacity="0.35" />
       <rect x="34" y="66" width="60" height="12" rx="6" fill="${PAPER}" opacity="0.65" />
       <rect x="34" y="88" width="60" height="12" rx="6" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '11-dial',
    label: 'Tone dial',
    mark: `${tile(
      `<circle cx="64" cy="66" r="34" fill="none" stroke="${PAPER}" stroke-width="12" />
       <rect x="60" y="46" width="8" height="26" rx="4" fill="${AMBER}" />`,
    )}`,
  },
  {
    slug: '12-equaliser',
    label: 'Levels',
    mark: `${tile(
      `<rect x="32" y="60" width="14" height="40" rx="7" fill="${PAPER}" opacity="0.55" />
       <rect x="52" y="40" width="14" height="60" rx="7" fill="${PAPER}" opacity="0.75" />
       <rect x="72" y="52" width="14" height="48" rx="7" fill="${PAPER}" />
       <rect x="92" y="34" width="14" height="66" rx="7" fill="${AMBER}" opacity="0.9" />`,
    )}`,
  },
  {
    slug: '13-two-bubbles',
    label: 'Two bubbles',
    mark: `${tile(
      `<rect x="26" y="40" width="42" height="36" rx="12" fill="none" stroke="${PAPER}" stroke-width="10" opacity="0.6" />
       <path d="M46 76 L 46 92 L 58 76 Z" fill="${PAPER}" opacity="0.6" />
       <rect x="60" y="60" width="42" height="36" rx="12" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '14-bubble-pen',
    label: 'Bubble with a nib',
    mark: `${tile(
      `<rect x="24" y="34" width="80" height="58" rx="18" fill="${PAPER}" />
       <path d="M44 92 L 40 110 L 60 92 Z" fill="${PAPER}" />
       <path d="M52 46 C 52 42, 56 40, 64 40 C 72 40, 76 42, 76 46 C 74 60, 68 76, 64 84 C 60 76, 54 60, 52 46 Z" fill="${INK}" />
       <circle cx="64" cy="50" r="2.6" fill="${PAPER}" />
       <rect x="62.6" y="55" width="2.8" height="24" rx="1.4" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '15-arrow-through',
    label: 'Transform arrow',
    mark: `${tile(
      `<path d="M24 52 C 30 40, 36 64, 44 52" fill="none" stroke="${PAPER}" stroke-width="10" stroke-linecap="round" opacity="0.6" />
       <rect x="30" y="76" width="70" height="12" rx="6" fill="${PAPER}" />
       <path d="M74 40 L 100 40 L 87 26 M 100 40 L 87 54" fill="none" stroke="${AMBER}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />`,
    )}`,
  },
  {
    slug: '16-mirror',
    label: 'Before / after',
    mark: `${tile(
      `<path d="M20 56 C 26 40, 32 72, 40 56 C 48 40, 54 72, 58 56" fill="none" stroke="${PAPER}" stroke-width="10" stroke-linecap="round" opacity="0.55" />
       <rect x="18" y="84" width="40" height="10" rx="5" fill="${PAPER}" opacity="0.55" />
       <rect x="68" y="52" width="42" height="10" rx="5" fill="${PAPER}" />
       <rect x="68" y="72" width="42" height="10" rx="5" fill="${PAPER}" />
       <rect x="68" y="92" width="26" height="10" rx="5" fill="${AMBER}" />`,
    )}`,
  },
  {
    slug: '17-monogram',
    label: 'M monogram',
    mark: `${tile(
      `<path d="M30 96 L 30 36 L 64 74 L 98 36 L 98 96" fill="none" stroke="${PAPER}" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" />`,
    )}${sparkle(97, 32, 12)}`,
  },
  {
    slug: '18-chips',
    label: 'Register chips',
    mark: `${tile(
      `<rect x="30" y="34" width="68" height="18" rx="9" fill="${PAPER}" opacity="0.5" />
       <rect x="30" y="58" width="52" height="18" rx="9" fill="${PAPER}" opacity="0.75" />
       <rect x="30" y="82" width="40" height="18" rx="9" fill="${AMBER}" opacity="0.9" />`,
    )}`,
  },
  {
    slug: '19-seal',
    label: 'Seal',
    mark: `${tile(
      `<circle cx="64" cy="64" r="38" fill="none" stroke="${PAPER}" stroke-width="12" />
       <path d="M54 44 C 54 40, 58 38, 64 38 C 70 38, 74 40, 74 44 C 72 60, 67 76, 64 86 C 61 76, 56 60, 54 44 Z" fill="${PAPER}" />`,
    )}`,
  },
  {
    slug: '20-sparkle-underline',
    label: 'Sparkle + line',
    mark: `${tile(
      `<rect x="30" y="84" width="68" height="12" rx="6" fill="${PAPER}" />`,
    )}${sparkle(60, 48, 30)}`,
  },
];

mkdirSync(svgDir, { recursive: true });
mkdirSync(join(root, 'test-results'), { recursive: true });

const svgFor = (mark, size = 128) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}" role="img">${mark}</svg>`;

for (const concept of concepts) {
  writeFileSync(join(svgDir, `${concept.slug}.svg`), svgFor(concept.mark));
  concept.svg = svgFor(concept.mark);
}

const cells = concepts
  .map(
    (concept) => `
      <figure>
        <div class="big">${concept.svg.replace('width="128" height="128"', 'width="96" height="96"')}</div>
        <div class="small">${concept.svg.replace('width="128" height="128"', 'width="16" height="16"')}</div>
        <figcaption>${concept.label}</figcaption>
      </figure>`,
  )
  .join('');

const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
  body { margin: 0; padding: 28px; background: #fff; font: 13px/1.4 system-ui, sans-serif; color: #18181b; }
  .grid { display: grid; grid-template-columns: repeat(5, 150px); gap: 22px 18px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  figcaption { font-size: 11px; color: #52525b; text-align: center; }
  .small { height: 20px; display: flex; align-items: center; }
  h1 { font-size: 15px; margin: 0 0 20px; }
</style></head><body>
  <h1>Meant — logo concepts (96px, and the same mark at 16px)</h1>
  <div class="grid">${cells}</div>
</body></html>`;

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 890, height: 1000 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.screenshot({ path: sheetPath, fullPage: true });
  console.log(`${concepts.length} concepts → assets/logo-concepts/, sheet → test-results/logo-sheet.png`);
} finally {
  await browser.close();
}
