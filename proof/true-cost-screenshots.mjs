import { chromium } from 'playwright';

const branch = 'bridge-cse';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto('http://localhost:4040/your-true-cost.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Hero (above-the-fold initial)
await page.screenshot({ path: `proof/${branch}.png` });

// 2. Section 1 — baseline
await page.evaluate(() => document.getElementById('tcSection1').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1200);
await page.screenshot({ path: `proof/${branch}-section1-baseline.png` });

// 3. Section 2 — override tiers
await page.evaluate(() => document.getElementById('tcSection2').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1200);
await page.screenshot({ path: `proof/${branch}-section2-tiers.png` });

// 4. Section 3 — trash
await page.evaluate(() => document.getElementById('tcSection3').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1200);
await page.screenshot({ path: `proof/${branch}-section3-trash.png` });

// 5. Section 4 — deductions
await page.evaluate(() => document.getElementById('tcSection4').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1200);
await page.screenshot({ path: `proof/${branch}-section4-deductions.png` });

// 5b. Section 4 with senior age (75) to show benefits applied
await page.fill('#tc-age', '75');
await page.fill('#tc-income', '65000');
await page.evaluate(() => document.getElementById('tcSection4').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1500);
await page.screenshot({ path: `proof/${branch}-section4-senior.png` });

// reset
await page.fill('#tc-age', '50');
await page.fill('#tc-income', '$182,132');

// 6. Section 5 — where money goes (donut)
await page.evaluate(() => document.getElementById('tcSection5').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1500);
await page.screenshot({ path: `proof/${branch}-section5-donut.png` });

// 7. Citation popover — open one
await page.evaluate(() => {
  const chip = document.querySelector('.tc-cite-chip');
  if (chip) chip.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: `proof/${branch}-citation-popover.png` });

// 8. Receipts drawer
await page.evaluate(() => document.querySelector('.tc-cite-close')?.click());
await page.waitForTimeout(300);
await page.evaluate(() => document.getElementById('tcReceiptsBtn').click());
await page.waitForTimeout(600);
await page.screenshot({ path: `proof/${branch}-receipts-drawer.png` });

// 9. Full-page screenshot for top-to-bottom view
await page.evaluate(() => document.querySelector('.tc-drawer-close').click());
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `proof/${branch}-full.png`, fullPage: true });

// 10. Mobile view
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto('http://localhost:4040/your-true-cost.html', { waitUntil: 'networkidle' });
await m.waitForTimeout(800);
await m.screenshot({ path: `proof/${branch}-mobile-hero.png` });
await m.evaluate(() => document.getElementById('tcSection2').scrollIntoView({ behavior: 'instant', block: 'start' }));
await m.waitForTimeout(1200);
await m.screenshot({ path: `proof/${branch}-mobile-tiers.png` });
await m.evaluate(() => document.getElementById('tcSection5').scrollIntoView({ behavior: 'instant', block: 'start' }));
await m.waitForTimeout(1500);
await m.screenshot({ path: `proof/${branch}-mobile-donut.png` });

await browser.close();
console.log('All screenshots captured.');
