import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const [url, file] of [
  ['http://localhost:4003/privacy.html#data-deletion', 'privacy-data-deletion.png'],
  ['http://localhost:4003/terms.html', 'terms-fb-compliant.png'],
]) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `proof/${file}` });
  console.log('saved', file);
}
await browser.close();
