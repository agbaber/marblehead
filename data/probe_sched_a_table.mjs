// Submit Schedule A Expenditures view for FY2024 and dump table headers + Marblehead row
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();

await page.goto('https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

const frame = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));
console.log('frame URL:', frame ? frame.url() : 'NONE');

// Switch to Expenditures view, select FY2024 only, click Submit
await frame.evaluate(() => {
  const sel = document.querySelector('select[name="islAmountType"]');
  if (sel) { sel.value = 'Expenditures'; sel.dispatchEvent(new Event('change')); }
  // Uncheck the "All Years" + uncheck all years; check FY2024
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
await page.waitForTimeout(2000);

// Submit
await frame.evaluate(() => {
  const btn = document.getElementById('btnSubmit');
  if (btn) btn.click();
});

// Wait for table
await page.waitForTimeout(15000);
const frame2 = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));
const headers = await frame2.evaluate(() => {
  const t = document.getElementById('xtGenFund');
  if (!t) return null;
  const trs = t.querySelectorAll('tr');
  return [...trs[0].querySelectorAll('th, td')].map(c => c.textContent.trim());
});
console.log('Table headers:', JSON.stringify(headers, null, 2));

// Find Marblehead row by paginating
let mhRow = null;
for (let pg = 0; pg < 15 && !mhRow; pg++) {
  await page.waitForTimeout(3000);
  const f = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));
  mhRow = await f.evaluate(() => {
    const t = document.getElementById('xtGenFund');
    if (!t) return null;
    for (const tr of t.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('td')].map(c => c.textContent.trim());
      if (cells.some(c => c === 'Marblehead')) return cells;
    }
    return null;
  });
  if (mhRow) break;
  // advance
  await f.evaluate(() => {
    const cap = document.getElementById('xtGenFund-NextPageCaption');
    const a = cap ? cap.closest('a') : null;
    if (a) { const code = (a.getAttribute('href')||'').replace(/^javascript:/, ''); window.eval(code); }
  });
}
console.log('Marblehead row:', JSON.stringify(mhRow));

await browser.close();
