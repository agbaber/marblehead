import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4000/school-building-maintenance.html#former-buildings', { waitUntil: 'networkidle' });
// scroll to the anchor and clip
await page.evaluate(() => {
  const el = document.getElementById('former-buildings');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] });
await browser.close();
