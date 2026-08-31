import { chromium } from 'playwright';

const URL = 'https://www.bidwells.co.uk/insights-reports-events/driving-innovation-at-speed/';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Dismiss cookie banner
const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("I Accept")').first();
try {
  await acceptBtn.click({ timeout: 3000 });
  await page.waitForTimeout(800);
} catch {}

// First, total scroll height
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
const vh = 900;
console.log('Page height:', pageHeight, 'px (', (pageHeight / vh).toFixed(1), 'viewports)');

// Capture screenshots at evenly spaced scroll positions
const positions = [0, 0.05, 0.1, 0.15, 0.2, 0.27, 0.34, 0.41, 0.48, 0.55, 0.62, 0.7, 0.78, 0.86, 0.94];
for (let i = 0; i < positions.length; i++) {
  const p = positions[i];
  await page.evaluate((p) => window.scrollTo({ top: p * (document.body.scrollHeight - window.innerHeight), behavior: 'instant' }), p);
  await page.waitForTimeout(800);
  const fname = `proof/bidwells-${String(i).padStart(2,'0')}-${Math.round(p*100)}.png`;
  await page.screenshot({ path: fname });
  console.log('captured', fname);
}

// Dump some structural info
const info = await page.evaluate(() => {
  function summarize(el) {
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string' ? el.className.split(/\s+/).slice(0,3).join('.') : '';
    return tag + (cls ? '.' + cls : '');
  }
  // Look for known scrollytelling indicators
  const lotties = document.querySelectorAll('lottie-player, [class*="lottie"], [class*="Lottie"]');
  const videos = document.querySelectorAll('video');
  const stickies = Array.from(document.querySelectorAll('*')).filter(e => getComputedStyle(e).position === 'sticky').slice(0,10);
  const fixeds = Array.from(document.querySelectorAll('*')).filter(e => getComputedStyle(e).position === 'fixed' && e.offsetWidth > 100).slice(0,10);
  return {
    lottiePlayers: Array.from(lotties).map(summarize),
    videos: Array.from(videos).map(v => ({ summary: summarize(v), src: v.currentSrc || v.src, w: v.offsetWidth, h: v.offsetHeight, autoplay: v.autoplay, loop: v.loop, muted: v.muted })),
    stickyEls: stickies.map(summarize),
    fixedEls: fixeds.map(summarize),
    bodyHeight: document.body.scrollHeight
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
