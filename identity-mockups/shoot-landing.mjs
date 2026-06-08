import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const browser = await chromium.launch();

{ // desktop
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8766/landing.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'identity-mockups/landing-desktop-abovefold.png' });
  await page.screenshot({ path: 'identity-mockups/landing-desktop-full.png', fullPage: true });
  await ctx.close();
}

{ // mobile
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8766/landing.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'identity-mockups/landing-mobile-abovefold.png' });
  await page.screenshot({ path: 'identity-mockups/landing-mobile-full.png', fullPage: true });
  await ctx.close();
}

await browser.close();
console.log('done');
