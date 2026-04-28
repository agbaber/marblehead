// Look at the pager HTML so we can drive it correctly.
import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1200 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36',
});
const page = await ctx.newPage();
await page.goto(
  'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_10_pres&rdSubReport=True&rdResizeFrame=True',
  { waitUntil: 'networkidle', timeout: 60000 }
);
await page.waitForTimeout(2000);

// Submit with all towns + just FY2026 to see pagination
await page.evaluate(() => {
  document.querySelectorAll('input[name="iclMuni"]').forEach((cb) => (cb.checked = true));
  document.querySelectorAll('input[name="iclYear"]').forEach((cb) => {
    cb.checked = cb.value === '2026';
  });
});
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 60000 }),
  page.evaluate(() => document.forms['rdForm'].submit()),
]);
await page.waitForTimeout(2000);

// Look at row count, pager fragment
const info = await page.evaluate(() => {
  const tbl = document.getElementById('tblExcess');
  const rowCount = tbl ? tbl.querySelectorAll('tbody tr').length : 0;
  // Find pager near tblExcess. Logi typically renders a div with PageNr controls.
  const pagerEl =
    document.querySelector('[id*="Paging"]') ||
    document.querySelector('[id*="tblExcess-Page"]') ||
    document.querySelector('.rdPaging');
  const pagerHTML = pagerEl ? pagerEl.outerHTML.substring(0, 3000) : '(no pager element found)';
  // Hunt for any element mentioning page size
  const pageNrInput = document.querySelector('input[name="tblExcess-PageNr"]');
  const pageNrVal = pageNrInput ? pageNrInput.value : '(no PageNr input)';
  // Pull all hrefs that mention tblExcess
  const hrefs = Array.from(document.querySelectorAll('a'))
    .filter((a) => /tblExcess/i.test(a.outerHTML))
    .slice(0, 12)
    .map((a) => ({
      text: a.textContent.trim().substring(0, 30),
      href: (a.getAttribute('href') || '').substring(0, 200),
      onclick: (a.getAttribute('onclick') || '').substring(0, 200),
    }));
  return { rowCount, pagerHTML, pageNrVal, hrefs };
});

console.log('Row count on first page:', info.rowCount);
console.log('PageNr input value:', info.pageNrVal);
console.log('Hrefs touching tblExcess:');
console.log(JSON.stringify(info.hrefs, null, 2));
console.log('Pager element HTML (truncated):');
console.log(info.pagerHTML);

fs.writeFileSync('scripts/dls_scrape/explore_pager.html', await page.content());
await browser.close();
