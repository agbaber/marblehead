# Bylaws History Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data pipeline that ingests Marblehead's General Bylaws (Part I) and its amendment history, then emits a real git repository whose commit history reproduces the current codified law exactly — each commit authored by an article's sponsor and carrying its Town Meeting vote tally.

**Architecture:** A Node ESM pipeline under `scripts/bylaws/`, following the existing `scripts/minutes/` convention (pure functions in `lib/*.mjs` with colocated `node:test` unit tests, orchestration scripts alongside, LLM prompts in `prompts/`). A canonical structured store in `data/bylaws-history/` is the single source of truth: `bylaws/*.md` (current text = HEAD) plus `amendments.jsonl` (one record per meeting-article). A generator walks the store oldest→newest and writes an actual `.git` repo. The master correctness check is a golden test: replaying every commit must reproduce the current text byte-for-byte.

**Tech Stack:** Node 24 ESM, `node:test` + `node:assert/strict`, `child_process` for git plumbing, the Anthropic SDK (already a dependency) for the LLM extraction steps, `diff` (npm) for text diffing.

**Scope:** General Bylaws Part I only. Verbatim diffs for amendments 2006–present (annual-report source text already in `data/town_docs/annual_reports/`); blame-only records for 1967–2005 (eCode amendment notes). The web tool (blame/timeline/diff UI) is a **separate follow-up plan** consuming this pipeline's JSON output.

---

## File Structure

```
scripts/bylaws/
  README.md                     # pipeline overview + run order
  lib/
    schema.mjs                  # amendment record shape + validators
    schema.test.mjs
    voteline.mjs                # parse "Voted Yes N No M ..." result lines
    voteline.test.mjs
    ecode_notes.mjs             # parse "[Amended M-D-YYYY ATM Art. N]" annotations
    ecode_notes.test.mjs
    sections.mjs                # parse eCode Part I export -> structured sections
    sections.test.mjs
    diffengine.mjs              # forward/inverse text patch application
    diffengine.test.mjs
    identity.mjs               # sponsor string -> stable git author identity
    identity.test.mjs
    timeline.mjs                # order amendments into a replayable sequence
    timeline.test.mjs
    gitemit.mjs                 # write commits into a real repo via git plumbing
    gitemit.test.mjs
  prompts/
    extract_articles.md         # LLM prompt: annual report -> article records
  acquire_ecode.mjs             # obtain + snapshot eCode Part I (raw)
  parse_bylaws.mjs              # raw eCode -> data/bylaws-history/bylaws/*.md + index
  extract_amendments.mjs        # annual reports + eCode notes -> amendments.jsonl
  reconcile.mjs                 # cross-check eCode dates vs report-derived; report gaps
  build_repo.mjs                # amendments.jsonl + bylaws/ -> generated git repo
  verify_golden.mjs             # replay repo HEAD == current text (master check)

data/bylaws-history/
  raw/ecode-part1.json          # snapshot of acquired eCode Part I (gitignored if large)
  bylaws/NNN-slug.md            # current codified text, one file per chapter (HEAD)
  section-index.json            # {sectionRef -> {chapter, heading, file, notes[]}}
  amendments.jsonl              # one record per (meeting, article)
  sponsor-map.json              # reviewed sponsor-string -> identity table
  reconcile-report.md           # generated: agreements, discrepancies, gaps
```

---

## Task 1: Pipeline scaffold + README

**Files:**
- Create: `scripts/bylaws/README.md`
- Create: `data/bylaws-history/.gitkeep`

- [ ] **Step 1: Create the directories and README**

Create `scripts/bylaws/README.md`:

```markdown
# Bylaws history pipeline

Builds a git repository of Marblehead's General Bylaws (Part I) where each
commit is a Town Meeting article, authored by its sponsor and carrying its
vote tally. See `docs/superpowers/specs/2026-07-15-bylaws-history-design.md`.

## Run order
1. `node scripts/bylaws/acquire_ecode.mjs`      # snapshot current codified text
2. `node scripts/bylaws/parse_bylaws.mjs`       # -> data/bylaws-history/bylaws/*.md + section-index.json
3. `node scripts/bylaws/extract_amendments.mjs` # -> amendments.jsonl
4. `node scripts/bylaws/reconcile.mjs`          # -> reconcile-report.md
5. `node scripts/bylaws/build_repo.mjs`         # -> generated git repo
6. `node scripts/bylaws/verify_golden.mjs`      # master check: replay == current text

## Test
`node --test scripts/bylaws/lib/*.test.mjs`

## Honest constraints (do not violate)
- Open Town Meeting is anonymous: attribute sponsor + aggregate tally only.
- Never fabricate historical text: blame-only records carry no reconstructed body.
```

Create empty `data/bylaws-history/.gitkeep`.

- [ ] **Step 2: Commit**

```bash
git add scripts/bylaws/README.md data/bylaws-history/.gitkeep
git commit -m "bylaws: scaffold pipeline directory + README"
```

---

## Task 2: Amendment record schema + validator

**Files:**
- Create: `scripts/bylaws/lib/schema.mjs`
- Test: `scripts/bylaws/lib/schema.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAmendment, DISPOSITIONS, FIDELITIES } from './schema.mjs';

const valid = {
  meeting: { date: '2019-05-06', type: 'ATM' },
  article: 14,
  sponsor: 'Planning Board',
  vote: { yes: 611, no: 204, threshold: 'majority', met: true },
  disposition: 'passed',
  affects: ['074-3'],
  change: { kind: 'touched' },
  source: { doc: 'Annual-Report-2019.txt', page: 187 },
  fidelity: 'blame',
};

test('accepts a well-formed record', () => {
  assert.deepEqual(validateAmendment(valid), []);
});

test('rejects missing source (citation discipline)', () => {
  const bad = { ...valid, source: undefined };
  const errs = validateAmendment(bad);
  assert.ok(errs.some(e => e.includes('source')));
});

test('rejects unknown disposition', () => {
  const bad = { ...valid, disposition: 'maybe' };
  assert.ok(validateAmendment(bad).some(e => e.includes('disposition')));
});

test('verbatim record requires a before/after change body', () => {
  const bad = { ...valid, fidelity: 'verbatim', change: { kind: 'touched' } };
  assert.ok(validateAmendment(bad).some(e => e.includes('verbatim')));
});

test('exposes the closed vocabularies', () => {
  assert.deepEqual(DISPOSITIONS, ['passed', 'defeated', 'withdrawn', 'referred']);
  assert.deepEqual(FIDELITIES, ['verbatim', 'blame']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/schema.test.mjs`
Expected: FAIL — cannot find module `./schema.mjs`.

- [ ] **Step 3: Write minimal implementation**

```javascript
export const DISPOSITIONS = ['passed', 'defeated', 'withdrawn', 'referred'];
export const FIDELITIES = ['verbatim', 'blame'];
const MEETING_TYPES = ['ATM', 'STM'];

export function validateAmendment(a) {
  const errs = [];
  if (!a || typeof a !== 'object') return ['record is not an object'];
  if (!a.meeting || !/^\d{4}-\d{2}-\d{2}$/.test(a.meeting.date || ''))
    errs.push('meeting.date must be YYYY-MM-DD');
  if (!MEETING_TYPES.includes(a.meeting?.type))
    errs.push(`meeting.type must be one of ${MEETING_TYPES.join(', ')}`);
  if (!Number.isInteger(a.article)) errs.push('article must be an integer');
  if (!a.sponsor || typeof a.sponsor !== 'string') errs.push('sponsor is required');
  if (!DISPOSITIONS.includes(a.disposition))
    errs.push(`disposition must be one of ${DISPOSITIONS.join(', ')}`);
  if (!FIDELITIES.includes(a.fidelity))
    errs.push(`fidelity must be one of ${FIDELITIES.join(', ')}`);
  if (!Array.isArray(a.affects)) errs.push('affects must be an array of section refs');
  if (!a.source || !a.source.doc) errs.push('source.doc is required (citation discipline)');
  if (a.disposition === 'passed' && a.vote &&
      (!Number.isInteger(a.vote.yes) || !Number.isInteger(a.vote.no)))
    errs.push('passed record needs integer vote.yes and vote.no');
  if (a.fidelity === 'verbatim' && a.change?.kind !== 'edit')
    errs.push('verbatim record requires change.kind === "edit" with before/after text');
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/schema.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/schema.mjs scripts/bylaws/lib/schema.test.mjs
git commit -m "bylaws: amendment record schema + validator"
```

---

## Task 3: Vote-line parser

Parses the result lines seen in the annual reports, e.g.
`Voted Yes 599 No 85: That the Town adopt an order requiring articles...`
and `Voted Yes 638 No 97 2/3rd vote achieved`.

**Files:**
- Create: `scripts/bylaws/lib/voteline.mjs`
- Test: `scripts/bylaws/lib/voteline.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoteLine } from './voteline.mjs';

test('parses a simple majority tally', () => {
  const r = parseVoteLine('Voted Yes 599 No 85: That the Town adopt an order');
  assert.deepEqual(r, { yes: 599, no: 85, threshold: 'majority', met: true, rest: 'That the Town adopt an order' });
});

test('parses a two-thirds tally', () => {
  const r = parseVoteLine('Voted Yes 638 No 97 2/3rd vote achieved');
  assert.equal(r.yes, 638);
  assert.equal(r.no, 97);
  assert.equal(r.threshold, 'two-thirds');
  assert.equal(r.met, true);
});

test('parses a four-fifths tally', () => {
  const r = parseVoteLine('Voted Yes 714 No 76 4/5th vote achieved');
  assert.equal(r.threshold, 'four-fifths');
  assert.equal(r.met, true);
});

test('detects a tally that appears defeated on a supermajority', () => {
  const r = parseVoteLine('Voted Yes 469 No 345');
  assert.equal(r.yes, 469);
  assert.equal(r.no, 345);
  assert.equal(r.threshold, 'majority');
  assert.equal(r.met, true);
});

test('returns null for a non-vote line', () => {
  assert.equal(parseVoteLine('To see if the Town will vote to amend'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/voteline.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
const VOTE_RE = /^\s*Voted\s+Yes\s+(\d+)\s+No\s+(\d+)\s*(.*)$/i;

const THRESHOLDS = [
  { re: /2\/3(rd)?/i, name: 'two-thirds' },
  { re: /4\/5(th)?/i, name: 'four-fifths' },
];

export function parseVoteLine(line) {
  const m = VOTE_RE.exec(line);
  if (!m) return null;
  const yes = Number(m[1]);
  const no = Number(m[2]);
  let tail = (m[3] || '').trim();
  let threshold = 'majority';
  for (const t of THRESHOLDS) {
    if (t.re.test(tail)) { threshold = t.name; break; }
  }
  // "vote achieved" phrasing means the supermajority was met.
  const met = /achieved/i.test(tail) ? true : yes > no;
  const rest = tail.replace(/^:\s*/, '')
                   .replace(/\b\d\/\d(rd|th)?\s*vote\s*(achieved|not achieved)\b/i, '')
                   .trim();
  return { yes, no, threshold, met, rest };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/voteline.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/voteline.mjs scripts/bylaws/lib/voteline.test.mjs
git commit -m "bylaws: vote-line parser for annual-report tallies"
```

---

## Task 4: eCode amendment-note parser

Parses the bracketed provenance eCode attaches to sections, e.g.
`[Amended 5-6-2019 ATM by Art. 14]`, `[Added 5-1-1995 STM by Art. 3]`.
This is the blame backbone for 1967–2005.

**Files:**
- Create: `scripts/bylaws/lib/ecode_notes.mjs`
- Test: `scripts/bylaws/lib/ecode_notes.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmendmentNotes } from './ecode_notes.mjs';

test('parses a single amended note', () => {
  const notes = parseAmendmentNotes('[Amended 5-6-2019 ATM by Art. 14]');
  assert.deepEqual(notes, [
    { action: 'amended', date: '2019-05-06', type: 'ATM', article: 14 },
  ]);
});

test('parses added + amended in one blurb', () => {
  const notes = parseAmendmentNotes(
    'History: [Added 5-1-1995 STM by Art. 3; Amended 5-2-2011 ATM by Art. 22]'
  );
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0], { action: 'added', date: '1995-05-01', type: 'STM', article: 3 });
  assert.deepEqual(notes[1], { action: 'amended', date: '2011-05-02', type: 'ATM', article: 22 });
});

test('normalizes zero-padless dates', () => {
  const [n] = parseAmendmentNotes('[Amended 3-14-1972 ATM by Art. 1]');
  assert.equal(n.date, '1972-03-14');
});

test('returns empty array when there is no note', () => {
  assert.deepEqual(parseAmendmentNotes('The dog officer shall...'), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/ecode_notes.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
const NOTE_RE = /\b(Added|Amended|Repealed)\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+(ATM|STM)\s+by\s+Art\.?\s+(\d+)/gi;

function iso(mm, dd, yyyy) {
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseAmendmentNotes(text) {
  const out = [];
  for (const m of (text || '').matchAll(NOTE_RE)) {
    out.push({
      action: m[1].toLowerCase(),
      date: iso(m[2], m[3], m[4]),
      type: m[5].toUpperCase(),
      article: Number(m[6]),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/ecode_notes.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/ecode_notes.mjs scripts/bylaws/lib/ecode_notes.test.mjs
git commit -m "bylaws: eCode amendment-note parser (blame backbone)"
```

---

## Task 5: Sponsor identity mapping

Maps a sponsor string to a stable git author identity, with a
reviewable overrides table so odd report phrasings collapse to one identity.

**Files:**
- Create: `scripts/bylaws/lib/identity.mjs`
- Test: `scripts/bylaws/lib/identity.test.mjs`
- Create: `data/bylaws-history/sponsor-map.json`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIdentity } from './identity.mjs';

const map = {
  'Board of Selectmen': 'Select Board',
  'Selectmen': 'Select Board',
  'FinCom': 'Finance Committee',
};

test('canonicalizes a known alias', () => {
  const id = toIdentity('Board of Selectmen', map);
  assert.deepEqual(id, { name: 'Select Board', email: 'select-board@marblehead.town' });
});

test('slugifies an unmapped sponsor deterministically', () => {
  const id = toIdentity('Recreation & Parks Commission', map);
  assert.equal(id.name, 'Recreation & Parks Commission');
  assert.equal(id.email, 'recreation-parks-commission@marblehead.town');
});

test('handles a named citizen petitioner', () => {
  const id = toIdentity('Citizen Petition (J. Buba et al.)', map);
  assert.equal(id.email, 'citizen-petition-j-buba-et-al@marblehead.town');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/identity.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
function slug(s) {
  return s.toLowerCase()
          .replace(/&/g, ' ')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
}

export function toIdentity(sponsor, map = {}) {
  const name = map[sponsor] || sponsor;
  return { name, email: `${slug(name)}@marblehead.town` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/identity.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Seed the reviewable sponsor map**

Create `data/bylaws-history/sponsor-map.json`:

```json
{
  "Board of Selectmen": "Select Board",
  "Selectmen": "Select Board",
  "Select Board": "Select Board",
  "FinCom": "Finance Committee",
  "Finance Committee": "Finance Committee",
  "Planning Board": "Planning Board",
  "School Committee": "School Committee"
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/bylaws/lib/identity.mjs scripts/bylaws/lib/identity.test.mjs data/bylaws-history/sponsor-map.json
git commit -m "bylaws: sponsor -> git identity mapping + seed table"
```

---

## Task 6: Diff engine (forward + inverse patch)

The replay walks HEAD backward, so we need to apply a patch's inverse.
A verbatim `change.kind === 'edit'` carries `{ section, before, after }`;
`invert` swaps them.

**Files:**
- Create: `scripts/bylaws/lib/diffengine.mjs`
- Test: `scripts/bylaws/lib/diffengine.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdit, invertEdit } from './diffengine.mjs';

const edit = { kind: 'edit', section: '074-3', before: 'a leash of 6 feet', after: 'a leash of 8 feet' };
const doc = { '074-3': 'Dogs shall be on a leash of 6 feet at all times.' };

test('applyEdit replaces before with after in the target section', () => {
  const out = applyEdit(doc, edit);
  assert.equal(out['074-3'], 'Dogs shall be on a leash of 8 feet at all times.');
});

test('applyEdit throws if before text is absent (guards a bad patch)', () => {
  assert.throws(() => applyEdit(doc, { ...edit, before: 'nonexistent' }), /before text not found/);
});

test('invertEdit swaps before and after', () => {
  const inv = invertEdit(edit);
  assert.equal(inv.before, 'a leash of 8 feet');
  assert.equal(inv.after, 'a leash of 6 feet');
});

test('applying an edit then its inverse round-trips the document', () => {
  const forward = applyEdit(doc, edit);
  const back = applyEdit(forward, invertEdit(edit));
  assert.deepEqual(back, doc);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/diffengine.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
export function applyEdit(doc, edit) {
  if (edit.kind !== 'edit') return doc;
  const body = doc[edit.section];
  if (body == null) throw new Error(`section ${edit.section} not present`);
  if (!body.includes(edit.before)) throw new Error(`before text not found in ${edit.section}`);
  return { ...doc, [edit.section]: body.replace(edit.before, edit.after) };
}

export function invertEdit(edit) {
  return { ...edit, before: edit.after, after: edit.before };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/diffengine.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/diffengine.mjs scripts/bylaws/lib/diffengine.test.mjs
git commit -m "bylaws: diff engine with invertible section edits"
```

---

## Task 7: Timeline ordering

Orders amendment records into a replayable sequence (oldest first), stable
within a meeting by article number, and separates bylaw-changing records
(passed + affects non-empty) from non-changing ones (defeated / appropriations)
that still belong in the log as closed changes.

**Files:**
- Create: `scripts/bylaws/lib/timeline.mjs`
- Test: `scripts/bylaws/lib/timeline.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTimeline } from './timeline.mjs';

const recs = [
  { meeting: { date: '2011-05-02', type: 'ATM' }, article: 22, disposition: 'passed', affects: ['074-3'] },
  { meeting: { date: '2019-05-06', type: 'ATM' }, article: 14, disposition: 'passed', affects: ['074-3'] },
  { meeting: { date: '2011-05-02', type: 'ATM' }, article: 5, disposition: 'defeated', affects: [] },
];

test('orders oldest-first, then by article number within a meeting', () => {
  const t = orderTimeline(recs);
  assert.deepEqual(
    t.map(r => `${r.meeting.date}#${r.article}`),
    ['2011-05-02#5', '2011-05-02#22', '2019-05-06#14']
  );
});

test('flags whether each record changes the bylaw text', () => {
  const t = orderTimeline(recs);
  assert.equal(t.find(r => r.article === 22).changesText, true);
  assert.equal(t.find(r => r.article === 5).changesText, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/timeline.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
export function orderTimeline(records) {
  return [...records]
    .map(r => ({ ...r, changesText: r.disposition === 'passed' && (r.affects?.length > 0) }))
    .sort((a, b) => {
      if (a.meeting.date !== b.meeting.date) return a.meeting.date < b.meeting.date ? -1 : 1;
      return a.article - b.article;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/timeline.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/timeline.mjs scripts/bylaws/lib/timeline.test.mjs
git commit -m "bylaws: timeline ordering with changes-text flag"
```

---

## Task 8: Commit message + author formatting

Formats a timeline record into the git author identity and the commit
message body (article title, tally, source citation, fidelity tag).

**Files:**
- Modify: `scripts/bylaws/lib/gitemit.mjs` (create in this task)
- Test: `scripts/bylaws/lib/gitemit.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCommit } from './gitemit.mjs';

const rec = {
  meeting: { date: '2019-05-06', type: 'ATM' },
  article: 14,
  title: 'Amend leash bylaw',
  sponsor: 'Planning Board',
  vote: { yes: 611, no: 204, threshold: 'majority', met: true },
  disposition: 'passed',
  source: { doc: 'Annual-Report-2019.txt', page: 187 },
  fidelity: 'verbatim',
};
const map = { 'Planning Board': 'Planning Board' };

test('builds subject with meeting, article, and title', () => {
  const c = formatCommit(rec, map);
  assert.equal(c.subject, '2019 ATM Art. 14: Amend leash bylaw');
});

test('body carries tally, sponsor, source, fidelity', () => {
  const c = formatCommit(rec, map);
  assert.match(c.body, /Voted Yes 611 No 204 \(majority\)/);
  assert.match(c.body, /Sponsor: Planning Board/);
  assert.match(c.body, /Source: Annual-Report-2019\.txt p\.187/);
  assert.match(c.body, /Fidelity: verbatim/);
});

test('author is the mapped sponsor identity; date is the meeting date', () => {
  const c = formatCommit(rec, map);
  assert.equal(c.authorName, 'Planning Board');
  assert.equal(c.authorEmail, 'planning-board@marblehead.town');
  assert.equal(c.date, '2019-05-06T12:00:00');
});

test('defeated article says Defeated in the body', () => {
  const d = { ...rec, disposition: 'defeated', vote: { yes: 204, no: 611, threshold: 'majority', met: false } };
  assert.match(formatCommit(d, map).body, /Disposition: defeated/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/gitemit.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
import { toIdentity } from './identity.mjs';

export function formatCommit(rec, sponsorMap) {
  const id = toIdentity(rec.sponsor, sponsorMap);
  const year = rec.meeting.date.slice(0, 4);
  const subject = `${year} ${rec.meeting.type} Art. ${rec.article}: ${rec.title}`;
  const lines = [];
  if (rec.vote) {
    lines.push(`Voted Yes ${rec.vote.yes} No ${rec.vote.no} (${rec.vote.threshold})` +
               `${rec.vote.met ? '' : ' — not met'}`);
  }
  lines.push(`Sponsor: ${rec.sponsor}`);
  lines.push(`Disposition: ${rec.disposition}`);
  lines.push(`Source: ${rec.source.doc} p.${rec.source.page}`);
  lines.push(`Fidelity: ${rec.fidelity}`);
  return {
    subject,
    body: lines.join('\n'),
    authorName: id.name,
    authorEmail: id.email,
    date: `${rec.meeting.date}T12:00:00`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/gitemit.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/lib/gitemit.mjs scripts/bylaws/lib/gitemit.test.mjs
git commit -m "bylaws: commit message + author formatting"
```

---

## Task 9: Acquire eCode Part I (IO — sourcing task)

> **Note:** This is a data-acquisition task, not a pure-function task. eCode360
> is bot-protected, so this deliberately does NOT scrape. It produces a raw
> snapshot the downstream parser targets. **This is the critical-path blocker
> from the spec — if it stalls, stop and escalate; do not fake data.**

**Files:**
- Create: `scripts/bylaws/acquire_ecode.mjs`
- Output: `data/bylaws-history/raw/ecode-part1.json`

- [ ] **Step 1: Obtain Part I text (in priority order)**

Try, in order, and record which worked in a top-of-file comment:
1. General Code's official downloadable PDF/print export of Part I (request via
   the "Download"/print affordance on ecode360.com, or email General Code
   support / the Marblehead Town Clerk for the code data file).
2. If a PDF is obtained, extract with `pdftotext -layout` (already used for
   annual reports — see `data/town_docs/annual_reports/README.md`).

Save the source PDF/text under `data/bylaws-history/raw/` (gitignore large PDFs,
mirroring the annual-reports convention).

- [ ] **Step 2: Write `acquire_ecode.mjs` to normalize the raw source into JSON**

The script reads the obtained text file (path via `--in`) and writes
`data/bylaws-history/raw/ecode-part1.json` shaped as:

```javascript
// [{ chapter: "074", chapterTitle: "Dogs", sections: [
//    { ref: "074-3", heading: "Leash requirement", body: "…", noteText: "[Amended …]" } ] }]
```

Because the exact export layout is unknown until Step 1 completes, write the
normalizer against the **observed** format: print the first 200 lines of the
raw file, identify the chapter/section delimiters, and encode those delimiters
as named constants at the top of the script. Do not guess — inspect first.

- [ ] **Step 3: Verify the snapshot is complete**

Run: `node scripts/bylaws/acquire_ecode.mjs --in data/bylaws-history/raw/<source> && node -e "const d=require('./data/bylaws-history/raw/ecode-part1.json'); console.log('chapters:', d.length, 'sections:', d.reduce((n,c)=>n+c.sections.length,0))"`
Expected: chapter count matches eCode's Part I table of contents (spot-check 3
chapter titles against ecode360.com). If counts are implausible (e.g. 1 chapter),
the delimiters are wrong — fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add scripts/bylaws/acquire_ecode.mjs
git add data/bylaws-history/raw/ecode-part1.json   # commit the normalized JSON; raw PDF stays gitignored
git commit -m "bylaws: acquire + normalize eCode Part I snapshot"
```

---

## Task 10: Parse bylaws into the canonical store

Turns the raw snapshot into `bylaws/*.md` (HEAD) and `section-index.json`,
attaching parsed amendment notes to each section.

**Files:**
- Create: `scripts/bylaws/parse_bylaws.mjs`
- Uses: `scripts/bylaws/lib/sections.mjs` (+ test), `lib/ecode_notes.mjs`
- Output: `data/bylaws-history/bylaws/*.md`, `data/bylaws-history/section-index.json`

- [ ] **Step 1: Write the failing test for `sections.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStore } from './sections.mjs';

const raw = [{
  chapter: '074', chapterTitle: 'Dogs',
  sections: [
    { ref: '074-3', heading: 'Leash requirement', body: 'Dogs shall be leashed.', noteText: '[Amended 5-6-2019 ATM by Art. 14]' },
  ],
}];

test('produces one markdown file per chapter keyed by filename', () => {
  const { files } = toStore(raw);
  assert.ok(files['074-dogs.md']);
  assert.match(files['074-dogs.md'], /# Chapter 074: Dogs/);
  assert.match(files['074-dogs.md'], /Dogs shall be leashed\./);
});

test('section index carries parsed notes and file pointer', () => {
  const { index } = toStore(raw);
  assert.equal(index['074-3'].file, '074-dogs.md');
  assert.equal(index['074-3'].heading, 'Leash requirement');
  assert.deepEqual(index['074-3'].notes, [
    { action: 'amended', date: '2019-05-06', type: 'ATM', article: 14 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/sections.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation of `sections.mjs`**

```javascript
import { parseAmendmentNotes } from './ecode_notes.mjs';

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function toStore(raw) {
  const files = {};
  const index = {};
  for (const ch of raw) {
    const filename = `${ch.chapter}-${slug(ch.chapterTitle)}.md`;
    const parts = [`# Chapter ${ch.chapter}: ${ch.chapterTitle}`, ''];
    for (const s of ch.sections) {
      parts.push(`## § ${s.ref} ${s.heading}`, '', s.body, '');
      index[s.ref] = {
        chapter: ch.chapter,
        heading: s.heading,
        file: filename,
        notes: parseAmendmentNotes(s.noteText || ''),
      };
    }
    files[filename] = parts.join('\n');
  }
  return { files, index };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/sections.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the orchestration script `parse_bylaws.mjs`**

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { toStore } from './lib/sections.mjs';

const RAW = 'data/bylaws-history/raw/ecode-part1.json';
const OUTDIR = 'data/bylaws-history/bylaws';

const raw = JSON.parse(readFileSync(RAW, 'utf8'));
const { files, index } = toStore(raw);
mkdirSync(OUTDIR, { recursive: true });
for (const [name, body] of Object.entries(files)) {
  writeFileSync(`${OUTDIR}/${name}`, body);
}
writeFileSync('data/bylaws-history/section-index.json', JSON.stringify(index, null, 2));
console.log(`wrote ${Object.keys(files).length} chapters, ${Object.keys(index).length} sections`);
```

- [ ] **Step 6: Run it and eyeball output**

Run: `node scripts/bylaws/parse_bylaws.mjs`
Expected: prints chapter/section counts; `data/bylaws-history/bylaws/` contains
one `.md` per chapter; open one and confirm headings + body read correctly.

- [ ] **Step 7: Commit**

```bash
git add scripts/bylaws/lib/sections.mjs scripts/bylaws/lib/sections.test.mjs scripts/bylaws/parse_bylaws.mjs data/bylaws-history/bylaws data/bylaws-history/section-index.json
git commit -m "bylaws: parse eCode snapshot into canonical store (HEAD)"
```

---

## Task 11: Extract amendments (LLM + notes → amendments.jsonl)

> **Note:** IO + LLM task. Two sources merge into `amendments.jsonl`:
> (a) eCode notes for the full blame backbone, (b) annual-report article text
> for verbatim 2006+ records. Extraction is LLM-assisted but verified against
> the quoted source (citation discipline) — never blind.

**Files:**
- Create: `scripts/bylaws/prompts/extract_articles.md`
- Create: `scripts/bylaws/extract_amendments.mjs`
- Uses: `lib/voteline.mjs`, `lib/schema.mjs`, `lib/identity.mjs`
- Output: `data/bylaws-history/amendments.jsonl`

- [ ] **Step 1: Write the extraction prompt**

Create `scripts/bylaws/prompts/extract_articles.md`:

```markdown
You are extracting Town Meeting warrant articles that amend the General Bylaws
from one Annual Town Report. Return JSON array; one object per article that
AMENDS, ADDS, or REPEALS a General Bylaw section. Ignore appropriations,
acceptances, and elections.

For each article output:
- article (integer), title (short verbatim phrase from the article),
- sponsor (the moving board/committee or "Citizen Petition (...)"),
- affects (list of bylaw section refs the article changes, e.g. "074-3"),
- change: { kind: "edit", section, before, after } using the EXACT struck and
  inserted text quoted from the warrant; if the article's wording does not give
  exact before/after text, set change: { kind: "touched" } and fidelity "blame",
- disposition: passed|defeated|withdrawn|referred,
- quote: the verbatim sentence you took the vote/disposition from.

Do NOT infer text that is not in the source. Quote, don't paraphrase.
```

- [ ] **Step 2: Write `extract_amendments.mjs`**

The script:
1. Loads `section-index.json`; emits one blame record per eCode note
   (`fidelity: 'blame'`, `change: { kind: 'touched' }`, `source` = eCode).
2. For each `Annual-Report-YYYY.txt` with `YYYY >= 2006`, sends the warrant
   section to the Anthropic SDK with the prompt; parses returned articles;
   attaches `vote` by running `parseVoteLine` over the report's result line for
   that article; sets `source` = `{ doc: 'Annual-Report-YYYY.txt', page }`.
3. Validates every record with `validateAmendment`; writes only valid records to
   `amendments.jsonl`; writes rejects to `amendments.rejects.jsonl` for review.

Use `@anthropic-ai/sdk` (already a dependency) with `claude-opus-4-8`. Read the
key from `ANTHROPIC_API_KEY`; if absent, print the missing-secret message from
the box CLAUDE.md and exit non-zero rather than inventing data.

- [ ] **Step 3: Run on a single year first (cheap smoke)**

Run: `node scripts/bylaws/extract_amendments.mjs --only 2019`
Expected: prints N articles extracted, M valid, 0 rejects (or lists rejects).
Manually open 2 records and confirm `change.before`/`after` are verbatim quotes
present in `Annual-Report-2019.txt`.

- [ ] **Step 4: Run the full extraction**

Run: `node scripts/bylaws/extract_amendments.mjs`
Expected: `amendments.jsonl` written; prints counts by fidelity. Blame records
should span 1967–2005; verbatim records cluster 2006+.

- [ ] **Step 5: Commit**

```bash
git add scripts/bylaws/prompts/extract_articles.md scripts/bylaws/extract_amendments.mjs data/bylaws-history/amendments.jsonl
git commit -m "bylaws: extract amendments (blame notes + verbatim 2006+)"
```

---

## Task 12: Reconcile eCode dates vs report-derived amendments

Cross-checks that every post-2006 eCode note has a matching report-derived
record and vice versa; writes a human-readable discrepancy report. Does not
mutate data — surfaces gaps.

**Files:**
- Create: `scripts/bylaws/lib/reconcile.mjs` (+ test)
- Create: `scripts/bylaws/reconcile.mjs`
- Output: `data/bylaws-history/reconcile-report.md`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './reconcile.mjs';

const notes = [
  { section: '074-3', date: '2019-05-06', article: 14 },
  { section: '074-9', date: '2008-05-05', article: 7 },
];
const verbatim = [
  { affects: ['074-3'], meeting: { date: '2019-05-06' }, article: 14 },
];

test('flags a post-2006 eCode note with no verbatim match', () => {
  const r = reconcile(notes, verbatim, { cutoff: '2006-01-01' });
  assert.deepEqual(r.missingVerbatim, [{ section: '074-9', date: '2008-05-05', article: 7 }]);
});

test('does not flag pre-cutoff notes (blame-only is expected there)', () => {
  const pre = [{ section: '020-1', date: '1989-05-01', article: 3 }];
  const r = reconcile(pre, [], { cutoff: '2006-01-01' });
  assert.deepEqual(r.missingVerbatim, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/reconcile.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
export function reconcile(notes, verbatim, { cutoff }) {
  const key = (date, article) => `${date}#${article}`;
  const haveVerbatim = new Set(verbatim.map(v => key(v.meeting.date, v.article)));
  const missingVerbatim = notes
    .filter(n => n.date >= cutoff && !haveVerbatim.has(key(n.date, n.article)))
    .map(n => ({ section: n.section, date: n.date, article: n.article }));
  return { missingVerbatim };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/reconcile.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `reconcile.mjs` to emit the report**

Loads `section-index.json` (flatten notes with their section ref),
`amendments.jsonl` (verbatim subset), calls `reconcile` with
`cutoff: '2006-01-01'`, and writes `reconcile-report.md` listing
`missingVerbatim` under a "Post-2006 eCode changes with no verbatim source"
heading. Exit 0 always (report, don't fail the build).

- [ ] **Step 6: Run it**

Run: `node scripts/bylaws/reconcile.mjs`
Expected: `reconcile-report.md` written; review the gap list. A short list is
expected (some articles reference attached documents); a huge list means the
extractor's section mapping is off — investigate before building the repo.

- [ ] **Step 7: Commit**

```bash
git add scripts/bylaws/lib/reconcile.mjs scripts/bylaws/lib/reconcile.test.mjs scripts/bylaws/reconcile.mjs data/bylaws-history/reconcile-report.md
git commit -m "bylaws: reconcile eCode notes vs verbatim extractions"
```

---

## Task 13: Build the git repo

Generates a real git repository from the canonical store: seed the earliest
reconstructable state, then commit each timeline record oldest→newest so HEAD
reproduces the current text. Verbatim edits carry real diffs; blame records are
touch-only (a marker line in the affected file's provenance section, never
fabricated body text).

**Files:**
- Create: `scripts/bylaws/build_repo.mjs`
- Extend: `scripts/bylaws/lib/gitemit.mjs` with `commitInto(repoDir, commit, changedFiles)` (+ tests)
- Output: `dist/bylaws-repo/` (generated; gitignored in the main repo)

- [ ] **Step 1: Write the failing test for `commitInto`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initRepo, commitInto } from './gitemit.mjs';

test('commitInto records author, date, and message and advances HEAD', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bylaws-'));
  initRepo(dir);
  writeFileSync(join(dir, '074-dogs.md'), 'v1\n');
  commitInto(dir, {
    subject: '2019 ATM Art. 14: Amend leash bylaw',
    body: 'Voted Yes 611 No 204 (majority)',
    authorName: 'Planning Board',
    authorEmail: 'planning-board@marblehead.town',
    date: '2019-05-06T12:00:00',
  }, ['074-dogs.md']);
  const log = execFileSync('git', ['-C', dir, 'log', '-1', '--pretty=%an|%ae|%ad|%s', '--date=short'], { encoding: 'utf8' });
  assert.match(log, /Planning Board\|planning-board@marblehead\.town\|2019-05-06\|2019 ATM Art\. 14/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/gitemit.test.mjs`
Expected: FAIL — `initRepo`/`commitInto` not exported.

- [ ] **Step 3: Add `initRepo` and `commitInto` to `gitemit.mjs`**

```javascript
import { execFileSync } from 'node:child_process';

export function initRepo(dir) {
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'bylaws-pipeline']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'pipeline@marblehead.town']);
}

export function commitInto(dir, commit, changedFiles) {
  execFileSync('git', ['-C', dir, 'add', ...changedFiles]);
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: commit.authorName, GIT_AUTHOR_EMAIL: commit.authorEmail,
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_NAME: commit.authorName, GIT_COMMITTER_EMAIL: commit.authorEmail,
    GIT_COMMITTER_DATE: commit.date,
  };
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', commit.subject, '-m', commit.body], { env });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/gitemit.test.mjs`
Expected: PASS (all gitemit tests).

- [ ] **Step 5: Write `build_repo.mjs`**

Loads `amendments.jsonl`, orders with `orderTimeline`, reconstructs the initial
document by applying inverse verbatim edits back from HEAD (`bylaws/*.md`), then
in a fresh `dist/bylaws-repo/`: `initRepo`, write the reconstructed initial
files, commit "Initial codified baseline (1967 Code)", then replay forward —
for each record `formatCommit` + apply the forward edit (verbatim) or append a
provenance marker line (blame) + `commitInto` + tag each new meeting
(`git tag "TM-YYYY-MM-DD"`). Print the commit count.

- [ ] **Step 6: Run it**

Run: `node scripts/bylaws/build_repo.mjs`
Expected: `dist/bylaws-repo/.git` exists; `git -C dist/bylaws-repo log --oneline | wc -l` is in the low hundreds; `git -C dist/bylaws-repo log -1` shows a real sponsor author and tally.

- [ ] **Step 7: Commit** (the generator + gitignore, not the generated repo)

```bash
echo "dist/" >> .gitignore
git add scripts/bylaws/build_repo.mjs scripts/bylaws/lib/gitemit.mjs scripts/bylaws/lib/gitemit.test.mjs .gitignore
git commit -m "bylaws: generate git repo from canonical store"
```

---

## Task 14: Golden verification (master check)

Proves the reconstruction is faithful: the generated repo's HEAD content must
equal the current canonical `bylaws/*.md` byte-for-byte.

**Files:**
- Create: `scripts/bylaws/verify_golden.mjs`

- [ ] **Step 1: Write `verify_golden.mjs`**

```javascript
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'dist/bylaws-repo';
const SRC = 'data/bylaws-history/bylaws';

let failures = 0;
for (const name of readdirSync(SRC)) {
  const want = readFileSync(`${SRC}/${name}`, 'utf8');
  const got = execFileSync('git', ['-C', REPO, 'show', `HEAD:${name}`], { encoding: 'utf8' });
  if (got !== want) {
    failures++;
    console.error(`MISMATCH: ${name} (HEAD differs from canonical text)`);
  }
}
if (failures) {
  console.error(`GOLDEN FAILED: ${failures} file(s) differ. The replay does not reproduce current law.`);
  process.exit(1);
}
console.log('GOLDEN PASSED: replayed HEAD reproduces current bylaws exactly.');
```

- [ ] **Step 2: Run it**

Run: `node scripts/bylaws/build_repo.mjs && node scripts/bylaws/verify_golden.mjs`
Expected: `GOLDEN PASSED`. If it fails, a verbatim `change.before/after` is
inexact — the mismatch names the chapter; fix that amendment record's text and
rebuild. (Blame-only sections are unaffected: they append provenance markers,
not body text, so they don't alter HEAD content.)

- [ ] **Step 3: Wire into package.json test script**

Add to `package.json` scripts:

```json
"test:bylaws": "node --test scripts/bylaws/lib/*.test.mjs"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/bylaws/verify_golden.mjs package.json
git commit -m "bylaws: golden verification that replay reproduces current law"
```

---

## Task 15: JSON contract for the web tool

Emits the single JSON payload the (separate) web-tool plan will consume, so the
contract is fixed now. No UI here.

**Files:**
- Create: `scripts/bylaws/lib/webdata.mjs` (+ test)
- Create: `scripts/bylaws/build_webdata.mjs`
- Output: `data/bylaws-history/web/history.json`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebData } from './webdata.mjs';

const index = { '074-3': { chapter: '074', heading: 'Leash requirement', file: '074-dogs.md', notes: [{ date: '2019-05-06', article: 14 }] } };
const amendments = [
  { meeting: { date: '2019-05-06', type: 'ATM' }, article: 14, sponsor: 'Planning Board', vote: { yes: 611, no: 204 }, affects: ['074-3'], fidelity: 'verbatim', disposition: 'passed' },
];

test('produces meetings, sections, and a blame map', () => {
  const w = buildWebData(index, amendments);
  assert.equal(w.meetings[0].date, '2019-05-06');
  assert.equal(w.blame['074-3'].latest.article, 14);
  assert.equal(w.sections['074-3'].heading, 'Leash requirement');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/bylaws/lib/webdata.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
export function buildWebData(index, amendments) {
  const meetings = [...new Map(
    amendments.map(a => [`${a.meeting.date}`, { date: a.meeting.date, type: a.meeting.type }])
  ).values()].sort((x, y) => x.date < y.date ? -1 : 1);

  const blame = {};
  for (const ref of Object.keys(index)) {
    const notes = [...(index[ref].notes || [])].sort((a, b) => a.date < b.date ? -1 : 1);
    blame[ref] = { latest: notes[notes.length - 1] || null, history: notes };
  }
  const sections = {};
  for (const [ref, meta] of Object.entries(index)) {
    sections[ref] = { chapter: meta.chapter, heading: meta.heading, file: meta.file };
  }
  return { meetings, sections, blame, amendments };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/bylaws/lib/webdata.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Write `build_webdata.mjs`** — loads `section-index.json` +
`amendments.jsonl`, calls `buildWebData`, writes
`data/bylaws-history/web/history.json`. Run it and confirm the file exists and
`meetings` is non-empty.

- [ ] **Step 6: Commit**

```bash
git add scripts/bylaws/lib/webdata.mjs scripts/bylaws/lib/webdata.test.mjs scripts/bylaws/build_webdata.mjs data/bylaws-history/web/history.json
git commit -m "bylaws: emit web-tool JSON contract"
```

---

## Self-Review

**Spec coverage:**
- Canonical store as source of truth → Tasks 10, 11 (bylaws/*.md, amendments.jsonl). ✓
- Verbatim 2006+ diffs → Tasks 6, 11 (diff engine + LLM extraction). ✓
- Blame backbone 1967–2005 → Tasks 4, 11 (note parser + blame records). ✓
- Sponsor + aggregate tally only, no per-person → Tasks 3, 5, 8 (tally parser, identity, commit format); no per-voter field anywhere in the schema (Task 2). ✓
- Never fabricate historical text → Task 13 blame records append provenance markers, not body; Task 11 prompt forbids inferring text; Task 14 golden proves HEAD integrity. ✓
- git repo byproduct, no scripted PRs → Task 13 (commits + tags only). ✓
- Golden test (replay == current text) → Task 14. ✓
- Citation on every record → Task 2 validator + Task 11 rejects file. ✓
- eCode bot-protection as first/critical task → Task 9 (explicit escalate-don't-fake). ✓
- Reconcile eCode vs reports → Task 12. ✓
- Web tool as separate plan; JSON contract fixed here → Task 15. ✓

**Placeholder scan:** No TBD/TODO. The two IO tasks (9, 11) intentionally describe acquisition/LLM steps with concrete verification gates rather than fake unit tests — that is the honest shape for non-deterministic steps, not a placeholder.

**Type consistency:** `change.kind` is `'edit' | 'touched'` in Tasks 2, 6, 11, 13. `toIdentity(sponsor, map) -> { name, email }` consistent in Tasks 5, 8. `formatCommit -> { subject, body, authorName, authorEmail, date }` consumed unchanged by `commitInto` in Task 13. `orderTimeline` adds `changesText` used by Task 13. Section refs are the `NNN-N` string form throughout.

**Out of scope (correctly deferred):** Zoning, pre-2006 verbatim backfill, the web UI itself — all per spec.
