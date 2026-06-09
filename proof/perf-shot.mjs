import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, scheme] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4001/charts/checkbook.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.perf-card--over .perf-row');
  // scroll to the perf-grid section so it's centered in viewport
  await page.locator('.perf-grid').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const grid = await page.locator('.perf-grid').first().boundingBox();
  if (grid) {
    await page.screenshot({
      path: 'proof/perf-card-' + name + '.png',
      clip: { x: Math.max(0, grid.x - 20), y: Math.max(0, grid.y - 60), width: Math.min(1400, grid.width + 40), height: Math.min(1300, grid.height + 80) }
    });
    console.log('saved perf-card-' + name + '.png (' + Math.round(grid.height) + 'px tall)');
  }
  await ctx.close();
}
await browser.close();
