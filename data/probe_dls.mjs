import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();

const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Community_Comparison_Report';
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(7000);

// Dump option values (these are typically the metric pickers like "Sanitation", "Public Works", etc.)
for (const f of page.frames()) {
  const opts = await f.evaluate(() => {
    const out = [];
    for (const sel of document.querySelectorAll('select')) {
      const name = sel.name || sel.id;
      const items = [];
      for (const o of sel.options) items.push({ value: o.value, text: o.text });
      out.push({ name, items });
    }
    return out;
  }).catch(() => []);
  if (opts.length === 0) continue;
  console.log('=== frame:', f.url().slice(0,80));
  for (const sel of opts) {
    console.log(' select:', sel.name, '(' + sel.items.length + ' opts)');
    for (const it of sel.items.slice(0, 60)) {
      if (it.text && /schedule|sanit|trash|object|line.?item|detail|expend/i.test(it.text)) {
        console.log('   *', it.text, '=>', it.value);
      }
    }
  }
}

// Also dump all rdReport URLs encountered in network
const seen = new Set();
page.on('request', r => {
  const u = r.url();
  if (u.includes('rdReport=')) {
    const m = u.match(/rdReport=([^&]+)/);
    if (m) seen.add(m[1]);
  }
});

// Try clicking around to surface a Schedule A report
const frame = page.frames().find(f => f.url().includes('Community'));
if (frame) {
  // Find a "Schedule A" hyperlink anywhere
  const found = await frame.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a')) {
      out.push({ txt: (a.textContent || '').trim().slice(0, 80), href: a.getAttribute('href') });
    }
    return out;
  }).catch(() => []);
  console.log('anchors:', found.length);
  for (const a of found.slice(0, 30)) console.log(' a:', a.txt, '=>', a.href);
}

console.log('rdReport queries seen:', [...seen]);

await browser.close();
