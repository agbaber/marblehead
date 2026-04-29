import { chromium } from 'playwright';
const SITE = process.env.SITE || 'http://localhost:36451';
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 320 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.addInitScript(t => localStorage.setItem('theme', t), theme);
  await page.goto(SITE, { waitUntil: 'networkidle' });
  // Crop just the nav for clarity
  const nav = await page.$('nav.site-nav');
  await nav.screenshot({ path: `proof/search-nav-${theme}.png` });
  await ctx.close();
}

await browser.close();
