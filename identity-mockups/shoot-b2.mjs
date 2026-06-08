import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const browser = await chromium.launch();

// Desktop above-fold + full
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8766/b2-course.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'identity-mockups/b2-desktop-abovefold.png' });
  await page.screenshot({ path: 'identity-mockups/b2-desktop-full.png', fullPage: true });
  await ctx.close();
}

// Mobile above-fold (drawer closed)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8766/b2-course.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'identity-mockups/b2-mobile-abovefold.png' });
  await page.screenshot({ path: 'identity-mockups/b2-mobile-full.png', fullPage: true });
  // Drawer open
  await page.click('.toc-btn');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'identity-mockups/b2-mobile-drawer.png' });
  await ctx.close();
}

await browser.close();
console.log('done');
