const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3005/creators/whatdidyoueattodaysir');
  await page.waitForTimeout(4000);
  const chip = page.locator('button:has-text("SANDWICH")').first();
  await chip.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/claude/grombear/.dev/worktree/honeypot-creator-streamline/.screenshots/food-types-expanded.png', fullPage: true });
  await browser.close();
})();
