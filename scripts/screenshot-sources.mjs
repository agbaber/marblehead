import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4000/school-building-maintenance.html#sources', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.getElementById('sources');
  if (el) el.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(400);
await page.screenshot({ path: process.argv[2] });
await browser.close();
