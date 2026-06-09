import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, scheme] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4001/charts/checkbook.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.perf-card--over .perf-row');
  await page.locator('.perf-card--over').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const card = await page.locator('.perf-card--over').boundingBox();
  if (card) {
    await page.screenshot({
      path: 'proof/perf-card-' + name + '.png',
      clip: { x: Math.max(0, card.x - 20), y: Math.max(0, card.y - 60), width: Math.min(1400, card.width + 40), height: Math.min(1300, card.height + 80) }
    });
    console.log('saved perf-card-' + name + '.png (' + Math.round(card.height) + 'px tall)');
  }
  await ctx.close();
}
await browser.close();
