#!/usr/bin/env node
// Sync gitignored parcels_full.csv into D1.parcel_owners.
//
// Usage:
//   node scripts/sync_parcel_owners.mjs \
//        [--csv data/parcels_raw/parcels_full.csv] \
//        [--db community-pulse-staging] [--remote]
//
// Reads the gitignored full parcels CSV (owner name + mailing address),
// projects to {address_normalized, owner_name, parcel_id, fy, updated_at},
// drops trust/LLC/estate rows the matcher will never accept anyway, then
// truncates and reinserts the parcel_owners table via wrangler d1 execute.
//
// Module exports buildRow and parseCsv so they can be tested without I/O.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ABBREVIATIONS = {
  ST: 'STREET', AVE: 'AVENUE', RD: 'ROAD', DR: 'DRIVE', LN: 'LANE',
  CT: 'COURT', PL: 'PLACE', BLVD: 'BOULEVARD', TER: 'TERRACE',
  HWY: 'HIGHWAY', PKWY: 'PARKWAY', CIR: 'CIRCLE', SQ: 'SQUARE',
};

// Local copy of normalizeAddress so the script has no worker-side import.
// Kept in sync with community-pulse/worker/src/match.js.
function normalizeAddress(s) {
  if (!s) return '';
  let out = s.toUpperCase().trim();
  out = out.replace(/[,\s]+(?:UNIT|APT|#)\s*\S+\s*$/u, '');
  out = out.replace(/[^\p{L}\p{N}]+$/u, '');
  out = out.replace(/\s+/g, ' ');
  out = out.split(' ').map(tok => {
    const bare = tok.replace(/[^\p{L}\p{N}]/gu, '');
    return ABBREVIATIONS[bare] || tok;
  }).join(' ');
  return out;
}

export function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (cells[i] ?? '').trim(); });
    return row;
  });
}

export function buildRow(r) {
  const site = (r.site_addr || '').trim();
  const owner = (r.owner1 || '').trim();
  if (!site) return null;
  if (!owner) return null;
  return {
    address_normalized: normalizeAddress(site),
    owner_name: owner,
    parcel_id: (r.prop_id || '').trim() || null,
    fy: r.fy ? Number(r.fy) : null,
    updated_at: Math.floor(Date.now() / 1000),
  };
}

function parseArgs(argv) {
  const args = { csv: 'data/parcels_raw/parcels_full.csv',
                 db: 'community-pulse-staging', remote: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--csv') args.csv = argv[++i];
    else if (a === '--db') args.db = argv[++i];
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

function main() {
  const args = parseArgs(process.argv);
  const csvPath = resolve(args.csv);
  const csv = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csv).map(buildRow).filter(Boolean);
  console.log(`Read ${rows.length} parcel rows from ${csvPath}`);

  const wranglerArgs = ['wrangler', 'd1', 'execute', args.db, '--env', 'staging'];
  if (args.remote) wranglerArgs.push('--remote');
  else wranglerArgs.push('--local');
  wranglerArgs.push('--command');

  // Truncate first.
  execFileSync('npx', [...wranglerArgs, 'DELETE FROM parcel_owners;'],
               { stdio: 'inherit', cwd: 'community-pulse/worker' });

  // Insert in chunks of 500 rows (D1 has a parameter limit; 500*5=2500).
  for (const batch of chunk(rows, 500)) {
    const values = batch.map(r =>
      `(${sqlEscape(r.address_normalized)},${sqlEscape(r.owner_name)},` +
      `${sqlEscape(r.parcel_id)},${sqlEscape(r.fy)},${sqlEscape(r.updated_at)})`
    ).join(',');
    const sql = `INSERT INTO parcel_owners ` +
      `(address_normalized, owner_name, parcel_id, fy, updated_at) ` +
      `VALUES ${values};`;
    execFileSync('npx', [...wranglerArgs, sql],
                 { stdio: 'inherit', cwd: 'community-pulse/worker' });
  }
  console.log(`Inserted ${rows.length} rows into parcel_owners.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
