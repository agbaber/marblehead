# Vimeo Auto-Transcript Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill `_transcripts/<board>-<date>.md` Jekyll collection entries for every default-board meeting on MHTV's Vimeo channel that has an auto-generated English caption track, so the entire historical board-meeting corpus becomes searchable on `marbleheaddata.org/meetings/` without paying for AssemblyAI.

**Architecture:**
- A small Node toolkit under `scripts/transcripts/` enumerates the MHTV Vimeo channel via `yt-dlp --flat-playlist`, filters to the five "default boards" defined in the scaling spec, downloads each video's WebVTT `en-x-autogen` track, collapses the per-second cues into ~45-second paragraphs with `#t=<seconds>s` deep-link anchors back to Vimeo, and writes one `_transcripts/<slug>.md` per meeting with frontmatter matching the existing collection schema.
- No AI summarization, no AssemblyAI, no speaker labels. The body is raw timecoded paragraphs. The transcript layout (`_layouts/transcript.html`) already degrades gracefully when `summary_card` / `topic_segments` are absent. Pagefind indexes the body, satisfying the "searchable" requirement.
- The scaling spec's `DEFAULT_BOARDS` lives in `scripts/transcripts/lib/config.mjs` and is the single source of truth for which board titles are in scope. A `source: vimeo-auto` frontmatter field marks every output so future LLM enrichment can target these files by query.

**Tech Stack:** Node 24 (ESM), `node:test`, `yt-dlp` (already at `~/.local/bin/yt-dlp`, version 2026.03.17), Jekyll 3.10 (existing). No new npm dependencies.

---

## File Structure

**Create:**
- `scripts/transcripts/lib/config.mjs` — `DEFAULT_BOARDS` list, board-name → slug + display mapping
- `scripts/transcripts/lib/config.test.mjs`
- `scripts/transcripts/lib/parse_title.mjs` — parse a Vimeo title into `{ board_slug, board_display, date, valid, reason }`
- `scripts/transcripts/lib/parse_title.test.mjs`
- `scripts/transcripts/lib/vtt_to_prose.mjs` — turn a WebVTT string into `[{ start_seconds, text }]` paragraphs (~45s each, broken on long pauses)
- `scripts/transcripts/lib/vtt_to_prose.test.mjs`
- `scripts/transcripts/lib/render_transcript.mjs` — render frontmatter + body to the `_transcripts/<slug>.md` string
- `scripts/transcripts/lib/render_transcript.test.mjs`
- `scripts/transcripts/pull_vimeo.mjs` — CLI: enumerate channel, filter, write `data/vimeo_meetings.json`
- `scripts/transcripts/backfill_auto.mjs` — CLI: for each entry in `data/vimeo_meetings.json` without an existing transcript file, fetch the VTT and write the markdown
- `data/vimeo_meetings.json` — generated index of in-scope meetings (initially empty `{}`, populated by `pull_vimeo.mjs`)

**Modify:**
- `package.json` — add `transcripts:pull-vimeo`, `transcripts:backfill`, `test:transcripts` scripts; extend the existing `test:minutes` script to also run `test:transcripts` (or add a sibling)
- `.gitignore` — ensure `/tmp/vtt-cache/` is not tracked

**Do not touch:**
- `data/meetings.json` (existing curated index; out of scope, may be reconciled later)
- `_layouts/transcript.html` (already handles missing `summary_card` / `topic_segments`)
- `meetings.html` (index page; works as-is)
- `_includes/meeting-card.html` (cards work with title + date alone)

---

### Task 1: Scaffold `scripts/transcripts/` with the config module

**Files:**
- Create: `scripts/transcripts/lib/config.mjs`
- Create: `scripts/transcripts/lib/config.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BOARDS, boardForTitle } from './config.mjs';

test('DEFAULT_BOARDS lists the five in-scope boards', () => {
  const slugs = DEFAULT_BOARDS.map(b => b.slug).sort();
  assert.deepEqual(slugs, [
    'board-of-health',
    'finance-committee',
    'school-committee',
    'select-board',
    'town-meeting',
  ]);
});

test('boardForTitle matches Select Board with the canonical prefix', () => {
  const m = boardForTitle('Marblehead Select Board Meeting: 5-27-26');
  assert.equal(m.slug, 'select-board');
  assert.equal(m.display, 'Select Board');
});

test('boardForTitle matches School Committee without the Marblehead prefix', () => {
  const m = boardForTitle('School Committee Meeting 9-14-22');
  assert.equal(m.slug, 'school-committee');
});

test('boardForTitle matches FinCom by either name', () => {
  assert.equal(boardForTitle('Marblehead Finance Committee 3-12-25').slug, 'finance-committee');
  assert.equal(boardForTitle('FINCOM Meeting 4-2-24').slug, 'finance-committee');
});

test('boardForTitle returns null on unrelated titles', () => {
  assert.equal(boardForTitle('MHS Scores and Stats - Week 3'), null);
  assert.equal(boardForTitle("'Headliner - The News of Marblehead: 6-5-26"), null);
});

test('boardForTitle returns null on board-member interview profiles', () => {
  assert.equal(boardForTitle('Select Board - Jim Full'), null);
  assert.equal(boardForTitle('School Committee - Sarah Fox'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/config.test.mjs`
Expected: FAIL with "Cannot find module './config.mjs'"

- [ ] **Step 3: Implement the config module**

Create `scripts/transcripts/lib/config.mjs`:

```js
// Boards whose meetings are backfilled by the Vimeo auto-transcript pipeline.
// Lifted from docs/superpowers/specs/2026-06-02-meeting-transcripts-scaling.md.

export const DEFAULT_BOARDS = [
  { slug: 'select-board',     display: 'Select Board',     patterns: [/\bselect board\b/i] },
  { slug: 'school-committee', display: 'School Committee', patterns: [/\bschool committee\b/i] },
  { slug: 'finance-committee', display: 'Finance Committee', patterns: [/\bfinance committee\b/i, /\bfincom\b/i] },
  { slug: 'town-meeting',     display: 'Town Meeting',     patterns: [/\btown meeting\b/i] },
  { slug: 'board-of-health',  display: 'Board of Health',  patterns: [/\bboard of health\b/i] },
];

// Titles that look like board names but are actually member profiles, interviews,
// or one-off content. Reject if these markers are present.
const PROFILE_MARKERS = [
  / - [A-Z][a-z]+ [A-Z][a-z]+/,           // "Select Board - Jim Full"
  /\binterview\b/i,
  /\bprofile\b/i,
  /\bnewest member\b/i,
  /^Voting from /i,
];

export function boardForTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return null;
  for (const marker of PROFILE_MARKERS) {
    if (marker.test(title)) return null;
  }
  for (const board of DEFAULT_BOARDS) {
    if (board.patterns.some(p => p.test(title))) {
      return { slug: board.slug, display: board.display };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/config.test.mjs`
Expected: PASS, 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/config.mjs scripts/transcripts/lib/config.test.mjs
git commit -m "transcripts: add DEFAULT_BOARDS config + title classifier"
```

---

### Task 2: Title-to-date parser

**Files:**
- Create: `scripts/transcripts/lib/parse_title.mjs`
- Create: `scripts/transcripts/lib/parse_title.test.mjs`

The Vimeo channel uses at least seven distinct title formats observed in `/tmp/vimeo-test/all-videos.txt`. The parser must accept all of them and reject non-meetings.

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/parse_title.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTitle } from './parse_title.mjs';

test('parses canonical "Marblehead Select Board Meeting: 5-27-26"', () => {
  const m = parseTitle('Marblehead Select Board Meeting: 5-27-26');
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'select-board');
  assert.equal(m.board_display, 'Select Board');
  assert.equal(m.date, '2026-05-27');
});

test('parses dash-separated 4-digit year', () => {
  const m = parseTitle('Marblehead Board of Health Meeting: 1-15-2025');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2025-01-15');
});

test('parses period-separated date', () => {
  const m = parseTitle('Marblehead Select Board Meeting 5.25.22');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2022-05-25');
});

test('parses period-separated 4-digit year', () => {
  const m = parseTitle('Select Board Meeting 6.11.2025');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2025-06-11');
});

test('parses trailing junk after date', () => {
  const m = parseTitle('Select Board Meeting 8.16.23 via Zoom');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2023-08-16');
});

test('parses written-month date', () => {
  const m = parseTitle('SELECT BOARD MEETING July 12, 2023');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2023-07-12');
});

test('parses "Annual Town Meeting" with day-month-year', () => {
  const m = parseTitle('Marblehead Annual Town Meeting 5-8-25');
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'town-meeting');
  assert.equal(m.date, '2025-05-08');
});

test('rejects member profile videos', () => {
  const m = parseTitle('Select Board - Jim Full');
  assert.equal(m.valid, false);
  assert.match(m.reason, /not a board meeting/i);
});

test('rejects videos with no parseable date', () => {
  const m = parseTitle('Marblehead Select Board candidate forum');
  assert.equal(m.valid, false);
  assert.match(m.reason, /no date/i);
});

test('rejects unrelated content', () => {
  const m = parseTitle("'Headliner - The News of Marblehead: 6-5-26");
  assert.equal(m.valid, false);
});

test('rejects two-digit years before 2000 (sanity guard)', () => {
  const m = parseTitle('Select Board Meeting 1-1-95');
  assert.equal(m.valid, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/parse_title.test.mjs`
Expected: FAIL with "Cannot find module './parse_title.mjs'"

- [ ] **Step 3: Implement the parser**

Create `scripts/transcripts/lib/parse_title.mjs`:

```js
import { boardForTitle } from './config.mjs';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function normalizeYear(y) {
  const n = Number(y);
  if (Number.isNaN(n)) return null;
  if (n >= 1000) return n;
  if (n < 0 || n > 99) return null;
  // MHTV started in ~2018. Anything 18-99 -> 20xx for now.
  return 2000 + n;
}

function pad(n) { return String(n).padStart(2, '0'); }

function isoDate(y, m, d) {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 2000) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Try to extract a date in M/D/Y or written-month form.
function extractDate(title) {
  // Written month: "July 12, 2023" or "July 12 2023"
  const m1 = title.match(/\b([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/);
  if (m1) {
    const mon = MONTHS[m1[1].toLowerCase()];
    if (mon) {
      return isoDate(normalizeYear(m1[3]), mon, Number(m1[2]));
    }
  }
  // Numeric: "5-27-26" or "5.25.22" or "5-8-2025"
  const m2 = title.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/);
  if (m2) {
    return isoDate(normalizeYear(m2[3]), Number(m2[1]), Number(m2[2]));
  }
  return null;
}

export function parseTitle(title) {
  const board = boardForTitle(title);
  if (!board) {
    return { valid: false, reason: 'not a board meeting' };
  }
  const date = extractDate(title);
  if (!date) {
    return { valid: false, reason: 'no date in title' };
  }
  return {
    valid: true,
    board_slug: board.slug,
    board_display: board.display,
    date,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/parse_title.test.mjs`
Expected: PASS, 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/parse_title.mjs scripts/transcripts/lib/parse_title.test.mjs
git commit -m "transcripts: parse Vimeo titles into {board, date}"
```

---

### Task 3: VTT-to-prose converter

**Files:**
- Create: `scripts/transcripts/lib/vtt_to_prose.mjs`
- Create: `scripts/transcripts/lib/vtt_to_prose.test.mjs`

Vimeo's `en-x-autogen` track is per-second WebVTT cues. We coalesce these into paragraphs of roughly 45 seconds each, with a deep-link anchor at the head of each paragraph. Two break rules: paragraph closes when either (a) the elapsed span since the paragraph's first cue exceeds `PARAGRAPH_TARGET_SECONDS` (default 45), or (b) the gap between the previous cue's end and the current cue's start exceeds `PAUSE_BREAK_SECONDS` (default 2.0).

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/vtt_to_prose.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVtt, coalesceCues, vttToProse } from './vtt_to_prose.mjs';

const SAMPLE = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
Hello and welcome.

2
00:00:02.500 --> 00:00:05.000
Tonight's meeting will come to order.

3
00:01:00.000 --> 00:01:03.000
Moving on to old business.
`;

test('parseVtt extracts cues with start_seconds and text', () => {
  const cues = parseVtt(SAMPLE);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].start_seconds, 0);
  assert.equal(cues[0].text, 'Hello and welcome.');
  assert.equal(cues[2].start_seconds, 60);
});

test('parseVtt strips entity references like &amp;', () => {
  const cues = parseVtt('WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nA &amp; B\n');
  assert.equal(cues[0].text, 'A & B');
});

test('coalesceCues breaks on long pauses', () => {
  const cues = parseVtt(SAMPLE);
  const paragraphs = coalesceCues(cues, { pauseBreakSeconds: 2.0, targetSeconds: 600 });
  // 55-second gap between cue 2 (ends at 5s) and cue 3 (starts at 60s) -> two paragraphs.
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].start_seconds, 0);
  assert.equal(paragraphs[1].start_seconds, 60);
  assert.match(paragraphs[0].text, /Hello and welcome\. Tonight's meeting/);
  assert.match(paragraphs[1].text, /Moving on to old business/);
});

test('coalesceCues breaks on paragraph target', () => {
  const cues = [
    { start_seconds: 0, end_seconds: 1, text: 'A.' },
    { start_seconds: 1, end_seconds: 2, text: 'B.' },
    { start_seconds: 2, end_seconds: 3, text: 'C.' },
  ];
  const paragraphs = coalesceCues(cues, { pauseBreakSeconds: 5, targetSeconds: 1.5 });
  // First cue starts at 0, third cue starts at 2 > 1.5 -> break after second cue.
  assert.equal(paragraphs.length, 2);
});

test('vttToProse formats each paragraph with a Vimeo deep-link anchor', () => {
  const md = vttToProse(SAMPLE, 'https://vimeo.com/1234567890');
  assert.match(md, /\[0:00\]\(https:\/\/vimeo\.com\/1234567890#t=0s\)/);
  assert.match(md, /\[1:00\]\(https:\/\/vimeo\.com\/1234567890#t=60s\)/);
});

test('vttToProse on empty input returns empty string', () => {
  assert.equal(vttToProse('WEBVTT\n', 'https://vimeo.com/x'), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/vtt_to_prose.test.mjs`
Expected: FAIL with "Cannot find module './vtt_to_prose.mjs'"

- [ ] **Step 3: Implement**

Create `scripts/transcripts/lib/vtt_to_prose.mjs`:

```js
const PARAGRAPH_TARGET_SECONDS = 45;
const PAUSE_BREAK_SECONDS = 2.0;

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

function decodeEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, m => ENTITIES[m] ?? m);
}

function tsToSeconds(ts) {
  // HH:MM:SS.mmm or MM:SS.mmm
  const parts = ts.split(':');
  let h = 0, m, s;
  if (parts.length === 3) { [h, m, s] = parts; }
  else { [m, s] = parts; }
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function parseVtt(vtt) {
  const lines = vtt.split(/\r?\n/);
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})/);
    if (m) {
      const start_seconds = tsToSeconds(m[1]);
      const end_seconds = tsToSeconds(m[2]);
      const textLines = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i += 1;
      }
      const text = decodeEntities(textLines.join(' ').replace(/\s+/g, ' ').trim());
      if (text) cues.push({ start_seconds, end_seconds, text });
    }
    i += 1;
  }
  return cues;
}

export function coalesceCues(cues, opts = {}) {
  const targetSeconds = opts.targetSeconds ?? PARAGRAPH_TARGET_SECONDS;
  const pauseBreakSeconds = opts.pauseBreakSeconds ?? PAUSE_BREAK_SECONDS;

  const paragraphs = [];
  let buf = null;
  let prevEnd = null;

  for (const cue of cues) {
    const pauseTooLong = prevEnd !== null && (cue.start_seconds - prevEnd) > pauseBreakSeconds;
    const targetExceeded = buf !== null && (cue.start_seconds - buf.start_seconds) > targetSeconds;

    if (buf === null || pauseTooLong || targetExceeded) {
      if (buf) paragraphs.push(buf);
      buf = { start_seconds: cue.start_seconds, text: cue.text };
    } else {
      buf.text += ' ' + cue.text;
    }
    prevEnd = cue.end_seconds;
  }
  if (buf) paragraphs.push(buf);
  return paragraphs;
}

function formatTimecode(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function vttToProse(vtt, vimeoUrl, opts) {
  const cues = parseVtt(vtt);
  if (cues.length === 0) return '';
  const paragraphs = coalesceCues(cues, opts);
  return paragraphs
    .map(p => `**[${formatTimecode(p.start_seconds)}](${vimeoUrl}#t=${Math.floor(p.start_seconds)}s)** ${p.text}`)
    .join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/vtt_to_prose.test.mjs`
Expected: PASS, 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/vtt_to_prose.mjs scripts/transcripts/lib/vtt_to_prose.test.mjs
git commit -m "transcripts: coalesce VTT cues into paragraphs with deep links"
```

---

### Task 4: Render the full transcript markdown file

**Files:**
- Create: `scripts/transcripts/lib/render_transcript.mjs`
- Create: `scripts/transcripts/lib/render_transcript.test.mjs`

Combines parsed metadata + body prose into a Jekyll collection entry that matches the existing `_transcripts/` schema. Emits the frontmatter fields the layout actually reads (`slug`, `board`, `board_display`, `date`, `title`, `vimeo_id`, `vimeo_url`, `duration_seconds`, `ai_generated`, `status`) plus a new `source: vimeo-auto` flag so future enrichment passes can target these files.

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/render_transcript.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTranscript, buildSlug, buildTitle } from './render_transcript.mjs';

test('buildSlug joins board-slug and ISO date', () => {
  assert.equal(buildSlug('select-board', '2026-04-22'), 'select-board-2026-04-22');
});

test('buildTitle produces "Select Board: April 22, 2026"', () => {
  assert.equal(buildTitle('Select Board', '2026-04-22'), 'Select Board: April 22, 2026');
});

test('buildTitle handles January and December correctly', () => {
  assert.equal(buildTitle('Board of Health', '2024-01-03'), 'Board of Health: January 3, 2024');
  assert.equal(buildTitle('Town Meeting', '2025-12-31'), 'Town Meeting: December 31, 2025');
});

test('renderTranscript emits Jekyll frontmatter with required fields', () => {
  const md = renderTranscript({
    board_slug: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    vimeo_id: '1185906675',
    duration_seconds: 2969,
    body: '**[0:00](https://vimeo.com/1185906675#t=0s)** Hello.',
  });
  assert.match(md, /^---\n/);
  assert.match(md, /\nslug: select-board-2026-04-22\n/);
  assert.match(md, /\nboard: select-board\n/);
  assert.match(md, /\nboard_display: "Select Board"\n/);
  assert.match(md, /\ndate: 2026-04-22\n/);
  assert.match(md, /\ntitle: "Select Board: April 22, 2026"\n/);
  assert.match(md, /\nvimeo_id: 1185906675\n/);
  assert.match(md, /\nvimeo_url: "https:\/\/vimeo\.com\/1185906675"\n/);
  assert.match(md, /\nduration_seconds: 2969\n/);
  assert.match(md, /\nai_generated: true\n/);
  assert.match(md, /\nstatus: published\n/);
  assert.match(md, /\nsource: vimeo-auto\n/);
  assert.match(md, /---\n\n> /); // disclaimer follows frontmatter
});

test('renderTranscript includes a clear no-speaker-labels disclaimer', () => {
  const md = renderTranscript({
    board_slug: 'school-committee',
    board_display: 'School Committee',
    date: '2025-10-30',
    vimeo_id: '1029384756',
    duration_seconds: 7200,
    body: '**[0:00](https://vimeo.com/1029384756#t=0s)** Hello.',
  });
  assert.match(md, /Vimeo.*auto-?captioning/i);
  assert.match(md, /no speaker labels/i);
});

test('renderTranscript places body after disclaimer', () => {
  const md = renderTranscript({
    board_slug: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    vimeo_id: '1185906675',
    duration_seconds: 2969,
    body: '**[0:00](https://vimeo.com/1185906675#t=0s)** Sample body.',
  });
  const bodyIndex = md.indexOf('Sample body');
  const disclaimerIndex = md.indexOf('Vimeo');
  assert.ok(disclaimerIndex >= 0 && bodyIndex > disclaimerIndex);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/render_transcript.test.mjs`
Expected: FAIL with "Cannot find module './render_transcript.mjs'"

- [ ] **Step 3: Implement**

Create `scripts/transcripts/lib/render_transcript.mjs`:

```js
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildSlug(boardSlug, isoDate) {
  return `${boardSlug}-${isoDate}`;
}

export function buildTitle(boardDisplay, isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${boardDisplay}: ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const DISCLAIMER = [
  '> Transcript captured from MHTV\'s Vimeo auto-captioning. No speaker labels;',
  '> proper names and dollar figures occasionally misheard. Click any timecode to',
  '> jump to that moment in the source video.',
].join('\n');

export function renderTranscript({
  board_slug,
  board_display,
  date,
  vimeo_id,
  duration_seconds,
  body,
}) {
  const slug = buildSlug(board_slug, date);
  const title = buildTitle(board_display, date);
  const vimeoUrl = `https://vimeo.com/${vimeo_id}`;
  const frontmatter = [
    '---',
    `slug: ${slug}`,
    `board: ${board_slug}`,
    `board_display: "${board_display}"`,
    `date: ${date}`,
    `title: "${title}"`,
    `vimeo_id: ${vimeo_id}`,
    `vimeo_url: "${vimeoUrl}"`,
    `duration_seconds: ${duration_seconds}`,
    'ai_generated: true',
    'status: published',
    'source: vimeo-auto',
    '---',
  ].join('\n');
  return `${frontmatter}\n\n${DISCLAIMER}\n\n${body}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/render_transcript.test.mjs`
Expected: PASS, 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/render_transcript.mjs scripts/transcripts/lib/render_transcript.test.mjs
git commit -m "transcripts: render Jekyll-collection markdown file"
```

---

### Task 5: Vimeo channel enumerator (`pull_vimeo.mjs`)

**Files:**
- Create: `scripts/transcripts/pull_vimeo.mjs`
- Create: `data/vimeo_meetings.json` (initially `{"last_updated": null, "meetings": []}`)

Wraps `yt-dlp --flat-playlist` against `https://vimeo.com/marbleheadtv`, parses each line through `parseTitle`, and writes `data/vimeo_meetings.json` with one entry per in-scope meeting.

- [ ] **Step 1: Verify yt-dlp is reachable from the expected path**

Run: `~/.local/bin/yt-dlp --version`
Expected: prints `2026.03.17` or later.

If missing, install via `pipx install yt-dlp` first.

- [ ] **Step 2: Implement `pull_vimeo.mjs`**

Create `scripts/transcripts/pull_vimeo.mjs`:

```js
#!/usr/bin/env node
/**
 * Enumerate the MHTV Vimeo channel via yt-dlp --flat-playlist, filter to
 * the five default boards, and write data/vimeo_meetings.json.
 *
 * Usage:
 *   node scripts/transcripts/pull_vimeo.mjs [--out data/vimeo_meetings.json]
 *
 * Output schema:
 *   {
 *     "last_updated": "2026-06-08T12:34:56.000Z",
 *     "channel_url": "https://vimeo.com/marbleheadtv",
 *     "total_videos": 2791,
 *     "meetings": [
 *       { "vimeo_id": "1196731483", "title": "...", "board_slug": "select-board",
 *         "board_display": "Select Board", "date": "2026-05-27", "raw_title": "..." }
 *     ]
 *   }
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseTitle } from './lib/parse_title.mjs';

const CHANNEL_URL = 'https://vimeo.com/marbleheadtv';
const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : 'data/vimeo_meetings.json';

function enumerateChannel() {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, [
      '--flat-playlist',
      '--print', '%(id)s\t%(title)s',
      CHANNEL_URL,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`yt-dlp exited ${code}: ${stderr}`));
      resolve(stdout);
    });
  });
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function main() {
  console.error(`Enumerating ${CHANNEL_URL} via yt-dlp ...`);
  const raw = await enumerateChannel();
  const lines = raw.split('\n').filter(l => l.includes('\t'));
  console.error(`Got ${lines.length} videos from channel.`);

  const meetings = [];
  for (const line of lines) {
    const tab = line.indexOf('\t');
    const vimeo_id = line.slice(0, tab).trim();
    const raw_title = decode(line.slice(tab + 1).trim());
    const parsed = parseTitle(raw_title);
    if (parsed.valid) {
      meetings.push({
        vimeo_id,
        title: raw_title,
        board_slug: parsed.board_slug,
        board_display: parsed.board_display,
        date: parsed.date,
        raw_title,
      });
    }
  }
  meetings.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const output = {
    last_updated: new Date().toISOString(),
    channel_url: CHANNEL_URL,
    total_videos: lines.length,
    meetings,
  };
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.error(`Wrote ${meetings.length} in-scope meetings to ${outPath}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Smoke-run against the live channel**

Run: `node scripts/transcripts/pull_vimeo.mjs --out /tmp/vimeo-test/vimeo_meetings.json`

Expected: prints "Got ~2790 videos from channel", then "Wrote ~400 in-scope meetings to ...". Takes ~30-60 seconds.

Inspect: `head -30 /tmp/vimeo-test/vimeo_meetings.json` shows last_updated, channel_url, and a meetings array with valid 4-digit dates and one of the five board_slug values.

If the parsed count is wildly off from the spec's expected ~400, stop and check the patterns in `config.mjs` and `parse_title.mjs`.

- [ ] **Step 4: Write the real `data/vimeo_meetings.json`**

Run: `node scripts/transcripts/pull_vimeo.mjs`

Verify: `wc -l data/vimeo_meetings.json` and `python3 -c "import json; d=json.load(open('data/vimeo_meetings.json')); print('meetings:', len(d['meetings'])); from collections import Counter; print(Counter(m['board_slug'] for m in d['meetings']))"`

Expected output looks like:
```
meetings: ~400
Counter({'board-of-health': ~123, 'select-board': ~113, 'school-committee': ~85, 'town-meeting': ~54, 'finance-committee': ~32})
```

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/pull_vimeo.mjs data/vimeo_meetings.json
git commit -m "transcripts: enumerate MHTV Vimeo channel into vimeo_meetings.json"
```

---

### Task 6: Backfill orchestrator (`backfill_auto.mjs`)

**Files:**
- Create: `scripts/transcripts/backfill_auto.mjs`

Reads `data/vimeo_meetings.json`, for each entry whose `_transcripts/<slug>.md` does not already exist, downloads the VTT via `yt-dlp --write-subs --sub-langs en-x-autogen`, runs it through `vttToProse`, renders the markdown file, and writes it. Idempotent: re-runs skip existing files.

- [ ] **Step 1: Implement**

Create `scripts/transcripts/backfill_auto.mjs`:

```js
#!/usr/bin/env node
/**
 * Backfill _transcripts/<slug>.md for every meeting in data/vimeo_meetings.json
 * that has an en-x-autogen track and no existing transcript file.
 *
 * Usage:
 *   node scripts/transcripts/backfill_auto.mjs [--limit N] [--board <slug>] [--dry-run]
 *
 * Caches downloaded VTTs in /tmp/vtt-cache/ to make re-runs cheap.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSlug, renderTranscript } from './lib/render_transcript.mjs';
import { vttToProse } from './lib/vtt_to_prose.mjs';

const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;
const TRANSCRIPTS_DIR = '_transcripts';
const CACHE_DIR = '/tmp/vtt-cache';
const INDEX_FILE = 'data/vimeo_meetings.json';

mkdirSync(CACHE_DIR, { recursive: true });

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
const dryRun = args.includes('--dry-run');

function downloadVtt(vimeoId) {
  const cachePath = join(CACHE_DIR, `${vimeoId}.en-x-autogen.vtt`);
  if (existsSync(cachePath)) return cachePath;
  const res = spawnSync(YT_DLP, [
    '--write-subs',
    '--sub-langs', 'en-x-autogen',
    '--skip-download',
    '--sub-format', 'vtt',
    '-o', join(CACHE_DIR, `${vimeoId}.%(ext)s`),
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  if (!existsSync(cachePath)) {
    return null;
  }
  return cachePath;
}

function getDurationSeconds(vimeoId) {
  const res = spawnSync(YT_DLP, [
    '--print', '%(duration)s',
    '--skip-download',
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  const n = Number(res.stdout.trim());
  return Number.isFinite(n) ? n : 0;
}

function main() {
  const idx = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of idx.meetings) {
    if (processed >= limit) break;
    if (boardFilter && m.board_slug !== boardFilter) continue;
    const slug = buildSlug(m.board_slug, m.date);
    const outPath = join(TRANSCRIPTS_DIR, `${slug}.md`);
    if (existsSync(outPath)) { skipped += 1; continue; }

    console.error(`[${processed + 1}] ${slug} ...`);
    if (dryRun) { processed += 1; continue; }

    const vttPath = downloadVtt(m.vimeo_id);
    if (!vttPath) {
      console.error(`  - no en-x-autogen track, skipping`);
      failed += 1;
      continue;
    }
    const vtt = readFileSync(vttPath, 'utf8');
    const body = vttToProse(vtt, `https://vimeo.com/${m.vimeo_id}`);
    if (!body) {
      console.error(`  - empty VTT, skipping`);
      failed += 1;
      continue;
    }
    const duration = getDurationSeconds(m.vimeo_id);
    const md = renderTranscript({
      board_slug: m.board_slug,
      board_display: m.board_display,
      date: m.date,
      vimeo_id: m.vimeo_id,
      duration_seconds: duration,
      body,
    });
    writeFileSync(outPath, md);
    console.error(`  - wrote ${outPath} (${md.length} bytes)`);
    processed += 1;
  }

  console.error(`Done. processed=${processed} skipped_existing=${skipped} failed=${failed}`);
}

main();
```

- [ ] **Step 2: Dry-run to see what would be processed**

Run: `node scripts/transcripts/backfill_auto.mjs --dry-run --limit 3`

Expected: prints three `[N] <slug> ...` lines, then `Done. processed=3 skipped_existing=<some count> failed=0`. Should be much faster than a real run.

- [ ] **Step 3: Real run on a tiny sample**

Run: `node scripts/transcripts/backfill_auto.mjs --limit 1 --board school-committee`

Expected: downloads one VTT (~30 sec), writes one `_transcripts/school-committee-<date>.md`, prints byte count.

Inspect the result:
- `head -25 _transcripts/school-committee-<date>.md` — frontmatter looks correct, disclaimer present, body has timecoded paragraphs.
- The deep-link anchors should look like `**[0:00](https://vimeo.com/<id>#t=0s)**`.

- [ ] **Step 4: Verify Jekyll builds with the new transcript**

Run: `bundle exec jekyll build 2>&1 | tail -20`

Expected: no errors. The new transcript page renders at `/meetings/<slug>/`. The `/meetings/` index lists it.

- [ ] **Step 5: Commit the orchestrator + sample transcript**

```bash
git add scripts/transcripts/backfill_auto.mjs _transcripts/school-committee-<date>.md
git commit -m "transcripts: backfill orchestrator + first sample"
```

---

### Task 7: Wire up npm scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add the three npm scripts**

Edit `package.json` `scripts` block to add:

```json
"transcripts:pull-vimeo": "node scripts/transcripts/pull_vimeo.mjs",
"transcripts:backfill": "node scripts/transcripts/backfill_auto.mjs",
"test:transcripts": "node --test scripts/transcripts/lib/*.test.mjs"
```

- [ ] **Step 2: Add the VTT cache to .gitignore**

Add to `.gitignore` (create section if missing):

```
# Transcript pipeline cache (transient)
/tmp/vtt-cache/
```

- [ ] **Step 3: Verify scripts run**

Run: `npm run test:transcripts`
Expected: all four test files run, all tests pass.

Run: `npm run transcripts:backfill -- --dry-run --limit 2`
Expected: matches Task 6 step 2.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "transcripts: wire npm scripts for pipeline + tests"
```

---

### Task 8: Eyeball a real transcript in the live preview before bulk-publishing

**Files:**
- None modified in this task.

- [ ] **Step 1: Start Jekyll dev server**

Run: `npm run dev` in one shell.
Wait for: `Server address: http://127.0.0.1:4000/`.

- [ ] **Step 2: Visit the sample transcript and check**

Open: `http://localhost:4000/meetings/<slug>/` for the sample written in Task 6.

Check, by eye:
- Hero shows board chip, title, date, duration, "Watch on MHTV →" link.
- Disclaimer paragraph (no speaker labels) is visible.
- Body has `**[0:00]**` style anchors, each linking to `vimeo.com/<id>#t=Ns`.
- No layout breakage from missing `summary_card` / `topic_segments` (the "Tonight's record" strip should still show `<duration> min full transcript`).
- The transcript is included inside the collapsible "min full transcript" section, exactly like the existing POCs.

- [ ] **Step 3: Visit the `/meetings/` index**

Open: `http://localhost:4000/meetings/`

Check, by eye:
- The new card is listed in date order.
- Card shows board / title / date.
- Card body is empty (no headline / summary) — that's expected and matches the layout's `{% if %}` guards. Not pretty, but not broken.

If anything is wrong, fix it (`render_transcript.mjs` is the most likely culprit) and re-run `backfill_auto.mjs` to regenerate the sample file.

- [ ] **Step 4: Capture proof screenshot**

In another shell, with the dev server still running:

```bash
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/meetings/<slug>/" \
  "proof/$(git branch --show-current)-transcript.png"
git add proof/*.png
git commit -m "transcripts: proof screenshot of sample backfill page"
```

---

### Task 9: Bulk backfill, batched commits

**Files:**
- Adds ~200 files to `_transcripts/`.

The bulk run downloads one VTT per in-scope meeting that has an `en-x-autogen` track. Expect ~50-70% hit rate (older meetings have no auto-captions). At ~150KB per file, the repo grows by ~25MB.

- [ ] **Step 1: Run by board, one at a time, committing each board separately**

Run, then commit, in this order:

```bash
node scripts/transcripts/backfill_auto.mjs --board select-board
git add _transcripts/select-board-*.md
git commit -m "transcripts: backfill Select Board meetings (Vimeo auto-captions)"

node scripts/transcripts/backfill_auto.mjs --board school-committee
git add _transcripts/school-committee-*.md
git commit -m "transcripts: backfill School Committee meetings (Vimeo auto-captions)"

node scripts/transcripts/backfill_auto.mjs --board finance-committee
git add _transcripts/finance-committee-*.md
git commit -m "transcripts: backfill Finance Committee meetings (Vimeo auto-captions)"

node scripts/transcripts/backfill_auto.mjs --board town-meeting
git add _transcripts/town-meeting-*.md
git commit -m "transcripts: backfill Town Meeting recordings (Vimeo auto-captions)"

node scripts/transcripts/backfill_auto.mjs --board board-of-health
git add _transcripts/board-of-health-*.md
git commit -m "transcripts: backfill Board of Health meetings (Vimeo auto-captions)"
```

Each board may take 5-20 minutes depending on hit rate (yt-dlp does one HTTP round-trip per video to discover whether the auto-track exists).

If a board partially completes (network blip), re-run — the existing-file check makes it idempotent.

- [ ] **Step 2: Verify total file count and a healthy sample**

Run:
```bash
ls _transcripts/select-board-*.md | wc -l
ls _transcripts/school-committee-*.md | wc -l
ls _transcripts/finance-committee-*.md | wc -l
ls _transcripts/town-meeting-*.md | wc -l
ls _transcripts/board-of-health-*.md | wc -l
```

Expected: rough counts reflecting `en-x-autogen` coverage (typically post-mid-2024). Totals should be in the low hundreds, not zero, not 400.

Spot-check the oldest file written for each board — the date in the filename should match the date in the frontmatter, and the body should be non-empty.

- [ ] **Step 3: Local Jekyll build with the full corpus**

Run: `npm run test:local`

Expected: all 52 smoke tests pass. Build time may grow noticeably (each transcript becomes a Jekyll page), but should still complete under 2 minutes.

- [ ] **Step 4: If build fails**

Common failure modes and fixes:
- YAML frontmatter parse error from an unescaped quote in a title → `render_transcript.mjs` quotes the title; if a specific board name introduces a quote, escape it in `buildTitle`.
- Pagefind build OOM on a multi-MB transcript → split the largest VTT into multiple paragraphs (already done by `coalesceCues`); if still failing, check Pagefind chunk size.
- Liquid error from a `{{` literal in a transcript body → escape inside `vtt_to_prose.mjs` (replace `{{` with `{ {`).

---

### Task 10: Push branch, open PR

**Files:**
- None modified.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin worktree-bridge-cse_01PK1NSLWD2Zi1C6XTC3efvU`

- [ ] **Step 2: Create the PR**

Run:

```bash
gh pr create --title "Backfill historical board-meeting transcripts from MHTV Vimeo auto-captions" --body "$(cat <<'EOF'
## Summary

Adds a small Node toolkit under \`scripts/transcripts/\` that enumerates the MHTV Vimeo channel, filters to the five default boards from the meeting-transcripts scaling spec, downloads each video's auto-generated English caption track, and writes a Jekyll-collection markdown file for each. Result: every historical board meeting that has Vimeo auto-captioning (mid-2024 onward) becomes a searchable page on \`/meetings/\` without paying for AssemblyAI.

What's intentionally NOT in this PR:
- No AssemblyAI / Whisper / speaker labels. The body is raw timecoded paragraphs.
- No LLM-generated summary cards or topic segments.
- No changes to \`_layouts/transcript.html\`, \`meetings.html\`, or \`_includes/meeting-card.html\`.

Going-forward speaker-labeled transcripts (the AssemblyAI Phase 2 from the spec) are a separate plan.

## Test plan

- [ ] Visit Preview URL → /meetings/ → the new cards appear, listed in date order
- [ ] Pick a recent Select Board card → opens the transcript page with a deep-link anchor at each ~45-second mark
- [ ] Click a \`**[12:34]**\` anchor → opens the source Vimeo video at the right timestamp
- [ ] Use the site search (Pagefind) → search "Bouvier Road" or any unique phrase → lands on the right transcript

## Proof of Work

- proof/<branch>-transcript.png — screenshot of a sample backfilled transcript page
- npm run test:transcripts → all 23 unit tests pass
- npm run test:local → 52 smoke tests pass with the full backfill corpus
EOF
)"
```

- [ ] **Step 3: Edit PR body with preview URL once Cloudflare publishes the sticky comment**

When `gh pr view --json comments` shows a comment with body starting `### Preview`, extract the **Branch URL** and edit the PR body to include it under "Preview URL:".

- [ ] **Step 4: Report PR URL to user**

Run: `gh pr view --json url --jq .url`
Print the URL.

---

## Self-Review

**Spec coverage:**

Mapping each line of `docs/superpowers/specs/2026-06-02-meeting-transcripts-scaling.md` that this plan implements:

- "Default: the 5 boards that drive policy" → Task 1 (DEFAULT_BOARDS).
- "Hardcoded list in `scripts/transcripts/lib/config.mjs`" → Task 1.
- "pull_meetings.mjs indexes MHTV Vimeo" → Task 5 (named `pull_vimeo.mjs` to avoid collision with the future multi-source orchestrator).
- "Pagefind indexes the transcript body" → not explicitly tested but already true for the collection; verified via Task 8 + Task 9 step 3.

Out of scope by spec (and out of scope here): AssemblyAI step, LLM enrichment, YouTube source feed, schema migration `vimeo_*` → `source_url`. These belong to a separate plan.

**Type consistency:**

- `boardForTitle` returns `{ slug, display }` everywhere.
- `parseTitle` returns `{ valid, board_slug, board_display, date }` on success or `{ valid: false, reason }` on failure. Consumed by both `pull_vimeo.mjs` and (transitively via the index) `backfill_auto.mjs`.
- `vttToProse` returns a string. `renderTranscript` takes `body: string`.
- `buildSlug(boardSlug, isoDate)` consistent across Task 4 (definition), Task 6 (orchestrator), and Task 9 (filename glob).

**Placeholder scan:** No "TBD", "appropriate error handling", or "similar to Task N" references. Each step contains the actual code or command.

**Known limitations called out in the plan:**
- Coverage is partial; older meetings have no en-x-autogen track. Backfill silently skips those (Task 6 step 1: "no en-x-autogen track, skipping"). Acceptable.
- No speaker labels. Disclaimer in `renderTranscript` (Task 4).
- Auto-captions occasionally misspell proper nouns (Mary Alley → Mary Ellis) and dollar figures. Disclaimer covers this.
- Repo grows by ~25MB. Acceptable; no LFS needed at this scale.
