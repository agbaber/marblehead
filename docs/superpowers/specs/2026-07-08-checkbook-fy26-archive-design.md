# FY26 checkbook archive — design

**Date:** 2026-07-08
**Branch:** `checkbook-fy26-archive`

## Goal

Bring back the full interactive checkbook explorer for FY26 as an archived
page at `/checkbook/fy26/`, linked from the live `/checkbook/` (FY27) page,
and keep FY26 data refreshing until the town's books close in fall 2026 so
late-posted vendor checks and year-end corrections keep appearing.

## Non-goals

- Not touching `/spending-by-vote/` (the separate FY26 "by who voted"
  analysis). It stays as-is.
- Not archiving FY25 or earlier. Only FY26 has the artifacts and the
  active-close rationale.
- Not building a general year-switcher UI. Two explicit pages, one link
  between them.

## Background — what the FY27 rollover (PR #978) did

- The nightly `checkbook-refresh.yml` now fetches only the **current**
  fiscal year (`fetch_checkbook_export.py` defaults to
  `fylib.current_fiscal_year()` = FY27). FY26 stopped refreshing.
- FY26 was frozen at the `checkbook_FY26_2026-06-30.csv` snapshot.
- `/checkbook/` was flipped to FY27; it reads the live `_data/checkbook.json`
  and `_data/budget.json` (both now FY27).

FY26 data was **not deleted** — the pipeline is fully FY-parameterized
(`--year` / `--out` on every build script), and the town portal still serves
FY26 via `?year=2026`.

## Architecture

Three parts: a template refactor (one explorer, two pages), the FY26 data
artifacts, and a lightweight FY26 ingestion workflow.

### Part 1 — one explorer, two pages (no drift)

The explorer is ~2,000 inline lines in `checkbook.html` with **no includes**.
To serve two fiscal years from one codebase:

1. **Extract the explorer body into `_includes/checkbook-explorer.html`.**
   It takes the fiscal-year data as include parameters rather than reading
   `site.data.*` directly:
   - `{% include checkbook-explorer.html cb=site.data.checkbook bud=site.data.budget %}` (FY27)
   - `{% include checkbook-explorer.html cb=site.data.checkbook_fy26 bud=site.data.budget_fy26 %}` (FY26)
   - Inside the include, every `site.data.checkbook.X` becomes `include.cb.X`
     and every `site.data.budget.X` becomes `include.bud.X`.
2. **`checkbook.html`** becomes a thin page: FY27 frontmatter +
   the include call. Must render behavior-identical to today.
3. **New `checkbook-fy26.html`**: FY26 frontmatter + the include call with
   the FY26 data namespaces.

**Routing / relative-path fix.** The page uses `../data/...` (13 spots),
which only works one path segment deep. Two clean options:
- **Chosen:** rewrite the data URLs in the include to
  `{{ '/data/...' | relative_url }}` (absolute from site root), so the same
  include works at any permalink depth. Then `checkbook-fy26.html` can use
  the conventional `permalink: /checkbook/fy26/`.
- (Rejected: `permalink: /checkbook-fy26/` to keep `../data/` working — uglier
  URL, and leaves a latent depth bug in the shared include.)

**OG placeholders.** `_includes/head.html` substitutes
`__CHECKBOOK_TOTAL_M__` / `__CHECKBOOK_AS_OF__` from `site.data.checkbook`
(FY27). The FY26 page's `og_description` must not use those tokens — it
carries its own FY26 total/as-of, sourced from `site.data.checkbook_fy26`
via Liquid in the page frontmatter, or written literally.

### Part 2 — FY26 data artifacts

The page fetches: the FY26 CSV, `budget_actual_FY26.json`,
`budget_drill_FY26.json`, a FY26 `checkbook_performance.json`, and the shared
`checkbook_labels.json`.

| Artifact | Status | Action |
|---|---|---|
| `checkbook_FY26_<as-of>.csv` | present (`2026-06-30`) | refreshed by Part 3 |
| `budget_actual_FY26.json` | present | refreshed by Part 3 |
| `budget_drill_FY26.json` | present | refreshed by Part 3 |
| `checkbook_performance_FY26.json` | **missing** | build: `build_checkbook_performance.py --year 2026 --out data/checkbook_performance_FY26.json` |
| `checkbook_labels.json` | present, shared | reuse as-is |
| `_data/checkbook_fy26.json` | **missing** | new FY26 dashboard (fiscal_year, total_M, row counts, as_of, fy_start/end, months_elapsed, csv_filename, performance_filename) |
| `_data/budget_fy26.json` | **missing** | new FY26 budget summary (fiscal_year, annual_operating_M, actual_filename, drill_filename) |

The include must reference a per-FY `performance_filename` (from
`include.cb`) instead of the hardcoded `checkbook_performance.json`, so FY27
keeps reading the generic file and FY26 reads `_FY26`.

### Part 3 — live FY26 ingestion (retires ~fall 2026)

A **separate** workflow, `checkbook-refresh-fy26.yml`, kept out of the
delicately tuned daily FY27 job (auto-merge, PII redaction, single-PR gate,
current-FY prune). **Daily** cadence, exactly like FY27, for consistency;
most runs will be no-ops (detect-changes step exits clean) until a late
FY26 payment posts. Offset the cron from the FY27 job so the two don't hit
the portal simultaneously.

Steps:
1. `fetch_checkbook_export.py --year 2026`
2. `build_checkbook_csv.py --year 2026` → `checkbook_FY26_<as-of>.csv`
3. `build_checkbook_performance.py --year 2026 --out data/checkbook_performance_FY26.json`
4. `build_budget_actual.py --year 2026`, `crawl_budget_drill.py --year 2026`
5. Regenerate `_data/checkbook_fy26.json` + `_data/budget_fy26.json`
6. Prune the superseded FY26 dated CSV (the daily job deliberately does
   **not** prune prior-FY CSVs, so this workflow prunes its own)
7. Open a PR and **auto-merge** (`--auto --squash`), matching the FY27 job.
   Same redaction + required checks gate it. Use a **distinct**
   `auto-checkbook-fy26` label and its own single-open-PR gate + concurrency
   group so a stuck FY26 PR never blocks the daily FY27 refresh (and vice
   versa).

**Wrinkle — rolling filename.** As late FY26 payments post, the CSV's
as-of date advances, so the filename changes
(`checkbook_FY26_2026-06-30.csv` → `..._2026-07-14.csv`). Therefore:
- the page's ledger-download link and CSV fetch must read
  `include.cb.csv_filename` (dashboard-driven), never a hardcoded date;
- the existing hardcoded reference at `checkbook.html:820`
  (`checkbook_FY26_2026-06-30.csv`, in the FY27 page's "Prior fiscal years"
  note) also becomes dashboard-driven off `site.data.checkbook_fy26`.

**Retirement.** When FY26 books close (expected fall 2026), delete
`checkbook-refresh-fy26.yml`; the page freezes on its last snapshot and
remains a permanent archive.

### Part 4 — linking + tests + proof

- **Link:** add a visible "View FY26" affordance on `/checkbook/` (near the
  existing top-of-page "Also see" line), and keep/upgrade the "Prior fiscal
  years" note. Add the FY26 page as a card in `/data/` under Budget & spending.
- **Smoke:** add a `tests/smoke-test.mjs` assertion for `/checkbook/fy26/`
  (loads, KPIs render, table populates), mirroring the `/checkbook/` check.
- **Proof:** Playwright screenshots of both `/checkbook/` (unchanged) and
  `/checkbook/fy26/` (explorer live with FY26 numbers), committed to `proof/`.

## Risks

1. **FY27 regression from the refactor.** The 2,000-line extraction is the
   riskiest change. Mitigation: FY27 page must be behavior-identical; verify
   with smoke + a before/after Playwright screenshot of `/checkbook/`.
2. **Ingestion cost/benefit.** Post-close FY26 deltas are small. If the
   trickle proves negligible, Part 3 can be dropped and the page frozen at
   the June 30 snapshot without affecting Parts 1–2.
3. **Two new `_data` files pinned to FY26** — must not be read by any
   current-FY code path.

## Decisions (resolved)

- FY26 refresh cadence: **daily**, offset cron from FY27, auto-merge with a
  distinct `auto-checkbook-fy26` label.
