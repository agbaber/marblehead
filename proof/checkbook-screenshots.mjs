import { chromium, devices } from 'playwright';
const URL = 'http://localhost:4001/charts/checkbook.html';

const shots = [
  { name: 'checkbook-desktop-top.png',     viewport: { width: 1280, height: 900 },        fullPage: false },
  { name: 'checkbook-desktop-full.png',    viewport: { width: 1280, height: 900 },        fullPage: true  },
  { name: 'checkbook-mobile-top.png',      viewport: devices['iPhone 13'].viewport,        fullPage: false },
  { name: 'checkbook-mobile-full.png',     viewport: devices['iPhone 13'].viewport,        fullPage: true  },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bva-row');
  await page.waitForSelector('table.ck-table tbody tr td.vendor');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'proof/' + s.name, fullPage: s.fullPage });
  console.log('saved', s.name);
  await ctx.close();
}
// Capture "by Object" view
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bva-row');
  await page.click('.breakdown-btn[data-breakdown="by_object"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'proof/checkbook-desktop-by-object.png', fullPage: false });
  console.log('saved checkbook-desktop-by-object.png');
  await ctx.close();
}
// Capture filtered view
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('table.ck-table tbody tr td.vendor');
  await page.fill('#f-vendor', 'AMAZON');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'proof/checkbook-desktop-amazon.png', fullPage: false });
  console.log('saved checkbook-desktop-amazon.png');
  await ctx.close();
}
await browser.close();
