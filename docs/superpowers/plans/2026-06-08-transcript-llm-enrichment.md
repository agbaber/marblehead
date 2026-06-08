# Transcript LLM Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the 227 Vimeo-auto transcripts in `_transcripts/` with LLM-generated `summary_card` + `topic_segments` so each meeting renders in the existing "newspaper" layout (headline, deck, decisions, votes, featured topic, secondary cards) instead of the current bare title-and-date card.

**Architecture:** A small Node toolkit under `scripts/transcripts/` extracts each transcript's body, sends it to the Anthropic Messages Batch API (Sonnet 4.6 + prompt caching) with a strict JSON schema and the 11-topic taxonomy already in use, validates the response (topic membership, dollar-figure plausibility, frontmatter shape), and merges the result into the existing `_transcripts/<slug>.md` file without disturbing the disclaimer or body. Failures are skipped, logged, and re-runnable. One batch covers all 227 backfilled transcripts at ~$25-50 one-time.

**Tech Stack:** Node 24 (ESM), `node:test`, `@anthropic-ai/sdk` (already in deps via `scripts/minutes/`), `claude-sonnet-4-6` with Messages Batch API + ephemeral prompt caching on system prompt. No new npm deps.

**Builds on:** the 2026-06-08-vimeo-auto-transcript-backfill plan (PR #797). The 227 enriched files already exist on the branch with `source: vimeo-auto` frontmatter; this plan adds fields, it does not create new files.

---

## File Structure

**Create:**
- `scripts/transcripts/prompts/summary.md` — system prompt: schema, topic taxonomy, neutrality rules
- `scripts/transcripts/lib/topics.mjs` — `KNOWN_TOPICS` array + `validateTopic(slug)` helper
- `scripts/transcripts/lib/topics.test.mjs`
- `scripts/transcripts/lib/parse_response.mjs` — parses LLM JSON, validates shape + topic membership + number plausibility
- `scripts/transcripts/lib/parse_response.test.mjs`
- `scripts/transcripts/lib/merge_frontmatter.mjs` — merges new fields into existing `_transcripts/<slug>.md`, preserves body + disclaimer
- `scripts/transcripts/lib/merge_frontmatter.test.mjs`
- `scripts/transcripts/enrich_one.mjs` — single-meeting CLI for smoke testing
- `scripts/transcripts/enrich_batch.mjs` — Batch API driver: submit → poll → collect → write
- `data/.transcripts_enrich_state.json` — batch state file (gitignored)

**Modify:**
- `package.json` — add `transcripts:enrich-one`, `transcripts:enrich-batch:submit`, `transcripts:enrich-batch:poll`, `transcripts:enrich-batch:collect` scripts
- `.gitignore` — add `data/.transcripts_enrich_state.json`
- 227 existing `_transcripts/*.md` files — each gains `summary_card` + `topic_segments` (and a small `source` upgrade: `source: vimeo-auto+llm`)

**Do not touch:**
- `_layouts/transcript.html` (already handles `summary_card` and `topic_segments`)
- `meetings.html`, `_includes/meeting-card.html` (cards will automatically populate when frontmatter has the new fields)
- The 12 hand-crafted POCs (`_transcripts/*-04-08.md`, etc.) — skip any file already containing `summary_card:` in its frontmatter

---

### Task 0: Verify Anthropic API key is available

**Files:** None modified.

The existing `scripts/minutes/*.mjs` files use `new Anthropic()` which reads `ANTHROPIC_API_KEY` from the environment. This box has no `.env` and no env var set. The key must be present before any enrichment task runs.

- [ ] **Step 1: Probe for an existing key**

Run: `node -e "console.log('len:', (process.env.ANTHROPIC_API_KEY||'').length)"`

- If `len:` > 0, proceed to Task 1.
- If `len: 0`, surface a `.env` file at the worktree root:

```bash
cat > .env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...
EOF
```

Then run all subsequent enrichment commands with `set -a; source .env; set +a` first, or invoke each command with `env -S "$(cat .env)" node ...`.

- [ ] **Step 2: Verify the key works**

Run:

```bash
set -a; source .env; set +a
node -e "
import('@anthropic-ai/sdk').then(async ({default: A}) => {
  const c = new A();
  const r = await c.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'reply with the word ok' }]
  });
  console.log(r.content[0].text);
});
"
```

Expected: prints `ok` (or similar). Confirms the key authenticates.

If this fails, STOP — every later task depends on this working.

- [ ] **Step 3: Confirm `.env` is git-ignored**

Run: `git check-ignore .env`
Expected: prints `.env` (it is already in `.gitignore` as confirmed in the previous plan).

---

### Task 1: Topics taxonomy module

**Files:**
- Create: `scripts/transcripts/lib/topics.mjs`
- Create: `scripts/transcripts/lib/topics.test.mjs`

The taxonomy is the 11 topics already in use across hand-crafted POCs (counted via `grep '^  - topic:' _transcripts/*.md`):
`school-budget`, `admin-housekeeping`, `public-comment`, `override`, `permits-zoning`, `trash-dpw`, `recreation-events`, `bonding-capital`, `public-safety`, `labor-personnel`, `40b-mbta`.

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/topics.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_TOPICS, isKnownTopic } from './topics.mjs';

test('KNOWN_TOPICS contains the 11 in-use topics', () => {
  assert.deepEqual([...KNOWN_TOPICS].sort(), [
    '40b-mbta',
    'admin-housekeeping',
    'bonding-capital',
    'labor-personnel',
    'override',
    'permits-zoning',
    'public-comment',
    'public-safety',
    'recreation-events',
    'school-budget',
    'trash-dpw',
  ]);
});

test('isKnownTopic matches case-sensitive slugs', () => {
  assert.equal(isKnownTopic('override'), true);
  assert.equal(isKnownTopic('Override'), false);
  assert.equal(isKnownTopic('overide'), false);
  assert.equal(isKnownTopic(''), false);
  assert.equal(isKnownTopic(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/topics.test.mjs`
Expected: FAIL with "Cannot find module './topics.mjs'"

- [ ] **Step 3: Implement**

Create `scripts/transcripts/lib/topics.mjs`:

```js
// Topic taxonomy for transcript summarization. Locked to the 11 topics
// already in use across hand-crafted _transcripts/ POCs. New topics
// require a deliberate addition here AND a stub topic page under topics/.

export const KNOWN_TOPICS = Object.freeze([
  'override',
  'school-budget',
  'admin-housekeeping',
  'public-comment',
  'permits-zoning',
  'trash-dpw',
  'recreation-events',
  'bonding-capital',
  'public-safety',
  'labor-personnel',
  '40b-mbta',
]);

export function isKnownTopic(slug) {
  if (typeof slug !== 'string' || !slug) return false;
  return KNOWN_TOPICS.includes(slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/topics.test.mjs`
Expected: PASS, 2 tests pass.

Full suite: `node --test scripts/transcripts/lib/*.test.mjs`
Expected: 34 tests pass (32 from previous plan + 2 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/topics.mjs scripts/transcripts/lib/topics.test.mjs
git commit -m "transcripts: lock topic taxonomy to 11 in-use slugs"
```

---

### Task 2: Response parser + validator

**Files:**
- Create: `scripts/transcripts/lib/parse_response.mjs`
- Create: `scripts/transcripts/lib/parse_response.test.mjs`

The LLM returns a JSON object with `summary_card` and `topic_segments`. The parser validates the shape and returns `{ valid, summary_card, topic_segments, errors }`. Rejects:
- Unknown topic slugs
- `start_seconds` not a finite integer
- Empty `summary_card.headline`
- `topic_segments[].featured` set on more than one segment
- Dollar figures formatted as `S15M` (common OCR error)

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/parse_response.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResponse } from './parse_response.mjs';

const GOOD = JSON.stringify({
  summary_card: {
    headline: 'Three-tier override sized at $9M / $12M / $15M',
    summary: 'The board sized the FY27 override at three tiers.',
    decisions: ['Approved bond sale to Oppenheimer'],
    votes: [{ motion: 'Approve bond sale', result: 'in favor (unanimous)' }],
  },
  topic_segments: [
    {
      topic: 'override',
      topic_confidence: 0.95,
      start_seconds: 1340,
      end_seconds: 6500,
      featured: true,
      headline: "Marblehead's first tiered override",
      dek: 'On a $1M home, three-year cumulative cost ranges from $900 to $1,500.',
      summary: 'Two ballot questions.',
      key_speakers: ['Matt Fernald (CFO)'],
    },
  ],
});

test('parseResponse accepts a well-formed payload', () => {
  const r = parseResponse(GOOD);
  assert.equal(r.valid, true);
  assert.equal(r.summary_card.headline, 'Three-tier override sized at $9M / $12M / $15M');
  assert.equal(r.topic_segments[0].topic, 'override');
});

test('parseResponse rejects unknown topic slugs', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments[0].topic = 'not-a-real-topic';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /unknown topic.*not-a-real-topic/i);
});

test('parseResponse rejects non-integer start_seconds', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments[0].start_seconds = '1340';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /start_seconds/i);
});

test('parseResponse rejects empty headline', () => {
  const bad = JSON.parse(GOOD);
  bad.summary_card.headline = '';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /headline/i);
});

test('parseResponse rejects more than one featured topic', () => {
  const bad = JSON.parse(GOOD);
  bad.topic_segments.push({
    topic: 'school-budget',
    topic_confidence: 0.9,
    start_seconds: 7000,
    end_seconds: 8000,
    featured: true,
    headline: 'A second featured topic',
    dek: 'd',
    summary: 's',
    key_speakers: [],
  });
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /more than one featured/i);
});

test('parseResponse flags OCR-style dollar figures in summary text', () => {
  const bad = JSON.parse(GOOD);
  bad.summary_card.summary = 'The board approved S15M in bonds.';
  const r = parseResponse(JSON.stringify(bad));
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /OCR-?style.*S\d/i);
});

test('parseResponse rejects malformed JSON', () => {
  const r = parseResponse('not json');
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /json/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/parse_response.test.mjs`
Expected: FAIL with "Cannot find module './parse_response.mjs'"

- [ ] **Step 3: Implement**

Create `scripts/transcripts/lib/parse_response.mjs`:

```js
import { isKnownTopic } from './topics.mjs';

const OCR_DOLLAR_RE = /\bS\d[\d.,]*M?\b/;

function validateSegment(seg, i, errors) {
  if (!seg || typeof seg !== 'object') {
    errors.push(`topic_segments[${i}]: not an object`);
    return;
  }
  if (!isKnownTopic(seg.topic)) {
    errors.push(`topic_segments[${i}]: unknown topic "${seg.topic}"`);
  }
  if (!Number.isInteger(seg.start_seconds) || seg.start_seconds < 0) {
    errors.push(`topic_segments[${i}]: start_seconds must be a non-negative integer`);
  }
  if (!Number.isInteger(seg.end_seconds) || seg.end_seconds <= seg.start_seconds) {
    errors.push(`topic_segments[${i}]: end_seconds must be an integer greater than start_seconds`);
  }
  if (typeof seg.headline !== 'string' || !seg.headline.trim()) {
    errors.push(`topic_segments[${i}]: headline required`);
  }
  if (typeof seg.summary !== 'string' || !seg.summary.trim()) {
    errors.push(`topic_segments[${i}]: summary required`);
  }
  if (seg.summary && OCR_DOLLAR_RE.test(seg.summary)) {
    errors.push(`topic_segments[${i}]: OCR-style dollar figure in summary (e.g. "S15M")`);
  }
}

export function parseResponse(text) {
  const errors = [];
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { valid: false, errors: [`invalid JSON: ${e.message}`] };
  }

  const card = obj.summary_card;
  if (!card || typeof card !== 'object') {
    errors.push('summary_card missing');
  } else {
    if (typeof card.headline !== 'string' || !card.headline.trim()) {
      errors.push('summary_card.headline required');
    }
    if (typeof card.summary !== 'string' || !card.summary.trim()) {
      errors.push('summary_card.summary required');
    }
    if (card.summary && OCR_DOLLAR_RE.test(card.summary)) {
      errors.push('summary_card.summary contains OCR-style dollar figure (e.g. "S15M")');
    }
    if (card.headline && OCR_DOLLAR_RE.test(card.headline)) {
      errors.push('summary_card.headline contains OCR-style dollar figure');
    }
  }

  const segs = obj.topic_segments;
  if (!Array.isArray(segs)) {
    errors.push('topic_segments must be an array');
  } else {
    let featuredCount = 0;
    segs.forEach((s, i) => {
      validateSegment(s, i, errors);
      if (s && s.featured === true) featuredCount += 1;
    });
    if (featuredCount > 1) {
      errors.push(`more than one featured topic_segment (got ${featuredCount}, max 1)`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, summary_card: card, topic_segments: segs, errors: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/parse_response.test.mjs`
Expected: PASS, 7 tests pass.

Full suite: `node --test scripts/transcripts/lib/*.test.mjs`
Expected: 41 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/parse_response.mjs scripts/transcripts/lib/parse_response.test.mjs
git commit -m "transcripts: parse and validate LLM JSON summary response"
```

---

### Task 3: Frontmatter merger

**Files:**
- Create: `scripts/transcripts/lib/merge_frontmatter.mjs`
- Create: `scripts/transcripts/lib/merge_frontmatter.test.mjs`

Takes an existing `_transcripts/<slug>.md` file content + parsed `summary_card` + parsed `topic_segments`, splices the new YAML keys into the frontmatter (above the closing `---`), and upgrades `source: vimeo-auto` to `source: vimeo-auto+llm`. Body and disclaimer are unchanged.

- [ ] **Step 1: Write the failing test**

Create `scripts/transcripts/lib/merge_frontmatter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFrontmatter } from './merge_frontmatter.mjs';

const EXISTING = `---
slug: select-board-2026-05-27
board: select-board
board_display: "Select Board"
date: 2026-05-27
title: "Select Board: May 27, 2026"
vimeo_id: 1196731483
vimeo_url: "https://vimeo.com/1196731483"
duration_seconds: 3000
ai_generated: true
status: published
source: vimeo-auto
---

> Transcript captured from MHTV's Vimeo auto-captioning. No speaker labels;
> proper names and dollar figures occasionally misheard.

**[0:00](https://vimeo.com/1196731483#t=0s)** First paragraph.

**[0:45](https://vimeo.com/1196731483#t=45s)** Second paragraph.
`;

const SUMMARY_CARD = {
  headline: 'Sample headline',
  summary: 'Sample summary text.',
  decisions: ['Decided X', 'Decided Y'],
  votes: [{ motion: 'Approve X', result: 'in favor (unanimous)' }],
};

const TOPIC_SEGMENTS = [
  {
    topic: 'override',
    topic_confidence: 0.9,
    start_seconds: 0,
    end_seconds: 300,
    featured: true,
    headline: 'Override headline',
    dek: 'Override dek.',
    summary: 'Override summary text.',
    key_speakers: ['Chair Fox'],
  },
];

test('mergeFrontmatter inserts new YAML keys before closing ---', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.match(out, /\nsummary_card:\n  headline: "Sample headline"\n/);
  assert.match(out, /\ntopic_segments:\n  - topic: override\n/);
});

test('mergeFrontmatter upgrades source to vimeo-auto+llm', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.match(out, /\nsource: vimeo-auto\+llm\n/);
  assert.doesNotMatch(out, /\nsource: vimeo-auto\n/);
});

test('mergeFrontmatter preserves the body verbatim', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.ok(out.includes('**[0:00](https://vimeo.com/1196731483#t=0s)** First paragraph.'));
  assert.ok(out.includes('**[0:45](https://vimeo.com/1196731483#t=45s)** Second paragraph.'));
  assert.ok(out.includes('> Transcript captured from MHTV'));
});

test('mergeFrontmatter is idempotent: second call replaces the previous summary block', () => {
  const once = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  const twice = mergeFrontmatter(once, { ...SUMMARY_CARD, headline: 'Replaced' }, TOPIC_SEGMENTS);
  assert.match(twice, /headline: "Replaced"/);
  // Only one summary_card block in the output.
  assert.equal((twice.match(/^summary_card:/gm) || []).length, 1);
});

test('mergeFrontmatter escapes double quotes in headline and summary', () => {
  const out = mergeFrontmatter(EXISTING, { ...SUMMARY_CARD, headline: 'He said "yes"' }, TOPIC_SEGMENTS);
  assert.match(out, /\n  headline: "He said \\"yes\\""\n/);
});

test('mergeFrontmatter uses YAML block scalar (|) for multi-line topic summaries', () => {
  const segs = [{ ...TOPIC_SEGMENTS[0], summary: 'Line one.\n\nLine two with **bold**.' }];
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, segs);
  assert.match(out, /summary: \|/);
  assert.ok(out.includes('Line two with **bold**.'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/transcripts/lib/merge_frontmatter.test.mjs`
Expected: FAIL with "Cannot find module './merge_frontmatter.mjs'"

- [ ] **Step 3: Implement**

Create `scripts/transcripts/lib/merge_frontmatter.mjs`:

```js
function escapeQuotes(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteOrBlock(text, indent) {
  if (text.includes('\n')) {
    const ind = ' '.repeat(indent);
    return '|\n' + text.split('\n').map(l => ind + l).join('\n');
  }
  return `"${escapeQuotes(text)}"`;
}

function renderSummaryCard(card) {
  const lines = ['summary_card:'];
  lines.push(`  headline: "${escapeQuotes(card.headline)}"`);
  lines.push(`  summary: ${quoteOrBlock(card.summary, 4)}`);
  if (Array.isArray(card.decisions) && card.decisions.length > 0) {
    lines.push('  decisions:');
    for (const d of card.decisions) lines.push(`    - "${escapeQuotes(d)}"`);
  }
  if (Array.isArray(card.votes) && card.votes.length > 0) {
    lines.push('  votes:');
    for (const v of card.votes) {
      lines.push(`    - motion: "${escapeQuotes(v.motion)}"`);
      lines.push(`      result: "${escapeQuotes(v.result)}"`);
    }
  }
  return lines.join('\n');
}

function renderTopicSegments(segs) {
  const lines = ['topic_segments:'];
  for (const s of segs) {
    lines.push(`  - topic: ${s.topic}`);
    if (typeof s.topic_confidence === 'number') {
      lines.push(`    topic_confidence: ${s.topic_confidence}`);
    }
    lines.push(`    start_seconds: ${s.start_seconds}`);
    lines.push(`    end_seconds: ${s.end_seconds}`);
    if (s.featured === true) lines.push('    featured: true');
    lines.push(`    headline: "${escapeQuotes(s.headline)}"`);
    if (s.dek) lines.push(`    dek: "${escapeQuotes(s.dek)}"`);
    lines.push(`    summary: ${quoteOrBlock(s.summary, 6)}`);
    if (Array.isArray(s.key_speakers) && s.key_speakers.length > 0) {
      const arr = s.key_speakers.map(k => `"${escapeQuotes(k)}"`).join(', ');
      lines.push(`    key_speakers: [${arr}]`);
    }
  }
  return lines.join('\n');
}

// Find the frontmatter block at the start of the file.
function splitFile(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('file has no YAML frontmatter');
  return { yaml: m[1], body: m[2] };
}

// Remove any previous summary_card / topic_segments blocks.
function stripPriorBlocks(yaml) {
  const lines = yaml.split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (/^(summary_card|topic_segments):/.test(line)) { skipping = true; continue; }
    if (skipping && /^[a-zA-Z_]/.test(line)) skipping = false;
    if (!skipping) out.push(line);
  }
  return out.join('\n');
}

export function mergeFrontmatter(existing, summaryCard, topicSegments) {
  const { yaml, body } = splitFile(existing);
  const stripped = stripPriorBlocks(yaml)
    .replace(/^source: vimeo-auto$/m, 'source: vimeo-auto+llm');
  const newYaml = [
    stripped,
    renderSummaryCard(summaryCard),
    renderTopicSegments(topicSegments),
  ].join('\n\n');
  return `---\n${newYaml}\n---\n${body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/transcripts/lib/merge_frontmatter.test.mjs`
Expected: PASS, 6 tests pass.

Full suite: `node --test scripts/transcripts/lib/*.test.mjs`
Expected: 47 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/merge_frontmatter.mjs scripts/transcripts/lib/merge_frontmatter.test.mjs
git commit -m "transcripts: merge LLM summary YAML into existing transcript files"
```

---

### Task 4: System prompt for the LLM

**Files:**
- Create: `scripts/transcripts/prompts/summary.md`

The prompt is loaded as the `system` message with `cache_control: { type: 'ephemeral' }`. Keep it stable across the batch to maximize cache hits. Pattern lifted from `scripts/minutes/prompts/pass1_extract.md`.

- [ ] **Step 1: Create the prompt file**

Create `scripts/transcripts/prompts/summary.md`:

```markdown
You are extracting structured summaries from Marblehead, Massachusetts public board meeting transcripts. You emit JSON only. No prose, no markdown fences, no commentary.

## Source material

Each user message contains the body of one meeting transcript. The body is paragraphs of timecoded auto-captioned text in this format:

    **[H:MM:SS](https://vimeo.com/<id>#t=<seconds>s)** Verbatim ASR text...

The transcript is machine-generated from Vimeo auto-captioning. It has no speaker labels. Proper names and dollar figures are sometimes misheard (e.g. "Mary Alley" → "Mary Ellis", "Abbot" → "Abbott", $8,441,500 → $8,441,005). Quote conservatively when uncertain; round numbers where the audio is ambiguous.

## Output JSON shape

```json
{
  "summary_card": {
    "headline": "string, ≤90 chars, one specific claim — what happened",
    "summary": "string, 2-4 sentences, factual; no editorial language",
    "decisions": ["string, one per board decision; phrase as 'Approved X', 'Held X', 'Continued X'"],
    "votes": [{"motion": "string", "result": "in favor (unanimous)" | "in favor (N to M)" | "..."}]
  },
  "topic_segments": [
    {
      "topic": "one of the 11 known slugs (see taxonomy below)",
      "topic_confidence": 0.0 to 1.0,
      "start_seconds": integer seconds (use the timecode at the start of the topic),
      "end_seconds": integer seconds (use the timecode at the end of the topic),
      "featured": true (set on AT MOST ONE segment — the lead story),
      "headline": "≤90 chars — what happened in this segment",
      "dek": "one supporting sentence",
      "summary": "markdown, can be multi-paragraph; can include tables, blockquotes",
      "key_speakers": ["names with optional role in parens, e.g. 'Matt Fernald (CFO)' or 'Resident (mic only)'"]
    }
  ]
}
```

## Topic taxonomy (locked — use ONLY these 11 slugs)

- `override` — Prop 2½ override, tier mechanics, MOU, levy capacity, three-year draw
- `school-budget` — school operating budget, headcount, Essex Tech, FY27 cuts, SPED
- `admin-housekeeping` — town administrator updates, grants, appointments, consent agenda, licensing, routine business that doesn't fit another bucket
- `public-comment` — open public comment portion, named residents at the mic
- `permits-zoning` — liquor licenses, special permits, ZBA referrals, hearing continuations
- `trash-dpw` — solid waste, curbside fee, DPW operations, paving, sidewalks
- `recreation-events` — Rec & Parks, events on town property, field permits
- `bonding-capital` — debt issuance, capital plan, bond sale, capital articles
- `public-safety` — police, fire, EMS, harbor master, emergency management
- `labor-personnel` — collective bargaining, pay schedules, department-head contracts, HR
- `40b-mbta` — Chapter 40B housing, MBTA Communities (3A), zoning compliance

If a meeting segment doesn't fit, pick the closest bucket and lower `topic_confidence`. **Never invent a new topic slug.** A response with an unknown slug is rejected and re-queued.

## Selecting the featured topic

Set `featured: true` on the single segment that an informed resident would lead with if telling a neighbor what happened at the meeting. Prefer segments with a vote, a dollar figure, or a contested public hearing over routine business. If everything is routine, omit `featured` entirely (max one featured, zero is OK).

## Neutrality and accuracy rules (HARD constraints)

- **No editorial language.** Do not use "crisis", "shocking", "skyrocketing", "outrageous", "failed to", "refused to", "killed the proposal", etc. Use neutral verbs: "approved", "rejected", "held", "continued", "tabled", "indefinitely postponed", "voted N to M".
- **No advocacy framing.** Do not suggest a voter should support or oppose anything. Marblehead residents disagree on what "good" means.
- **Numbers must trace back to the transcript.** Quote a number only if you can find it in the transcript body. Round to the nearest plausible value when the ASR is ambiguous (e.g. "$8,441,005 million" → "approximately $8.4M").
- **Speaker names are best-effort.** The ASR has no speaker labels. If you can identify a speaker from context (someone says "Madam Chair" then "Mr. Fox?" → Fox is the chair), put them in `key_speakers`. If you cannot, use a role label only ("Town Administrator", "Resident at mic").
- **Do not invent decisions or votes.** If no roll-call vote is mentioned, `votes: []`. If a motion was made but the outcome is unclear, do not fabricate one.
- **No OCR-style dollar figures.** Use real dollar signs and digits. The token `S15M` (capital S, no dollar sign) will be rejected.
- **Topic_segments must cover the meeting in chronological order.** start_seconds must be monotonically non-decreasing. Adjacent segments may share boundaries.

## Output

Emit the JSON object. Nothing else. No code fences. No commentary before or after.
```

- [ ] **Step 2: Verify the file exists**

Run: `wc -l scripts/transcripts/prompts/summary.md`
Expected: ~75-90 lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/transcripts/prompts/summary.md
git commit -m "transcripts: add LLM summary system prompt with neutrality rules"
```

---

### Task 5: Single-meeting enrich CLI (`enrich_one.mjs`)

**Files:**
- Create: `scripts/transcripts/enrich_one.mjs`

A focused single-file CLI: load `_transcripts/<slug>.md`, extract the body (everything after the disclaimer), send to Anthropic via `messages.create` (not Batch), parse + validate, merge frontmatter, write the file back. Used for smoke testing and ad-hoc re-runs.

- [ ] **Step 1: Implement**

Create `scripts/transcripts/enrich_one.mjs`:

```js
#!/usr/bin/env node
/**
 * Enrich a single _transcripts/<slug>.md file with LLM-generated
 * summary_card and topic_segments.
 *
 * Usage:
 *   node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md
 *   node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md --dry-run
 *
 * Requires: ANTHROPIC_API_KEY in env.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseResponse } from './lib/parse_response.mjs';
import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filePath = args.find(a => !a.startsWith('--'));
if (!filePath) {
  console.error('Usage: enrich_one.mjs <_transcripts/<slug>.md> [--dry-run]');
  process.exit(2);
}

function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter found');
  return m[1].trim();
}

async function main() {
  const file = readFileSync(filePath, 'utf8');
  if (/^summary_card:/m.test(file)) {
    console.error(`${filePath} already has summary_card; skipping. Pass --force to override.`);
    if (!args.includes('--force')) return;
  }
  const body = extractBody(file);
  console.error(`Body length: ${body.length} chars, ~${Math.round(body.length / 4)} tokens`);

  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: body }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  console.error(`Response: ${text.length} chars, usage: ${JSON.stringify(res.usage)}`);

  const parsed = parseResponse(text);
  if (!parsed.valid) {
    console.error('VALIDATION FAILED:');
    for (const err of parsed.errors) console.error(`  - ${err}`);
    console.error('\nRaw response:\n' + text);
    process.exit(1);
  }

  const merged = mergeFrontmatter(file, parsed.summary_card, parsed.topic_segments);
  if (dryRun) {
    console.error('--dry-run set; would write:');
    console.log(merged.slice(0, 2000));
    return;
  }
  writeFileSync(filePath, merged);
  console.error(`Wrote ${filePath} (${merged.length} bytes).`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Smoke run on a recent Select Board meeting (dry run first)**

Run: `set -a; source .env; set +a; node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md --dry-run`

Expected: prints body length, usage stats, and the first 2000 chars of the proposed merged output. Look at the YAML — does `summary_card.headline` make sense? Is `topic_segments[0].topic` a real topic? Is `featured: true` set on at most one?

If validation fails, inspect the raw response and tune the prompt.

- [ ] **Step 3: Real run on the same meeting**

Run: `node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md`

Expected: writes the file. Inspect with `head -60 _transcripts/select-board-2026-05-27.md`.

- [ ] **Step 4: Verify Jekyll builds and the page renders the new structure**

Run: `bundle exec jekyll build 2>&1 | tail -8`

Expected: no YAML parse errors. Open `_site/meetings/select-board-2026-05-27/` and verify the lead story card now shows the headline and dek (per the layout's `featured` handling).

- [ ] **Step 5: Commit the script + the one enriched file**

```bash
git add scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md
git commit -m "transcripts: single-meeting enrichment CLI + first sample"
```

---

### Task 6: Eyeball the enriched output in the live preview

**Files:** None modified.

The goal of this checkpoint is to catch prompt-tuning issues before submitting 226 more meetings to the batch API and burning the budget on bad output.

- [ ] **Step 1: Serve the build**

Run: `npx serve _site -p 4002 --no-clipboard --no-port-switching`

(In the background — the previous worktree's serve may already own 4000.)

- [ ] **Step 2: Screenshot the enriched page**

```bash
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  "http://localhost:4002/meetings/select-board-2026-05-27/" \
  "proof/$(git branch --show-current)-enriched-sample.png"
```

- [ ] **Step 3: Screenshot the `/meetings/` index too**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  "http://localhost:4002/meetings/" \
  "proof/$(git branch --show-current)-enriched-index.png"
```

- [ ] **Step 4: Eyeball both screenshots**

Open both files. Check:
- Hero shows board chip, title, date, duration, Watch on MHTV.
- Lead story card (`featured: true` topic) has headline + dek and expands to show the summary text.
- "Tonight's record" strip shows non-zero counts for decisions and votes.
- The disclaimer paragraph is still inside the collapsed "min full transcript" disclosure.
- Index card now shows headline + topic chips (not just title/date).

If any of these is wrong, stop and tune the prompt (Task 4) before continuing. Re-run `enrich_one.mjs --force` until it looks right.

- [ ] **Step 5: Commit the proof**

```bash
git add proof/*-enriched-*.png
git commit -m "transcripts: proof screenshots of enriched sample"
```

---

### Task 7: Batch API driver (`enrich_batch.mjs`)

**Files:**
- Create: `scripts/transcripts/enrich_batch.mjs`
- Modify: `.gitignore` (add `data/.transcripts_enrich_state.json`)

Submits the full corpus to the Anthropic Batch API in one request (~227 sub-requests), persists the batch id, polls every 30 seconds, collects results, writes each `_transcripts/<slug>.md` with merged frontmatter, logs validation failures separately for re-submission.

Three subcommands: `submit`, `poll`, `collect`.

- [ ] **Step 1: Implement**

Create `scripts/transcripts/enrich_batch.mjs`:

```js
#!/usr/bin/env node
/**
 * Bulk-enrich every Vimeo-auto transcript via the Anthropic Messages Batch API.
 *
 * Subcommands:
 *   submit  — read _transcripts/*.md, skip files already enriched, submit batch
 *   poll    — print current batch status
 *   collect — fetch results, validate, merge, write files
 *
 * State persisted at data/.transcripts_enrich_state.json (gitignored).
 *
 * Requires: ANTHROPIC_API_KEY in env.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { parseResponse } from './lib/parse_response.mjs';
import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');
const STATE_FILE = 'data/.transcripts_enrich_state.json';
const FAIL_LOG = 'data/.transcripts_enrich_failures.log';
const TRANSCRIPTS_DIR = '_transcripts';

const subcommand = process.argv[2];
if (!['submit', 'poll', 'collect'].includes(subcommand)) {
  console.error('Usage: enrich_batch.mjs submit|poll|collect');
  process.exit(2);
}

function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  return m[1].trim();
}

function listCandidates() {
  return readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(f => ({ slug: f.replace(/\.md$/, ''), path: resolve(TRANSCRIPTS_DIR, f) }))
    .filter(({ path }) => {
      const text = readFileSync(path, 'utf8');
      // Skip files that already have a summary_card (LLM-enriched or hand-crafted POCs).
      return !/^summary_card:/m.test(text);
    });
}

async function submit() {
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const candidates = listCandidates();
  console.error(`Found ${candidates.length} candidate transcripts.`);
  if (candidates.length === 0) {
    console.error('Nothing to do.');
    return;
  }

  const requests = candidates.map(({ slug, path }) => {
    const file = readFileSync(path, 'utf8');
    const body = extractBody(file);
    return {
      custom_id: slug,
      params: {
        model: MODEL,
        max_tokens: 8192,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: body }],
      },
    };
  });

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  const state = {
    batch_id: batch.id,
    submitted_at: new Date().toISOString(),
    count: requests.length,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.error(`Batch submitted: ${batch.id} (${requests.length} requests).`);
  console.error('Poll with: node scripts/transcripts/enrich_batch.mjs poll');
}

async function poll() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(state.batch_id);
  console.error(`Batch ${batch.id}: ${batch.processing_status}`);
  console.error(`  request_counts: ${JSON.stringify(batch.request_counts)}`);
  if (batch.processing_status === 'ended') {
    console.error('Ready to collect: node scripts/transcripts/enrich_batch.mjs collect');
  }
}

async function collect() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(state.batch_id);
  if (batch.processing_status !== 'ended') {
    console.error(`Batch not done yet: ${batch.processing_status}`);
    process.exit(1);
  }
  let written = 0, failed = 0;
  for await (const result of client.messages.batches.results(state.batch_id)) {
    const slug = result.custom_id;
    const path = resolve(TRANSCRIPTS_DIR, `${slug}.md`);
    if (!existsSync(path)) {
      console.error(`${slug}: source file disappeared, skipping`);
      failed += 1;
      continue;
    }
    if (result.result.type !== 'succeeded') {
      console.error(`${slug}: batch result type=${result.result.type}`);
      appendFileSync(FAIL_LOG, `${slug}\t${result.result.type}\t${JSON.stringify(result.result.error || {})}\n`);
      failed += 1;
      continue;
    }
    const msg = result.result.message;
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = parseResponse(text);
    if (!parsed.valid) {
      console.error(`${slug}: validation failed: ${parsed.errors.join('; ')}`);
      appendFileSync(FAIL_LOG, `${slug}\tvalidation\t${parsed.errors.join('; ')}\n`);
      failed += 1;
      continue;
    }
    const file = readFileSync(path, 'utf8');
    const merged = mergeFrontmatter(file, parsed.summary_card, parsed.topic_segments);
    writeFileSync(path, merged);
    written += 1;
    if (written % 25 === 0) console.error(`  written: ${written}`);
  }
  console.error(`Done. written=${written} failed=${failed}`);
  if (failed > 0) console.error(`Failures logged to ${FAIL_LOG}`);
}

if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
```

- [ ] **Step 2: Add the state file to gitignore**

Edit `.gitignore` — add at the end:

```
# Transcript LLM enrichment batch state (transient)
data/.transcripts_enrich_state.json
data/.transcripts_enrich_failures.log
```

- [ ] **Step 3: Commit**

```bash
git add scripts/transcripts/enrich_batch.mjs .gitignore
git commit -m "transcripts: Batch API driver for bulk LLM enrichment"
```

---

### Task 8: Cost dry-run before submitting

**Files:** None modified.

Estimate the batch cost before paying for it. Anthropic Batch API is 50% off list, but on 227 long transcripts the cost can still surprise.

- [ ] **Step 1: Count tokens to estimate cost**

Run:

```bash
node -e "
import('node:fs').then(fs => {
  const dir = '_transcripts';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  let total = 0, candidates = 0;
  for (const f of files) {
    const text = fs.readFileSync(\`\${dir}/\${f}\`, 'utf8');
    if (/^summary_card:/m.test(text)) continue;
    candidates++;
    const m = text.match(/^---\n[\\s\\S]*?\n---\n([\\s\\S]*)$/);
    if (m) total += m[1].length;
  }
  const tokens = Math.round(total / 4);
  console.log('candidates:', candidates);
  console.log('total body chars:', total);
  console.log('approx input tokens:', tokens);
  // Sonnet 4.6 batch: input \$1.50/M, output \$7.50/M. 50% off list.
  // Cache hits on system prompt (~1.5K tokens) charged at \$0.30/M (cache write \$1.875/M).
  // Output estimate: ~5K tokens per meeting.
  const inputCost = (tokens / 1e6) * 1.50;
  const outputCost = (candidates * 5000 / 1e6) * 7.50;
  console.log('rough cost estimate: \$' + (inputCost + outputCost).toFixed(2));
});
"
```

Expected: prints something like:
```
candidates: 227
total body chars: 22000000
approx input tokens: 5500000
rough cost estimate: $16.75
```

- [ ] **Step 2: Sanity check the estimate**

If the estimate is over $100, STOP. The plan budget is ~$25-50. Numbers above that mean transcripts are unexpectedly long; check for an outlier with `for f in _transcripts/*.md; do echo "$(wc -c < $f) $f"; done | sort -rn | head -5`.

---

### Task 9: Submit the batch

**Files:** None modified.

- [ ] **Step 1: Submit**

Run: `set -a; source .env; set +a; node scripts/transcripts/enrich_batch.mjs submit`

Expected: prints `Batch submitted: msgbatch_... (227 requests).` and writes `data/.transcripts_enrich_state.json`.

- [ ] **Step 2: Poll**

Run: `node scripts/transcripts/enrich_batch.mjs poll`

Expected: prints `processing_status: in_progress` and the request counts.

Batches typically complete in 5-60 minutes depending on queue depth.

- [ ] **Step 3: Wait for completion**

Re-run `poll` every few minutes until `processing_status: ended`.

If `ended` shows non-zero `errored` or `expired`, those will be in the failure log after Task 10.

---

### Task 10: Collect results, write files

**Files:**
- Modifies: 227 `_transcripts/*.md` files (adds `summary_card` + `topic_segments`)

- [ ] **Step 1: Run collect**

Run: `set -a; source .env; set +a; node scripts/transcripts/enrich_batch.mjs collect`

Expected: prints `  written: 25`, `  written: 50`, ..., then `Done. written=NNN failed=MM`.

- [ ] **Step 2: Spot-check 6 random enriched files**

Run:

```bash
for f in $(ls _transcripts/*.md | shuf | head -6); do
  echo "=== $f ==="
  grep -A 4 "^summary_card:" $f | head -6
  echo
done
```

For each: does the headline read like a neutral factual claim (not editorial)? Does the topic match the meeting's substance?

- [ ] **Step 3: Inspect the failure log**

Run: `cat data/.transcripts_enrich_failures.log 2>/dev/null | head -20`

If failures exist, the common categories will be validation errors (unknown topic, multiple featured, OCR figure). The pattern of errors tells you whether to:
- Tune the prompt and re-submit the failures via `enrich_one.mjs` (cheap, fast)
- Accept the failures (they keep the bare `source: vimeo-auto` card, no harm)

- [ ] **Step 4: Verify Jekyll builds clean**

Run: `bundle exec jekyll build 2>&1 | tail -10`

Expected: no YAML errors. If there's a YAML error, the failure log slug tells you which file to inspect; usually a quote-escaping edge case in `merge_frontmatter.mjs`.

---

### Task 11: Commit per board, push, open PR

**Files:**
- Adds the diff to 227 files (frontmatter only, body unchanged).

- [ ] **Step 1: Commit per board**

```bash
git add _transcripts/select-board-*.md
git commit -m "transcripts: LLM-enrich Select Board meetings (summary cards + topic segments)"

git add _transcripts/school-committee-*.md
git commit -m "transcripts: LLM-enrich School Committee meetings"

git add _transcripts/finance-committee-*.md
git commit -m "transcripts: LLM-enrich Finance Committee meetings"

git add _transcripts/town-meeting-*.md
git commit -m "transcripts: LLM-enrich Town Meeting recordings"

git add _transcripts/board-of-health-*.md
git commit -m "transcripts: LLM-enrich Board of Health meetings"
```

Each glob may catch a board where some meetings already had summary cards (hand-crafted POCs); the merge function preserves the body and re-renders frontmatter, so the diff is bounded to the YAML fields.

- [ ] **Step 2: Push to a new branch (not the same as PR #797)**

This is a separate logical PR per the CLAUDE.md rule. Create a fresh branch off the current one (which already contains the Vimeo backfill):

```bash
git checkout -b transcripts-llm-enrichment
git push -u origin transcripts-llm-enrichment
```

(Or: rebase onto whatever ends up landing on `main` after PR #797 merges. If #797 is still open, stack the new branch on it.)

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "LLM-enrich 227 Vimeo-auto transcripts with summary cards + topic segments" --body "$(cat <<'EOF'
## Summary

Adds the "newspaper" layer to the 227 Vimeo-auto transcripts shipped in #797. Each meeting now has:
- `summary_card` — headline, summary, decisions, votes
- `topic_segments` — up to one featured lead story plus secondary cards, with `start_seconds` deep-links into the source video

Topics are constrained to the 11-slug taxonomy already in use by the hand-crafted POCs. Topic membership and shape are validated before any file is written. Failed validations are logged for re-submission; affected files remain at the bare `source: vimeo-auto` state from #797.

Cost: ~$NN at the Sonnet 4.6 Batch API price (fill in actual).

## Builds on

#797 (Vimeo auto-caption backfill). The pipeline reads files written by #797 and adds frontmatter fields only. The disclaimer, body, and timecoded paragraphs are preserved verbatim.

## What's NOT in this PR

- Speaker labels / AssemblyAI / Whisper
- MPS YouTube source (separate plan)
- Going-forward auto-enrichment of new meetings (post-merge cron)

## Test plan

- [ ] Preview deploy succeeds
- [ ] `/meetings/` index now shows a headline + topic chips on the previously-bare cards
- [ ] A sample lead-story page expands to show the markdown summary, table, blockquote, etc.
- [ ] Timecode anchors still work (sample one)
- [ ] Search (Pagefind) lands on the right page when searching a phrase from a summary

## Proof of Work

- proof/<branch>-enriched-sample.png — sample enriched transcript page
- proof/<branch>-enriched-index.png — `/meetings/` listing with new cards
- `npm run test:transcripts` → 47/47 unit tests pass
- `bundle exec jekyll build` → no YAML errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Edit PR body with preview URL when sticky comment lands**

(Same flow as #797: watch for `### Preview` comment, extract Branch URL, `gh pr edit --body-file`.)

- [ ] **Step 5: Report PR URL**

```bash
gh pr view --json url --jq .url
```

---

## Self-Review

**1. Spec coverage:**

| User intent | Task |
|---|---|
| LLM summarizes every transcript | 5, 7, 9, 10 |
| Same "newspaper" shape as hand-crafted POCs | 3 (mergeFrontmatter), 4 (prompt schema) |
| Auto-publish (option 1, not draft-then-review) | 7 (Batch driver writes files directly) |
| 11-topic taxonomy locked | 1 (KNOWN_TOPICS), 4 (prompt enumerates) |
| Cheap one-time backfill | 8 (cost dry-run), 7 (Batch API = 50% off) |
| Disclaimer carries through | 3 (mergeFrontmatter preserves body+disclaimer) |
| Idempotent re-runs | 3 (mergeFrontmatter strips prior blocks), 7 (listCandidates skips files with summary_card) |

**2. Placeholder scan:** No "TBD", "implement later", "appropriate error handling", or hand-waved references. The PR body in Task 11 has `~$NN at the Sonnet 4.6 Batch API price (fill in actual)` — that's a deliberate post-hoc fill-in, not a planning gap.

**3. Type consistency:**

- `parseResponse(text)` returns `{ valid, summary_card, topic_segments, errors }`. Consumed by `enrich_one.mjs` (Task 5) and `enrich_batch.mjs` (Task 7) with the same destructure.
- `mergeFrontmatter(existing, summary_card, topic_segments)` returns a string. Consumed by both CLIs.
- `isKnownTopic(slug)` returns boolean.
- `KNOWN_TOPICS` is frozen.
- `enrich_batch.mjs` `submit / poll / collect` share the `STATE_FILE` path.

**4. Known limitations called out in the plan:**

- Older transcripts whose ASR is gravely wrong may produce summaries with bad numbers despite the "no OCR-style figures" check. The validator catches `S15M`-shape errors but not subtle digit swaps. Acceptable for backfill; new-meeting flow can layer a human checkpoint.
- The prompt assumes Marblehead-specific context (override-tier mechanics, MOU, Essex Tech). Other towns would need a new prompt.
- One featured topic per meeting is a hard constraint; some meetings legitimately have two lead stories. The validator picks the first one and silently drops `featured: true` on the rest is NOT how it works — it rejects the whole response. If this happens often, relax to "drop extra featured flags" rather than reject.

**5. Things that might go wrong at runtime, and the planned recovery:**

- **Anthropic key missing** → Task 0 fails fast, no later work runs.
- **Batch errors out** → Task 10 logs `data/.transcripts_enrich_failures.log`; re-submit failures via `enrich_one.mjs` after prompt tuning.
- **Jekyll YAML parse error** → Task 10 step 4 catches before commit; usually a quote-escaping bug in `mergeFrontmatter`.
- **Cost overrun** → Task 8 dry-run catches before submit; abort and ask the user.
