# Town Explorer: School Share Column

## Goal

Add a "School share" metric to `charts/town_explorer.html` — the share of each
town's general-fund spending that goes to schools. Surfaces a useful
cross-town benchmark (Marblehead 45.8%) and lets the user filter / rank
the 351 towns by it.

## What the metric is

`education_pct_of_gf` from `data/dor_all_351_FY26.csv`, defined as:

```
education_pct_of_gf = education_spending / total_general_fund_expenditures × 100
```

Both numerator and denominator come from DOR DLS Schedule A. The Schedule A
"Education" line is the operating school budget — it does NOT include
benefits, OPEB, or pension costs attributable to school employees, which sit
under "Fixed Costs". Same convention applies to every town in the comparison,
so the cross-town ranking is fair, but residents who hear "schools are 70% of
the budget" elsewhere will see a lower number here. The explainer text
addresses this directly.

## Source data

- File: `data/dor_all_351_FY26.csv`
- Field: `education_pct_of_gf`
- FY: filename says FY26, but the Schedule A spending figures inside reflect
  the most recent year filed at scrape time (currently FY24 for most towns).
  Explainer copy says "Schedule A, most recent year filed" — does not commit
  to a specific FY.
- Marblehead value: 45.8% (sanity check)
- All-351 distribution: spans roughly 20% (small towns where regional school
  district assessments hide schools under "Intergov Assessments") up to 70%+
  (independent K–12 districts with no regional split).

## Changes to `charts/town_explorer.html`

Single-file change. Five touchpoints:

1. **Inline `DATA` array (line ~447)** — add an `esh` field (education share)
   per town, populated from `education_pct_of_gf`. Numeric, 1 decimal place.
2. **Sort bar (`<div class="sort-bar">`)** — add a primary `<button>` between
   `Tax per person` and `New construction`:
   ```html
   <button type="button" class="sort-btn" data-sort="esh">School share</button>
   ```
3. **Table `<thead>`** — add a column header in the same position:
   ```html
   <th data-col="esh" title="Schools' share of general-fund spending. DOR Schedule A.">School share <span class="sa"></span></th>
   ```
4. **`renderRow()` function** — render the cell:
   ```js
   '<td>' + fP(t.esh) + '</td>' +
   ```
   placed in the same column position as the header.
5. **`COL_EXPLAINERS` map** — add an entry:
   ```js
   esh: 'Education spending as a share of total general-fund spending. Source: DOR Schedule A, most recent year filed. Excludes benefits, OPEB, and pension costs (those sit under "Fixed Costs"); same convention applies to all 351 towns.',
   ```

## Sort behavior

- Default direction: ascending (memory: `feedback_chart_direction`, bars
  always climb).
- No entry in `DESC_DEFAULT`.
- Filter: not added to the filter bar in this change. Sort + bar chart
  visualization is enough for v1; if a "show me towns above X% schools"
  filter proves valuable later, add it then.

## Bar chart

The existing `bar-chart` rendering reads from the active sort column.
`esh` will work without changes — values are 0–100, same shape as `bpi`,
`rpct`, `ng`, `opr`, all of which already render correctly.

## Mechanics: augmenting the inline `DATA` array

The 351-row JSON array is inlined as a single line in the HTML. The previous
column additions (#648, 411a40d) appear to have been hand-merged; reproducing
the full literal from source CSVs would require joining multiple files
(DOR 351 + override history + debt exclusions) and is out of scope here.

Approach: a one-shot Python script (`scripts/add_school_share_to_explorer.py`)
that:

1. Reads `data/dor_all_351_FY26.csv` into a dict `{municipality: education_pct_of_gf}`.
2. Reads `charts/town_explorer.html`, locates the `var DATA = [...]` line.
3. Parses the JSON array, adds `"esh": <value>` to every row by name match.
4. Writes the file back with the augmented array (same single-line format).
5. Logs any town in the CSV not found in `DATA` (or vice versa) for review.

The script is committed alongside the change so the same approach works for
future column additions, but is not wired into a build pipeline — it's a
manual, one-shot tool. The HTML's `DATA` array remains the source of truth
for the explorer; the script is just a safe way to edit it.

If 351 town names match cleanly between the CSV and the existing array
(expected, since the CSV is what built the array originally), no manual
reconciliation is needed.

## Verification

- Build locally with `npm run dev`, load `/charts/town_explorer.html`,
  click the new "School share" sort button, confirm:
  - Bars render ascending left-to-right (low-school towns first).
  - Marblehead's row shows 45.8%.
  - Header column shows the ▲ indicator when sorted.
  - Hovering a bar shows the value in the tooltip.
- Run `npm run test:local` — the smoke test should still pass; this change
  doesn't alter routing or markup the test relies on.
- Capture a Playwright screenshot for the PR proof.

## Out of scope

- Adding "School share" to the filter bar.
- Adding a "schools-heavy towns" cohort preset.
- Showing absolute education spending dollars (only the percentage).
- Backfilling the metric onto other charts (`/charts/per_capita_levy.html`,
  `/charts/rate_value_schools.html`).
- Changing what FY the Schedule A data represents (out of scope; that's a
  separate scrape/refresh task).
