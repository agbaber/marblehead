import { chromium } from 'playwright';

const PORT = process.env.PORT || 4396;
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/checkbook/`, { waitUntil: 'networkidle' });
// Wait extra for the page's JS to settle
await page.waitForTimeout(2000);
// Scroll the Keep going block into view
const handle = await page.$('#ck-keep-going');
if (handle) {
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await handle.screenshot({ path: 'proof/checkbook-keep-going.png' });
  console.log('Wrote proof/checkbook-keep-going.png (element shot)');
} else {
  console.log('ck-keep-going not found, falling back to full-page');
  await page.screenshot({ path: 'proof/checkbook-keep-going.png', fullPage: true });
}
await browser.close();
