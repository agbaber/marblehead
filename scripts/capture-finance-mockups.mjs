import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4322';
const BRANCH = process.env.BRANCH || 'finance-story-mockups';

const shots = [
  { path: '/mockups/finance-story/index.html', file: `${BRANCH}-index.png` },
  { path: '/mockups/finance-story/arc-stack.html', file: `${BRANCH}-A-top.png` },
  { path: '/mockups/finance-story/arc-people.html', file: `${BRANCH}-B-top.png` },
  { path: '/mockups/finance-story/arc-time.html', file: `${BRANCH}-C-top.png` },
];

const midScrolls = [
  { path: '/mockups/finance-story/arc-stack.html', file: `${BRANCH}-A-grid.png`, stage: 'grid' },
  { path: '/mockups/finance-story/arc-stack.html', file: `${BRANCH}-A-org.png`, stage: 'org' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

for (const s of shots) {
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `proof/${s.file}` });
  console.log(`captured ${s.file}`);
  await page.close();
}

for (const s of midScrolls) {
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // Scroll the panel matching the requested stage into view
  await page.evaluate((stage) => {
    const target = document.querySelector(`.fs-panel[data-stage="${stage}"]`);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, s.stage);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `proof/${s.file}` });
  console.log(`captured ${s.file}`);
  await page.close();
}

await browser.close();
