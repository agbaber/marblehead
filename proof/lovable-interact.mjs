import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('https://where-are-my-taxes-going.lovable.app/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Take "above the fold" before interaction
await page.screenshot({ path: 'proof/lovable-1-initial.png' });

// Fill in income (or tax amount)
const input = await page.locator('input[type="text"], input[type="number"]').first();
await input.click();
await input.fill('150000');
await page.waitForTimeout(2500);

// Scroll down and capture the breakdown
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(800);
await page.screenshot({ path: 'proof/lovable-2-after-fill.png' });

// Full page to see the whole effect
await page.screenshot({ path: 'proof/lovable-3-fullpage.png', fullPage: true });

// Try tax-amount tab
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
const taxBtn = await page.locator('text=/I know my tax amount/i').first();
if (await taxBtn.count()) {
  await taxBtn.click();
  await page.waitForTimeout(800);
  const input2 = await page.locator('input[type="text"], input[type="number"]').first();
  await input2.fill('8000');
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'proof/lovable-4-tax-mode.png' });
  await page.screenshot({ path: 'proof/lovable-5-tax-full.png', fullPage: true });
}

await browser.close();
console.log('done');
