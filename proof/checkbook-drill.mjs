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

// Nested drill: expand Fund -> click a category inside
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.bva-row--drillable');
await page.locator('.bva-row--drillable').first().click();
await page.waitForSelector('.drill-bar-row--click');
// click first drillable nested row (department)
await page.locator('.drill-bar-row--click').first().click();
await page.waitForSelector('.drill-crumbs');
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/checkbook-drill-nested.png', clip: { x: 0, y: 200, width: 1280, height: 1200 } });
console.log('saved checkbook-drill-nested.png');

// Go one more level deep
await page.locator('.drill-bar-row--click').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/checkbook-drill-nested-3.png', clip: { x: 0, y: 200, width: 1280, height: 1200 } });
console.log('saved checkbook-drill-nested-3.png');

// Line-item drill: Fund -> Department -> Category (Salaries) -> line items
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.bva-row--drillable');
// Open by_department breakdown
await page.click('[data-breakdown="by_department"]');
await page.waitForTimeout(300);
// Find Police row (3rd or 4th by budget)
const policeRow = page.locator('.bva-row--drillable').filter({ hasText: /police/i });
if (await policeRow.count()) {
  await policeRow.first().click();
} else {
  await page.locator('.bva-row--drillable').nth(3).click();
}
await page.waitForSelector('.drill-bar-row--click');
// Click "Professional Salary" inside the category panel
const profSalary = page.locator('.drill-bar-row--click').filter({ hasText: /professional salary/i });
if (await profSalary.count()) {
  await profSalary.first().click();
  await page.waitForSelector('.drill-card--span');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'proof/checkbook-drill-lineitems.png', clip: { x: 0, y: 200, width: 1280, height: 1200 } });
  console.log('saved checkbook-drill-lineitems.png');
} else {
  console.log('SKIPPED line-items (no Professional Salary row found)');
}

await ctx.close();
await browser.close();
