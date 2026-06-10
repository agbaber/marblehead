import { chromium } from 'playwright';

const url = 'http://localhost:4382/2026-override/';

const browser = await chromium.launch();

// Desktop full page
let ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
let page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'proof/archive-redesign-full.png', fullPage: true });
console.log('wrote proof/archive-redesign-full.png');

// Desktop above the fold (no full page)
await page.screenshot({ path: 'proof/archive-redesign-hero.png', fullPage: false });
console.log('wrote proof/archive-redesign-hero.png');

// Result section element shot
const result = page.locator('#the-result');
await result.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await result.screenshot({ path: 'proof/archive-redesign-result.png' });
console.log('wrote proof/archive-redesign-result.png');

await ctx.close();

// Mobile full page
ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
});
page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'proof/archive-redesign-mobile.png', fullPage: true });
console.log('wrote proof/archive-redesign-mobile.png');
await ctx.close();

await browser.close();
