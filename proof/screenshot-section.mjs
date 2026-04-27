import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1600 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4567/senior-tax-relief.html');
await page.evaluate(() => {
  document.querySelectorAll('details').forEach(d => d.open = true);
});
await page.waitForTimeout(500);
const handle = await page.evaluateHandle(() => {
  const h = document.getElementById('residential-exemption');
  return h.closest('details');
});
const el = handle.asElement();
await el.screenshot({ path: 'proof/residential-exemption-section.png' });
await browser.close();
console.log('saved', 'proof/residential-exemption-section.png');
