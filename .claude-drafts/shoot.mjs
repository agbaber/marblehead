import { chromium } from 'playwright';

const url = 'http://localhost:8766/acquisition-letter.html';
const out = process.argv[2] || 'proof/acquisition-letter.png';
const fullPage = process.argv[3] === 'full';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage });
await browser.close();
console.log('wrote', out);
