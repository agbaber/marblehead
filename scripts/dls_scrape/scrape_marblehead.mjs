// Scrape MA DLS Gateway "Excess Levy Capacity and Override Capacity" report
// for Marblehead, all available years (FY2007-FY2026).
//
// The report URL puts the table in an iframe; we hit the iframe URL directly.
// The form has multi-select checkboxes for iclMuni (351 towns) and iclYear
// (FY2007-FY2026). Default state = some towns + 5 most recent years selected.
// We override the form state via JavaScript: uncheck all towns except
// Marblehead, check all years, submit, then parse the resulting table.
//
// Output columns: dor_code, municipality, fiscal_year, levy_limit_no_excl,
//                 max_levy_limit, total_levy, excess_levy_capacity,
//                 excess_pct, levy_ceiling, override_capacity
//
// (Column names mirror the report's underlying SQL columns:
//  JURISDICTIONCODE, NAME, FISCAL_YEAR, LEVY_LIMIT, MAX_LIMIT, TOTALLEVY,
//  EXCAP, EXPERCAP, LEVY_CEILING, OVERRIDECAPACITY)

import { chromium } from 'playwright';
import fs from 'node:fs';

const REPORT_URL =
  'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_10_pres&rdSubReport=True&rdResizeFrame=True';
const TARGET_TOWN = 'Marblehead';
const OUT_CSV = 'data/marblehead_excess_levy_capacity.csv';
const RAW_HTML = 'scripts/dls_scrape/raw_marblehead.html';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1200 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();

console.log('Loading report iframe...');
await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Sanity: confirm we got past the WAF challenge and have form fields.
const muniCount = await page.$$eval('input[name="iclMuni"]', (els) => els.length);
const yearCount = await page.$$eval('input[name="iclYear"]', (els) => els.length);
console.log(`Form has ${muniCount} town checkboxes and ${yearCount} year checkboxes`);
if (muniCount < 350 || yearCount < 15) {
  throw new Error('Form did not load fully — bailing.');
}

// Set checkbox state purely via JS, then submit. The popups are CSS-hidden
// but the underlying form values still post.
const result = await page.evaluate((TARGET) => {
  // 1. Towns: only Marblehead checked
  const muniBoxes = document.querySelectorAll('input[name="iclMuni"]');
  let kept = 0;
  muniBoxes.forEach((cb) => {
    cb.checked = cb.value === TARGET;
    if (cb.checked) kept++;
  });

  // 2. Years: all checked
  const yearBoxes = document.querySelectorAll('input[name="iclYear"]');
  yearBoxes.forEach((cb) => {
    cb.checked = true;
  });

  return {
    townsKept: kept,
    yearsChecked: yearBoxes.length,
  };
}, TARGET_TOWN);

console.log('Form state:', result);
if (result.townsKept !== 1) {
  throw new Error(`Expected 1 town selected, got ${result.townsKept}`);
}

// Submit. The form's submit is fired via the YUI handler when sub-controls
// blur/change. Cleanest way: locate the form and submit it directly, but
// the submit needs to go via the Logi POST endpoint. Try `rdForm.submit()`.
console.log('Submitting form...');
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 60000 }),
  page.evaluate(() => {
    const f = document.forms['rdForm'];
    if (!f) throw new Error('rdForm not found');
    f.submit();
  }),
]);
await page.waitForTimeout(2500);

// Save raw HTML for debugging
const html = await page.content();
fs.writeFileSync(RAW_HTML, html);
console.log(`Saved raw HTML (${html.length} bytes) to ${RAW_HTML}`);

// Parse the result table. Columns are identified by the colgroup ids we
// saw in the original DOM (colJURISDICTIONCODE, colNAME, etc.) — they map
// to td order within each row of #tblExcess.
const rows = await page.evaluate(() => {
  const tbl = document.getElementById('tblExcess');
  if (!tbl) return [];
  const out = [];
  const trs = tbl.querySelectorAll('tbody tr');
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 10) continue;
    out.push(Array.from(tds).map((td) => td.textContent.trim()));
  }
  return out;
});

console.log(`Parsed ${rows.length} data rows`);
if (rows.length === 0) {
  console.error('No rows parsed — check raw_marblehead.html for what came back');
  process.exit(1);
}

// Show a sample so we can sanity-check
console.log('First row:', rows[0]);
console.log('Last row:', rows[rows.length - 1]);

// Column order observed from the colgroup:
// 0 JURISDICTIONCODE, 1 NAME, 2 FISCAL_YEAR, 3 LEVY_LIMIT, 4 MAX_LIMIT,
// 5 TOTALLEVY, 6 EXCAP, 7 EXPERCAP, 8 LEVY_CEILING, 9 OVERRIDECAPACITY,
// 10 CapPerLevy?, 11 TOTAL?, 12 TLPERCVALUE?
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

// Strip $ , % from numeric cells; keep raw strings for first two columns
function clean(cell) {
  return cell.replace(/[$,\s]/g, '').replace(/%$/, '');
}

const csvLines = [HEADER.join(',')];
for (const r of rows) {
  const cleaned = [
    r[0],
    r[1],
    r[2],
    clean(r[3]),
    clean(r[4]),
    clean(r[5]),
    clean(r[6]),
    clean(r[7]),
    clean(r[8]),
    clean(r[9]),
  ];
  csvLines.push(cleaned.join(','));
}

fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');
console.log(`Wrote ${rows.length} rows to ${OUT_CSV}`);

await browser.close();
