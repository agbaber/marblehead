# Department Explorer — Design

**Date:** 2026-07-15
**Branch:** `departments-explorer`
**Status:** Approved design, pre-implementation

## Origin

Resident feedback on "what to work on next" clustered on one theme: forensic,
granular transparency into where town money goes, what each department does, and
how spending has trended over time. Three representative quotes:

- "what our money is being spent on / how much is being spent / how long have we
  spent on an item ... build an appropriate budget ... more enthusiastic tax payers."
- "a more comprehensive site that goes into more detail about our town departments
  and what exactly their services entail. Detailed rationale on large spends."
- "Forensic accounting of every penny spent by the town."

Much of the "every penny" ask is already served by `checkbook.html`,
`town-budget.html`, and `where-has-the-money-gone.html`. The genuine gaps are
(1) **per-department depth** — what a department does and what it costs, in one
place — and (2) **per-item trend** — how a line has moved over time.

## Chosen approach

**A — data-driven Department Explorer for all 40 departments first.** Ship the
full skeleton fast from data we already trust; layer authored service prose and
longer history in later where they earn it. (Rejected: deep pilot on a few
departments first; categorizing the checkbook by department first — the payment
data is not cleanly departmentalized and is single-year.)

**URL shape:** single explorer page with client-side JS routing (one page, hash
fragment selects a department). No per-department static pages, no page
generator. Trade-off accepted: weaker deep-linking / SEO / OG cards in exchange
for a much lighter build. Deep links still work via hash (`#fire`).

## Data reality (constraints that shaped this design)

- **Clean department structure lives in the budget, not the checkbook.**
  `data/town_budget_FY27.json` has 396 rows across `level` = grand_total /
  function / department / line: **10 functions, 40 departments, 344 line items**,
  each with `fy25_budget`, `fy25_actual`, `fy26_budget`, `fy27_proposed`,
  `change_dollars`, `change_pct`, and `parent_id` linking lines → departments →
  functions. `town-budget.html` already loads this exact file via client-side
  `fetch('data/town_budget_FY27.json')`; the explorer uses the same file.
- **Override restorations are already tagged by department** in the
  `meta.override_tiers` block (`category`, `description`, `tier_1/2/3`).
- **Per-department headcount IS available** in
  `data/town_employee_headcount_FY08-26.csv` (`FY, Department, Headcount`,
  FY2008-2026). This is **headcount, not FTE** (includes PT + seasonal) and MUST
  be labeled as such — FTE at department granularity is not published. Department
  names are ledger-style caps (`SELECTMEN`, `FINANCE DEPARTMENT`) and need a
  crosswalk to the 40 budget keys.
- **Per-department role descriptions already exist, cited**, in `_data/org_chart.yml`
  (`town` list, roles-only, sourced to marbleheadma.gov + the FY27 packet). These
  fill the profile's service/role line in v1 — it is NOT an empty slot. Deeper
  narrative service catalogs remain a follow-up. org_chart keys also need a
  crosswalk to the budget keys.
- **A department crosswalk is required.** The three sources key departments
  differently (budget `select_board` ↔ headcount `SELECTMEN` ↔ org_chart entry).
  The build script owns a single explicit crosswalk table mapping each of the 40
  budget department keys to its headcount name and org_chart entry. Where a
  budget department has no match, its profile renders money + line items +
  override only, omitting headcount/role rather than guessing.
- **The checkbook cannot be sliced by department.** `checkbook_FY26_summary.json`
  `by_division` is accounting object-codes (`UNDEFINED` $35.5M, `EXPENSES`,
  `SALARIES`, `GROUP INSURANCE`), not departments, and is FY26-only. **v1 does
  not attempt checkbook-per-department.** A profile may link to the checkbook
  page generally, but makes no false claim of departmental checkbook detail.
- **Only 3 budget years in the source JSON** (FY25 actual, FY26 budget, FY27
  proposed). Longer per-department *budget* history exists in the ACFR series
  (~FY15+) but requires extraction — a follow-up, out of scope for v1. (Headcount
  history, by contrast, spans FY08-26 and IS shown.)

## Relationship to `town-budget.html` (avoid duplication)

`town-budget.html` already renders the same budget file as a filterable,
sortable, function-first spreadsheet with function→department→line drill-down and
deep-linking. The explorer is deliberately **department-first**, not a second
budget table: you land on a department and see a *profile* (role, headcount
trend, budget, override restoration) rather than the whole general fund. The plan
MUST reuse the same data file and must NOT rebuild town-budget's filter/sort/
preset machinery. If the two ever feel redundant, they cross-link rather than
compete.

## Architecture

Three units, each independently understandable:

### 1. Build script — `data/build_departments_data.py`

- **Does:** joins `town_budget_FY27.json` + `town_employee_headcount_FY08-26.csv`
  + `_data/org_chart.yml` + the `override_tiers` block into one
  `data/departments_view.json`. Owns the department crosswalk table.
- **Depends on:** those inputs only. Deterministic; re-runnable.
- **Output shape:** `{ schema_version, source_note, functions: [ {key, label,
  fy27_proposed, change_pct} ], departments: { <dept_key>: { name, function,
  function_label, role (nullable string, from org_chart), role_source (nullable),
  budget: {fy25_actual, fy26_budget, fy27_proposed, change_dollars, change_pct},
  line_items: [ {description, fy25_actual, fy26_budget, fy27_proposed,
  change_dollars, change_pct} ], headcount: [ {fy, headcount} ] | null,
  overrides: [ {tier_1, tier_2, tier_3, description} ] } } }`.
- **`role`** carries the cited org_chart one-liner where the crosswalk matches;
  `null` otherwise (profile shows a "description forthcoming" line, never faked).
- **`headcount`** is the FY08-26 series where the crosswalk matches; `null`
  otherwise. Always labeled "headcount (incl. PT/seasonal)", never "FTE".
- Mirrors `build_town_budget_data.py` conventions. Test file
  `test_build_departments.py` asserts: all 40 budget departments present;
  line-item dollars sum to each department's budget total; every override tag
  maps to a real department key; crosswalk targets exist in their source files
  (no dangling headcount/org_chart references); headcount is labeled headcount
  not FTE.

### 2. Explorer page — `departments.html`

- `layout: page`. Loads `data/departments_view.json` client-side (same pattern as
  `checkbook.html`).
- **Index view (default, no hash):** 10 function groups; within each, department
  cards showing name + FY27 proposed + 3-yr change. Neutral semantic colors only.
- **Detail view (`#<dept_key>`):** renders the profile for one department (see
  below). Back link returns to index. Hash change re-renders without reload.
- Graceful fallback: unknown or missing hash → index; JSON load failure → a
  plain message, not a broken page.

### 3. Per-department profile (a render function, not a separate file)

Sections, each rendered only if it has data:

- **Header** — name, function, one-line role from org_chart (with its cited
  source); if `role` is null, a plain "fuller description forthcoming" line.
- **Money** — FY25 actual → FY26 budget → FY27 proposed, dollar + % change, in
  neutral colors. No green-good / red-bad.
- **Line items** — sub-rows, expandable/collapsible.
- **Headcount** — FY08-26 headcount trend where the crosswalk maps, explicitly
  labeled "headcount (includes PT/seasonal), not FTE". Omitted where unmapped.
- **Override impact** — "Tier 1/2/3 would restore $X here," shown only for the
  departments that have tagged restorations.

## Editorial guardrails (from CLAUDE.md / STYLE_GUIDE)

- Neutral semantic colors on every comparison; never green/red value judgments.
- No "value/waste/efficient/bloated" framing. This is a data page, not advocacy.
- Volatile-data caveats (FY23 FTE jump) shown where the number appears.
- Every budget figure traces to the source the input JSON already cites (FY27
  proposed budget / ACFR); service prose, when added, cites primary sources.
- No em-dashes in rendered site copy; no meta-narration ("this page shows...").

## Testing

- `test_build_departments.py` — build-script invariants (above).
- Extend `tests/smoke-test.mjs` — `departments.html` loads, index renders 40
  department cards across 10 groups, selecting a department shows its profile,
  the money numbers are present. Playwright screenshot of index + one profile to
  `proof/` for the PR.

## Explicitly out of scope for v1 (named so they aren't silently dropped)

- **Narrative** service catalogs (v1 ships the org_chart one-line role; a fuller
  cited description of what each department *does* is a follow-up).
- Per-department checkbook drill-down (data does not support it cleanly).
- Multi-year *budget* history beyond FY25-27 (ACFR extraction is a follow-up;
  headcount history FY08-26 IS shown).
- Per-department static URLs / OG cards (single-page JS routing chosen).

## Follow-ups (post-v1, tracked here so they aren't lost)

1. Author fuller cited service descriptions per department, beyond the org_chart
   role line.
2. Extract per-department ACFR *budget* history (~FY15+) to lengthen the trend.
3. Revisit checkbook→department categorization if the town's data improves.
