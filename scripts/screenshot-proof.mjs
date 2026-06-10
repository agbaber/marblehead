import { chromium } from 'playwright';

const PORT = process.env.PORT || 4396;
const BASE = `http://localhost:${PORT}`;

const shots = [
  { name: 'homepage-6tiles-desktop', path: '/', viewport: { width: 1440, height: 900 } },
  { name: 'homepage-6tiles-mobile', path: '/', viewport: { width: 375, height: 800 } },
  { name: 'data-hub-featured', path: '/data/', viewport: { width: 1440, height: 900 } },
  { name: 'budget-flow-default', path: '/charts/budget_flow.html', viewport: { width: 1440, height: 900 } },
  { name: 'override-history-chart', path: '/charts/override_history.html', viewport: { width: 1440, height: 900 } },
  { name: 'checkbook-keep-going', path: '/checkbook/', viewport: { width: 1440, height: 900 }, scrollTo: 'ck-keep-going' },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: s.viewport,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
  if (s.scrollTo) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'center' });
    }, s.scrollTo);
    await page.waitForTimeout(300);
  }
  const out = `proof/${s.name}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log(`Wrote ${out}`);
  await ctx.close();
}
await browser.close();
