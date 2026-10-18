import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(process.argv[2], { waitUntil: 'networkidle' });
await page.screenshot({ path: process.argv[3], fullPage: true });
await browser.close();
console.log('ok');
