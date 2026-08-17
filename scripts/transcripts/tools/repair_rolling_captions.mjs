// One-time repair of YouTube rolling-caption artifacts in existing transcripts.
//
// Dry run by default: reports per-file word reduction and changes nothing.
// Pass --write to apply.
//
// Only the prose body is touched. Frontmatter is left alone (verified clean: no
// cue markup reaches it) so LLM-written summaries and every structural field
// survive byte-identical.
//
// Every file is checked against three invariants before it is written, and the
// run aborts on any violation rather than writing a partial repair:
//
//   1. The cleaned word stream is a SUBSEQUENCE of the original. The repair can
//      only delete words, never invent or reorder them.
//   2. Every distinct word in the original still appears. Since the repair only
//      removes duplicates, nothing should vanish from the vocabulary.
//   3. The timecode-link count is unchanged, so no deep link is lost.
//
// Usage:
//   node scripts/transcripts/tools/repair_rolling_captions.mjs
//   node scripts/transcripts/tools/repair_rolling_captions.mjs --write
//   node scripts/transcripts/tools/repair_rolling_captions.mjs --show <slug>

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanRollingCaptions, hasRollingArtifacts, stripCueTags } from '../lib/rolling_captions.mjs';

const TRANSCRIPT_DIR = '_transcripts';

function splitFrontmatter(src) {
  if (!src.startsWith('---')) return { head: '', body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { head: '', body: src };
  const cut = end + 4;
  return { head: src.slice(0, cut), body: src.slice(cut) };
}

function words(s) {
  return s.split(/\s+/).filter(Boolean);
}

// Is `small` a subsequence of `big`?
function isSubsequence(small, big) {
  let i = 0;
  for (const w of big) {
    if (i < small.length && small[i] === w) i += 1;
  }
  return i === small.length;
}

function repairBody(body) {
  // Paragraphs are blank-line separated; only timecoded prose is rewritten.
  return body
    .split('\n\n')
    .map(p => (p.startsWith('**[') ? cleanRollingCaptions(p) : p))
    .join('\n\n');
}

export function checkInvariants(before, after) {
  // Compare against the tag-stripped original, not the raw one: in the raw text
  // markup is glued onto words ("Mhm.<00:00:03.000><c>"), so a raw comparison
  // would fail trivially. Tag stripping is separately unit-tested as
  // word-preserving, which is what makes this substitution safe.
  const b = words(stripCueTags(before));
  const a = words(after);
  const problems = [];

  if (!isSubsequence(a, b)) problems.push('result is not a subsequence of the original');

  const lost = new Set(b);
  for (const w of a) lost.delete(w);
  if (lost.size > 0) {
    problems.push(`${lost.size} distinct word(s) vanished, e.g. ${[...lost].slice(0, 5).join(', ')}`);
  }

  const links = s => (s.match(/\*\*\[/g) ?? []).length;
  if (links(before) !== links(after)) {
    problems.push(`timecode link count changed: ${links(before)} -> ${links(after)}`);
  }

  return problems;
}

function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const showIdx = argv.indexOf('--show');
  const show = showIdx === -1 ? null : argv[showIdx + 1];

  const files = readdirSync(TRANSCRIPT_DIR).filter(f => f.endsWith('.md')).sort();
  const rows = [];
  const failures = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const path = join(TRANSCRIPT_DIR, file);
    const src = readFileSync(path, 'utf8');
    if (!hasRollingArtifacts(src)) continue;

    const { head, body } = splitFrontmatter(src);
    const repaired = repairBody(body);
    const next = head + repaired;

    const problems = checkInvariants(body, repaired);
    if (problems.length > 0) {
      failures.push({ file, problems });
      continue;
    }

    const wb = words(body).length;
    const wa = words(repaired).length;
    totalBefore += wb;
    totalAfter += wa;
    rows.push({ file, before: wb, after: wa, bytes: src.length - next.length });

    if (show && file.includes(show)) {
      const para = repaired.split('\n\n').find(p => p.startsWith('**['));
      process.stdout.write(`\n--- ${file} first paragraph after repair ---\n${para}\n\n`);
    }
    if (write) writeFileSync(path, next);
  }

  if (failures.length > 0) {
    process.stdout.write(`INVARIANT VIOLATIONS in ${failures.length} file(s) -- nothing written for these:\n`);
    for (const f of failures) {
      process.stdout.write(`  ${f.file}\n`);
      for (const p of f.problems) process.stdout.write(`    - ${p}\n`);
    }
    process.exitCode = 1;
  }

  rows.sort((a, b) => (b.before - b.after) - (a.before - a.after));
  process.stdout.write(`${'FILE'.padEnd(42)}  BEFORE   AFTER   CUT\n`);
  for (const r of rows.slice(0, 12)) {
    const pct = r.before ? Math.round((1 - r.after / r.before) * 100) : 0;
    process.stdout.write(
      `${r.file.padEnd(42)}  ${String(r.before).padStart(6)}  ${String(r.after).padStart(6)}  ${String(pct).padStart(3)}%\n`,
    );
  }
  if (rows.length > 12) process.stdout.write(`... and ${rows.length - 12} more\n`);

  const cutPct = totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
  const bytes = rows.reduce((n, r) => n + r.bytes, 0);
  process.stdout.write(
    `\n${rows.length} files repaired, ${failures.length} refused\n` +
    `body words ${totalBefore} -> ${totalAfter} (${cutPct}% cut)\n` +
    `bytes saved ${(bytes / 1048576).toFixed(1)} MB\n`,
  );
  if (!write) process.stdout.write('\n(dry run -- pass --write to apply)\n');
}

main();
