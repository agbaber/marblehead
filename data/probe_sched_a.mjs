// Inspect the Schedule A General Fund report. Specifically: what view options exist
// in the dropdown? We need to find an object-level / departmental detail option.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();

await page.goto('https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);

for (const f of page.frames()) {
  if (!f.url().includes('ScheduleA')) continue;
  const dump = await f.evaluate(() => {
    const out = { selects: [], links: [], radios: [] };
    for (const sel of document.querySelectorAll('select')) {
      out.selects.push({
        name: sel.name || sel.id,
        options: [...sel.options].map(o => ({ value: o.value, text: o.text }))
      });
    }
    for (const a of document.querySelectorAll('a')) {
      const t = (a.textContent || '').trim();
      if (t) out.links.push({ text: t.slice(0, 100), href: (a.getAttribute('href') || '').slice(0, 160) });
    }
    for (const r of document.querySelectorAll('input[type="radio"], input[type="checkbox"]')) {
      const label = document.querySelector('label[for="' + r.id + '"]');
      out.radios.push({ id: r.id, name: r.name, label: label ? label.textContent.trim() : '' });
    }
    return out;
  }).catch(e => ({ err: e.message }));

  console.log('--- frame:', f.url().slice(0, 80));
  console.log('selects:', JSON.stringify(dump.selects, null, 2).slice(0, 4000));
  console.log('\nradios/checkboxes:');
  for (const r of dump.radios) console.log(' ', r.name, r.id, '=>', r.label);
  console.log('\nlinks (first 40):');
  for (const l of dump.links.slice(0, 40)) console.log(' ', l.text, '=>', l.href);
}

await browser.close();
