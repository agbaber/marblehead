import { chromium } from 'playwright';

const BASE = 'http://localhost:4322';
const browser = await chromium.launch();
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });

async function shoot(ctx, scrollPct, label) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/mockups/finance-story/arc-report.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  if (scrollPct > 0) {
    await page.evaluate((p) => window.scrollTo({ top: p * (document.body.scrollHeight - window.innerHeight), behavior: 'instant' }), scrollPct);
    await page.waitForTimeout(1500); // let reveal + chart animations finish
  }
  await page.screenshot({ path: `proof/finance-story-mockups-${label}.png` });
  console.log('captured', label);
  await page.close();
}

for (const [pct, name] of [[0,'v5-hero'],[0.1,'v5-c1'],[0.22,'v5-stats'],[0.32,'v5-quote'],[0.42,'v5-cut'],[0.55,'v5-pillars'],[0.68,'v5-stats2'],[0.78,'v5-quote2'],[0.88,'v5-traj'],[0.97,'v5-foot']]) {
  await shoot(desk, pct, name);
}
for (const [pct, name] of [[0,'v5-mob-hero'],[0.32,'v5-mob-quote'],[0.55,'v5-mob-pillars'],[0.88,'v5-mob-traj']]) {
  await shoot(mob, pct, name);
}

await browser.close();
