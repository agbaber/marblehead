# Checkbook refresh: self-healing auto-PRs

Design notes, 2026-10-21. Status: approved, implemented in the same PR.

## Problem

Both checkbook refresh workflows (`checkbook-refresh.yml`, live FY27;
`checkbook-refresh-fy26.yml`, archive) open a bot PR, enable auto-merge,
and walk away. Branch protection requires three checks (`smoke`,
`Secret scan`, `Content guardrails`) and `enforce_admins` is on, so a
single cancelled required check leaves the PR BLOCKED forever: nothing
re-runs a cancelled check. The next day's run finds the open PR and
skips. PR #1179 (2026-08-27) made that skip turn red after 48 hours, but
the data still stays frozen until a human closes the PR.

Three wedges in four months, every one cleared by hand:

| PR | Window | What cancelled the check |
|---|---|---|
| #1150 | Aug 18 to Aug 28 | smoke hit its 10-minute job timeout inside `npx playwright install --with-deps chromium` |
| #1287 | Oct 9 to Oct 21 | same step, same timeout; the Azure apt mirror stalled on font packages (step normally takes 20 s) |
| #1278 | Oct 5 to Oct 21 | all four checks: "The job was not acquired by Runner of type hosted even after multiple attempts" |

Two further brittleness sources sit underneath:

- The smoke job has no Playwright cache, pulls apt font packages on
  every run, and runs with a 10-minute timeout. 118 of 120 recent runs
  finish in about 2 minutes; both cancelled ones died in the install
  step.
- The FY26 job's `timeout-minutes: 15` is shorter than its own
  `crawl_budget_drill.py` run (15m53s on Oct 5; 16m on the Oct 21
  re-dispatch). 26 of 104 FY26 runs have been killed by that timeout.
  Its ledger has not changed since at least Sep 16 (18,521 rows,
  $114,437,393.33), but the budget-side FY26 actuals still moved on
  Oct 3 and no other workflow refreshes them.

The budget, data and meetings refreshes use the same skip-if-open-PR
gate without even the 48-hour alarm, so they would wedge silently.

## Design

### 1. `scripts/ci/auto_pr.mjs`, shared by every auto-PR workflow

Plain Node, built-ins only (the runner image ships Node; the data jobs
only set up Python). Two subcommands:

- `gate <label>`: close every open PR carrying `<label>` whose head
  branch starts with `bot/`, with a comment quoting its check results,
  then proceed. A labeled PR on a non-bot branch belongs to a human:
  print `::error::` and exit 1 instead of touching it. The old
  skip / 48-hour logic goes away: after change 2 below, a leftover open
  bot PR can only exist because an earlier run already went red.
- `await-merge <pr> [--minutes N]` (default 15): after auto-merge is
  armed, poll every 20 s until the PR is MERGED. The required-check list
  comes from branch protection
  (`.../branches/main/protection/required_status_checks/contexts`),
  falling back to "every check" with a warning. Decision table per poll,
  over required checks only:
  - any check FAILURE / TIMED_OUT / ACTION_REQUIRED / other non-success:
    `::error::`, exit 1, PR left open for diagnosis;
  - any check CANCELLED and no re-run yet: `gh run rerun <id> --failed`
    (fallback: full re-run) for each cancelled check's workflow run,
    record the time; results completed before that time are treated as
    pending from then on;
  - any check CANCELLED again after the re-run: exit 1;
  - otherwise wait. Deadline reached: exit 1 naming the check states.

  Invariant the workflow gains: **a green scheduled run means the data
  landed on main (or there was nothing to land).** A red run names the
  PR and the check in its annotation.

The decision logic (`classifyChecks`, `decide`, `gateDecision`,
`runIdFromDetailsUrl`) is pure and covered by `node --test`, following
`scripts/transcripts/lib/*.test.mjs`. The `gh` calls are a thin layer
exercised by a local dry run against the real repo.

### 2. Wire both checkbook workflows to the helper

- Gate step body becomes the label-create line plus
  `node scripts/ci/auto_pr.mjs gate <label>`; the `skip` output and the
  per-step `if: steps.gate.outputs.skip == 'false'` guards go away.
- The commit/PR step exports the PR URL as a step output.
- New final step, `if: steps.changes.outputs.changed == 'true'`:
  `node scripts/ci/auto_pr.mjs await-merge <url> --minutes 15`.
- Job timeouts grow to cover the wait: live job 10 to 25 minutes.

### 3. Smoke job hardening (`smoke-tests.yml`)

- `actions/cache@v4` on `~/.cache/ms-playwright`, keyed on
  `package-lock.json`, placed after `npm install`.
- `npx playwright install chromium` **without** `--with-deps`. The apt
  font pull is the step that stalled past the timeout both times, and
  `ubuntu-latest` already ships Chromium's shared libraries. The fix
  PR's own smoke run is the proof; if Chromium fails to launch, the
  fallback is to restore `--with-deps` and rely on the larger timeout.
- Job timeout 10 to 20 minutes.
- `npm run test:ci` (`node --test scripts/ci/*.test.mjs`) runs in the
  smoke job so the helper's decision table is regression-tested on
  every PR.

### 4. FY26 archive job: weekly, bigger timeout, not retired yet

- Cron `0 11 * * 0` (Sundays 11:00 UTC) instead of daily.
- `timeout-minutes: 40` so the crawler plus the merge wait fit.
- Delete the workflow once the FY26 ACFR is published (expected around
  January 2027); the page then freezes on its last snapshot as the
  permanent archive.

## Alternatives considered

- **Inline bash in each workflow** (as today): less code, but it is
  already duplicated twice and would be five times once the siblings
  adopt it, and bash decision logic has no tests. Rejected.
- **Retire the FY26 job now:** the ledger is frozen, but FY26 budget
  actuals still moved on Oct 3 and nothing else refreshes them. Deferred
  until the ACFR.
- **Keep FY26 daily with the bigger timeout:** 365 sixteen-minute crawls
  a year for an archive that changes a few dollars a month. Weekly keeps
  the verification stamp without the cost.
- **Re-run cancelled checks from the gate the next day** instead of
  waiting in the same run: self-heals a day late and leaves the run that
  actually failed green. Rejected in favour of the green-means-landed
  invariant.
- **Drop the smoke check from bot PRs:** branch protection applies to
  every PR and `enforce_admins` is on; the smoke build is also the only
  thing that proves a new JSON does not break a page. Rejected.

## Out of scope (follow-ups)

- Adopt `gate` / `await-merge` in `data-refresh.yml`,
  `budget-refresh.yml`, `ingest-meetings.yml`.
- Speed up `crawl_budget_drill.py`.
