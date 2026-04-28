// Scrape MA DLS Gateway "Excess Levy Capacity and Override Capacity" report
// for all 351 MA municipalities across all available years (FY2007-FY2026).
//
// Strategy: select all 351 towns + one target year, submit to render the
// table, then click the report's "Excel" export link to download an XLS
// containing the full table for that year. Iterate over years.
// (Walking the on-screen pagination is slower and more brittle.)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const REPORT_URL =
  'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_10_pres&rdSubReport=True&rdResizeFrame=True';
const DOWNLOAD_DIR = 'scripts/dls_scrape/downloads';
const OUT_CSV = 'data/dls_excess_levy_capacity_all_351.csv';

const HEADER = [
  'dor_code',
  'municipality',
  'fiscal_year',
  'levy_limit_no_excl',
  'max_levy_limit',
  'total_levy',
  'excess_levy_capacity',
  'excess_pct',
  'levy_ceiling',
  'override_capacity',
];

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1400, height: 1200 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();

console.log('Loading report iframe...');
await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

const years = await page.$$eval('input[name="iclYear"]', (els) =>
  Array.from(els)
    .map((el) => el.value)
    .filter((v) => /^\d{4}$/.test(v))
    .sort()
);
console.log('Available years:', years.join(', '));

const allRows = []; // [dor_code, muni, fy, ...10 cols]

for (const targetYear of years) {
  console.log(`\n=== FY${targetYear} ===`);
  // Reload to reset form state between years
  await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  await page.evaluate((TARGET) => {
    document.querySelectorAll('input[name="iclMuni"]').forEach((cb) => (cb.checked = true));
    document.querySelectorAll('input[name="iclYear"]').forEach((cb) => {
      cb.checked = cb.value === TARGET;
    });
  }, targetYear);

  console.log('Submitting form...');
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 90000 }),
    page.evaluate(() => document.forms['rdForm'].submit()),
  ]);
  await page.waitForTimeout(2000);

  // Find the Excel export anchor and click it.
  const excelLink = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    for (const a of anchors) {
      const onclick = a.getAttribute('onclick') || '';
      if (/rdReportFormat=NativeExcel/i.test(onclick) && /tblExcess/i.test(onclick)) {
        return { onclick, text: a.textContent.trim() };
      }
    }
    return null;
  });
  if (!excelLink) {
    console.error('Excel export link not found — bailing.');
    process.exit(1);
  }
  console.log(`Triggering Excel export: ${excelLink.text}`);

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  // The onclick does SubmitForm(...) which posts the form to a URL with the
  // export parameters. We can run it directly via evaluate.
  await page.evaluate((onclickStr) => {
    // SubmitForm is a Logi global helper. Just eval the onclick.
    // Strip leading "javascript:" if present (it's already onclick form).
    new Function(onclickStr)();
  }, excelLink.onclick);

  let dl;
  try {
    dl = await downloadPromise;
  } catch (e) {
    console.error(`No download fired for FY${targetYear}: ${e.message}`);
    continue;
  }
  const xlsPath = path.join(DOWNLOAD_DIR, `excess_levy_${targetYear}.xls`);
  await dl.saveAs(xlsPath);
  console.log(`Saved ${xlsPath}`);

  // Logi "NativeExcel" exports as an HTML file with .xls extension. Parse
  // the HTML table to extract rows. Cheaper than spinning up a real xlsx
  // parser, and avoids a new dependency.
  const xlsHtml = fs.readFileSync(xlsPath, 'utf8');
  const tableMatch = xlsHtml.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    console.error(`No table found in ${xlsPath}`);
    continue;
  }
  // Strip tags, walk rows
  const rowMatches = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  let yearRowCount = 0;
  for (const m of rowMatches) {
    const tr = m[0];
    const tdMatches = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (tdMatches.length < 10) continue;
    const cells = tdMatches.map((x) =>
      x[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim()
    );
    // Skip header row (non-numeric DOR code)
    if (!/^\d{1,3}$/.test(cells[0])) continue;
    allRows.push(cells.slice(0, 10));
    yearRowCount++;
  }
  console.log(`  parsed ${yearRowCount} rows`);
}

console.log(`\nTotal rows: ${allRows.length}`);
if (allRows.length === 0) {
  console.error('No rows scraped');
  process.exit(1);
}

function clean(cell) {
  return cell.replace(/[$,\s]/g, '').replace(/%$/, '');
}

const csv = [HEADER.join(',')];
for (const r of allRows) {
  csv.push(
    [
      r[0],
      // Wrap municipality in quotes if it contains commas (a few do).
      r[1].includes(',') ? `"${r[1]}"` : r[1],
      r[2],
      clean(r[3]),
      clean(r[4]),
      clean(r[5]),
      clean(r[6]),
      clean(r[7]),
      clean(r[8]),
      clean(r[9]),
    ].join(',')
  );
}
fs.writeFileSync(OUT_CSV, csv.join('\n') + '\n');
console.log(`Wrote ${allRows.length} rows to ${OUT_CSV}`);

await browser.close();
