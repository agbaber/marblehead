# Historical Minutes Catalog: Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two interrelated narrative pages on the site, each backed by a primary-source-cited catalog of Select Board and School Committee attempts to address systemic fiscal issues (FY19 to present). The pages answer the two motivating questions directly: "is the board trying?" and "what have we tried?" They link to each other and to the underlying catalog.

**Architecture:** Four-pass pipeline that is fully AI-automated between passes; human attention is on the synthesis output, not individual candidate rows.

1. **Pass 1: Bulk extract.** Every `status=downloaded` minutes file produces a JSON array of raw candidate entries against the Phase 2 rubric.
2. **Pass 2: Verify + score.** Per candidate: verify the quote against cleaned source text, score importance 1 to 5, optionally re-categorize. Pass 2 filters out routine/unimportant/unverifiable candidates.
3. **Pass 3: Synthesize.** Reads the filtered catalog and writes two narrative markdown documents, one per motivating question, each with inline citations to catalog rows.
4. **Human: Spot-check + ship.** Read the synthesis (roughly 5-10 pages), sample 10% of citations to confirm quote fidelity, wire up the HTML pages, open a PR.

**Tech Stack:** Node.js + Anthropic SDK (Claude API), Anthropic Batch API for Pass 1 and Pass 2, prompt caching for the rubric doc and shared context, system `pdftotext` already handled by Phase 1. `scripts/minutes/` Node conventions already established.

**Spec reference:** `docs/superpowers/specs/2026-04-16-historical-minutes-catalog-design.md`. This plan **supersedes** sections 6 and 7 of the spec. The spec's sample-vet-then-scale design was sound in theory but infeasible in practice (roughly 35 hours of human vetting per the prototype finding that vetting is ~5 min per meeting). See `docs/superpowers/notes/2026-04-16-extraction-prototype-findings.md` for the full rationale.

**Prerequisites before execution:**

- Phase 1 merged (PR #586). Corpus at `data/minutes/{body}/*.txt`, manifest at `data/minutes_manifest.csv`.
- Prototype findings merged (PR #592) or co-merged with this work.
- `ANTHROPIC_API_KEY` in `.env` is required for the pilot (Tasks 3 and 5 issue direct API calls). For the full-corpus scale-up in Task 7, it's required for the Batch-API route; not required if you pick the subagent-dispatch route.

**Execution strategy: pilot first, decide, then scale.**

The plan gates the scale-up behind a two-step micro-pilot because the wall-time to run the full pipeline (4 to 6 hours via subagents, or 2 to 4 hours via Batch API plus about $20-30) is the real cost, not the dollars. If the pilot surfaces a prompt issue or quality problem, you'd rather find out after 20 minutes of pilot than after 5 hours of full run.

- **Pilot (Tasks 1 through 6):** text cleaning + Pass 1 on 10 stratified meetings + Pass 2 on the ~60 candidates produced + go/no-go decision. Uses sync API calls (about $1-2 total). Wall time: 20-40 minutes of active waiting plus 10-20 minutes of review.
- **Scale-up (Task 7 onward):** runs the full corpus only after you have evidence the rubric holds. Either subagent-driven (your subscription, longer wall time) or Batch API (about $20-30, shorter wall time).

**Out of scope for Phase 2:** FinCom minutes remain a coverage gap pending the public records request to Kyle Wiley (draft at `docs/superpowers/notes/2026-04-16-records-request-fincom-minutes.md`). If FinCom PDFs arrive mid-Phase-2, they can be dropped into `data/minutes/fincom/` and the pipeline re-run on just those files.

---

## File structure

| Path | Responsibility | Created in task |
|---|---|---|
| `scripts/minutes/clean_text.mjs` | Strip page-footer patterns from raw `.txt` into `.cleaned.txt` | Task 1 |
| `scripts/minutes/prompts/pass1_extract.md` | System prompt for Pass 1 (the rubric) | Task 2 |
| `scripts/minutes/prompts/pass2_score.md` | System prompt for Pass 2 (verify + score) | Task 4 |
| `scripts/minutes/prompts/pass3_synthesize_trying.md` | System prompt for "is the board trying?" narrative | Task 8 |
| `scripts/minutes/prompts/pass3_synthesize_tried.md` | System prompt for "what have we tried?" narrative | Task 8 |
| `data/minutes/{body}/{date}.cleaned.txt` | Cleaned source text (committed) | Task 1 |
| `data/pilot_candidates_pass1.csv` | Pilot Pass 1 output (10 meetings) | Task 3 |
| `data/pilot_candidates_pass2.csv` | Pilot Pass 2 output (scored pilot candidates) | Task 5 |
| `data/catalog_raw.csv` | Full-corpus Pass 1 output | Task 7 |
| `data/catalog.csv` | Full-corpus Pass 2 output (promoted, verified, scored) | Task 7 |
| `data/catalog_pass2_log.md` | Pass 2 dropped/rejected entries with reasons | Task 7 |
| `docs/superpowers/notes/2026-04-16-phase2-pilot-review.md` | Pilot quality review and scale-up decision | Task 6 |
| `is-the-board-trying.md` (draft) | Pass 3 synthesis for motivating question 1 | Task 8 |
| `what-have-we-tried.md` (draft) | Pass 3 synthesis for motivating question 2 | Task 8 |
| `is-the-board-trying.html` | Site page 1 | Task 9 |
| `what-have-we-tried.html` | Site page 2 | Task 9 |
| `data/DATA_CATALOG.md` | Existing doc, gets rows added | Task 10 |
| `data/SOURCE_LOOKUP.md` | Existing doc, gets entries added | Task 10 |

---

### Task 1: Text cleaning (strip page-footer noise)

**Goal:** Produce a `.cleaned.txt` alongside each existing `.txt` with page-footer interruptions removed, so that Pass 1 and Pass 2 quote verification work reliably.

**Observed footer patterns (from prototype and sampling):**
- `Month Day, Year<spaces>NN` (example: `June 17, 2020                              61`)
- `Page N of M`
- A bare integer on its own line (pagination)

**Files:**
- Create: `scripts/minutes/clean_text.mjs`
- Create: `scripts/minutes/lib/clean.mjs`
- Create: `scripts/minutes/lib/clean.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `scripts/minutes/lib/clean.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripFooters } from './clean.mjs';

test('strips month-day-year-pagenum footer lines', () => {
  const input = [
    'Motion made and seconded to approve',
    '',
    'June 17, 2020                              61',
    '',
    '$650,396.00 for Salaries,'
  ].join('\n');
  const out = stripFooters(input);
  assert.equal(out.includes('June 17, 2020'), false);
  assert.equal(out.includes('Motion made and seconded to approve'), true);
  assert.equal(out.includes('$650,396.00 for Salaries'), true);
});

test('strips Page N of M', () => {
  const input = 'some text\nPage 3 of 12\nmore text';
  assert.equal(stripFooters(input).includes('Page 3 of 12'), false);
});

test('strips bare page number on its own line', () => {
  const input = 'ending of sentence\n\n61\n\nnext section';
  const out = stripFooters(input);
  assert.equal(out.includes('\n61\n'), false);
  assert.equal(out.includes('ending of sentence'), true);
  assert.equal(out.includes('next section'), true);
});

test('does not strip standalone numbers inside prose', () => {
  const input = 'approved $650,396.00 for Salaries';
  assert.equal(stripFooters(input), input);
});

test('does not strip months mentioned in body', () => {
  const input = 'The meeting held on June 17, 2020 discussed...';
  const out = stripFooters(input);
  assert.equal(out.includes('June 17, 2020'), true);
});

test('collapses multiple blank lines introduced by stripping', () => {
  const input = 'a\n\n\nJune 17, 2020    61\n\n\n\nb';
  const out = stripFooters(input);
  assert.match(out, /a\n\n+b/);
  assert.doesNotMatch(out, /\n\n\n\n/);
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
node --test scripts/minutes/lib/clean.test.mjs
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `clean.mjs`**

```js
const MONTHS = '(January|February|March|April|May|June|July|August|September|October|November|December)';
const FOOTER_PATTERNS = [
  new RegExp(`^\\s*${MONTHS}\\s+\\d{1,2},\\s*\\d{4}\\s+\\d{1,4}\\s*$`, 'i'),
  /^\s*Page\s+\d+\s+of\s+\d+\s*$/i,
  /^\s*\d{1,4}\s*$/,
];

export function stripFooters(text) {
  const lines = text.split('\n');
  const kept = lines.filter(line => !FOOTER_PATTERNS.some(re => re.test(line)));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}
```

- [ ] **Step 4: Tests pass**

```bash
node --test scripts/minutes/lib/clean.test.mjs
```

Expected: 6 passing.

- [ ] **Step 5: Implement the driver `clean_text.mjs`**

```js
#!/usr/bin/env node
import { readManifest, appendOrUpdate } from './lib/manifest.mjs';
import { stripFooters } from './lib/clean.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');

function main() {
  const rows = readManifest(MANIFEST_PATH);
  const todo = rows.filter(r => r.status === 'downloaded' && r.local_txt);
  console.log(`Cleaning text for ${todo.length} rows`);
  let i = 0;
  for (const row of todo) {
    i++;
    const src = resolve(row.local_txt);
    if (!existsSync(src)) continue;
    const dest = src.replace(/\.txt$/, '.cleaned.txt');
    const raw = readFileSync(src, 'utf8');
    const cleaned = stripFooters(raw);
    writeFileSync(dest, cleaned);
    if (i % 25 === 0 || i === todo.length) console.log(`  ${i}/${todo.length}`);
  }
}

main();
```

- [ ] **Step 6: Run on full corpus**

```bash
node scripts/minutes/clean_text.mjs
ls data/minutes/select_board/*.cleaned.txt | wc -l  # expect 234
ls data/minutes/school_committee/*.cleaned.txt | wc -l  # expect 203
```

- [ ] **Step 7: Spot-check the 2020-06-17 file previously flagged by the prototype**

```bash
grep -c "June 17, 2020" data/minutes/select_board/2020-06-17.cleaned.txt
# Expected: 1 (the meeting-date header stays; the page-footer repeats are gone)
# For comparison:
grep -c "June 17, 2020" data/minutes/select_board/2020-06-17.txt
# Expected: 10 or more
```

- [ ] **Step 8: Commit**

```bash
git add scripts/minutes/clean_text.mjs scripts/minutes/lib/clean.mjs scripts/minutes/lib/clean.test.mjs data/minutes/*/*.cleaned.txt
git commit -m "Add page-footer stripper for extraction pipeline; emit cleaned text alongside raw"
```

---

### Task 2: Write Pass 1 extraction prompt

**Goal:** Author the Pass 1 extraction rubric prompt that Pass 1 (pilot and full-scale) will use. No code; this is a one-file deliverable.

**Files:**
- Create: `scripts/minutes/prompts/pass1_extract.md`

- [ ] **Step 1: Write the prompt**

Create `scripts/minutes/prompts/pass1_extract.md`:

```markdown
You are a research agent extracting structured data from Marblehead Massachusetts municipal meeting minutes. You emit JSON only. No prose.

## Goal

Identify every **attempt** by the Board to address a **systemic fiscal issue**. Emit one JSON object per attempt.

## Definition of "attempt"

A voted motion, adopted policy, funded study, formal appointment of a working group, warrant article, OR a named proposal presented in a meeting that received substantive discussion (even if not voted). Routine agenda items, license approvals, public comment, or generic discussion WITHOUT a named proposal do NOT count.

### Bundled motions

When one motion bundles multiple line items and two or more line items are systemic-topic-relevant (OPEB, Group Insurance, Non-Contributory Retirement, etc.), emit ONE entry per systemic line item, all sharing the same `evidence_quote`. Distinguish them in `minutes_section` (e.g. `Budgets: Finance Department / Group Insurance` vs. `Budgets: Finance Department / Non-Contributory Retirement`).

### Contractual obligations

Debt service, Workers Compensation, Non-Contributory Retirement, and other statutorily or contractually required appropriations are votes on non-discretionary amounts. Include them, but mark `attempt_type=vote` and `deliberation=routine`, and let downstream scoring filter them out.

### Routine recurring votes

A departmental budget vote with no recorded deliberation ("X appeared before the Board to present... Motion made...") that touches a systemic line item: include with `deliberation=routine`. Scoring will filter.

## Topic taxonomy

- `healthcare_gic`: health insurance, GIC, employee benefits
- `pensions_opeb`: pensions, OPEB, post-employment liability
- `special_ed_collaborative`: SPED, out-of-district, collaborative tuition
- `structural_deficit_reserves`: deficit, reserves, free cash policy, stabilization
- `revenue_diversification`: new growth, fees, PILOT, voluntary contributions
- `override_prop25`: override and Prop 2.5 history, debt exclusions
- `regionalization_shared`: regionalization, shared services, consolidation (inter-municipal AND intra-town organizational restructuring both qualify)
- `capital_facilities_debt`: capital plan, facilities, debt service
- `solid_waste`: trash funding model
- `staffing_fte_bargaining`: FTE structural decisions, collective bargaining cost items
- `other_candidate`: escape hatch; set `topic_other_label` when used

## Schema (JSON array)

```json
{
  "entry_id": "{body}_{date}_{seq-001}",
  "meeting_date": "YYYY-MM-DD",
  "body": "select_board" | "school_committee",
  "topic": one of the taxonomy keys,
  "topic_other_label": null | string,
  "attempt_type": "vote" | "proposal" | "study" | "working_group" | "warrant_article",
  "deliberation": "discussed" | "routine" | "unknown",
  "what_was_tried": string (NEUTRAL, FACTUAL language; no "failed to act", no judgment),
  "outcome": string (factual; vote result if a vote, disposition if a proposal),
  "evidence_quote": 1-3 verbatim sentences from the cleaned source text, MUST be substring-findable in cleaned text,
  "minutes_section": string (label of the agenda item the attempt belongs to),
  "confidence": "high" | "medium" | "low" (self-rated, based on clarity of signal)
}
```

## Output contract

Emit ONLY a JSON array. No preface, no postface. Empty array `[]` if the meeting contains no attempts.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/minutes/prompts/pass1_extract.md
git commit -m "Add Pass 1 extraction rubric prompt"
```

---

### Task 3: Pilot Pass 1 (10 stratified meetings)

**Goal:** Run Pass 1 extraction against a 10-meeting stratified sample. Produce `data/pilot_candidates_pass1.csv`. This is the first of two pilot gates before committing to the full-corpus run.

**Sample selection (stratified):** pick one meeting from each bucket so the pilot covers era + body + text-quality variation:

1. Select Board, FY19 era, `pdftotext` clean
2. Select Board, FY20 era, `ocr` (to confirm OCR'd files work)
3. Select Board, FY22 era, `pdftotext` clean
4. Select Board, FY24 era, `pdftotext` clean
5. Select Board, FY26 era, `pdftotext` clean
6. School Committee, FY19 era, `pdftotext` clean
7. School Committee, FY21 era, `ocr` (to confirm OCR'd files work)
8. School Committee, FY23 era, `pdftotext` clean
9. School Committee, FY25 era, `pdftotext` clean
10. School Committee, FY26 era, `pdftotext` clean

Query for candidates:

```bash
awk -F, 'NR>1 && $1=="select_board" && $6=="pdftotext" && $7=="clean" && $2 >= "2018-07-01" && $2 < "2019-07-01"' data/minutes_manifest.csv | head -3
# Repeat for each era/body/quality combo
```

**Files:**
- Create: `scripts/minutes/pilot_pass1.mjs`
- Create: `data/pilot_candidates_pass1.csv`

- [ ] **Step 1: Source the API key**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
test -n "$ANTHROPIC_API_KEY" || { echo "ANTHROPIC_API_KEY not set"; exit 1; }
```

- [ ] **Step 2: Install SDK**

```bash
npm install --save @anthropic-ai/sdk
```

- [ ] **Step 3: Implement the pilot driver**

Create `scripts/minutes/pilot_pass1.mjs`:

```js
#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify } from 'csv-stringify/sync';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass1_extract.md');
const OUTPUT = resolve('data/pilot_candidates_pass1.csv');

const SAMPLE = [
  { body: 'select_board',     date: 'YYYY-MM-DD' }, // FY19 clean
  { body: 'select_board',     date: 'YYYY-MM-DD' }, // FY20 ocr
  { body: 'select_board',     date: 'YYYY-MM-DD' }, // FY22 clean
  { body: 'select_board',     date: 'YYYY-MM-DD' }, // FY24 clean
  { body: 'select_board',     date: 'YYYY-MM-DD' }, // FY26 clean
  { body: 'school_committee', date: 'YYYY-MM-DD' }, // FY19 clean
  { body: 'school_committee', date: 'YYYY-MM-DD' }, // FY21 ocr
  { body: 'school_committee', date: 'YYYY-MM-DD' }, // FY23 clean
  { body: 'school_committee', date: 'YYYY-MM-DD' }, // FY25 clean
  { body: 'school_committee', date: 'YYYY-MM-DD' }, // FY26 clean
];

// Fill in the 10 SAMPLE entries with actual dates from the manifest before running.

const COLUMNS = [
  'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
  'attempt_type', 'deliberation', 'what_was_tried', 'outcome',
  'evidence_quote', 'minutes_section', 'confidence',
  'quote_findable'
];

function normalize(s) { return s.replace(/\s+/g, ' ').trim(); }

async function extractOne(client, prompt, body, date) {
  const path = resolve(`data/minutes/${body}/${date}.cleaned.txt`);
  const text = readFileSync(path, 'utf8');
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Meeting: ${body} ${date}\n\n---\n${text}\n---\n\nEmit the JSON array.` }]
  });
  const out = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
  const m = out.match(/\[[\s\S]*\]/);
  if (!m) throw new Error(`No JSON for ${body} ${date}`);
  const cands = JSON.parse(m[0]);
  const normText = normalize(text);
  for (const c of cands) {
    c.quote_findable = normText.includes(normalize(c.evidence_quote || ''));
  }
  return cands;
}

async function main() {
  const client = new Anthropic();
  const prompt = readFileSync(PROMPT_PATH, 'utf8');
  const all = [];
  for (const s of SAMPLE) {
    console.log(`Extracting ${s.body} ${s.date}...`);
    const cands = await extractOne(client, prompt, s.body, s.date);
    console.log(`  got ${cands.length} candidates, ${cands.filter(c => c.quote_findable).length} verified`);
    all.push(...cands);
  }
  const rows = all.map(c => { const o = {}; for (const k of COLUMNS) o[k] = c[k] ?? ''; return o; });
  writeFileSync(OUTPUT, stringify(rows, { header: true, columns: COLUMNS }));
  console.log(`\nWrote ${rows.length} candidates to ${OUTPUT}`);
  console.log(`Quote-verified: ${rows.filter(r => r.quote_findable === true).length}/${rows.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Pick the 10 sample dates from the manifest**

Use the query in the task goal to pick one clean and one OCR'd meeting per era per body. Edit `SAMPLE` in the script with the 10 concrete dates.

- [ ] **Step 5: Run the pilot**

```bash
node scripts/minutes/pilot_pass1.mjs
```

Expected wall time: 10-20 minutes at sync, sequential rate. Total candidates should land in the 40-80 range. Quote-verified ratio should be 95%+ (page-footer cleaning from Task 1 should close the gap from the prototype's 4/6).

- [ ] **Step 6: Commit**

```bash
git add scripts/minutes/pilot_pass1.mjs data/pilot_candidates_pass1.csv package.json package-lock.json
git commit -m "Pilot Pass 1: extract candidates from 10 stratified meetings"
```

---

### Task 4: Pass 2 prompt (verify + score)

**Goal:** Write and dry-run the prompt that verifies a candidate's quote against the cleaned source text and scores its importance.

**Files:**
- Create: `scripts/minutes/prompts/pass2_score.md`

- [ ] **Step 1: Write the Pass 2 prompt**

Create `scripts/minutes/prompts/pass2_score.md`:

```markdown
You score and verify one Pass 1 candidate catalog entry for the Marblehead Historical Minutes Catalog. You emit JSON only.

## Input

You receive:
1. One candidate JSON object (from Pass 1).
2. A `context` string: roughly 80 lines of cleaned source text centered on the candidate's `evidence_quote`. The full meeting text may be much longer; only the context is provided.

## What you do

### Verify the quote

Check whether `evidence_quote` appears as a substring of `context` after whitespace normalization. If yes: `quote_verified=true`. If no: `quote_verified=false`; Pass 3 will drop the candidate.

If the quote is *nearly* there but the LLM in Pass 1 paraphrased or compressed slightly, set `quote_verified=false` and put a cleaned-up verbatim replacement in `verified_quote`. Otherwise leave `verified_quote=null`.

### Score importance

Rate 1 to 5 on:

- **1 - routine obligation.** Statutorily required (debt service, workers comp), or recurring line item with no new policy content. Near-certain noise.
- **2 - routine with policy-adjacent text.** Recurring appropriation at a materially different level than prior year, but no discussion of policy.
- **3 - policy-adjacent action.** Named proposal, motion, or working-group appointment on a systemic topic. The kind of item a resident asking "what have we tried" wants to see.
- **4 - meaningful attempt.** Substantive discussion AND a vote or proposal. Clearly a moment where the body tried to address a systemic issue.
- **5 - landmark moment.** High-impact decision (override approved or rejected; reserves policy change; working group created with funding; significant rate hike or cut). A resident answering "is the board trying" should get this in their top 10 results.

### Re-categorize (optional)

If the Pass 1 `topic` looks wrong, override it. Set `topic_revised` (null if no change). Same for `attempt_type_revised` and `deliberation_revised`.

### Promote?

Derived field: `promote = quote_verified AND importance >= 3`. Set it.

## Schema (single JSON object, not array)

```json
{
  "entry_id": string (echoed from input),
  "quote_verified": true | false,
  "verified_quote": null | string,
  "importance": 1 | 2 | 3 | 4 | 5,
  "topic_revised": null | taxonomy key,
  "attempt_type_revised": null | one of the attempt types,
  "deliberation_revised": null | one of the deliberation values,
  "pass2_notes": short string (one line explaining the score),
  "promote": true | false
}
```

## Output contract

Emit ONLY the JSON object. No preface, no postface.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/minutes/prompts/pass2_score.md
git commit -m "Add Pass 2 scoring rubric prompt"
```

---

### Task 5: Pilot Pass 2 (score pilot candidates)

**Goal:** Run Pass 2 against the ~40-80 candidates from `data/pilot_candidates_pass1.csv`. Produce `data/pilot_candidates_pass2.csv` with verified quotes, importance scores, and any topic overrides.

**Files:**
- Create: `scripts/minutes/pilot_pass2.mjs`
- Create: `data/pilot_candidates_pass2.csv`

- [ ] **Step 1: Implement the pilot Pass 2 driver**

Create `scripts/minutes/pilot_pass2.mjs`:

```js
#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass2_score.md');
const INPUT = resolve('data/pilot_candidates_pass1.csv');
const OUTPUT = resolve('data/pilot_candidates_pass2.csv');

const CONTEXT_LINES_BEFORE = 40;
const CONTEXT_LINES_AFTER = 40;

function extractContext(cand) {
  const txtPath = resolve(`data/minutes/${cand.body}/${cand.meeting_date}.cleaned.txt`);
  const full = readFileSync(txtPath, 'utf8');
  const probe = (cand.evidence_quote || '').slice(0, 60);
  const idx = probe ? full.indexOf(probe) : -1;
  if (idx === -1) return full.slice(0, 8000);
  const lines = full.split('\n');
  let charCount = 0, lineIdx = 0;
  while (charCount < idx && lineIdx < lines.length) { charCount += lines[lineIdx].length + 1; lineIdx++; }
  const start = Math.max(0, lineIdx - CONTEXT_LINES_BEFORE);
  const end = Math.min(lines.length, lineIdx + CONTEXT_LINES_AFTER);
  return lines.slice(start, end).join('\n');
}

const COLUMNS = [
  'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
  'attempt_type', 'deliberation', 'importance', 'what_was_tried', 'outcome',
  'evidence_quote', 'minutes_section', 'confidence',
  'quote_verified', 'promote', 'pass2_notes'
];

async function main() {
  const client = new Anthropic();
  const prompt = readFileSync(PROMPT_PATH, 'utf8');
  const candidates = parse(readFileSync(INPUT, 'utf8'), { columns: true });
  console.log(`Scoring ${candidates.length} pilot candidates`);
  const rows = [];
  let i = 0;
  for (const cand of candidates) {
    i++;
    const ctx = extractContext(cand);
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: JSON.stringify({ candidate: cand, context: ctx }) }],
    });
    const out = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) { console.warn(`  [${i}] no JSON for ${cand.entry_id}`); continue; }
    const p2 = JSON.parse(m[0]);
    const merged = {
      ...cand,
      topic: p2.topic_revised || cand.topic,
      attempt_type: p2.attempt_type_revised || cand.attempt_type,
      deliberation: p2.deliberation_revised || cand.deliberation,
      evidence_quote: p2.verified_quote || cand.evidence_quote,
      importance: p2.importance,
      quote_verified: p2.quote_verified,
      promote: p2.promote,
      pass2_notes: p2.pass2_notes,
    };
    rows.push(merged);
    if (i % 10 === 0 || i === candidates.length) console.log(`  ${i}/${candidates.length}`);
  }
  const out = rows.map(r => { const o = {}; for (const c of COLUMNS) o[c] = r[c] ?? ''; return o; });
  writeFileSync(OUTPUT, stringify(out, { header: true, columns: COLUMNS }));
  const promoted = rows.filter(r => r.promote === true).length;
  console.log(`\nScored ${rows.length}; ${promoted} promoted (importance>=3 + quote_verified)`);
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) dist[r.importance] = (dist[r.importance] || 0) + 1;
  console.log(`Importance distribution: ${JSON.stringify(dist)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the pilot Pass 2**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
node scripts/minutes/pilot_pass2.mjs
```

Expected wall time: 5-15 minutes at sync rate. Expected promote rate: 20-50 percent of candidates.

- [ ] **Step 3: Commit**

```bash
git add scripts/minutes/pilot_pass2.mjs data/pilot_candidates_pass2.csv
git commit -m "Pilot Pass 2: score and verify pilot candidates"
```

---

### Task 6: Pilot review and scale-up decision

**Goal:** Sanity-check the pilot output end-to-end. Decide whether to proceed to the full-corpus run, iterate the prompts, or rethink the approach. This is a human-in-the-loop gate, not a code task.

**Files:**
- Create: `docs/superpowers/notes/2026-04-16-phase2-pilot-review.md`

- [ ] **Step 1: Produce the pilot review summary**

For each of the 10 pilot meetings, manually check:
- Did Pass 1 find the systemic-attempt entries a human would find (OPEB, Group Insurance, reserve policy, override discussion, etc.)?
- Are Pass 1 categories mostly right?
- Does Pass 2 quote verification rate >= 95% (roughly)?
- Does Pass 2 importance scoring feel right? For a hand-picked top-importance entry, is it rated 4 or 5?
- For a hand-picked routine entry (e.g., recurring DPW budget line vote), is it rated 1 or 2 and NOT promoted?

Write a 1-2 page review at `docs/superpowers/notes/2026-04-16-phase2-pilot-review.md` with:
- Promote rate (total and per-body, per-era)
- Top 5 strongest promoted entries (verbatim quotes)
- Top 5 weakest promoted entries (and whether they should have been rejected)
- 5 non-promoted entries that should have been promoted (false negatives)
- Overall recommendation: GO, ITERATE, or REJECT

- [ ] **Step 2: Decide the route**

| Pilot outcome | Action |
|---|---|
| GO: quality looks good, promote rate feels right | Proceed to Task 7 with chosen route (subagent or API) |
| ITERATE: prompts need tightening on specific failure modes | Edit `pass1_extract.md` and/or `pass2_score.md`, re-run Tasks 3 and 5 on same pilot |
| REJECT: fundamental approach does not work | Stop; reconsider Phase 2 architecture |

- [ ] **Step 3: If GO, pick scale route**

Two routes:
- **Subagent-driven** (from an interactive Claude Code session): zero marginal cost on your subscription; longer wall time (4-6 hours); Task 7 implementation uses subagent dispatches.
- **Batch API** (requires ANTHROPIC_API_KEY already in .env): about $15-30 depending on model mix; shorter wall time (2-4 hours including waiting for batch SLA).

Record the choice in the review note.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/2026-04-16-phase2-pilot-review.md
git commit -m "Pilot review: record Pass 1/2 quality and scale-up decision"
```

---

### Task 7: Scale-up Pass 1 + Pass 2 to full corpus

**Goal:** Produce `data/catalog_raw.csv` (all Pass 1 candidates) and `data/catalog.csv` (Pass 2 promoted rows) across the full corpus, using the route chosen in Task 6.

The implementation diverges by route. Pick ONE of the two sub-tasks.

**Files (route-independent):**
- Create: `data/catalog_raw.csv`
- Create: `data/catalog.csv`
- Create: `data/catalog_pass2_log.md`

#### Route A: Batch API (requires ANTHROPIC_API_KEY)

**Files:**
- Create: `scripts/minutes/extract_candidates.mjs` (Pass 1 batch driver)
- Create: `scripts/minutes/score_candidates.mjs` (Pass 2 batch driver)

- [ ] **A1: Implement the Pass 1 batch driver**

Generalize the pilot Pass 1 driver from Task 3 to use the Batch API across all `status=downloaded` rows in `data/minutes_manifest.csv`. Submit, poll, collect; write to `data/catalog_raw.csv`. Pattern: three subcommands `--submit`, `--poll`, `--collect` with batch ID stored in `data/.pass1_batch_state.json` (gitignored).

- [ ] **A2: Implement the Pass 2 batch driver**

Same pattern as the Pass 1 driver but reads `data/catalog_raw.csv`, applies the Pass 2 prompt, writes to `data/catalog.csv` (promoted rows) + `data/catalog_pass2_log.md` (full audit log).

- [ ] **A3: Run Pass 1**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
node scripts/minutes/extract_candidates.mjs --submit
# wait, poll every 15 min
node scripts/minutes/extract_candidates.mjs --poll
```

Typical completion: 30-90 minutes.

- [ ] **A4: Run Pass 2**

```bash
node scripts/minutes/score_candidates.mjs --submit
node scripts/minutes/score_candidates.mjs --poll
```

- [ ] **A5: Add batch state files to gitignore**

```bash
grep -q '.pass*_batch_state.json' .gitignore || echo 'data/.pass*_batch_state.json' >> .gitignore
```

- [ ] **A6: Sanity-check and commit**

```bash
wc -l data/catalog_raw.csv data/catalog.csv
awk -F, 'NR>1 {print $4}' data/catalog.csv | sort | uniq -c | sort -rn
git add scripts/minutes/extract_candidates.mjs scripts/minutes/score_candidates.mjs data/catalog_raw.csv data/catalog.csv data/catalog_pass2_log.md .gitignore
git commit -m "Scale Pass 1 + Pass 2 to full corpus via Batch API"
```

#### Route B: Subagent-driven (from Claude Code session)

- [ ] **B1: Dispatch Pass 1 per meeting**

From an interactive Claude Code session, dispatch one subagent per meeting in rolling batches of about 8 in parallel. Each subagent reads the meeting text, applies the Pass 1 prompt verbatim, and appends its output JSON to `data/catalog_raw.csv`. Expected wall time: 1.5-2 hours.

- [ ] **B2: Dispatch Pass 2 per candidate**

Same pattern against candidates from `data/catalog_raw.csv`. Batches of about 10 in parallel. Apply Pass 2 prompt, write verified/scored rows. Promoted rows land in `data/catalog.csv`, all rows logged to `data/catalog_pass2_log.md`. Expected wall time: 2-3 hours.

- [ ] **B3: Sanity-check and commit**

Same checks as Route A6.

---

---

### Task 8: Pass 3 synthesis (two narratives)

**Goal:** Write two synthesis prompts (one per motivating question) and one driver script that calls each once. Output: two markdown documents with inline citations.

**Files:**
- Create: `scripts/minutes/prompts/pass3_synthesize_trying.md`
- Create: `scripts/minutes/prompts/pass3_synthesize_tried.md`
- Create: `scripts/minutes/synthesize_catalog.mjs`
- Create: `is-the-board-trying.md`
- Create: `what-have-we-tried.md`

- [ ] **Step 1: Write the two synthesis prompts**

Both prompts share a common structure. The differences are the framing of the narrative.

Create `scripts/minutes/prompts/pass3_synthesize_trying.md`:

```markdown
You write a neutral, primary-source-cited narrative for the Marblehead civic data site answering: "Is the Select Board and School Committee substantively engaging with systemic fiscal issues?"

## Input

You receive a JSON array of catalog entries (Pass 2 promoted rows), covering Select Board and School Committee meetings FY19 to present.

## Output

Markdown text only. NO preface, NO postface. Target length: 1500 to 2500 words.

## Structure (required)

1. **Lead paragraph.** 3 to 5 sentences. State what the catalog shows at a high level. No advocacy; describe the shape of the engagement.
2. **By topic.** One short section per topic where the catalog has at least 3 entries. Each section: how many attempts, importance distribution, 2 to 3 cited examples with quote. Cite as `[{body} {date}](#entry-{entry_id})`.
3. **By era.** Brief comparison: FY19-FY20, FY21-FY23, FY24-present. How does attempt volume and importance mix shift over time?
4. **By body.** Brief: do Select Board and School Committee show similar engagement patterns, or diverge?
5. **What the data does NOT show.** Coverage gaps (FinCom minutes pending records request), topic areas with 0 to 2 entries that may reflect either non-engagement or missing data.
6. **Closing.** 2 to 3 sentences. Where a reader should go next (link to companion page "What have we tried?").

## Style rules

- Neutral and factual. No "the board failed to act," no "the board is clearly trying." State frequencies and quote specifics.
- Every claim cites a catalog entry by `entry_id`.
- No em-dashes. Use commas, semicolons, colons, or restructure.
- No meta-narration ("this page shows...").
- Numbers in sentences: spell out one through nine; numerals for 10+.

Emit the markdown. Nothing else.
```

Create `scripts/minutes/prompts/pass3_synthesize_tried.md`:

```markdown
You write a neutral, primary-source-cited narrative for the Marblehead civic data site answering: "What has Marblehead tried to address systemic fiscal issues, and what came of it?"

## Input

JSON array of catalog entries (Pass 2 promoted rows).

## Output

Markdown text only. NO preface, NO postface. Target length: 2500 to 4000 words.

## Structure (required)

1. **Lead paragraph.** 3 to 5 sentences. Summarize the catalog as a set of attempts, grouped by topic. Neutral description of scope.
2. **Topic sections.** One per topic with at least 3 catalog entries. Each section:
   - Title (human-readable).
   - 2 to 4 sentences of context for the topic.
   - A table OR list of attempts, oldest to newest, citing each: `[{body} {date}](#entry-{entry_id})`, `attempt_type`, `what_was_tried`, `outcome`, importance 1-5 as a star rating.
   - 1 to 2 sentences summarizing the pattern of attempts (scope, frequency, outcomes).
3. **Low-coverage topics.** Single section listing topics with 0 to 2 entries. Note that absence in the catalog may reflect either absence of attempts or the FinCom minutes gap.
4. **Closing.** 2 to 3 sentences. Link back to companion page "Is the board trying?".

## Style rules

- Neutral and factual.
- Every attempt cites its entry_id.
- No em-dashes.
- No meta-narration.
- Quote at least one evidence_quote verbatim per topic section, in blockquote form.

Emit the markdown. Nothing else.
```

- [ ] **Step 2: Implement the driver**

```js
#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL = 'claude-opus-4-7';

async function synthesize(promptPath, outPath) {
  const client = new Anthropic();
  const prompt = readFileSync(promptPath, 'utf8');
  const catalog = parse(readFileSync('data/catalog.csv', 'utf8'), { columns: true });
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(catalog) }],
  });
  const md = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
  writeFileSync(outPath, md);
  console.log(`Wrote ${md.length} chars to ${outPath}`);
}

await synthesize('scripts/minutes/prompts/pass3_synthesize_trying.md', 'is-the-board-trying.md');
await synthesize('scripts/minutes/prompts/pass3_synthesize_tried.md', 'what-have-we-tried.md');
```

- [ ] **Step 3: Run**

```bash
node scripts/minutes/synthesize_catalog.mjs
```

Expected: two markdown files, each 2000 to 4000 words.

- [ ] **Step 4: Spot-check 10% of citations**

Extract all citations from both files:

```bash
grep -oE '\[([a-z_]+ \d{4}-\d{2}-\d{2})\]\(#entry-[^)]+\)' is-the-board-trying.md what-have-we-tried.md > /tmp/citations.txt
wc -l /tmp/citations.txt
# Pick 10% at random
shuf -n $((($(wc -l < /tmp/citations.txt) + 9) / 10)) /tmp/citations.txt > /tmp/spot.txt
cat /tmp/spot.txt
```

For each sampled citation: look up the `entry_id` in `data/catalog.csv`, read the `evidence_quote`, open the corresponding `.cleaned.txt`, confirm the quote is present. If more than 1 in 10 fails, Pass 3 has a hallucination problem. Report DONE_WITH_CONCERNS.

- [ ] **Step 5: Commit**

```bash
git add scripts/minutes/prompts/pass3_*.md scripts/minutes/synthesize_catalog.mjs is-the-board-trying.md what-have-we-tried.md
git commit -m "Pass 3: synthesize twin narratives from scored catalog"
```

---

### Task 9: Convert markdowns to site HTML pages

**Goal:** Land the two narratives as Jekyll pages, with citation machinery hooked up to the existing `assets/citations.js` pattern.

**Files:**
- Create: `is-the-board-trying.html`
- Create: `what-have-we-tried.html`
- Modify: `_includes/nav.html` (add links)

- [ ] **Step 1: Examine an existing content page to match the layout**

```bash
head -30 how-we-got-here.html
```

Note the Jekyll frontmatter, `body_class`, `<h1>` style, `<p class="page-lead">` style, and how citation markers are written.

- [ ] **Step 2: Convert `is-the-board-trying.md` to `is-the-board-trying.html`**

Wrap the markdown content in Jekyll frontmatter:

```yaml
---
title: "Is the board trying?"
og_title: "Is Marblehead's Select Board and School Committee substantively engaging with systemic fiscal issues?"
og_description: "A primary-source catalog of board attempts to address systemic fiscal issues, FY19 to present. Neutral evidence, not advocacy."
body_class: doc-page
---
```

Keep the markdown content below the frontmatter as-is; Jekyll renders markdown-in-HTML files when the frontmatter is present. Fix any citation marker syntax to match the existing site's `<sup class="cite">` convention (see `how-we-got-here.html`).

- [ ] **Step 3: Same conversion for the other page**

```yaml
---
title: "What have we tried?"
og_title: "What has Marblehead tried to address systemic fiscal issues, and what came of it?"
og_description: "A catalog of specific attempts by the Select Board and School Committee, FY19 to present, each cited to primary source minutes."
body_class: doc-page
---
```

- [ ] **Step 4: Add entry anchors so citations resolve**

At the top of each HTML page, add a small post-render step: after each paragraph, inject an `<a id="entry-{entry_id}">` anchor near the cited quote. Since citation targets are catalog rows, not page sections, the simplest approach is to link citations to a viewer page at `/minutes-catalog.html?entry={entry_id}` instead, OR inline the quote anchor right before each citation.

Simplest that works: keep citations as links to the underlying minutes PDF via the manifest's `source_url`. Rewrite citations from `[body date](#entry-id)` to `[body date](PDF_URL)` during HTML conversion. This makes every citation click-through go to the primary source, which is the strongest form of traceability.

Implement this rewriting as part of Step 2/3 conversion rather than trying to maintain in-page anchors.

- [ ] **Step 5: Add nav links**

Edit `_includes/nav.html` to add the two new pages under an appropriate existing grouping (inspect current structure first).

- [ ] **Step 6: Commit**

```bash
git add is-the-board-trying.html what-have-we-tried.html _includes/nav.html
git commit -m "Add twin minutes-catalog narrative pages with primary-source citations"
```

---

### Task 10: Coverage audit + DATA_CATALOG entries

**Goal:** Document the new data files so a future session understands what was produced and how.

**Files:**
- Modify: `data/DATA_CATALOG.md`
- Modify: `data/SOURCE_LOOKUP.md`

- [ ] **Step 1: Add catalog rows to DATA_CATALOG.md**

Entries for each of:
- `data/catalog_raw.csv` (Pass 1 output)
- `data/catalog.csv` (Pass 2 output, the canonical catalog)
- `data/catalog_pass2_log.md` (audit log)

For each: file name, row count, what the columns mean, what produced it (pointing at `scripts/minutes/`).

- [ ] **Step 2: Add source-lookup entries for the two new pages**

In `data/SOURCE_LOOKUP.md`, add sections `#is-the-board-trying` and `#what-have-we-tried` linking each page's claims to the catalog rows it cites.

- [ ] **Step 3: Commit**

```bash
git add data/DATA_CATALOG.md data/SOURCE_LOOKUP.md
git commit -m "Document catalog CSVs and new pages in DATA_CATALOG and SOURCE_LOOKUP"
```

---

### Task 11: Open PR with preview URL

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/minutes-catalog-phase-2
```

- [ ] **Step 2: Open PR**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
GH_TOKEN="$GITHUB_TOKEN" gh pr create --title "Phase 2: historical minutes catalog (extraction, scoring, twin narratives)" --body "$(cat <<'EOF'
## Summary

Implements Phase 2 of the historical minutes catalog:

- Text cleaning pipeline removes page-footer noise that breaks quote verification
- Pass 1: bulk extract candidates from all 437 meetings via Batch API
- Pass 2: AI verify quotes + score importance 1-5; filter to promoted catalog
- Pass 3: AI synthesize two narrative pages with primary-source citations

**Output:** two new site pages under twin motivating questions:
- `/is-the-board-trying.html`
- `/what-have-we-tried.html`

Both cite back to the underlying catalog (`data/catalog.csv`) and through to the primary source minutes PDFs (via `source_url` in `data/minutes_manifest.csv`).

## Data

- `data/catalog_raw.csv`: every Pass 1 candidate (audit trail).
- `data/catalog.csv`: promoted rows (verified + importance >= 3).
- `data/catalog_pass2_log.md`: Pass 2 drop log with reasons.

## Test plan

- [ ] `npm run test:minutes` passes
- [ ] `node scripts/minutes/verify_corpus.mjs` still passes (Phase 1 invariants preserved)
- [ ] Both narrative pages render on preview
- [ ] Sample 10% of citations on each page resolve to a catalog row whose quote is findable in the cited minutes file

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Post preview URL**

Per repo CLAUDE.md, fetch the Cloudflare preview URL from the PR's sticky comment and report it back so the user can eyeball the two pages live.

---

## Phase 2 exit criteria

- `data/catalog.csv` contains at least 150 rows (sanity floor; actual is likely 200-500).
- Both synthesis markdown files exist and are >= 1500 words.
- Both HTML pages render on the Cloudflare preview.
- 10% citation sample passes quote-fidelity check.
- PR is open with preview URL posted.

## What comes after Phase 2

- If Kyle Wiley's records request produces FinCom minutes: drop PDFs into `data/minutes/fincom/`, re-run `download_minutes.mjs` (no-op) then `clean_text.mjs`, then **incremental** Pass 1 + Pass 2 just for the new rows, then re-run Pass 3 to regenerate both narratives. The pipeline is idempotent by design.
- If the narratives read well but the catalog is noisy: tighten the Pass 2 importance threshold (e.g., promote `>=4` instead of `>=3`), re-synthesize.
- If the narratives miss meaningful attempts: that's a Pass 1 prompt issue; iterate on `pass1_extract.md` and re-run the whole pipeline.
