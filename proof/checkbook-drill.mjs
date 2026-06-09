import { chromium } from 'playwright';
const URL = 'http://localhost:4001/charts/checkbook.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.bva-row--drillable');
// Click General Fund - Town
await page.locator('.bva-row--drillable').first().click();
await page.waitForSelector('.bva-expand');
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/checkbook-drill-fund.png', clip: { x: 0, y: 200, width: 1280, height: 1200 } });
console.log('saved checkbook-drill-fund.png');

// Switch to department view and drill High School
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[data-breakdown="by_department"]');
await page.waitForTimeout(300);
// Find "High School" row (third row by revenue)
const hsRow = page.locator('.bva-row--drillable').nth(2);
await hsRow.click();
await page.waitForSelector('.bva-expand');
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/checkbook-drill-dept.png', clip: { x: 0, y: 200, width: 1280, height: 1200 } });
console.log('saved checkbook-drill-dept.png');

await ctx.close();
await browser.close();
