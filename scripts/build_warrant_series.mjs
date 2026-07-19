#!/usr/bin/env node
// Regenerate data/article_series.csv and data/article_series_map.csv
// from data/town_meeting_results.csv. Deterministic; run after any
// results-CSV change and commit the diff.
//
// Usage: node scripts/build_warrant_series.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, buildSeries } from './warrant_lib.mjs';

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => csvField(r[h])).join(','));
  return lines.join('\n') + '\n';
}

const rows = parseCsv(readFileSync('data/town_meeting_results.csv', 'utf-8'));
const { series, map } = buildSeries(rows);

writeFileSync('data/article_series.csv',
  toCsv(['slug', 'title', 'kind', 'first_year', 'last_year', 'notes'], series));
writeFileSync('data/article_series_map.csv',
  toCsv(['normalized_title', 'slug'], map));

const kinds = {};
for (const s of series) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log(`Input rows: ${rows.length}`);
console.log(`Series: ${series.length}`, kinds);
console.log(`Map entries: ${map.length}`);

const recurring = series.filter(s => s.last_year > s.first_year).length;
console.log(`Recurring series (seen in more than one year): ${recurring}`);
