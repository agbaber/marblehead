import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4322';
const browser = await chromium.launch();

// Desktop and mobile contexts to verify mobile bug is fixed
const desktopCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const mobileCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});

async function shoot(ctx, urlPath, label, sceneNum) {
  const page = await ctx.newPage();
  await page.goto(BASE + urlPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (sceneNum !== undefined) {
    // Scroll to scene N
    await page.evaluate((n) => {
      const sel = document.querySelector(`[data-scene="${n}"]`);
      if (sel) sel.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, sceneNum);
    await page.waitForTimeout(900); // let animation play
  }
  await page.screenshot({ path: `proof/finance-story-mockups-${label}.png` });
  console.log(`captured ${label}`);
  await page.close();
}

// v3 narrative
for (const [scene, name] of [[undefined,'v3-top'],[1,'v3-cut'],[2,'v3-stack'],[3,'v3-grid'],[4,'v3-pillars'],[5,'v3-boards'],[6,'v3-stream']]) {
  await shoot(desktopCtx, '/mockups/finance-story/arc-narrative.html', name, scene);
}
// v3 mobile
for (const [scene, name] of [[undefined,'v3-mob-top'],[3,'v3-mob-grid'],[5,'v3-mob-boards']]) {
  await shoot(mobileCtx, '/mockups/finance-story/arc-narrative.html', name, scene);
}

// v4 explainer
for (const [scene, name] of [[undefined,'v4-top'],[1,'v4-s1'],[2,'v4-s2'],[3,'v4-s3'],[4,'v4-s4'],[5,'v4-s5']]) {
  await shoot(desktopCtx, '/mockups/finance-story/arc-explainer.html', name, scene);
}

// Index
await shoot(desktopCtx, '/mockups/finance-story/index.html', 'index-v3v4');

await browser.close();
