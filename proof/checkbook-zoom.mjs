import { chromium } from 'playwright';
const URL = 'http://localhost:4001/charts/checkbook.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.perf-meter');
await page.waitForTimeout(300);
// Zoom in on perf section
const perfSection = await page.locator('.ck-section').nth(1).boundingBox();
if (perfSection) {
  await page.screenshot({
    path: 'proof/checkbook-perf-zoom.png',
    clip: { x: 0, y: perfSection.y - 20, width: 1280, height: 1000 }
  });
  console.log('saved checkbook-perf-zoom.png');
}
// Zoom in on bva chart
const bvaChart = await page.locator('.bva-chart').boundingBox();
if (bvaChart) {
  await page.screenshot({
    path: 'proof/checkbook-bva-zoom.png',
    clip: { x: 0, y: bvaChart.y - 80, width: 1280, height: 700 }
  });
  console.log('saved checkbook-bva-zoom.png');
}
// Zoom in on notes
const notes = await page.locator('.notes').boundingBox();
if (notes) {
  await page.evaluate((y) => window.scrollTo(0, y - 50), notes.y);
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'proof/checkbook-notes-zoom.png',
    clip: { x: 0, y: 0, width: 1280, height: 600 }
  });
  console.log('saved checkbook-notes-zoom.png');
}
await ctx.close();
await browser.close();
