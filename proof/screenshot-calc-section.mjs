import { chromium } from 'playwright';

const browser = await chromium.launch();

// Desktop view focused on the new section
const ctxD = await browser.newContext({
  viewport: { width: 1100, height: 1400 },
  deviceScaleFactor: 2,
});
const pageD = await ctxD.newPage();
await pageD.goto('http://localhost:4001/charts/override_calculator.html', { waitUntil: 'networkidle' });
await pageD.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Your full tax bill'));
  if (h) h.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -40);
});
await pageD.waitForTimeout(300);
await pageD.screenshot({ path: 'proof/calc-new-section.png' });
await ctxD.close();

// Mobile screenshot at iPhone width
const ctxM = await browser.newContext({
  viewport: { width: 390, height: 1600 },
  deviceScaleFactor: 2,
});
const pageM = await ctxM.newPage();
await pageM.goto('http://localhost:4001/charts/override_calculator.html', { waitUntil: 'networkidle' });
await pageM.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Your full tax bill'));
  if (h) h.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -20);
});
await pageM.waitForTimeout(300);
await pageM.screenshot({ path: 'proof/calc-table-mobile.png' });
await ctxM.close();

await browser.close();
console.log('Done');
