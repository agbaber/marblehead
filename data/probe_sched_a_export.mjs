// Click "Export to Excel" and capture the file.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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
frame = page.frames().find(f => f.url().includes('GeneralFund')) || page.frames().find(f => f.url().includes('ScheduleA'));

// Set up download interception. Click the "Export to Excel" anchor.
const dlPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
await frame.evaluate(() => {
  for (const a of document.querySelectorAll('a, button, input')) {
    const txt = (a.textContent || a.value || '').trim();
    if (/export to excel/i.test(txt)) { a.click(); return; }
  }
});

const dl = await dlPromise;
if (dl) {
  const dest = 'data/trash_analysis/schedA_FY2024_expenditures.xls';
  await dl.saveAs(dest);
  console.log('saved:', dest, 'suggested name:', dl.suggestedFilename());
} else {
  console.log('No download triggered — checking network for response...');
  // wait for any new request
  await page.waitForTimeout(8000);
  console.log('still no download');
}

await browser.close();
