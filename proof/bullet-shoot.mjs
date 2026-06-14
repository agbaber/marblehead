import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const URL = 'http://localhost:8087/marblehead-101/01-what-a-ma-town-is';

// Mobile dark — scroll to the Select Board section bullets
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // Find the h2 "How the Select Board works" and scroll
  await page.evaluate(() => {
    const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Select Board'));
    if (h2) h2.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'proof/bullets-mobile-dark.png' });
  await ctx.close();
}

await browser.close();
console.log('done');
