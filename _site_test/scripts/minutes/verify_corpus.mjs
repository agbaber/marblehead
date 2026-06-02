#!/usr/bin/env node
import { readManifest } from './lib/manifest.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const VALID_BODIES = new Set(['select_board', 'fincom', 'school_committee']);
const VALID_STATUSES = new Set(['downloaded', 'missing', 'restricted', 'not_published']);
const FY19_START = '2018-07-01';

function main() {
  const rows = readManifest(MANIFEST_PATH);
  const violations = [];

  // Invariant 6: valid body and status values
  for (const r of rows) {
    if (!VALID_BODIES.has(r.body)) {
      violations.push(`Invalid body "${r.body}" on row ${r.meeting_date}`);
    }
    if (!VALID_STATUSES.has(r.status)) {
      violations.push(`Invalid status "${r.status}" on ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 1: required fields non-empty
  for (const r of rows) {
    for (const f of ['body', 'meeting_date', 'source_url', 'status']) {
      if (!r[f]) violations.push(`Missing ${f} on row ${JSON.stringify(r)}`);
    }
  }

  // Invariant 2: downloaded rows must have both local_pdf and local_txt on disk
  for (const r of rows) {
    if (r.status !== 'downloaded') continue;
    if (!r.local_pdf || !existsSync(resolve(r.local_pdf))) {
      violations.push(`downloaded but PDF missing: ${r.body} ${r.meeting_date}`);
    }
    if (!r.local_txt || !existsSync(resolve(r.local_txt))) {
      violations.push(`downloaded but text missing: ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 3: missing rows must have notes
  for (const r of rows) {
    if (r.status === 'missing' && !r.notes) {
      violations.push(`missing but no explanation: ${r.body} ${r.meeting_date}`);
    }
  }

  // Invariant 4: no duplicate (body, meeting_date) pairs
  const keys = new Map();
  for (const r of rows) {
    const k = `${r.body}:${r.meeting_date}`;
    if (keys.has(k)) violations.push(`Duplicate key ${k}`);
    keys.set(k, true);
  }

  // Invariant 5: meeting_date >= FY19_START
  for (const r of rows) {
    if (r.meeting_date && r.meeting_date < FY19_START) {
      violations.push(`Date out of range (${r.meeting_date}) for ${r.body}`);
    }
  }

  // Coverage summary
  const byBody = {};
  for (const r of rows) {
    byBody[r.body] ??= { downloaded: 0, missing: 0, restricted: 0, not_published: 0 };
    byBody[r.body][r.status]++;
  }

  console.log('Coverage by body:');
  for (const [body, counts] of Object.entries(byBody)) {
    console.log(`  ${body}: ${JSON.stringify(counts)}`);
  }

  if (violations.length) {
    console.error(`\n${violations.length} invariant violations:`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('\nAll Phase 1 invariants pass.');
}

main();
