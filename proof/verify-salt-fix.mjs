import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await page.goto('http://localhost:4041/your-true-cost.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// scroll to section 4
await page.evaluate(() => document.getElementById('tcSection4').scrollIntoView({ behavior: 'instant', block: 'start' }));
await page.waitForTimeout(900);
// click the SALT citation chip
await page.evaluate(() => {
  const cards = document.querySelectorAll('.tc-deduction-card');
  const saltCard = Array.from(cards).find(c => c.textContent.includes('SALT'));
  const chip = saltCard.querySelector('.tc-cite-chip');
  chip.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'proof/salt-fix.png' });
await browser.close();
console.log('done');
