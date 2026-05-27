import { chromium } from 'playwright';

const browser = await chromium.launch();

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
