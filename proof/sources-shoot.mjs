import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const URL = 'http://localhost:8089/marblehead-101/01-how-the-town-is-run';

// Element-only screenshot of the sources block on desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const handle = await page.$('.sources-list');
  if (handle) {
    await handle.screenshot({ path: 'proof/sources-element.png' });
  }
  await ctx.close();
}

// Full mobile dark page (we'll use this since the page is short on mobile)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const handle = await page.$('.sources-list');
  if (handle) {
    await handle.screenshot({ path: 'proof/sources-element-mobile.png' });
  }
  await ctx.close();
}

await browser.close();
console.log('done');
