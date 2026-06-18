// scripts/og-build.mjs
// Render every og-cards/*.html to assets/og/<name>.png at 1200x630.
// Usage:
//   node scripts/og-build.mjs            # build all
//   node scripts/og-build.mjs checkbook  # build just checkbook.html

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIR = path.join(ROOT, 'og-cards');
const OUT_DIR = path.join(ROOT, 'assets', 'og');

const target = process.argv[2];

const cards = (await fs.readdir(CARDS_DIR))
  .filter(f => f.endsWith('.html') && !f.startsWith('_'))
  .filter(f => !target || f === `${target}.html`);

if (cards.length === 0) {
  console.error(target
    ? `No card named ${target}.html in og-cards/`
    : 'No cards found in og-cards/');
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  for (const file of cards) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const url = pathToFileURL(path.join(CARDS_DIR, file)).href;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const name = file.replace(/\.html$/, '');
    const out = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({
      path: out,
      type: 'png',
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    await context.close();
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
} finally {
  await browser.close();
}
