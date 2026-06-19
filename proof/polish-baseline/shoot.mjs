import { chromium } from 'playwright';
const PORT = 4004;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const targets = [
  ['/verify-me.html', 'verify-me-current.png'],
  ['/profile.html', 'profile-signed-out.png'],
  ['/what-is-the-override.html', 'reference-explainer.png'],
  ['/', 'reference-home.png'],
];
for (const [path, file] of targets) {
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `proof/polish-baseline/${file}` });
  console.log('saved', file);
}
await page.goto(`http://localhost:${PORT}/verify-me.html#claim`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'proof/polish-baseline/verify-me-claim-current.png' });
console.log('saved verify-me-claim-current.png');
await browser.close();
