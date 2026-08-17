// Candidate finder for person names: compares surnames from the town roster in
// _data/org_chart.yml against surname-shaped tokens in the transcript corpus,
// and reports near misses for human review.
//
// This is a REVIEW AID, not a generator. Edit distance catches ASR errors that
// happen to be orthographically close ("Schmeckpepper" for "Schmeckpeper") and
// misses ones that are only acoustically close ("Coughlin" for "Coffin"), so a
// clean run here does not mean the corpus is clean. Nothing it prints should
// reach data/known_names.json without reading the surrounding transcript text.
//
// Usage:
//   node scripts/transcripts/tools/name_match.mjs             # near misses
//   node scripts/transcripts/tools/name_match.mjs --roster     # parsed roster only
//   node scripts/transcripts/tools/name_match.mjs --max 3      # edit-distance ceiling

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROSTER = '_data/org_chart.yml';
const TRANSCRIPT_DIR = '_transcripts';

// `name:` in org_chart.yml labels both bodies ("Select Board") and people
// ("Moses Grader"). Filter out the institutional ones.
const NOT_A_PERSON = /\b(Board|Committee|Commission|Commissioners|Department|Office|Trustees|Authority|Council|Fund|District|School|Library|Town|Selectmen|Group|Association|Team|Division|Bureau|Services|Waste|Buildings|Works|Health|Safety|Finance|Planning|Recreation|Assessors|Clerk|Treasurer|Collector|Inspector|Veterans|Public|Solid|Water|Sewer|Harbor|Light|Cemetery|Historical|Housing|Conservation|Zoning|Appeals|Aging|Disabilities)\b/;

export function parseRoster(src) {
  const names = new Set();
  for (const m of src.matchAll(/^\s*(?:-\s+)?name:\s*"([^"]+)"/gm)) {
    const value = m[1].trim();
    if (NOT_A_PERSON.test(value)) continue;
    const words = value.split(/\s+/);
    if (words.length < 2) continue;
    // Every word should look like a name part: Capitalized, an initial, or a particle.
    if (!words.every(w => /^([A-Z][a-z'’-]+|[A-Z]\.|[A-Z]|de|van|von|la|di)$/.test(w))) continue;
    names.add(value);
  }
  return [...names].sort();
}

function surnameOf(full) {
  const words = full.split(/\s+/).filter(w => !/^[A-Z]\.?$/.test(w));
  return words[words.length - 1]?.replace(/[^A-Za-z'’-]/g, '') ?? '';
}

function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Bare edit distance over every capitalized token drowns in common English
// words ("Well" is 2 edits from "Hull", "Right" 2 from "Knight"). So only look
// at tokens sitting in a position that is almost certainly a surname: right
// after an honorific, or right after the person's own first name.
function surnameSlots(dir) {
  const slots = new Map();   // token -> {count, contexts: Set<file>}
  const afterFirst = new Map(); // "First Token" -> count
  for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const src = readFileSync(join(dir, file), 'utf8').replace(/https?:\/\/\S+/g, ' ');
    for (const m of src.matchAll(/\b(?:Mr|Ms|Mrs|Dr|Chairman|Chairwoman|Chair|Superintendent|Selectman)\.?\s+([A-Z][a-z'’]{3,})\b/g)) {
      const t = m[1];
      if (!slots.has(t)) slots.set(t, { count: 0, files: new Set() });
      const s = slots.get(t);
      s.count += 1;
      s.files.add(file);
    }
    for (const m of src.matchAll(/\b([A-Z][a-z'’]{2,})\s+([A-Z][a-z'’]{3,})\b/g)) {
      const key = `${m[1]} ${m[2]}`;
      afterFirst.set(key, (afterFirst.get(key) ?? 0) + 1);
    }
  }
  return { slots, afterFirst };
}

function main() {
  const argv = process.argv.slice(2);
  const maxDist = Number(argv[argv.indexOf('--max') + 1]) || 2;

  const roster = parseRoster(readFileSync(ROSTER, 'utf8'));
  if (argv.includes('--roster')) {
    for (const n of roster) process.stdout.write(`${n}\t${surnameOf(n)}\n`);
    process.stderr.write(`\n${roster.length} people parsed from ${ROSTER}\n`);
    return;
  }

  const { slots, afterFirst } = surnameSlots(TRANSCRIPT_DIR);
  const surnames = new Map();
  for (const full of roster) {
    const s = surnameOf(full);
    if (s.length >= 4) surnames.set(s, full);
  }

  const rows = [];
  const seen = new Set();
  const add = row => {
    const key = `${row.candidate}|${row.surname}|${row.via}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const [surname, full] of surnames) {
    const correct = slots.get(surname)?.count ?? 0;

    // Honorific + near-miss surname.
    for (const [tok, s] of slots) {
      if (tok === surname || surnames.has(tok)) continue;
      const d = levenshtein(tok.toLowerCase(), surname.toLowerCase());
      if (d === 0 || d > maxDist) continue;
      add({ candidate: tok, count: s.count, d, surname, full, correct, via: 'honorific' });
    }

    // The person's own first name followed by a near-miss surname.
    const first = full.split(/\s+/)[0];
    for (const [pair, n] of afterFirst) {
      const [f, t] = pair.split(' ');
      if (f !== first || t === surname || surnames.has(t)) continue;
      const d = levenshtein(t.toLowerCase(), surname.toLowerCase());
      if (d === 0 || d > maxDist + 1) continue;
      add({ candidate: t, count: n, d, surname, full, correct, via: `after "${first}"` });
    }
  }

  rows.sort((a, b) => b.count - a.count || a.d - b.d);
  process.stdout.write('CANDIDATE       N  DIST  ROSTER SURNAME  CORRECT-N  VIA           PERSON\n');
  for (const r of rows) {
    process.stdout.write(
      `${r.candidate.padEnd(14)} ${String(r.count).padStart(3)}  ${r.d}     ` +
      `${r.surname.padEnd(15)} ${String(r.correct).padStart(8)}   ${r.via.padEnd(13)} ${r.full}\n`,
    );
  }
  process.stderr.write(
    `\n${rows.length} near misses in surname position across ${surnames.size} ` +
    `roster surnames. Review each against transcript context before adding.\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
