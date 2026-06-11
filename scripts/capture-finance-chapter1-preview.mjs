import { chromium } from 'playwright';

const BASE = 'http://localhost:4322';
const browser = await chromium.launch();
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });

async function shoot(ctx, anchor, label) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/finance-story/01-four-buckets.html` + (anchor ? '#' + anchor : ''), { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `proof/finance-story-ch1-preview-${label}.png` });
  console.log('captured', label);
  await p.close();
}

for (const [a, n] of [[null,'hero'],['general-fund','gf'],['enterprise','ef'],['capital','cb'],['restricted','sr'],['why-they-dont-mix','why']]) {
  await shoot(desk, a, n);
}
for (const [a, n] of [[null,'mob-hero'],['general-fund','mob-gf'],['enterprise','mob-ef']]) {
  await shoot(mob, a, n);
}
await browser.close();
