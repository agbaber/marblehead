# Peer Town Deficit Curves: Research Status

**Goal:** Build deficit dynamics charts (revenue vs expense lines crossing)
for 14 peer towns, matching the Marblehead model at
`/charts/deficit_model.html`.

## What we have

- **Override vote history** for 14 towns is done and merged
  (`/charts/override_history.html`, PR #531).
- **Marblehead** general fund budgetary data (FY15-FY24) from ACFRs is in
  `data/general_fund_budgetary_FY15-24.csv`.

## What we need

Per-town general fund **total revenues** and **total expenditures** for
FY2002-FY2025 from the DOR DLS Schedule A reports.

## Data source

**DOR DLS Schedule A General Fund**
- URL: `https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN`
- Content loads in an iframe (`#subGenFund`) pointing to `ScheduleA.GeneralFund`
- The iframe has:
  - Municipality checkboxes (`input[name="iclMuni"]`) with 351 towns
  - Year checkboxes (`input[name="islYear"]`) for FY2002-FY2025
  - Revenue/Expenditure dropdown (`<select>`)
  - Submit button (image input)
- Data table ID: `xtGenFund`, paginated at 40 rows per page (~9 pages for all 351 towns)
- Columns (Revenue view): DOR Code, Municipality, Fiscal Year, Taxes,
  Service Charges, Licenses and Permits, Federal Revenue, State Revenue,
  Revenue from Other Governments, Special Assessments, Fines and
  Forfeitures, Miscellaneous, Other Financing Sources, Transfers,
  **Total Revenues**
- Expenditure view has similar structure with different categories and
  **Total Expenditures**

## Scraper status

`pull_schedule_a.mjs` is a working Playwright scraper that:
1. Navigates to the Schedule A page
2. Enters the iframe
3. Loops through each year, selecting it and submitting
4. Paginates through the `xtGenFund` table
5. Filters to 14 peer towns and saves CSV

**Known issue:** After the first form submission, pagination does not
properly reset to page 1 when the year changes. The `<<` reset click
was added but the second run was interrupted before completing.

### To fix and run

1. Run `node pull_schedule_a.mjs` and watch the output
2. Verify that each year gets ~351 rows (all towns) not ~32 (stuck on
   last page)
3. If pagination is still stuck, try reloading the full page URL for
   each year instead of just changing the year dropdown
4. Alternative: click the `<<` link, wait longer, then verify page 1
   is showing before scraping

### Peer towns (14)

Arlington, Brookline, Cohasset, Framingham, Hingham, Lexington,
Marblehead, Melrose, Natick, Needham, Stoneham, Swampscott, Wellesley,
Winchester

## Next steps after data is collected

1. Save as `data/peer_schedule_a_revenues.csv` and
   `data/peer_schedule_a_expenditures.csv`
2. Build combined `data/peer_gf_rev_exp_summary.csv` with columns:
   municipality, fiscal_year, total_revenues, total_expenditures
3. Add a new chart page (or extend `/charts/override_history.html`) with
   per-town deficit curves
4. Each town gets a small-multiple: revenue line vs expense line, with
   override votes marked as annotations
