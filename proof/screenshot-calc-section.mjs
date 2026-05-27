import { chromium } from 'playwright';

const browser = await chromium.launch();

async function shoot(theme, scale, path) {
  const ctx = await browser.newContext({
    viewport: { width: scale === 'desktop' ? 1100 : 390, height: 1600 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4001/charts/override_calculator.html', { waitUntil: 'networkidle' });
  if (theme === 'dark') {
    // Site uses [data-theme="dark"] in addition to prefers-color-scheme.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Your full tax bill'));
    if (h) h.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -40);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await ctx.close();
}

await shoot('light', 'desktop', 'proof/calc-new-section.png');
await shoot('light', 'mobile',  'proof/calc-table-mobile.png');
await shoot('dark',  'desktop', 'proof/calc-new-section-dark.png');

await browser.close();
console.log('Done');
