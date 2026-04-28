// Parse the downloaded DLS xlsx files and produce the consolidated CSV.
import { read, utils } from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

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

const files = fs
  .readdirSync(DOWNLOAD_DIR)
  .filter((f) => /^excess_levy_\d{4}\.xls$/i.test(f))
  .sort();
console.log('Files:', files.length);

const allRows = [];
for (const f of files) {
  const fy = f.match(/(\d{4})/)[1];
  const buf = fs.readFileSync(path.join(DOWNLOAD_DIR, f));
  const wb = read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  console.log(`FY${fy}: ${aoa.length} sheet rows`);
  let parsed = 0;
  for (const row of aoa) {
    if (!row || row.length < 10) continue;
    const code = String(row[0]).trim();
    if (!/^\d{1,3}$/.test(code)) continue;
    allRows.push(row.map((c) => String(c).trim()));
    parsed++;
  }
  console.log(`  parsed ${parsed} data rows`);
}
console.log(`Total rows: ${allRows.length}`);

function clean(c) {
  return c.replace(/[$,\s]/g, '').replace(/%$/, '');
}

const csv = [HEADER.join(',')];
for (const r of allRows) {
  csv.push(
    [
      r[0],
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
