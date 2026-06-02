import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('https://where-are-my-taxes-going.lovable.app/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const input = await page.locator('input[type="text"], input[type="number"]').first();
await input.click();
await input.fill('150000');
await page.waitForTimeout(3000);

// Capture each section by scroll
const sections = [
  { y: 700, name: 'breakdown-donut' },
  { y: 1100, name: 'breakdown-list' },
  { y: 1500, name: 'breakdown-deep' },
  { y: 1900, name: 'breakdown-end' },
  { y: 2300, name: 'breakdown-after' },
  { y: 2700, name: 'breakdown-far' },
];

for (const s of sections) {
  await page.evaluate(y => window.scrollTo(0, y), s.y);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `proof/lovable-scroll-${s.name}.png` });
}

// Dump the HTML structure so we can see how the breakdown is built
const html = await page.content();
import('fs').then(fs => fs.writeFileSync('proof/lovable-dom.html', html));

await browser.close();
console.log('done');
