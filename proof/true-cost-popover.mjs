import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4040/your-true-cost.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Scroll to section 2 (tier bars have visible chips), open popover on a chip
await page.evaluate(() => document.getElementById('tcSection2').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1200);
// Click the citation chip on the second bar (FY28)
await page.evaluate(() => {
  const chips = document.querySelectorAll('#s2Rows .tc-cite-chip');
  if (chips.length > 1) chips[1].click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'proof/bridge-cse-citation-popover.png' });

// Verify net vs gross: set senior conditions and check pinned card numbers
await page.evaluate(() => document.querySelector('.tc-cite-close')?.click());
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.fill('#tc-age', '75');
await page.waitForTimeout(300);
await page.fill('#tc-income', '$60,000');
await page.waitForTimeout(300);
await page.fill('#tc-assessed', '$900,000');  // under CB limit
await page.waitForTimeout(800);

const values = await page.evaluate(() => ({
  pinnedTotal: document.getElementById('pinnedTotal').textContent,
  pinnedOverride: document.getElementById('pinnedOverride').textContent,
  pinnedOverrideSub: document.getElementById('pinnedOverrideSub').textContent,
  s4Net: document.getElementById('s4Net').textContent
}));
console.log('After senior inputs:', JSON.stringify(values));

await page.evaluate(() => document.getElementById('tcSection4').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'proof/bridge-cse-section4-senior2.png' });

await browser.close();
console.log('done');
