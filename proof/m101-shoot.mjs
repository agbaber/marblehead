import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const targets = [
  ['marblehead-101', '/marblehead-101/'],
  ['chapter-03', '/marblehead-101/03-where-money-comes-from'],
];

for (const [label, path] of targets) {
  // Desktop above-fold
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8085' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `proof/${label}-desktop.png` });
    await ctx.close();
  }
  // Mobile above-fold
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8085' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `proof/${label}-mobile.png` });
    await ctx.close();
  }
  console.log(`captured ${label}`);
}

await browser.close();
