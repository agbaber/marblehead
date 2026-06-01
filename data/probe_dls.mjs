import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();

// The Community_Comparison_Report is the canonical DLS portal entry on the public site.
const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Community_Comparison_Report';
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
console.log('after community comparison: URL=', page.url(), 'title=', await page.title());

// Drill down: enumerate all iframes
for (const f of page.frames()) {
  console.log(' frame:', f.url().slice(0, 120));
}

// Capture all anchor tags across all frames
for (const f of page.frames()) {
  if (!f.url().includes('rdPage') && !f.url().includes('dor.state')) continue;
  const links = await f.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a, option')) {
      const href = a.getAttribute('href') || a.getAttribute('value') || '';
      const txt = (a.textContent || '').trim();
      if (/schedule|sanit|trash|object|expend|line.?item|detail/i.test(href + ' ' + txt)) {
        out.push({ href, txt: txt.slice(0, 100) });
      }
    }
    return out;
  }).catch(() => []);
  console.log('frame', f.url().slice(0,60), 'matching:', links.length);
  for (const l of links.slice(0, 30)) console.log(' ', l.txt, '=>', l.href);
}

await browser.close();
