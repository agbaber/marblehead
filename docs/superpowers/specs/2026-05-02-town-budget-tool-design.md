# Town Budget Tool — Design

**Date:** 2026-05-02
**Author:** Andrew Baber, with Claude
**Status:** Approved (pre-implementation)

## Summary

Build an interactive, hierarchical line-item explorer for Marblehead's
town budget. Source of truth is the FY27 Proposed Budget book; ACFR
department-level history extends every department row back to FY15.
Tree-table UI with collapsible function → department → line-item
nesting, deep filtering, sorting, group-by toggles, and shareable URL
state. Lives at `/town-budget.html`. Surfaces the same data as the
existing narrative budget pages but lets residents drill, filter, and
sort instead of read.

## Goals

- Every line item in the FY27 proposed budget visible, drillable, and
  traceable to its source row in the budget book.
- Function-level rollups match the budget book's `VOTE TOTAL` lines
  exactly; sub-totals reconcile to the published $122.76M grand total.
- Department rows show 10+ years of ACFR-actual history; line rows
  show the 4 years the budget book provides.
- Filtering, sorting, group-by, column choice, and tree expansion all
  encode in URL state so any view is shareable.
- Mobile-usable: default 8-row collapsed view fits on a phone; filter
  bar collapses to a sheet.
- Every dollar traces to a primary source (budget book item number +
  page, or named ACFR with year).
- Editorial neutrality: no green-good / red-bad coloring, no advocacy
  framing in copy, all caveats surfaced where the number lives (per
  STYLE_GUIDE).

## Non-goals

- Vendor-level drill-in (the Open Finance snapshot is town-wide, not
  per-department; defer to a future phase if it earns its keep).
- Parsing historical budget books to backfill line-item-level history
  before FY25 (line items don't reliably match year-to-year; high
  effort for marginal payoff).
- Full school line-item parity with town departments (schools drill to
  cost-center level only — HS, MS, Brown, Glover, Village, District-Wide,
  Athletics, Sped Tuitions, OOD Transport).
- Any editorial overlay or commentary on what the numbers mean. The
  tool is a viewer; the narrative pages stay where they are.
- Light Enterprise operating-expense breakdown (not consolidated in
  the town budget book; out of scope).

## Decision log (locked during brainstorming)

1. **Data scope** = B: FY27 line-item book + ACFR history at department
   level back to FY15.
2. **UI pattern** = 3: tree-table hybrid with collapsible nesting and
   "expand all" toggle.
3. **Column model** = C: lean default, optional power-user columns,
   user choice persisted in URL.
4. **Schools depth** = B: drill to school department's published cost
   centers (HS, MS, Brown, Glover, Village, District-Wide, Athletics,
   Sped Tuition × 3, OOD Transport). Schools sits as top-level function
   peer to Public Safety.
5. **Filters/sort/group-by** = B (Default): function/dept/spend-type/
   direction/magnitude/GF-vs-Enterprise filters, six sort keys, three
   group-by options, top-N flatten mode.
6. **Page placement** = C: new top-level page at `/town-budget.html`
   plus a 5-row mini-table embedded into `where-has-the-money-gone.html`
   that links into the full tool.

## Data pipeline

### Source files

- `data/FY27_Proposed_Budget_No_Override.txt` — primary source for
  every line item (FY25 actual, FY25 budget, FY26 budget, FY27
  proposed, $ change, % change).
- `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt`
  — school cost-center breakdown.
- `data/general_fund_budgetary_FY15-24.csv` plus ACFR-derived
  department-actual histories — populates 10-yr trend at department
  level.
- `data/dept_aliases.yaml` (new, hand-curated) — maps name variants
  between budget book and ACFR ("Comm Dev & Planning Department" ↔
  "Community Development") so the join works.

### Parser

New script `data/build_town_budget_data.py`:

1. Parses the FY27 budget book text via anchored regex on the
   `ITEM | DESCRIPTION | FY25BUD | FY25EXP | FY26BUD | FY27PROP | $CHG | %CHG`
   pattern.
2. Detects function headers (`VOTE TOTAL ...`), department headers
   (lines that don't match the line-item shape), and the
   `TOTAL GENERAL FUND ACCOUNTS` / `TOTAL BUDGETS` rollups.
3. Parses the school packet for cost-center rows; tags each with
   `parent_function: schools` and `parent_dept: <school-name>`.
4. Reads the 10-yr ACFR department-actual CSVs; joins on slug-normalized
   department name (using `dept_aliases.yaml`); records gaps explicitly
   for departments that don't span the full window.
5. Classifies each line into a `spend_type` enum: `salaries | expense
   | officials_expense | benefits | debt | transfer | utility | other`.
   Description-prefix regex with explicit overrides for known weird
   lines.
6. Outputs `data/town_budget_FY27.json` (committed to git, no runtime
   parsing). Shape:

```json
{
  "meta": {
    "generated_at": "2026-05-02T...",
    "source_doc": "FY27 Proposed Budget — No Override",
    "source_pdf_url": "https://www.marbleheadma.gov/.../FY27_Proposed_Budget_No_Override.pdf",
    "total_general_fund": 109777938,
    "total_with_enterprise": 122762030
  },
  "rows": [
    {
      "id": "police",
      "level": "department",
      "parent_id": "public_safety",
      "function": "public_safety",
      "department": "police",
      "description": "Police Department",
      "spend_type": null,
      "fy25_actual": 4856174,
      "fy25_budget": 4879953,
      "fy26_budget": 4984687,
      "fy27_proposed": 5216914,
      "change_dollars": 232227,
      "change_pct": 0.0466,
      "history": {
        "fy15_actual": 3210000,
        "fy16_actual": null,
        "...": "...",
        "fy24_actual": 4711000
      },
      "cagr_10yr": 0.043,
      "source_ref": {
        "doc": "fy27_budget_book",
        "page": 12,
        "line_item": 62
      }
    }
  ]
}
```

7. Also outputs `data/town_budget_FY27_lookup.json` — small helper
   mapping function/department slugs to display names plus
   source-PDF deep links where available.

### Source treatment in the tool

- Every row, when expanded, shows a "Source" line: "FY27 Proposed
  Budget Book, Item #62, p. 12 (open PDF →)" — enforces the
  per-project rule "every number traces to a primary source" at the
  row level.
- ACFR history columns link to the relevant ACFR years
  (`data/acfrs/...` or canonical `marbleheadma.gov` archive URLs;
  blocked `wp-content` URLs are not used per
  `feedback_content_guardrails`).
- A page-level "Sources & methodology" section at the bottom
  enumerates every input file, the parser version, the date the
  data was generated, and any classification edge cases.

### Regeneration cadence

Manual. Triggered when a new budget book is published (fall and
spring). Script is idempotent. Output JSON committed to git.

## Page anatomy (`/town-budget.html`)

Top to bottom:

1. **Title & one-line frame**: "Marblehead's town budget, line by line."
   Subline: "Every line item in the FY27 proposed budget, grouped by
   function. Click any row to drill in. ACFR history goes back to FY15."
   No editorial framing.
2. **Anchor stats row** (4 tiles): GF total, +Enterprise total,
   $/% change vs FY26, biggest YoY mover. Each tile click-to-filter.
3. **Filter bar** — collapsed by default; click to expand.
4. **Tree-table** — main element.
5. **Sources & methodology**.
6. **Footer / cross-links** — to `where-has-the-money-gone.html` and
   `charts/town_explorer.html`.

### Tree-table — default (collapsed) state

Eight function rows visible:

| Function | FY27 | % vs FY26 | Sparkline (FY15→FY27) |
|---|---|---|---|
| ▸ General Government | $4.62M | -2.86% | sparkline |
| ▸ Public Safety | $11.86M | +5.55% | sparkline |
| ▸ Public Works & Facilities | $6.86M | +17.41% | sparkline |
| ▸ Human Services | $0.88M | -1.83% | sparkline |
| ▸ Schools | $47.62M | -3.05% | sparkline |
| ▸ Culture & Recreation | $1.87M | -26.31% | sparkline |
| ▸ Debt Service | $11.10M | +19.16% | sparkline |
| ▸ Other General Govt | $24.97M | +10.96% | sparkline |
| **TOTAL GENERAL FUND** | **$109.78M** | **+3.36%** | — |
| ▸ Sewer Enterprise | $4.80M | -13.25% | sparkline |
| ▸ Water Enterprise | $6.87M | +6.21% | sparkline |
| ▸ Harbor Enterprise | $1.32M | +3.34% | sparkline |
| ▸ Light Enterprise | (footnote: not consolidated in town book) | | |
| **TOTAL BUDGETS** | **$122.76M** | **+2.75%** | — |

### Tree-table — expanded state

- Click `▸ Public Safety` → reveals 5 (or however many) department
  rows, indented one level. Function row stays visible above its
  children.
- Click `▸ Police Department` → reveals its line items (Salaries,
  Expense, etc.), indented two levels. Line rows show no sparkline
  (no FY15 history at line level).
- Click any **leaf** row (line item) → opens an inline expandable
  panel with full numbers (FY25 actual, FY25 budget, $ change, FY25
  forecast variance), the source citation, and a "Show in context →"
  link.

### Visual hierarchy

- Function rows: bold, slightly larger, function-color left border
  (using existing series-color tokens).
- Department rows: regular weight, indent 24px, lighter left border.
- Line rows: smaller font, indent 48px, no left border.
- Subtotal rows: bold, top border, tinted background.
- Sparklines: inline SVG, no chart library.

### Expand/collapse controls

- Caret icon (`▸`/`▾`); click anywhere on the row toggles.
- "Expand all" / "Collapse all" button top-right of the table.
  Expand-all flattens into power-table mode with sticky group headers.
- Filter actions auto-expand parents containing matching children.
  Clearing a filter collapses filter-opened rows but preserves
  manually-opened ones.

### Empty / edge states

- No-match filter: empty-state with "Clear filters" link and active
  chip list.
- Department with line items missing in source: dept row shown with
  an "ⓘ this department's line items aren't broken out in the FY27
  book" tooltip.

### Mobile (<700px)

- Sparkline column hides; sparkline appears in expanded panel.
- % change shortens (`+5.9%`).
- Description column truncates with ellipsis; full text on tap.
- Filter bar collapses to "Filters (N)" sheet.
- Sticky table header.

## Filters, sort, group-by, columns

### Filter bar layout

```
[Filters (0)]   [Sort: FY27 amount ↓]   [Group by: Function ▾]   [Columns ▾]   [Reset]
```

Click "Filters (N)" → expands a `<details>` grid (matching Town
Explorer's pattern):

| Section | Control | Default |
|---|---|---|
| Function | Multi-select chips (8 GF + 4 enterprise) | All GF on, enterprise off |
| Department | Typeahead + chip list | Empty |
| Spend type | 7 chips | All on |
| Direction | 4 chips (Increased / Decreased / Flat / Cut) | All on |
| Magnitude | `% change > [__]` and `$ change > [__]` inputs | Empty |
| GF vs Enterprise | Two-state toggle | GF only |
| Search | Free-text input | Empty (live filter) |

Active filters show as chips below the bar; each has [×] to remove.

Filter semantics: filters intersect (`AND` across sections, `OR`
within a multi-chip section). Selecting `function=Public Safety` plus
`department=Police` shows only Police rows. The department typeahead
suggestions are scoped to the active function selection as a UX
helper, but selecting a department does not implicitly add its
function to the function filter.

### Sort

Single-select dropdown with direction toggle:

- FY27 amount (default desc)
- % change FY26→FY27
- $ change FY26→FY27
- 10-yr CAGR (department rows only; lines fall to bottom)
- Description (alpha)
- Forecast variance (FY25 actual − FY25 budget; nulls fall to bottom)

By default, sort happens *within* parents (steepest-rising line under
each department, not all rises across the table). A "Flatten on sort"
toggle disables the tree and gives a flat ranked list (auto-switches
to expand-all).

### Group-by

- **Function** (default — matches budget book)
- **Department** (flat list of departments)
- **Spend type** (all Salaries together, all Expense together — the
  "salary footprint" view)

Description text on each line preserves function/department context
when grouping changes.

### Columns dropdown (checkboxes)

- ☑ FY27 Proposed (locked on)
- ☑ % change FY26→FY27 (default on)
- ☐ $ change FY26→FY27
- ☐ FY26 Budget
- ☐ FY25 Budget
- ☐ FY25 Actual
- ☐ FY25 Forecast variance
- ☑ History sparkline (default on, dept+function rows only)

User selection persists in URL.

### URL state

All UI state encodes into search params via `history.replaceState`
(no scroll jump, no history pollution). Page-load hydrates from URL
on first paint.

| Param | Meaning |
|---|---|
| `fn` | Comma-list of function slugs filtered IN |
| `dept` | Comma-list of department slugs |
| `type` | Comma-list of spend types |
| `dirfilter` | Comma-list of direction values |
| `pct_min`, `dollar_min` | Magnitude thresholds |
| `gf` | `only` (default) or `all` |
| `q` | Search string (URL-encoded) |
| `sort` | Column slug |
| `dir` | `asc` or `desc` |
| `group` | `function` (default), `department`, `spend_type` |
| `cols` | Comma-list of column slugs (omit if default) |
| `expand` | Comma-list of currently-expanded row IDs |

Example URLs:

- `/town-budget.html` — default
- `/town-budget.html?fn=public_safety&expand=public_safety`
- `/town-budget.html?sort=pct_change&dir=desc&dirfilter=increased&pct_min=10`
- `/town-budget.html?group=spend_type&type=salaries`
- `/town-budget.html?cols=fy27,pct,delta_dollar,fy26&sort=delta_dollar`
- `/town-budget.html?q=insurance`

### Preset chips (above filter bar, max 5)

Each preset is just a saved URL; clicking sets the params.

- "Biggest 50 lines"
- "Cuts only"
- "Grew >10%"
- "Salary footprint"
- "Forecast misses >5%"

## Integration & navigation

### Header nav

Add "Town Budget" link → `/town-budget.html`.

### Explore landing (`browse.html`)

Add a Town Budget tile alongside existing tiles. Headline: "Every line
in the FY27 budget — sortable, filterable, drillable." Tile shows the
four anchor stats (GF total, +Enterprise total, FY26→FY27 change,
biggest mover).

### Embed on `where-has-the-money-gone.html`

A new section near the top, after intro paragraph, before the FY15→
FY26 area chart. Headline: "Or skip the essay — explore every line
item yourself." Body: 5-row mini-table of biggest YoY movers
(generated from the same JSON via a small `<script>`, not hand-written
— stays current as new budget books land). CTA: "See all 244 line
items in the Town Budget tool →" linking to the full tool.

Implementation: new `_includes/town-budget-mini.html` partial
included at the top of `where-has-the-money-gone.html`.

### Deep links from related pages

| Page | Link target |
|---|---|
| `charts/healthcare_costs.html` | `/town-budget.html?q=insurance&expand=other_general_government` |
| `charts/deficit_model.html` | `/town-budget.html?dirfilter=increased&pct_min=10` |
| `charts/override_calculator.html` | `/town-budget.html?fn=schools` |
| `senior-tax-relief.html` | `/town-budget.html?q=veterans` |
| `inside-school-staffing.html` | `/town-budget.html?fn=schools&group=department` |
| `question-2-trash.html` | `/town-budget.html?q=waste` |
| `whats-on-the-ballot.html` | `/town-budget.html` (general) |
| `the-debate.html` | left alone (steelmanned, no nudge) |

Small text links in context, not banners.

### Reverse links from the tool

- Page footer: "Read the FY15→FY26 narrative →" link to
  `where-has-the-money-gone.html`.
- Each function's expanded state: "Read more about [Function] →" link
  if a relevant page exists. Schools → `inside-school-staffing.html`.
  Don't fabricate links where no page exists.

### SEO

- Title: "Marblehead Town Budget — Every line in the FY27 budget"
- OG description: "Every line item in the $122.76M FY27 proposed
  budget. Filter, sort, drill into any department. Built from the
  FY27 budget book; ACFR history back to FY15."
- One H1; per-function H2 anchors (`#public-safety`, `#schools`, etc.)
  for indexable section deep-links.
- Sitemap: Jekyll auto-includes via page list.

## Build, test, ship

### File layout

```
/town-budget.html                                  # the page
/data/build_town_budget_data.py                    # parser
/data/town_budget_FY27.json                        # generated, committed
/data/town_budget_FY27_lookup.json                 # generated, committed
/data/dept_aliases.yaml                            # hand-curated
/_includes/town-budget-mini.html                   # narrative-page embed
/tests/town-budget-test.mjs                        # functional smoke
/data/test_build_town_budget.py                    # parser tests
```

`town-budget.html` follows the established convention: frontmatter +
inline `<style>` + inline `<script>`. Estimated 1,200–1,400 lines,
comparable to Town Explorer's 914.

### JS architecture

Vanilla, single-file IIFE. Top-level functions:

- `loadData()` — fetches `town_budget_FY27.json`, returns parsed data
  plus precomputed indices (slug → row, function → child rows).
- `parseURLState()` / `serializeURLState()` — bidirectional URL ↔
  state.
- `applyFilters(rows, state)` / `applySort(rows, state)` /
  `applyGroupBy(rows, state)` — pure functions.
- `renderTreeTable(rows, state)` — clears and rebuilds the table
  container; ~250 rows is small enough to skip diffing.
- `renderSparkline(history)` — returns inline SVG string.
- `attachListeners()` — single delegated click handler dispatching by
  `data-action` attributes.

Single state object; all renders derived from it.

### CSS

Page-scoped. Reuse `assets/site.css` design tokens (`--c-teal`,
`--surface`, `--text-muted`, `--series-*`, `--radius-md`,
`--shadow-sm`). New classes prefixed `.tb-`.

### Citations

Page added to `citations` script include in frontmatter.
`citations.js` injects an `<h2>Sources</h2>`; the static
"Sources & methodology" h2 stays separate to avoid duplication
(per `project_citations_h2_injection`).

### Tests

- **Smoke test**: add `/town-budget.html` to `tests/smoke-test.mjs`
  URL list. Existing 52→53 expected passes.
- **Functional test** (`tests/town-budget-test.mjs`):
  1. Default state shows 8 function rows + Total General Fund row.
  2. Click "Public Safety" caret → its dept rows appear under it.
  3. Click "Police Department" → its line items appear.
  4. Sort "% change desc" → top row's % change > second row's.
  5. URL filter `?dirfilter=decreased` → all visible rows are negative.
  6. Spend-type "Salaries" only → all visible line rows are salaries.
  7. "Expand all" → all line items visible.
  8. Deep link `/town-budget.html?fn=schools&dept=high_school` → that
     state reflects in UI.
  Run via `npm run test:budget`.
- **Parser test** (`data/test_build_town_budget.py`, pytest):
  1. Grand total row matches `$122,762,030`.
  2. Landmark slugs hit known values (police FY27 = $5,216,914,
     schools FY27 = $47,620,287, total_general_fund FY27 =
     $109,777,938).
  3. Each function row's children sum to its function total within
     $1.
  4. Every department in the FY27 book has a join target in
     `dept_aliases.yaml` (else fail with the unmatched name).
- **Lint**: existing `lint.yml` rules — no `marbleheadma.gov/wp-content`
  URLs, no per-line acronym wraps, no Liquid in new hrefs.

### Deploy & proof

- `bundle exec jekyll build` produces `_site/town-budget.html` and
  copies the JSON files to `_site/data/`.
- Cloudflare PR preview live within ~3 min of push.
- Proof of work for the eventual PR:
  - `proof/town-budget.png` — viewport 1440×900 × DPR 2, default state.
  - `proof/town-budget-expanded.png` — Public Safety expanded.
  - `proof/town-budget-mobile.png` — viewport 390×844, mobile collapsed
    filter bar.
- PR body links the Cloudflare preview URL with three test paths:
  default, `?fn=schools&group=department`,
  `?dirfilter=decreased&sort=delta_dollar`.

## Risks

1. **Parser brittleness** — FY27 text dump uses whitespace-delimited
   columns. Parser must tolerate variable spacing and edge cases
   (Light Enterprise has `Operating Expenditures` with no number).
   *Mitigation*: parser tests assert known landmark numbers; if a
   future budget book changes column widths, tests fail loudly.
2. **ACFR-to-budget department join** — names don't always match
   ("Comm Dev & Planning Department" vs "Community Development").
   *Mitigation*: hand-curated `dept_aliases.yaml`; parser warns on
   any unmatched dept; test fails if any FY27 dept lacks a join target.
3. **School packet format drift** — different layout from town book;
   future packets may restructure. *Mitigation*: schools parser is a
   separate function with its own test; failure falls back to
   one-lump display rather than breaking the whole tool.
4. **Tree-sort edge cases** — sorting within parents vs flattening
   across the whole tree. *Mitigation*: explicit `flatten_on_sort`
   toggle; both modes have tests.
5. **URL length** — power-user state could push URLs past Slack/
   Twitter preview limits. *Acceptable*: short for default-pre-filter,
   long for six-filter custom but still under 2KB.

## Open questions

None at brainstorming completion. Implementation plan will surface
any sub-decisions needed during build.
