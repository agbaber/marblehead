import { chromium } from 'playwright';

const worktree = '/home/claude/marblehead/.claude/worktrees/bridge-cse_01VfSsJ4F9VBYqPyWtPUVy18';

const browser = await chromium.launch();

async function shot(url, filename, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  // wait a bit for any JS rendering
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${worktree}/proof/${filename}` });
  await page.close();
  console.log(`Saved ${filename}`);
}

await shot('http://localhost:4000/town-budget.html', 'town-budget.png', 1440, 900);
await shot('http://localhost:4000/town-budget.html?expand=public_safety', 'town-budget-expanded.png', 1440, 900);
await shot('http://localhost:4000/town-budget.html', 'town-budget-mobile.png', 390, 844);

await browser.close();
