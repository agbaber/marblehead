import { chromium } from 'playwright';

const URL = 'https://marbleheaddata.org/';
const OUT = 'proof/homepage-mock-split.png';
const OUT_FULL = 'proof/homepage-mock-split-full.png';

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

await page.evaluate(() => {
  const hero = document.querySelector('.home-hero');
  if (hero) hero.remove();

  const tilesWrap = document.querySelector('.home-tiles');
  if (!tilesWrap) return;
  const tiles = Array.from(tilesWrap.querySelectorAll('.home-tile'));

  const SECTION_HREFS = new Set([
    '/marblehead-101/',
    '/checkbook/',
    '/data/',
    '/meetings/',
    '/what-can-we-do.html',
    '/2026-override/',
    '/org-chart',
  ]);

  const sections = [];
  const notable = [];
  for (const t of tiles) {
    const h = new URL(t.getAttribute('href'), location.origin).pathname;
    (SECTION_HREFS.has(h) ? sections : notable).push(t);
  }

  const stop = document.querySelector('.home-stop');
  if (!stop) return;

  const oldTilesWrap = tilesWrap;

  // Section row
  const sectionsRow = document.createElement('div');
  sectionsRow.className = 'home-tiles';
  sections.forEach(t => sectionsRow.appendChild(t));

  // Divider heading
  const heading = document.createElement('div');
  heading.style.cssText = 'margin: 40px 0 18px; display:flex; align-items:center; gap:14px;';
  heading.innerHTML = `
    <h2 style="font-family:'Libre Franklin',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--text-subtle);margin:0;">Notable pieces</h2>
    <span style="flex:1;height:1px;background:color-mix(in srgb, var(--c-navy) 12%, transparent);"></span>
  `;

  // Notable row
  const notableRow = document.createElement('div');
  notableRow.className = 'home-tiles';
  notable.forEach(t => notableRow.appendChild(t));

  oldTilesWrap.replaceWith(sectionsRow);
  sectionsRow.after(heading);
  heading.after(notableRow);

  // Small "site name + tagline" replacement for the removed hero
  const intro = document.createElement('section');
  intro.style.cssText = 'padding: 48px 0 32px;';
  intro.innerHTML = `
    <h1 style="font-family:'Libre Franklin',system-ui,sans-serif;font-size:clamp(36px,5vw,52px);line-height:1.05;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px;color:var(--text);">Marblehead Budget Data</h1>
    <p style="font-size:clamp(16px,1.9vw,20px);color:var(--text-muted);line-height:1.45;margin:0;max-width:620px;">Open data on the town's and schools' finances. Spending, debt, meetings, and how to take part.</p>
  `;
  const firstStop = document.querySelector('.home-stop');
  firstStop.parentNode.insertBefore(intro, firstStop);
});

await page.waitForTimeout(300);
await page.screenshot({ path: OUT, fullPage: false });
await page.screenshot({ path: OUT_FULL, fullPage: true });
await b.close();
console.log('wrote', OUT, 'and', OUT_FULL);
