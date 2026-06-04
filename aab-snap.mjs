import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(process.argv[2], { waitUntil: 'networkidle' });
await page.screenshot({ path: process.argv[3], fullPage: true });
await browser.close();
console.log('ok');
