import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const p = await ctx.newPage();
await p.goto('https://www.mass.gov/info-details/funded-ratios', { timeout: 60000, waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);

// Collect all rows by paginating through the DataTable "next" button
const seen = new Map();
let pages = 0;
while (pages < 40) {
  pages++;
  const rows = await p.$$eval('table tbody tr', trs => trs.map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
  ).filter(r => r.length >= 3));
  for (const r of rows) seen.set(r[0], r);
  // find next button
  const next = await p.$('a.paginate_button.next:not(.disabled), li.next:not(.disabled) a, a[rel="next"]');
  // fallback: look for the » or › control
  const nextEls = await p.$$('a, button');
  let clicked = false;
  for (const el of nextEls) {
    const t = (await el.innerText().catch(()=>'')).trim();
    const cls = (await el.getAttribute('class').catch(()=>'')) || '';
    if ((t === '›' || t === 'Next' || t === '»') && !cls.includes('disabled')) {
      const before = rows[0] ? rows[0][0] : '';
      await el.click().catch(()=>{});
      await p.waitForTimeout(700);
      const after = await p.$$eval('table tbody tr', trs => trs[0]?.querySelector('td')?.innerText.trim() || '');
      if (after && after !== before) { clicked = true; break; }
    }
  }
  if (!clicked) break;
}
console.log('PAGES_VISITED', pages, 'ROWS', seen.size);
console.log('=====ALLROWS=====');
for (const r of seen.values()) console.log(r.join(' | '));
await b.close();
