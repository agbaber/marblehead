import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3];
const scheme = process.argv[4] || 'light';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 850 },
  deviceScaleFactor: 2,
  colorScheme: scheme,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out });
await browser.close();
console.log('ok ' + scheme);
