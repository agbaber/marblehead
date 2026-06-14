import { chromium } from 'playwright';
const URL = 'http://localhost:4001/checkbook/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

// Switch to department breakdown so we can drill dept -> division -> see by_department panel
await page.click('[data-breakdown="by_department"]');
await page.waitForTimeout(200);
await page.waitForSelector('.bva-row--drillable');

// 1. Drill into a department that has a division breakdown (e.g. Police)
const polDeptRow = page.locator('.bva-row--drillable').filter({ hasText: /police/i });
if (await polDeptRow.count()) {
  await polDeptRow.first().click();
} else {
  await page.locator('.bva-row--drillable').first().click();
}
await page.waitForSelector('.drill-bar-row--click');

// 2. Look for a division row to drill into (under "By division" panel typically)
const divRow = page.locator('.drill-card').filter({ hasText: /by division/i }).locator('.drill-bar-row--click').first();
if (await divRow.count()) {
  await divRow.click();
  await page.waitForSelector('.drill-crumbs');
  await page.waitForTimeout(300);
}

const hereCount = await page.locator('.drill-bar-row--here').count();
console.log('drill-bar-row--here count:', hereCount);
const expand = await page.locator('.bva-expand').boundingBox();
if (expand) {
  await page.screenshot({
    path: 'proof/drill-here.png',
    clip: { x: 0, y: Math.max(0, expand.y - 40), width: 1280, height: Math.min(1300, expand.height + 80) }
  });
  console.log('saved drill-here.png');
}
await browser.close();
