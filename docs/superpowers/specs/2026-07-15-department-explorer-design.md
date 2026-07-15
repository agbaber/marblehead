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
  functions.
- **Override restorations are already tagged by department** in the
  `meta.override_tiers` block (`category`, `description`, `tier_1/2/3`).
- **Headcount** is available in `data/fte_employees_FY01-24.csv` but keyed by its
  own labels — needs a mapping to the 40 department keys; where no clean mapping
  exists, the profile omits the headcount block rather than guessing.
- **The checkbook cannot be sliced by department.** `checkbook_FY26_summary.json`
  `by_division` is accounting object-codes (`UNDEFINED` $35.5M, `EXPENSES`,
  `SALARIES`, `GROUP INSURANCE`), not departments, and is FY26-only. **v1 does
  not attempt checkbook-per-department.** A profile may link to the checkbook
  page generally, but makes no false claim of departmental checkbook detail.
- **Only 3 budget years in the source JSON** (FY25 actual, FY26 budget, FY27
  proposed). Longer per-department history exists in the ACFR series (~FY15+) but
  requires extraction — a follow-up, explicitly out of scope for v1.

## Architecture

Three units, each independently understandable:

### 1. Build script — `data/build_departments_data.py`

- **Does:** joins `town_budget_FY27.json` + `fte_employees_FY01-24.csv` +
  `override_tiers` into one `data/departments_view.json`.
- **Depends on:** those three inputs only. Deterministic; re-runnable.
- **Output shape:** `{ schema_version, source_note, functions: [...],
  departments: { <dept_key>: { name, function, function_label, role (nullable),
  budget: {fy25_actual, fy26_budget, fy27_proposed, change_dollars, change_pct},
  line_items: [ {description, fy25_actual, fy26_budget, fy27_proposed,
  change_dollars, change_pct} ], headcount: [ {fy, fte} ] | null,
  overrides: [ {tier_1, tier_2, tier_3, description} ], services: null } } }`.
- **`services: null`** is the deliberate empty slot for authored, cited prose
  added later. v1 never fabricates it.
- Mirrors the existing `build_town_budget_data.py` conventions and gets a test
  file alongside it (`test_build_departments.py`) asserting: all 40 departments
  present, line-item dollars sum to the department total, override tags map to
  real department keys.

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

- **Header** — name, function, one-line role (role omitted if null).
- **Money** — FY25 actual → FY26 budget → FY27 proposed, dollar + % change, in
  neutral colors. No green-good / red-bad.
- **Line items** — sub-rows, expandable/collapsible.
- **Headcount** — FTE trend where mapped; the FY23 FTE reporting-error caveat is
  surfaced inline wherever FY23 appears (per repo guidance / existing site
  treatment). Omitted entirely where no clean FTE mapping exists.
- **Override impact** — "Tier 1/2/3 would restore $X here," shown only for the
  departments that have tagged restorations.
- **Services** — a clearly-labeled placeholder section stating a plain-language
  description is forthcoming; renders nothing misleading when `services` is null.

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

- Authored service descriptions (the `services` slot ships null).
- Per-department checkbook drill-down (data does not support it cleanly).
- Multi-year budget history beyond FY25-27 (ACFR extraction is a follow-up).
- Per-department static URLs / OG cards (single-page JS routing chosen).

## Follow-ups (post-v1, tracked here so they aren't lost)

1. Author cited service descriptions per department, filling the `services` slot.
2. Extract per-department ACFR history (~FY15+) to lengthen the trend.
3. Revisit checkbook→department categorization if the town's data improves.
