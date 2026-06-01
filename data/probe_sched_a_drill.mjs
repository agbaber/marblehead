// After getting the FY2024 expenditures table, click on the Marblehead row to see
// if there's a sub-report with object-level detail.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  acceptDownloads: true
});
const page = await context.newPage();

await page.goto('https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);

let frame = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));
await frame.evaluate(() => {
  const sel = document.querySelector('select[name="islAmountType"]');
  if (sel) { sel.value = 'Expenditures'; sel.dispatchEvent(new Event('change')); }
  const allCb = document.querySelector('input[id="islYear_rdListAll"]');
  if (allCb && allCb.checked) allCb.click();
  for (const cb of document.querySelectorAll('input[name="islYear"]')) {
    if (cb.checked && !cb.id.includes('All')) cb.click();
  }
  for (const cb of document.querySelectorAll('input[name="islYear"]')) {
    const label = document.querySelector('label[for="' + cb.id + '"]');
    if (label && label.textContent.trim() === '2024') cb.click();
  }
});
await frame.evaluate(() => document.getElementById('btnSubmit').click());
await page.waitForTimeout(15000);

// Now find an interactive cell — links inside the table?
frame = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));
const sample = await frame.evaluate(() => {
  const t = document.getElementById('xtGenFund');
  if (!t) return { ok: false };
  const trs = t.querySelectorAll('tr');
  const out = { headers: [], rows: [], anchors: [], exportLinks: [] };
  out.headers = [...trs[0].querySelectorAll('th, td')].map(c => c.textContent.trim());
  // Find Marblehead row
  for (const tr of trs) {
    const cells = [...tr.querySelectorAll('td')].map(c => c.textContent.trim());
    if (cells[1] === 'Marblehead') {
      // For each cell, capture inner HTML to spot anchors
      out.rows.push(cells);
      out.anchors = [...tr.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
      break;
    }
  }
  // Look for export/download anchors elsewhere on page
  for (const a of document.querySelectorAll('a, button, input')) {
    const txt = (a.textContent || a.value || '').trim();
    if (/export|excel|csv|download|xls/i.test(txt)) {
      out.exportLinks.push({ text: txt.slice(0, 60), href: a.getAttribute('href') || a.getAttribute('onclick') });
    }
  }
  return out;
});
console.log('headers:', sample.headers);
console.log('Marblehead row:', sample.rows[0]);
console.log('row anchors:', sample.anchors);
console.log('export links:', sample.exportLinks);

await browser.close();
