import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3];
const fullPage = process.argv[4] === 'full';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// give checkbook chart a moment
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage });
await b.close();
console.log('wrote', out);
