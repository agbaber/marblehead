import { chromium } from '/home/claude/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const variants = ['a-editorial', 'b-course', 'c-documentary'];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

for (const v of variants) {
  const page = await context.newPage();
  await page.goto(`http://localhost:8766/${v}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `proof/identity-mockups/${v}-abovefold.png` });
  await page.screenshot({ path: `proof/identity-mockups/${v}-full.png`, fullPage: true });
  console.log(`captured ${v}`);
  await page.close();
}

await browser.close();
