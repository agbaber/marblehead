# Batch-API CI Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the meeting-transcript enrichment bill roughly in half by routing the daily `ingest-meetings` workflow's LLM enrichment through the Anthropic **Message Batches API** (50% cheaper) instead of the full-price real-time `enrich_one.mjs` loop.

**Architecture:** Add a single self-contained `run` subcommand to the existing `scripts/transcripts/enrich_batch.mjs` that submits one batch of all unenriched transcripts, polls until it ends (bounded by a max-wait that fits inside the job's 45-minute timeout), and collects the results — all in one process. The CI workflow replaces its `for f in _transcripts/*.md; do enrich_one … done` loop with one call to that subcommand. Because CI runners are ephemeral and the batch state file is gitignored, the design deliberately does **not** rely on cross-run state: if a batch does not finish inside the job, the job fails, the transcripts stay unenriched, and the next scheduled run submits a fresh batch (worst case: one orphaned, half-priced batch whose results are never collected — no data corruption).

**Tech Stack:** Node 20 (ESM), `@anthropic-ai/sdk` Message Batches API, `node --test` for unit tests, GitHub Actions (`.github/workflows/ingest-meetings.yml`).

**Why this is the fix (context):** Over the last 90 days, ~95% of enrichment volume came from three one-off backfills (220 + 134 + 73 transcripts), not the 1–4/day steady-state trickle. The 220 and 134 backfills were enriched by the CI loop at **full real-time price**, cap=25/day, grinding for a week each. Switching the CI enrich step to the batch path makes any backlog — daily or backfill — enrich at 50% off automatically, and removes the cap=25 grind (a backfill enriches in one batch rather than over many days).

---

## File Structure

- **Create** `scripts/transcripts/lib/select_candidates.mjs` — pure function that decides which `_transcripts/*.md` files to enrich, given the frontmatter text and the filter options (source, skip-boards, force, max-batch). Extracted from the current in-file `listCandidates()` so it can be unit-tested without the filesystem or API.
- **Create** `scripts/transcripts/lib/select_candidates.test.mjs` — unit tests for the selection logic.
- **Modify** `scripts/transcripts/enrich_batch.mjs` — import the extracted selector; add a `pollUntilEnded()` helper and a `run` subcommand (submit → poll → collect in one process, with `--max-wait-sec`, `--max-batch`, and `--dry-run`).
- **Modify** `.github/workflows/ingest-meetings.yml` — replace the `enrich_one.mjs` loop with a single `enrich_batch.mjs run` call; update the header comment.
- **Reference (do not modify):** `scripts/transcripts/lib/parse_response.mjs`, `scripts/transcripts/lib/merge_frontmatter.mjs` (already used by `collect`), `scripts/transcripts/enrich_one.mjs` (kept for manual/one-off single-file enrichment).

---

## Task 1: Extract candidate selection into a testable pure function

**Files:**
- Create: `scripts/transcripts/lib/select_candidates.mjs`
- Test: `scripts/transcripts/lib/select_candidates.test.mjs`

The current `listCandidates()` in `enrich_batch.mjs` both reads the directory and applies the include/exclude rules. Split the decision logic (pure) from the IO so it can be tested. The rules, verbatim from the current implementation, are: skip files whose frontmatter contains `ingest:` (hand-crafted POCs); if `skipBoards` is set, skip files whose `board:` is in that set; if `source` is set, skip files whose `source:` != that value; unless `force`, skip files that already contain `summary_card:`.

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/transcripts/lib/select_candidates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidates } from './select_candidates.mjs';

const fm = (o) => [
  '---',
  o.board ? `board: ${o.board}` : '',
  o.source ? `source: ${o.source}` : '',
  o.ingest ? 'ingest: true' : '',
  o.enriched ? 'summary_card:\n  headline: x' : '',
  '---',
  'body',
].filter(Boolean).join('\n');

test('skips already-enriched files by default', () => {
  const items = [
    { slug: 'a', text: fm({ source: 'whisper-local' }) },
    { slug: 'b', text: fm({ source: 'whisper-local', enriched: true }) },
  ];
  const out = selectCandidates(items, {});
  assert.deepEqual(out.map((i) => i.slug), ['a']);
});

test('force re-includes enriched files', () => {
  const items = [{ slug: 'b', text: fm({ enriched: true }) }];
  assert.equal(selectCandidates(items, { force: true }).length, 1);
});

test('always skips hand-crafted ingest: POCs even with force', () => {
  const items = [{ slug: 'p', text: fm({ ingest: true }) }];
  assert.equal(selectCandidates(items, { force: true }).length, 0);
});

test('source filter keeps only the matching source', () => {
  const items = [
    { slug: 'a', text: fm({ source: 'whisper-local' }) },
    { slug: 'b', text: fm({ source: 'youtube-auto' }) },
  ];
  const out = selectCandidates(items, { source: 'whisper-local' });
  assert.deepEqual(out.map((i) => i.slug), ['a']);
});

test('skipBoards drops matching boards', () => {
  const items = [
    { slug: 'a', text: fm({ board: 'board-of-health' }) },
    { slug: 'b', text: fm({ board: 'select-board' }) },
  ];
  const out = selectCandidates(items, { skipBoards: new Set(['board-of-health']) });
  assert.deepEqual(out.map((i) => i.slug), ['b']);
});

test('maxBatch caps the returned count', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ slug: `s${i}`, text: fm({}) }));
  assert.equal(selectCandidates(items, { maxBatch: 3 }).length, 3);
});

test('maxBatch of 0 or undefined means no cap', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ slug: `s${i}`, text: fm({}) }));
  assert.equal(selectCandidates(items, {}).length, 5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/transcripts/lib/select_candidates.test.mjs`
Expected: FAIL — `Cannot find module './select_candidates.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
// scripts/transcripts/lib/select_candidates.mjs
//
// Pure selection of which transcripts to enrich. Input is an array of
// { slug, text } where text is the full markdown (frontmatter + body).
// Returns the subset to enrich, in input order, capped at maxBatch.
//
// Rules (kept identical to the original enrich_batch.mjs listCandidates):
//   - Always skip hand-crafted POCs (frontmatter has a top-level `ingest:`).
//   - If skipBoards is set, skip files whose `board:` is in it.
//   - If source is set, skip files whose `source:` != it.
//   - Unless force, skip files that already have `summary_card:`.
//   - Cap the result at maxBatch (falsy/0 = no cap).
export function selectCandidates(items, { force = false, skipBoards = null, source = null, maxBatch = 0 } = {}) {
  const out = [];
  for (const item of items) {
    const text = item.text;
    if (/^ingest:/m.test(text)) continue;
    if (skipBoards) {
      const m = text.match(/^board: (\S+)$/m);
      if (m && skipBoards.has(m[1])) continue;
    }
    if (source) {
      const m = text.match(/^source: (\S+)$/m);
      if (!m || m[1] !== source) continue;
    }
    if (!force && /^summary_card:/m.test(text)) continue;
    out.push(item);
    if (maxBatch && out.length >= maxBatch) break;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/transcripts/lib/select_candidates.test.mjs`
Expected: PASS — 7 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/select_candidates.mjs scripts/transcripts/lib/select_candidates.test.mjs
git commit -m "Extract testable transcript enrichment candidate selection"
```

---

## Task 2: Rewire enrich_batch.mjs to use the extracted selector

**Files:**
- Modify: `scripts/transcripts/enrich_batch.mjs`

Replace the in-file rule logic in `listCandidates()` with a call to `selectCandidates`, keeping `listCandidates` as the thin IO wrapper (read the directory → build `{slug, path, text}` → call `selectCandidates`). This is a no-behavior-change refactor that the existing `submit` path keeps using.

- [ ] **Step 1: Add the import at the top of `enrich_batch.mjs`**

Immediately after the existing `import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';` line, add:

```javascript
import { selectCandidates } from './lib/select_candidates.mjs';
```

- [ ] **Step 2: Replace the body of `listCandidates()`**

Replace the entire existing `function listCandidates() { … }` (the directory read + inline `.filter(...)` rules) with:

```javascript
function listCandidates({ maxBatch = 0 } = {}) {
  const items = readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== '.gitkeep')
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const path = resolve(TRANSCRIPTS_DIR, f);
      return { slug, path, text: readFileSync(path, 'utf8') };
    });
  return selectCandidates(items, { force, skipBoards, source: onlySource, maxBatch });
}
```

(`force`, `skipBoards`, and `onlySource` are the module-level vars already parsed from argv near the top of the file.)

- [ ] **Step 3: Run the transcript test suite to verify nothing broke**

Run: `npm run test:transcripts`
Expected: PASS — the prior 70 tests plus the 7 new ones (77 total), 0 fail.

- [ ] **Step 4: Manually verify the existing submit path still selects correctly with --dry-run**

There is no `--dry-run` on `submit` yet; instead confirm the selector wiring by a one-off node check (no API call):

Run:
```bash
node -e "import('./scripts/transcripts/enrich_batch.mjs').catch(()=>{})" 2>&1 | head -1 || true
node --input-type=module -e "
import { selectCandidates } from './scripts/transcripts/lib/select_candidates.mjs';
import { readdirSync, readFileSync } from 'node:fs';
const items = readdirSync('_transcripts').filter(f=>f.endsWith('.md')).map(f=>({slug:f,text:readFileSync('_transcripts/'+f,'utf8')}));
console.log('unenriched candidates:', selectCandidates(items, {}).length);
"
```
Expected: prints a count (0 if everything is enriched). No crash.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/enrich_batch.mjs
git commit -m "Route enrich_batch candidate selection through the shared selector"
```

---

## Task 3: Add the `run` subcommand (submit + poll + collect in one process)

**Files:**
- Modify: `scripts/transcripts/enrich_batch.mjs`

Add a `pollUntilEnded()` helper and a `run` subcommand that performs the whole cycle in one invocation, bounded by `--max-wait-sec`. Add `--dry-run` so CI-free verification lists the candidate count and exits without calling the API. Extend the usage string and subcommand validation to include `run`.

- [ ] **Step 1: Extend the subcommand allow-list and usage string**

Find the existing guard:

```javascript
if (!['submit', 'poll', 'collect'].includes(subcommand)) {
  console.error('Usage: enrich_batch.mjs submit|poll|collect [--force] [--skip-boards a,b] [--source vimeo-auto|youtube-auto|whisper-local]');
  process.exit(2);
}
```

Replace it with:

```javascript
if (!['submit', 'poll', 'collect', 'run'].includes(subcommand)) {
  console.error('Usage: enrich_batch.mjs submit|poll|collect|run [--force] [--skip-boards a,b] [--source S] [--max-batch N] [--max-wait-sec N] [--dry-run]');
  process.exit(2);
}

const maxBatch = (() => {
  const i = process.argv.indexOf('--max-batch');
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 0;
})();
const maxWaitSec = (() => {
  const i = process.argv.indexOf('--max-wait-sec');
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 2400;
})();
const dryRun = process.argv.includes('--dry-run');
```

- [ ] **Step 2: Add the `pollUntilEnded` helper**

Add this function above the `if (subcommand === …)` dispatch block near the bottom of the file:

```javascript
async function pollUntilEnded(client, batchId, maxWaitSecs) {
  const deadline = Date.now() + maxWaitSecs * 1000;
  const intervalMs = 30_000;
  // Fixed steps so the loop is deterministic under test tooling; no Date.now
  // gymnastics beyond the deadline check.
  while (Date.now() < deadline) {
    const batch = await client.messages.batches.retrieve(batchId);
    console.error(`  batch ${batchId}: ${batch.processing_status} ${JSON.stringify(batch.request_counts)}`);
    if (batch.processing_status === 'ended') return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
```

- [ ] **Step 3: Add the `run` function**

Add this function next to the existing `submit` / `poll` / `collect` functions. It reuses `listCandidates`, the same request shape as `submit`, and the same result-merge loop as `collect`.

```javascript
async function run() {
  const candidates = listCandidates({ maxBatch });
  const total = listCandidates({}).length; // count before the cap, for logging
  if (candidates.length === 0) {
    console.error('No unenriched transcripts. Nothing to do.');
    return;
  }
  console.error(`Enriching ${candidates.length} transcript(s) via batch` +
    (maxBatch && total > maxBatch ? ` (${total - maxBatch} deferred past --max-batch=${maxBatch}, will run next time)` : ''));
  if (dryRun) {
    for (const c of candidates) console.error(`  would enrich: ${c.slug}`);
    return;
  }

  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const requests = candidates.map(({ slug, text }) => ({
    custom_id: slug,
    params: {
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: extractBody(text) }],
    },
  }));

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(STATE_FILE, JSON.stringify({ batch_id: batch.id, submitted_at: null, count: requests.length }, null, 2) + '\n');
  console.error(`Batch submitted: ${batch.id} (${requests.length} requests). Polling up to ${maxWaitSec}s...`);

  const ended = await pollUntilEnded(client, batch.id, maxWaitSec);
  if (!ended) {
    console.error(`Batch did not finish within ${maxWaitSec}s. Leaving it; a later run will resubmit fresh.`);
    process.exit(1);
  }

  let written = 0, failed = 0;
  for await (const result of await client.messages.batches.results(batch.id)) {
    const slug = result.custom_id;
    const path = resolve(TRANSCRIPTS_DIR, `${slug}.md`);
    if (!existsSync(path)) { console.error(`${slug}: source gone, skipping`); failed += 1; continue; }
    if (result.result.type !== 'succeeded') {
      console.error(`${slug}: batch result type=${result.result.type}`);
      appendFileSync(FAIL_LOG, `${slug}\t${result.result.type}\t${JSON.stringify(result.result.error || {})}\n`);
      failed += 1; continue;
    }
    const msg = result.result.message;
    const textOut = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseResponse(textOut);
    if (!parsed.valid) {
      console.error(`${slug}: validation failed: ${parsed.errors.join('; ')}`);
      appendFileSync(FAIL_LOG, `${slug}\tvalidation\t${parsed.errors.join('; ')}\n`);
      failed += 1; continue;
    }
    writeFileSync(path, mergeFrontmatter(readFileSync(path, 'utf8'), parsed.summary_card, parsed.topic_segments));
    written += 1;
  }
  console.error(`Done. written=${written} failed=${failed}`);
}
```

Note: this reuses `extractBody`, which currently takes the file text. Confirm `extractBody` accepts the frontmatter+body string (it does — it regex-matches `^---\n…\n---\n(body)`); pass `text` directly rather than re-reading the file.

- [ ] **Step 4: Wire `run` into the dispatch**

Find the dispatch at the bottom:

```javascript
if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
```

Replace with:

```javascript
if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
else if (subcommand === 'run') await run();
```

- [ ] **Step 5: Verify --dry-run works without an API key**

Run: `node scripts/transcripts/enrich_batch.mjs run --dry-run`
Expected: prints `No unenriched transcripts. Nothing to do.` (if the tree is fully enriched) or a list of `would enrich: <slug>` lines. **No API call, no crash, exit 0.**

- [ ] **Step 6: Run the full transcript test suite**

Run: `npm run test:transcripts`
Expected: PASS, 0 fail (unchanged from Task 2 — the new code is exercised via --dry-run, not unit tests, since it wraps the network API).

- [ ] **Step 7: Commit**

```bash
git add scripts/transcripts/enrich_batch.mjs
git commit -m "Add enrich_batch run subcommand: submit+poll+collect in one process"
```

---

## Task 4: Switch the CI workflow to the batch path

**Files:**
- Modify: `.github/workflows/ingest-meetings.yml`

Replace the full-price `enrich_one.mjs` loop with one `enrich_batch.mjs run` call. Keep the `ANTHROPIC_API_KEY` env. Choose `--max-batch 150` (comfortably covers daily volume and modest backlogs; a rare 200+ backfill splits over two runs) and `--max-wait-sec 2400` (40 min, inside the 45-min job timeout with headroom for commit + PR).

- [ ] **Step 1: Replace the enrich step's `run:` block**

Find the step named `Enrich new transcripts with LLM summary cards`. Replace its entire `run: |` body (the `set -eu … Enriched: … Failed: …` shell loop) with:

```yaml
        run: |
          set -eu
          # Enrich all unenriched transcripts via the Message Batches API
          # (50% cheaper than real-time). One batch per run; polls up to
          # 40 min, inside this job's 45-min timeout. If the batch does not
          # finish in time the job fails and the next scheduled run submits
          # a fresh batch (the orphaned batch's results are simply never
          # collected). --max-batch caps a single run so a very large
          # backfill splits across runs; for a big one-off backfill, run
          # `enrich_batch.mjs submit`/`collect` manually instead (no timeout).
          node scripts/transcripts/enrich_batch.mjs run --max-batch 150 --max-wait-sec 2400
```

- [ ] **Step 2: Update the workflow header comment**

Near the top of the file the header comment describes step 3 as "LLM-enrich each new transcript … via scripts/transcripts/enrich_one.mjs". Change that line to:

```
#   3. LLM-enrich new transcripts in one Message Batches API job via
#      scripts/transcripts/enrich_batch.mjs run (50% cheaper than real-time).
```

Also update the `Required repo secrets` note that says `ANTHROPIC_API_KEY  Used by scripts/transcripts/enrich_one.mjs.` to `… Used by scripts/transcripts/enrich_batch.mjs.`

- [ ] **Step 3: Lint the workflow YAML locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ingest-meetings.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ingest-meetings.yml
git commit -m "CI: enrich meeting transcripts via Batch API (50% cheaper)"
```

---

## Task 5: Document the backfill runbook and open the PR

**Files:**
- Modify: `.github/workflows/ingest-meetings.yml` (comment only — already covered in Task 4 Step 1) — no code change here; this task is verification + PR.

- [ ] **Step 1: Confirm the branch diff is scoped**

Run: `git diff --stat origin/main`
Expected: only `scripts/transcripts/lib/select_candidates.mjs`, `scripts/transcripts/lib/select_candidates.test.mjs`, `scripts/transcripts/enrich_batch.mjs`, `.github/workflows/ingest-meetings.yml`.

- [ ] **Step 2: Full transcript test suite green**

Run: `npm run test:transcripts`
Expected: PASS, 0 fail.

- [ ] **Step 3: Dry-run the CI command exactly as the workflow will call it**

Run: `node scripts/transcripts/enrich_batch.mjs run --max-batch 150 --max-wait-sec 2400 --dry-run`
Expected: exit 0; prints either "Nothing to do" or a bounded list ≤150.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin <branch>
gh pr create --base main \
  --title "Enrich meeting transcripts via the Batch API (50% cheaper CI)" \
  --body-file <(cat <<'EOF'
Routes the daily ingest-meetings enrichment through the Anthropic Message Batches API instead of the full-price real-time enrich_one loop. ~95% of enrichment volume is one-off backfills that previously ground through CI at full price, cap=25/day; this halves that cost and removes the grind (a backfill enriches in one batch).

Proof of Work:
- `npm run test:transcripts` green (77 tests incl. 7 new selector tests) — paste output.
- `enrich_batch.mjs run --dry-run` lists candidates without an API call — paste output.
- First live CI run: link the `gh run list --branch main` entry showing the enrich step used the batch path, plus the auto-meetings PR it opened.
EOF
)
```

- [ ] **Step 5: After merge, validate on the first real cron run**

The real end-to-end proof needs the workflow to run with `ANTHROPIC_API_KEY` (only present in CI). After merge, on the next daily run (or a manual `gh workflow run ingest-meetings.yml`), confirm from the run log that the enrich step submitted a batch and collected it, and that the auto-meetings PR carried enriched transcripts. Link that run in the PR thread.

---

## Self-Review

**Spec coverage:**
- 50%-off enrichment → Tasks 3–4 (batch path in CI). ✓
- Handles backfills, not just daily → `run` enriches the whole unenriched backlog in one batch; `--max-batch` bounds a single run; large one-offs documented as manual `submit`/`collect`. ✓
- Async vs 45-min job → `--max-wait-sec 2400` inside the 45-min timeout; fail-and-resubmit-next-run on the rare overflow (no cross-run state dependency). ✓
- Testability → candidate selection extracted to a pure function with unit tests (Task 1). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The PR body in Task 5 is a heredoc with real content. ✓

**Type/name consistency:** `selectCandidates(items, opts)` signature is identical in Task 1 (definition), Task 2 (call in `listCandidates`), and the Task 3 `run`/`--dry-run` count. `listCandidates({ maxBatch })` gains an options arg in Task 2 and is called that way in Task 3. `pollUntilEnded(client, batchId, maxWaitSecs)` defined and called consistently in Task 3. `maxWaitSec`/`maxBatch`/`dryRun` parsed in Task 3 Step 1 and used in Task 3 Step 3 and Task 4. ✓

## Not in scope (documented alternatives)
- **Haiku for routine meetings** (~3× further savings, ~6× combined): higher-risk quality change; do as a separate measured A/B on ~10 meetings before rollout, not bundled here.
- **Cross-run batch state persistence** (commit the state file or use Actions cache to always collect next run): rejected as unnecessary complexity — batches finish in minutes at this volume, and fail-and-resubmit is a safe fallback.
