// Census of capitalized tokens across the transcript corpus, for building and
// maintaining data/known_names.json.
//
// Speech recognition errors are acoustic, not orthographic, so neither Soundex
// nor edit distance reliably links "Coughlin" to "Coffin". This tool therefore
// does not guess at corrections. It just reports what proper nouns the corpus
// actually contains and how often, so a human can compare that list against
// verified town sources and decide.
//
// Usage:
//   node scripts/transcripts/tools/name_census.mjs            # top 400 as a table
//   node scripts/transcripts/tools/name_census.mjs --json     # full list as JSON
//   node scripts/transcripts/tools/name_census.mjs --min 3    # frequency floor
//   node scripts/transcripts/tools/name_census.mjs --grep Cof # filter by substring

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TRANSCRIPT_DIR = '_transcripts';
const URL_RE = /https?:\/\/\S+/g;

// Capitalized words that are almost always sentence-initial English, not names.
// Kept short on purpose: over-filtering hides real names, and the output is
// reviewed by a human anyway.
const STOP = new Set([
  'The', 'A', 'An', 'And', 'But', 'So', 'Or', 'If', 'It', 'Is', 'In', 'On', 'At',
  'To', 'Of', 'For', 'We', 'You', 'I', 'He', 'She', 'They', 'This', 'That',
  'These', 'Those', 'There', 'Here', 'What', 'When', 'Where', 'Which', 'Who',
  'How', 'Why', 'Yes', 'No', 'Okay', 'OK', 'All', 'Right', 'Well', 'Now', 'Then',
  'Thank', 'Thanks', 'Yeah', 'Yep', 'Sure', 'Just', 'Let', 'Do', 'Does', 'Did',
  'Can', 'Could', 'Would', 'Should', 'Will', 'Have', 'Has', 'Had', 'Are', 'Was',
  'Were', 'Be', 'Been', 'Not', 'My', 'Our', 'Your', 'Their', 'His', 'Her', 'Its',
  'One', 'Two', 'Three', 'First', 'Second', 'Next', 'Last', 'Some', 'Any', 'Also',
  'Because', 'Before', 'After', 'About', 'Like', 'Really', 'Very', 'Sorry',
  'Please', 'Good', 'Great', 'Mr', 'Mrs', 'Ms', 'Dr',
  // Filler the ASR capitalizes as if it were a word.
  'Um', 'Uh', 'Mm', 'Hmm', 'Huh', 'Correct', 'Again', 'Sound', 'Sounds',
  // Calendar words dominate the counts and are never dictionary entries.
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]);

// "I'm", "That's", "We'll" -- capitalized only because they start a sentence.
const CONTRACTION_RE = /['’](s|m|ll|ve|d|re|t)$/i;

function stripFrontmatter(src) {
  if (!src.startsWith('---')) return { frontmatter: '', body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: src };
  return { frontmatter: src.slice(0, end), body: src.slice(end + 4) };
}

// A capitalized run of one to three words, e.g. "Coffin", "Mary Alley",
// "North Shore Medical". Longer names surface as overlapping shorter runs.
const RUN_RE = /\b[A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+){0,2}\b/g;

export function censusText(text, counts, sentenceInitial) {
  const clean = text.replace(URL_RE, ' ');
  for (const m of clean.matchAll(RUN_RE)) {
    const run = m[0].replace(/\s+/g, ' ');
    const words = run.split(' ');
    // Record the full run and each leading prefix, so both "Mary Alley" and
    // "Mary" get counted.
    for (let n = words.length; n >= 1; n -= 1) {
      const term = words.slice(0, n).join(' ');
      if (n === 1 && (STOP.has(term) || CONTRACTION_RE.test(term))) continue;
      if (CONTRACTION_RE.test(words[n - 1])) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    // Track whether the first word ever appears mid-sentence. A token that is
    // only ever sentence-initial is probably a common word, not a name.
    const before = clean.slice(Math.max(0, m.index - 2), m.index);
    if (!/(^|[.!?])\s*$/.test(before) && m.index > 0) {
      sentenceInitial.set(words[0], false);
    } else if (!sentenceInitial.has(words[0])) {
      sentenceInitial.set(words[0], true);
    }
  }
}

export function runCensus(dir = TRANSCRIPT_DIR) {
  const counts = new Map();
  const sentenceInitial = new Map();
  const docs = new Map();
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8');
    const { body } = stripFrontmatter(src);
    const local = new Map();
    censusText(body, local, sentenceInitial);
    for (const [term, n] of local) {
      counts.set(term, (counts.get(term) ?? 0) + n);
      docs.set(term, (docs.get(term) ?? 0) + 1);
    }
  }

  return { counts, docs, sentenceInitial, fileCount: files.length };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = name => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const min = Number(flag('--min') ?? 2);
  const grep = flag('--grep');
  const asJson = argv.includes('--json');
  const limit = Number(flag('--limit') ?? 400);

  const { counts, docs, sentenceInitial, fileCount } = runCensus();

  let rows = [...counts.entries()]
    .filter(([term, n]) => n >= min)
    .filter(([term]) => !(term.split(' ').length === 1 && sentenceInitial.get(term) === true))
    .filter(([term]) => (grep ? term.toLowerCase().includes(grep.toLowerCase()) : true))
    .map(([term, n]) => ({ term, count: n, files: docs.get(term) }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

  if (asJson) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return;
  }

  const total = rows.length;
  rows = rows.slice(0, limit);
  process.stderr.write(
    `${fileCount} transcripts; ${total} terms at count >= ${min}` +
    (total > rows.length ? `; showing top ${rows.length}` : '') + '\n\n',
  );
  const w = Math.max(...rows.map(r => r.term.length), 4);
  process.stdout.write(`${'TERM'.padEnd(w)}  COUNT  FILES\n`);
  for (const r of rows) {
    process.stdout.write(`${r.term.padEnd(w)}  ${String(r.count).padStart(5)}  ${String(r.files).padStart(5)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
