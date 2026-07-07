import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
});
const page = await context.newPage();
await page.goto('http://localhost:4000/schools-budget.html');
await page.waitForSelector('#panel2-svg rect', { timeout: 5000 });
await page.screenshot({
  path: '/home/claude/marblehead/.dev/worktree/smooth-star/proof/task7-panel2-full.png',
  fullPage: true
});
await browser.close();
console.log('Screenshot saved');
