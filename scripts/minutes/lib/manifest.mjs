import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export const MANIFEST_COLUMNS = [
  'body', 'meeting_date', 'source_url', 'local_pdf', 'local_txt',
  'extraction_method', 'text_quality', 'status', 'notes'
];

export function readManifest(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (!text.trim()) return [];
  return parse(text, { columns: true, skip_empty_lines: true });
}

export function writeManifest(path, rows) {
  const normalized = rows.map(row => {
    const out = {};
    for (const col of MANIFEST_COLUMNS) out[col] = row[col] ?? '';
    return out;
  });
  const csv = stringify(normalized, { header: true, columns: MANIFEST_COLUMNS });
  writeFileSync(path, csv);
}

export function appendOrUpdate(path, row) {
  const rows = readManifest(path);
  const idx = rows.findIndex(r => r.body === row.body && r.meeting_date === row.meeting_date);
  if (idx === -1) {
    rows.push(row);
  } else {
    rows[idx] = { ...rows[idx], ...row };
  }
  writeManifest(path, rows);
}
