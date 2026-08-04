#!/usr/bin/env node
// Sync the warrant corpus CSVs into D1 (article_series, article_instances).
// Mirrors scripts/sync_parcel_owners.mjs: truncate then chunked inserts
// through wrangler d1 execute.
//
// Usage:
//   node scripts/sync_warrant_corpus.mjs [--db community-pulse-staging] [--env staging] [--prod] [--remote]
//
// Defaults to the staging DB, local mode. --prod targets the production
// DB with no wrangler env. Exports buildSeriesRow and buildInstanceRow
// for tests (community-pulse/tests/warrant-sync.test.js).

import { readFileSync } from 'node:fs';
import { parseCsv, normalizeTitle } from './warrant_lib.mjs';

export function buildSeriesRow(r) {
  return {
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    first_year: Number(r.first_year),
    last_year: Number(r.last_year),
    notes: r.notes ? r.notes : null,
  };
}

export function buildInstanceRow(r, slugByNormalizedTitle) {
  const slug = slugByNormalizedTitle.get(normalizeTitle(r.title));
  if (!slug) {
    throw new Error(`no series mapping for title: ${r.title} (${r.meeting_year})`);
  }
  const notes = r.notes ? r.notes : null;
  return {
    series_slug: slug,
    meeting_year: Number(r.meeting_year),
    meeting_type: r.meeting_type,
    meeting_date: r.meeting_date,
    article_number: Number(r.article_number),
    title: r.title,
    amount: null,
    fincom_recommendation: null,
    tm_result: r.disposition,
    tm_vote_yes: r.vote_yes ? Number(r.vote_yes) : null,
    tm_vote_no: r.vote_no ? Number(r.vote_no) : null,
    in_effect: notes && notes.includes('overturned') ? 0 : null,
    notes,
    source_doc: r.source_doc,
    source_url: r.source_url,
  };
}

function parseArgs(argv) {
  const args = { db: 'community-pulse-staging', env: 'staging', remote: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--env') args.env = argv[++i];
    else if (a === '--prod') { args.db = 'community-pulse'; args.env = ''; }
    else if (a === '--remote') args.remote = true;
  }
  return args;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const { execFileSync } = await import('node:child_process');
  const args = parseArgs(process.argv);

  const seriesRows = parseCsv(readFileSync('data/article_series.csv', 'utf-8'))
    .map(buildSeriesRow);
  const mapRows = parseCsv(readFileSync('data/article_series_map.csv', 'utf-8'));
  const slugByNormalizedTitle = new Map(mapRows.map(m => [m.normalized_title, m.slug]));
  const knownSlugs = new Set(seriesRows.map(s => s.slug));

  for (const m of mapRows) {
    if (!knownSlugs.has(m.slug)) {
      throw new Error(`map references unknown series slug: ${m.slug}`);
    }
  }

  const instanceRows = parseCsv(readFileSync('data/town_meeting_results.csv', 'utf-8'))
    .map(r => buildInstanceRow(r, slugByNormalizedTitle));

  console.log(`Series: ${seriesRows.length}, instances: ${instanceRows.length}`);

  const wranglerArgs = ['-y', 'wrangler@4', 'd1', 'execute', args.db];
  if (args.env) wranglerArgs.push('--env', args.env);
  if (args.remote) wranglerArgs.push('--remote');
  else wranglerArgs.push('--local');
  wranglerArgs.push('--command');

  const run = sql => execFileSync('npx', [...wranglerArgs, sql],
    { stdio: 'inherit', cwd: 'community-pulse/worker' });

  run('DELETE FROM article_instances;');
  run('DELETE FROM article_series;');

  const SERIES_COLS = ['slug', 'title', 'kind', 'first_year', 'last_year', 'notes'];
  for (const batch of chunk(seriesRows, 200)) {
    const values = batch.map(r => `(${SERIES_COLS.map(c => sqlEscape(r[c])).join(',')})`).join(',');
    run(`INSERT INTO article_series (${SERIES_COLS.join(',')}) VALUES ${values};`);
  }

  const INSTANCE_COLS = ['series_slug', 'meeting_year', 'meeting_type', 'meeting_date',
    'article_number', 'title', 'amount', 'fincom_recommendation', 'tm_result',
    'tm_vote_yes', 'tm_vote_no', 'in_effect', 'notes', 'source_doc', 'source_url'];
  for (const batch of chunk(instanceRows, 100)) {
    const values = batch.map(r => `(${INSTANCE_COLS.map(c => sqlEscape(r[c])).join(',')})`).join(',');
    run(`INSERT INTO article_instances (${INSTANCE_COLS.join(',')}) VALUES ${values};`);
  }

  console.log(`Inserted ${seriesRows.length} series and ${instanceRows.length} instances.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
