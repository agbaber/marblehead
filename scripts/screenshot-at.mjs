import { chromium } from 'playwright';
const [, , outFile, anchor] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`http://localhost:4000/school-building-maintenance.html${anchor ? '#' + anchor : ''}`, { waitUntil: 'networkidle' });
if (anchor) {
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start' });
  }, anchor);
}
await page.waitForTimeout(300);
await page.screenshot({ path: outFile });
await browser.close();
