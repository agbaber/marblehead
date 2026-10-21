# Checkbook Refresh Self-Heal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two checkbook refresh workflows recover on their own from a cancelled required check, and remove the two timeouts that keep cancelling those checks and the FY26 job.

**Architecture:** One dependency-free Node helper, `scripts/ci/auto_pr.mjs`, owns the bot-PR lifecycle decisions (`gate` closes leftovers, `await-merge` waits, re-runs once, fails loudly). The decision functions are pure and unit-tested; the `gh` calls are a thin layer. Both checkbook workflows call the helper; the smoke job gets a Playwright cache, loses the apt font pull, and runs the helper's tests; the FY26 job goes weekly with a timeout that fits its crawler.

**Tech Stack:** Node 20+ built-ins (`node:test`, `node:child_process`), `gh` CLI, GitHub Actions YAML.

Spec: `docs/superpowers/specs/2026-10-21-checkbook-refresh-self-heal-design.md`.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/ci/auto_pr.mjs` (new) | Pure decisions (`runIdFromDetailsUrl`, `classifyChecks`, `decide`, `gateDecision`) plus the `gate` / `awaitMerge` commands that call `gh`. |
| `scripts/ci/auto_pr.test.mjs` (new) | `node --test` coverage of the pure decisions. |
| `package.json` | `test:ci` script, mirroring `test:minutes` / `test:transcripts`. |
| `.github/workflows/checkbook-refresh.yml` | Gate via helper, export PR URL, await step, timeout 25. |
| `.github/workflows/checkbook-refresh-fy26.yml` | Same wiring, weekly cron, timeout 40. |
| `.github/workflows/smoke-tests.yml` | Playwright cache, no `--with-deps`, timeout 20, `npm run test:ci`. |

---

### Task 1: Pure decision logic, test-first

**Files:**
- Create: `scripts/ci/auto_pr.test.mjs`
- Create: `scripts/ci/auto_pr.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// scripts/ci/auto_pr.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyChecks, decide, gateDecision, runIdFromDetailsUrl } from './auto_pr.mjs';

const REQUIRED = ['smoke', 'Secret scan', 'Content guardrails'];

// One entry of a PR's statusCheckRollup as `gh pr view --json` returns it.
function run(name, { status = 'COMPLETED', conclusion = 'SUCCESS',
  completedAt = '2026-10-09T17:09:00Z', runId = 100 } = {}) {
  return {
    __typename: 'CheckRun', name, status, conclusion, completedAt,
    detailsUrl: `https://github.com/agbaber/marblehead/actions/runs/${runId}/job/${runId * 10}`,
  };
}

const empty = { pending: [], passing: [], cancelled: [], failed: [] };

test('runIdFromDetailsUrl pulls the workflow run id out of a job URL', () => {
  assert.equal(runIdFromDetailsUrl(
    'https://github.com/agbaber/marblehead/actions/runs/37964064899/job/113933858629'), 37964064899);
  assert.equal(runIdFromDetailsUrl('https://example.com/no-run-here'), null);
  assert.equal(runIdFromDetailsUrl(undefined), null);
});

test('a required check with no check run yet is pending', () => {
  const c = classifyChecks([run('smoke')], REQUIRED);
  assert.deepEqual(c.passing, ['smoke']);
  assert.deepEqual(c.pending, ['Secret scan', 'Content guardrails']);
});

test('an in-progress required check is pending', () => {
  const c = classifyChecks([run('smoke', { status: 'IN_PROGRESS', conclusion: null, completedAt: null })], REQUIRED);
  assert.ok(c.pending.includes('smoke'));
  assert.deepEqual(c.passing, []);
});

test('non-required checks are ignored even when they fail', () => {
  const rollup = [...REQUIRED.map((n) => run(n)), run('preview', { conclusion: 'FAILURE' })];
  const c = classifyChecks(rollup, REQUIRED);
  assert.deepEqual(c.failed, []);
  assert.deepEqual(c.passing, REQUIRED);
});

test('a cancelled required check is reported with its workflow run id', () => {
  const c = classifyChecks([run('smoke', { conclusion: 'CANCELLED', runId: 37964064899 })], REQUIRED);
  assert.deepEqual(c.cancelled, [{ name: 'smoke', runId: 37964064899 }]);
});

test('a failed required check is reported with its conclusion', () => {
  const c = classifyChecks([run('smoke', { conclusion: 'TIMED_OUT' })], REQUIRED);
  assert.deepEqual(c.failed, [{ name: 'smoke', conclusion: 'TIMED_OUT' }]);
});

test('results completed before the re-run are stale and count as pending', () => {
  const rollup = [run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' })];
  const c = classifyChecks(rollup, REQUIRED, '2026-10-09T17:20:00Z');
  assert.deepEqual(c.cancelled, []);
  assert.ok(c.pending.includes('smoke'));
});

test('after a re-run, the newest completed run of a name decides', () => {
  const rollup = [
    run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' }),
    run('smoke', { conclusion: 'SUCCESS', completedAt: '2026-10-09T17:24:00Z', runId: 200 }),
  ];
  const c = classifyChecks(rollup, REQUIRED, '2026-10-09T17:20:00Z');
  assert.deepEqual(c.passing, ['smoke']);
  assert.deepEqual(c.cancelled, []);
});

test('an in-flight re-run attempt beats an older cancelled result', () => {
  const rollup = [
    run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' }),
    run('smoke', { status: 'IN_PROGRESS', conclusion: null, completedAt: null }),
  ];
  const c = classifyChecks(rollup, REQUIRED);
  assert.ok(c.pending.includes('smoke'));
  assert.deepEqual(c.cancelled, []);
});

test('decide: a failed required check fails immediately, even alongside a cancelled one', () => {
  const next = decide({ ...empty,
    cancelled: [{ name: 'smoke', runId: 1 }],
    failed: [{ name: 'Secret scan', conclusion: 'FAILURE' }] }, { rerunDone: false });
  assert.equal(next.action, 'fail');
  assert.match(next.reason, /Secret scan: FAILURE/);
});

test('decide: cancelled checks trigger one re-run per distinct workflow run', () => {
  const next = decide({ ...empty, cancelled: [
    { name: 'Secret scan', runId: 7 }, { name: 'Content guardrails', runId: 7 },
    { name: 'smoke', runId: 8 }, { name: 'odd', runId: null },
  ] }, { rerunDone: false });
  assert.deepEqual(next, { action: 'rerun', runIds: [7, 8] });
});

test('decide: a check cancelled again after the re-run fails', () => {
  const next = decide({ ...empty, cancelled: [{ name: 'smoke', runId: 9 }] }, { rerunDone: true });
  assert.equal(next.action, 'fail');
  assert.match(next.reason, /again/);
});

test('decide: pending or all-passing means keep waiting', () => {
  assert.deepEqual(decide({ ...empty, pending: ['smoke'] }, { rerunDone: false }), { action: 'wait' });
  assert.deepEqual(decide({ ...empty, passing: REQUIRED }, { rerunDone: false }), { action: 'wait' });
});

test('gateDecision closes bot branches and refuses everything else', () => {
  const bot = { number: 1287, headRefName: 'bot/checkbook-refresh-2026-10-09-1707' };
  const human = { number: 1179, headRefName: 'fix/checkbook-gate' };
  assert.deepEqual(gateDecision([bot, human]), { close: [bot], refuse: [human] });
  assert.deepEqual(gateDecision([]), { close: [], refuse: [] });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/ci/auto_pr.test.mjs`
Expected: the suite fails to load with `Cannot find module '.../scripts/ci/auto_pr.mjs'`.

- [ ] **Step 3: Write the pure functions**

```js
#!/usr/bin/env node
// scripts/ci/auto_pr.mjs
// Self-healing helpers for bot-authored "auto-*" data refresh PRs.
//
//   node scripts/ci/auto_pr.mjs gate <label>
//     Close every open PR carrying <label> whose head branch starts with
//     "bot/" (a leftover from a run that never merged), commenting with
//     its check results, then exit 0 so the refresh proceeds. A labeled
//     PR on any other branch belongs to a human: print ::error:: and
//     exit 1 without touching it.
//
//   node scripts/ci/auto_pr.mjs await-merge <pr-url-or-number> [--minutes N]
//     Poll until the PR is MERGED (default budget 15 minutes). Required
//     checks come from branch protection. A cancelled required check
//     (runner never acquired, apt mirror stall, ...) gets its workflow
//     run re-run once. A failed required check, a second cancellation,
//     or the deadline exits 1 with a ::error:: naming the PR, leaving
//     the PR open for diagnosis. Net effect: a green scheduled run means
//     the data landed on main.
//
// Why: PRs #1150, #1278 and #1287 each sat BLOCKED for 10-16 days after
// one cancelled required check, because nothing re-runs a cancelled
// check and the old gate only skipped (then, after #1179, alarmed).
//
// Node built-ins only; needs `gh` on PATH and GH_TOKEN in the env.
// Decision logic is pure and tested in auto_pr.test.mjs; the gh calls
// are a thin layer underneath.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const POLL_MS = 20_000;
const REQUIRED_CHECKS_ENDPOINT =
  'repos/{owner}/{repo}/branches/main/protection/required_status_checks/contexts';

// ---- pure decision logic ---------------------------------------------

export function runIdFromDetailsUrl(url) {
  const m = /\/actions\/runs\/(\d+)/.exec(url ?? '');
  return m ? Number(m[1]) : null;
}

// Sort the PR's statusCheckRollup into buckets, required checks only.
// Several check runs can share a name after a re-run: an in-flight one
// makes the name pending; otherwise the most recently completed one
// decides. Results completed at or before `rerunAt` are pre-re-run and
// count as pending.
export function classifyChecks(rollup, required, rerunAt = null) {
  const out = { pending: [], passing: [], cancelled: [], failed: [] };
  for (const name of required) {
    const runs = (rollup ?? []).filter((c) => c.name === name);
    if (runs.length === 0 || runs.some((c) => c.status !== 'COMPLETED')) {
      out.pending.push(name);
      continue;
    }
    const latest = runs.reduce((a, b) => ((b.completedAt ?? '') > (a.completedAt ?? '') ? b : a));
    if (rerunAt && (latest.completedAt ?? '') <= rerunAt) {
      out.pending.push(name);
    } else if (PASSING.has(latest.conclusion)) {
      out.passing.push(name);
    } else if (latest.conclusion === 'CANCELLED') {
      out.cancelled.push({ name, runId: runIdFromDetailsUrl(latest.detailsUrl) });
    } else {
      out.failed.push({ name, conclusion: latest.conclusion });
    }
  }
  return out;
}

// What await-merge does next for a PR that is still OPEN.
export function decide(checks, { rerunDone }) {
  if (checks.failed.length) {
    const reason = checks.failed.map((f) => `${f.name}: ${f.conclusion}`).join(', ');
    return { action: 'fail', reason };
  }
  if (checks.cancelled.length) {
    const names = checks.cancelled.map((c) => c.name).join(', ');
    if (rerunDone) return { action: 'fail', reason: `cancelled again after one re-run: ${names}` };
    const runIds = [...new Set(checks.cancelled.map((c) => c.runId).filter(Boolean))];
    return { action: 'rerun', runIds };
  }
  return { action: 'wait' };
}

export function gateDecision(prs) {
  const isBot = (p) => p.headRefName.startsWith('bot/');
  return { close: prs.filter(isBot), refuse: prs.filter((p) => !isBot(p)) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/ci/auto_pr.test.mjs`
Expected: `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci/auto_pr.mjs scripts/ci/auto_pr.test.mjs
git commit -m "ci: pure decision logic for self-healing auto PRs"
```

---

### Task 2: `gate` and `await-merge` commands

**Files:**
- Modify: `scripts/ci/auto_pr.mjs` (append below the pure functions)
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Append the gh layer and CLI**

```js
// ---- gh plumbing -------------------------------------------------------

function gh(args, { json = true } = {}) {
  const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return json ? JSON.parse(out) : out.trim();
}

function summarize(rollup) {
  const parts = (rollup ?? []).map((c) => `${c.name}: ${c.status === 'COMPLETED' ? c.conclusion : c.status}`);
  return parts.join(', ') || 'no checks reported';
}

function requiredChecks() {
  try {
    return gh(['api', REQUIRED_CHECKS_ENDPOINT]);
  } catch {
    console.log('::warning::could not read required checks from branch protection; treating every check as required');
    return null;
  }
}

function rerun(runId) {
  const attempts = [['run', 'rerun', String(runId), '--failed'], ['run', 'rerun', String(runId)]];
  for (const args of attempts) {
    try {
      gh(args, { json: false });
      console.log(`re-ran workflow run ${runId}${args.includes('--failed') ? ' (failed jobs)' : ' (all jobs)'}`);
      return;
    } catch (e) {
      console.log(`::warning::gh ${args.join(' ')} failed: ${String(e.message).split('\n')[0]}`);
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoSeconds = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function gate(label) {
  const prs = gh(['pr', 'list', '--label', label, '--state', 'open',
    '--json', 'number,url,headRefName,createdAt,statusCheckRollup']);
  const { close, refuse } = gateDecision(prs);
  for (const p of refuse) {
    console.log(`::error::${p.url} carries the ${label} label but ${p.headRefName} is not a bot/ branch; leaving it alone`);
  }
  if (refuse.length) return 1;
  for (const p of close) {
    const comment = `Closing: this auto PR never merged (${summarize(p.statusCheckRollup)}). `
      + 'Today\'s refresh replaces it with current data. See scripts/ci/auto_pr.mjs.';
    gh(['pr', 'close', p.url, '--delete-branch', '--comment', comment], { json: false });
    console.log(`closed leftover ${p.url} (${p.headRefName}, opened ${p.createdAt})`);
  }
  if (!close.length) console.log(`no open ${label} PR; proceeding`);
  return 0;
}

export async function awaitMerge(ref, minutes) {
  const started = Date.now();
  const deadline = started + minutes * 60_000;
  const required = requiredChecks();
  let rerunDone = false;
  let rerunAt = null;
  for (;;) {
    const pr = gh(['pr', 'view', ref, '--json', 'url,state,mergeStateStatus,statusCheckRollup']);
    if (pr.state === 'MERGED') {
      console.log(`merged: ${pr.url}`);
      return 0;
    }
    if (pr.state !== 'OPEN') {
      console.log(`::error::${pr.url} is ${pr.state}; nothing to wait for`);
      return 1;
    }
    const names = required ?? [...new Set(pr.statusCheckRollup.map((c) => c.name))];
    const checks = classifyChecks(pr.statusCheckRollup, names, rerunAt);
    const next = decide(checks, { rerunDone });
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`[${elapsed}s] ${pr.mergeStateStatus}; ${summarize(pr.statusCheckRollup)}`);
    if (next.action === 'fail') {
      console.log(`::error::${pr.url} did not merge: ${next.reason}. Left open for diagnosis.`);
      return 1;
    }
    if (next.action === 'rerun') {
      for (const id of next.runIds) rerun(id);
      rerunDone = true;
      rerunAt = isoSeconds();
    }
    if (Date.now() >= deadline) {
      console.log(`::error::${pr.url} not merged after ${minutes} min (${summarize(pr.statusCheckRollup)}). Left open for diagnosis.`);
      return 1;
    }
    await sleep(POLL_MS);
  }
}

// ---- CLI -----------------------------------------------------------------

async function main(argv) {
  const [cmd, ref, ...rest] = argv;
  if (cmd === 'gate' && ref) return gate(ref);
  if (cmd === 'await-merge' && ref) {
    const i = rest.indexOf('--minutes');
    const minutes = i >= 0 ? Number(rest[i + 1]) : 15;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      console.error('--minutes must be a positive number');
      return 2;
    }
    return awaitMerge(ref, minutes);
  }
  console.error('usage: auto_pr.mjs gate <label> | await-merge <pr-url-or-number> [--minutes N]');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `test:transcripts` line:

```json
    "test:ci": "node --test scripts/ci/*.test.mjs",
```

- [ ] **Step 3: Unit tests still green, then dry-run both commands against the live repo**

Run: `npm run test:ci`
Expected: `# pass 14`, `# fail 0`.

Run: `node scripts/ci/auto_pr.mjs gate auto-checkbook; echo "exit=$?"`
Expected (no leftover PR open right now): `no open auto-checkbook PR; proceeding`, `exit=0`.

Run: `node scripts/ci/auto_pr.mjs await-merge 1298 --minutes 1; echo "exit=$?"`
Expected (PR #1298 merged 2026-10-21): `merged: https://github.com/agbaber/marblehead/pull/1298`, `exit=0`.

Run: `node scripts/ci/auto_pr.mjs; echo "exit=$?"`
Expected: the usage line, `exit=2`.

- [ ] **Step 4: Commit**

```bash
git add scripts/ci/auto_pr.mjs package.json
git commit -m "ci: gate + await-merge commands for auto PRs"
```

---

### Task 3: Wire `checkbook-refresh.yml` to the helper

**Files:**
- Modify: `.github/workflows/checkbook-refresh.yml`

- [ ] **Step 1: Replace the gate step (lines 58-87) with**

```yaml
      - name: Close any leftover auto-checkbook PR (a prior run that never merged)
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
        run: |
          set -euo pipefail
          gh label create auto-checkbook \
            --color d62728 \
            --description "Daily auto-refresh of the checkbook CSV" \
            2>/dev/null || true
          # A leftover open bot PR means an earlier run already went red
          # in its "Wait for auto-merge" step. Close it and start fresh;
          # never skip (PRs #1150, #1287 froze the data 10-16 days each).
          node scripts/ci/auto_pr.mjs gate auto-checkbook
```

- [ ] **Step 2: Delete every `if: steps.gate.outputs.skip == 'false'` line** (four of them: the fetch, prune, rebuild and detect-changes steps).

- [ ] **Step 3: Export the PR URL from the commit step**

Add `id: pr` under the step's `name:` line, and immediately after the `pr_url=$(gh pr create ... )` call add:

```bash
          echo "url=$pr_url" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 4: Replace the PR-body paragraph that starts "Auto-merge is enabled."** with

```
          Auto-merge is enabled and the workflow waits for it: a cancelled
          required check is re-run once, and the run goes red if this PR
          has not merged within 15 minutes, leaving it open for diagnosis.
          The next run closes any leftover auto-checkbook PR and starts
          fresh (\`scripts/ci/auto_pr.mjs\`). The redaction review TSV is
          posted below as an audit log; if a kept description ever turns
          out to identify a person, add a pattern to
          \`scripts/build_checkbook_csv.py\` and the next run will mask it.
```

- [ ] **Step 5: Append the await step after the commit step**

```yaml
      - name: Wait for auto-merge (re-run a cancelled required check once; fail loudly otherwise)
        if: steps.changes.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
          PR_URL: ${{ steps.pr.outputs.url }}
        run: node scripts/ci/auto_pr.mjs await-merge "$PR_URL" --minutes 15
```

- [ ] **Step 6: Raise `timeout-minutes: 10` to `25`** (refresh takes about a minute; the wait budget is 15).

- [ ] **Step 7: Update the header comment** so the paragraph on auto-merge reads:

```
# That best-effort redaction is treated as sufficient: auto-merge is
# enabled, and the last step waits for it (scripts/ci/auto_pr.mjs:
# one re-run of a cancelled required check, red run if the PR has
# not merged in 15 minutes). The review TSV is still posted as a PR
# comment so the masking decisions remain auditable after the fact.
```

- [ ] **Step 8: Validate and commit**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/checkbook-refresh.yml')); print('ok')"`
Expected: `ok`.

```bash
git add .github/workflows/checkbook-refresh.yml
git commit -m "ci: checkbook refresh closes leftovers and waits for its own merge"
```

---

### Task 4: Wire `checkbook-refresh-fy26.yml`, weekly, timeout 40

**Files:**
- Modify: `.github/workflows/checkbook-refresh-fy26.yml`

- [ ] **Step 1: Replace the header comment (lines 3-6) with**

```yaml
# Weekly refresh of the FY26 checkbook archive. The FY26 ledger stopped
# moving in Sep 2026 but the budget-side FY26 actuals still pick up
# close adjustments and nothing else refreshes them. Delete this
# workflow once the FY26 ACFR is published (expected ~Jan 2027); the
# page then freezes on its last snapshot as the permanent archive.
# Kept separate from checkbook-refresh.yml so a stuck FY26 PR never
# blocks the live current-year refresh.
```

- [ ] **Step 2: Cron and timeout**

```yaml
    # Sundays 11:00 UTC. Was daily; the output is a verification stamp
    # plus the occasional close adjustment, and each run crawls the
    # budget portal for ~16 minutes.
    - cron: '0 11 * * 0'
```

```yaml
    # crawl_budget_drill.py alone runs ~16 min (15m53s on 2026-10-05);
    # the old 15-minute timeout killed 26 of 104 runs. 40 covers the
    # crawl plus the 15-minute merge wait.
    timeout-minutes: 40
```

- [ ] **Step 3: Replace the gate step (lines 33-58) with**

```yaml
      - name: Close any leftover FY26 auto PR (a prior run that never merged)
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
        run: |
          set -euo pipefail
          gh label create auto-checkbook-fy26 --color d62728 \
            --description "Weekly auto-refresh of the FY26 checkbook archive" 2>/dev/null || true
          node scripts/ci/auto_pr.mjs gate auto-checkbook-fy26
```

- [ ] **Step 4: Delete the three `if: steps.gate.outputs.skip == 'false'` lines.**

- [ ] **Step 5: Commit step: add `id: pr`, export the URL, reword the body**

After `pr_url=$(gh pr create ...)`:

```bash
          echo "url=$pr_url" >> "$GITHUB_OUTPUT"
```

PR body:

```
--body "Weekly FY26 archive refresh. Auto-merged; same redaction + required checks as the live job. The workflow waits for the merge and re-runs a cancelled check once. Delete this workflow once the FY26 ACFR is out."
```

- [ ] **Step 6: Append the await step**

```yaml
      - name: Wait for auto-merge (re-run a cancelled required check once; fail loudly otherwise)
        if: steps.changes.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
          PR_URL: ${{ steps.pr.outputs.url }}
        run: node scripts/ci/auto_pr.mjs await-merge "$PR_URL" --minutes 15
```

- [ ] **Step 7: Validate and commit**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/checkbook-refresh-fy26.yml')); print('ok')"`
Expected: `ok`.

```bash
git add .github/workflows/checkbook-refresh-fy26.yml
git commit -m "ci: FY26 archive refresh weekly, timeout fits the crawler, self-healing gate"
```

---

### Task 5: Smoke job hardening

**Files:**
- Modify: `.github/workflows/smoke-tests.yml`

- [ ] **Step 1: Replace lines 27-28 (`npm install` and the Playwright install) with**

```yaml
      - run: npm install

      # Unit tests for CI helpers (scripts/ci). Fast; runs before the
      # browser install so a helper regression fails in seconds.
      - run: npm run test:ci

      # Cache the Chromium build Playwright downloads (~150 MB) so the
      # usual run never touches the Playwright CDN.
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      # No --with-deps: that flag apt-installs ~80 MB of font packages on
      # every run, and the Azure apt mirror stalling inside it is what
      # pushed PR #1150 (Aug 18) and PR #1287 (Oct 9) past the job
      # timeout and wedged the checkbook refresh for 10+ days each.
      # ubuntu-latest already ships Chromium's shared libraries.
      - run: npx playwright install chromium
```

- [ ] **Step 2: Raise `timeout-minutes: 10` to `20`.**

- [ ] **Step 3: Validate and commit**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/smoke-tests.yml')); print('ok')"`
Expected: `ok`.

```bash
git add .github/workflows/smoke-tests.yml
git commit -m "ci: cache Playwright, drop the apt font pull, run helper tests in smoke"
```

---

### Task 6: Push, open the PR, prove it

- [ ] **Step 1: Confirm the branch carries only this work**

Run: `git log --oneline origin/main..HEAD`
Expected: only the commits from Tasks 1-5 plus the docs commit; no `wip` commits.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin fix/checkbook-refresh-self-heal
gh pr create --base main --title "Checkbook refresh: self-healing auto-PRs, smoke without apt, FY26 weekly" --body-file <body>
```

- [ ] **Step 3: Proof of Work to collect for the PR body**

- The PR's own `smoke` check green **without** `--with-deps` (proves Chromium launches on the stock runner), with the `npm run test:ci` step output showing 14 passing.
- Local dry-run transcript from Task 2 Step 3.
- After merge: `gh workflow run checkbook-refresh-fy26.yml` and link the run whose "Wait for auto-merge" step prints `merged: ...` (proves the 40-minute budget fits the crawler and the await path works end to end).

---

## Self-review

- Spec coverage: §1 helper = Tasks 1-2; §2 wiring = Tasks 3-4; §3 smoke = Task 5; §4 FY26 weekly = Task 4; proof = Task 6. Follow-ups (siblings, crawler speed) stay out of scope as the spec says.
- Names used consistently: `classifyChecks`, `decide`, `gateDecision`, `runIdFromDetailsUrl`, `gate`, `awaitMerge`; step id `pr`, output `url`; npm script `test:ci`.
- No placeholders.

---

## Follow-up plan: FY26 job survives a slow portal (spec section "Follow-up")

### Task 7: fingerprint + skip in the crawler, test-first

**Files:**
- Create: `tests/test_crawl_budget_drill.py`
- Modify: `scripts/crawl_budget_drill.py`

- [ ] **Step 1: Write the failing tests** (pytest, imports `crawl_budget_drill` the way `tests/test_fylib.py` imports `fylib`)

```python
def test_fingerprint_ignores_the_as_of_stamp(): ...        # same hash, different as_of
def test_fingerprint_changes_when_a_number_moves(): ...    # different hash
def test_fingerprint_is_a_sha256_hex_digest(): ...         # 64 hex chars
def test_skip_only_when_the_existing_drill_recorded_the_same_fingerprint(): ...
    # True for matching actuals_sha256; False for different, missing key, or None
```

- [ ] **Step 2: Run** `python3 -m pytest tests/test_crawl_budget_drill.py -q`. Expected: 4 failures, `AttributeError: module 'crawl_budget_drill' has no attribute 'actuals_fingerprint'`.

- [ ] **Step 3: Implement** in `scripts/crawl_budget_drill.py`

```python
import hashlib  # add to the existing import line

def actuals_fingerprint(b):
    """sha256 of the budget_actual JSON minus its as_of stamp."""
    stable = {k: v for k, v in b.items() if k != 'as_of'}
    return hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()

def should_skip_crawl(existing_drill, fingerprint):
    """True when a prior drill file recorded the same actuals fingerprint."""
    return bool(existing_drill) and existing_drill.get('actuals_sha256') == fingerprint
```

In `main()`: add `--skip-if-unchanged`; after loading `b`, compute `fp`; if the flag is set and `should_skip_crawl(json.load(open(out)) if os.path.exists(out) else None, fp)`, print `budget_actual unchanged since the last crawl (actuals_sha256 match); keeping <out>` and return; put `'actuals_sha256': fp` in the `drill` dict right after `'fiscal_year'`.

- [ ] **Step 4: Run** the tests again. Expected: `4 passed`. Also `python3 -m pytest tests/test_fylib.py -q` still green.

- [ ] **Step 5: Commit** `feat: crawl_budget_drill --skip-if-unchanged via actuals fingerprint`.

### Task 8: wire the FY26 workflow

**Files:** `.github/workflows/checkbook-refresh-fy26.yml`

- [ ] Job-level `env: PYTHONUNBUFFERED: '1'`; `timeout-minutes: 45`.
- [ ] In "Fetch + redact FY26 export, rebuild artifacts": add `python3 scripts/fetch_operating_budget.py --year 2026` before `build_budget_actual.py`; remove the crawl line.
- [ ] New step after it:

```yaml
      - name: Re-crawl budget drill (skipped when the FY26 actuals are unchanged)
        id: crawl
        timeout-minutes: 25
        continue-on-error: true
        run: python3 scripts/crawl_budget_drill.py --year 2026 --skip-if-unchanged
```

- [ ] Last step of the job:

```yaml
      - name: Fail the run if the drill crawl did not finish (the actuals above still landed)
        if: steps.crawl.outcome == 'failure'
        run: |
          echo "::error::crawl_budget_drill.py did not finish inside its 25-minute step budget. The operating-budget CSV and budget_actual changes were still committed; the drill keeps its previous snapshot and the next Sunday run re-crawls because its actuals_sha256 is stale."
          exit 1
```

- [ ] Validate with `yaml.safe_load` + a step dump; commit `ci: FY26 job fetches its budget CSV, crawls only when actuals moved, unbuffered`.

### Task 9: proof

- pytest output for both test files.
- Local CLI proof without network: copy the committed drill, add the matching `actuals_sha256`, run `--skip-if-unchanged`, expect the skip line and exit 0 in under a second; then restore.
- Local CLI proof of the proceed path with `PYTHONUNBUFFERED=1 timeout 90 ...`: expect `Will make 754 API calls` and at least one `N/754 ...` progress line before the kill.
- `git diff --stat` of the live-fetched FY26 CSV and rebuilt actuals (the staleness evidence).
- PR CI green; after merge, `gh workflow run checkbook-refresh-fy26.yml` and link the run.
