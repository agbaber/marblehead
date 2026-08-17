// Apply data/known_names.json across the existing transcript corpus.
//
// Dry run by default: prints per-term hit counts and the files affected, and
// changes nothing. Pass --write to actually rewrite the files.
//
// Usage:
//   node scripts/transcripts/tools/backfill_names.mjs           # report only
//   node scripts/transcripts/tools/backfill_names.mjs --write   # apply
//   node scripts/transcripts/tools/backfill_names.mjs --flags   # also list flag_only hits

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDictionary, normalizeNames, findFlagged } from '../lib/normalize_names.mjs';

const TRANSCRIPT_DIR = '_transcripts';
const DICT_PATH = 'data/known_names.json';

// Frontmatter keys that must survive a backfill byte-identical. A correction
// landing in one of these would break a permalink, a deep link, or the ingest
// pipeline's idempotency, so we verify rather than trust.
const STRUCTURAL = [
  'slug', 'board', 'date', 'vimeo_id', 'vimeo_url', 'video_url',
  'youtube_id', 'duration_seconds', 'ai_generated', 'status', 'source',
  'date_approximate',
];

function structuralFields(src) {
  const out = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m && STRUCTURAL.includes(m[1])) out.push(line);
    if (line === '---' && out.length > 0) break;
  }
  return out.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const showFlags = process.argv.includes('--flags');

  const dict = JSON.parse(readFileSync(DICT_PATH, 'utf8'));
  const compiled = compileDictionary(dict);

  const files = readdirSync(TRANSCRIPT_DIR).filter(f => f.endsWith('.md')).sort();
  const totals = new Map();
  const filesPerTerm = new Map();
  const flagTotals = new Map();
  const changed = [];
  const refused = [];

  for (const file of files) {
    const path = join(TRANSCRIPT_DIR, file);
    const src = readFileSync(path, 'utf8');
    const { text, hits } = normalizeNames(src, compiled);

    if (showFlags) {
      for (const f of findFlagged(src, compiled)) {
        flagTotals.set(f.term, (flagTotals.get(f.term) ?? 0) + f.count);
      }
    }

    if (hits.length === 0) continue;

    // Guard: a correction must never touch a structural frontmatter field.
    if (structuralFields(src) !== structuralFields(text)) {
      refused.push(file);
      continue;
    }

    for (const h of hits) {
      const key = `${h.wrong} -> ${h.right}`;
      totals.set(key, (totals.get(key) ?? 0) + h.count);
      filesPerTerm.set(key, (filesPerTerm.get(key) ?? 0) + 1);
    }
    changed.push(file);
    if (write) writeFileSync(path, text);
  }

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const w = Math.max(...rows.map(([k]) => k.length), 10);
  process.stdout.write(`${'CORRECTION'.padEnd(w)}  COUNT  FILES\n`);
  for (const [key, n] of rows) {
    process.stdout.write(`${key.padEnd(w)}  ${String(n).padStart(5)}  ${String(filesPerTerm.get(key)).padStart(5)}\n`);
  }

  const total = rows.reduce((n, [, c]) => n + c, 0);
  process.stdout.write(
    `\n${total} corrections across ${changed.length} of ${files.length} transcripts\n`,
  );

  if (showFlags && flagTotals.size > 0) {
    process.stdout.write('\nflag_only terms present (never rewritten):\n');
    for (const [term, n] of [...flagTotals.entries()].sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${term}: ${n}\n`);
    }
  }

  if (refused.length > 0) {
    process.stdout.write(
      `\nREFUSED ${refused.length} file(s) -- a correction would have altered a ` +
      `structural frontmatter field:\n`,
    );
    for (const f of refused) process.stdout.write(`  ${f}\n`);
    process.exitCode = 1;
  }

  if (!write) process.stdout.write('\n(dry run -- pass --write to apply)\n');
}

main();
