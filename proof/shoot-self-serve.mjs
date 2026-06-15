import { chromium } from 'playwright';

const branch = 'spec-self-serve-verification';
const PORT = 4002;
const targets = [
  ['/verify-me.html', `${branch}-verify-me.png`],
  ['/profile.html',   `${branch}-profile.png`],
  ['/terms.html',     `${branch}-terms.png`],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
for (const [path, file] of targets) {
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);  // let controllers run
  await page.screenshot({ path: `proof/${file}` });
  console.log(`saved proof/${file}`);
}
await browser.close();
