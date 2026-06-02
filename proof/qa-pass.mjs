// QA: capture above-fold + key scroll points in 4 modes:
// desktop-light, desktop-dark, mobile-light, mobile-dark
// Pass URL as first arg or default to branch URL.
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://your-true-cost-preview.marbleheaddata-preview.pages.dev/your-true-cost.html';
const browser = await chromium.launch();

const matrix = [
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, scheme: 'light' },
  { name: 'desktop-dark',  viewport: { width: 1440, height: 900 }, scheme: 'dark'  },
  { name: 'mobile-light',  viewport: { width: 390, height: 844 },  scheme: 'light' },
  { name: 'mobile-dark',   viewport: { width: 390, height: 844 },  scheme: 'dark'  },
];

for (const m of matrix) {
  const ctx = await browser.newContext({ viewport: m.viewport, deviceScaleFactor: 2, colorScheme: m.scheme });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. above-the-fold hero
  await page.screenshot({ path: `proof/qa-${m.name}-1-hero.png` });

  // 2. tier section (scrolled into view)
  await page.evaluate(() => document.getElementById('tcSection2').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `proof/qa-${m.name}-2-tiers.png` });

  // 3. trash
  await page.evaluate(() => document.getElementById('tcSection3').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `proof/qa-${m.name}-3-trash.png` });

  // 4. deductions
  await page.evaluate(() => document.getElementById('tcSection4').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `proof/qa-${m.name}-4-deductions.png` });

  // 5. donut/breakdown
  await page.evaluate(() => document.getElementById('tcSection5').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `proof/qa-${m.name}-5-donut.png` });

  await ctx.close();
  console.log(`✓ ${m.name}`);
}

await browser.close();
console.log('QA capture done.');
