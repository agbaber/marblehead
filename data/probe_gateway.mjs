// Inspect the public DLS Gateway search — sometimes town Schedule A submissions
// (the actual filed reports) are downloadable here as PDF or XML.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ userAgent: 'Mozilla/5.0' })).newPage();
await page.goto('https://dlsgateway.dor.state.ma.us/gateway/DLSPublic/Search/Search', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
console.log('URL:', page.url());
console.log('title:', await page.title());

// Dump all selects + a few hints
const dump = await page.evaluate(() => {
  const out = { selects: [], links: [] };
  for (const sel of document.querySelectorAll('select')) {
    out.selects.push({ name: sel.name || sel.id, options: [...sel.options].slice(0, 30).map(o => ({ value: o.value, text: o.text })) });
  }
  for (const a of document.querySelectorAll('a')) {
    const t = (a.textContent || '').trim();
    if (t) out.links.push({ text: t.slice(0,80), href: (a.getAttribute('href') || '').slice(0, 160) });
  }
  return out;
});
console.log('selects:', JSON.stringify(dump.selects, null, 2));
console.log('links (first 20):');
for (const l of dump.links.slice(0, 30)) console.log(' ', l.text, '=>', l.href);

await browser.close();
