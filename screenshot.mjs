import { chromium } from 'playwright';
const browser = await chromium.launch();

async function shot(mockDate, file) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  if (mockDate) {
    await ctx.addInitScript((iso) => {
      const fixed = new Date(iso).getTime();
      const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) return new RealDate(fixed);
          return new RealDate(...args);
        }
        static now() { return fixed; }
      };
    }, mockDate);
  }
  const page = await ctx.newPage();
  await page.goto('http://localhost:4100/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // Clip to the hero / countdown area so the screenshot focuses on the change.
  const countdown = await page.locator('#countdown').first();
  await countdown.scrollIntoViewIfNeeded();
  const box = await countdown.boundingBox();
  // Capture a generous region around the countdown so labels are visible.
  await page.screenshot({
    path: file,
    clip: {
      x: Math.max(0, box.x - 300),
      y: Math.max(0, box.y - 80),
      width: Math.min(1440, box.width + 600),
      height: Math.min(900, box.height + 200),
    },
  });
  await ctx.close();
}

await shot(null, 'proof/countdown-today.png');           // real clock = 2026-06-09
await shot('2026-06-08T12:00:00-04:00', 'proof/countdown-tomorrow.png');

await browser.close();
console.log('done');
