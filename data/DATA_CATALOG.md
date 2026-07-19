---
layout: page
body_class: doc-page
title: DATA CATALOG
---

# Marblehead Budget Data Catalog

All data compiled April 2026 from primary public sources. Every number is either audited (ACFR), published by a state agency (DOR, GIC, PERAC), or from official town budget documents (FinCom reports, proposed budgets).

## Master Data File

`MASTER_DATA.csv` contains all verified time-series data in one file, one row per fiscal year (FY2001-FY2027). Empty cells mean data is not available for that year, NOT that the value is zero.

## Data Fields and Sources

### Tax Levy (24 data points, FY01-FY24)
- **What it is:** Total property taxes collected by the town
- **Source:** ACFR "Property Tax Levies and Collections" table (FY01-FY10 from FY10 ACFR, FY05-FY14 from FY14 ACFR, FY15-FY24 from FY24 ACFR)
- **Confidence:** High. Audited.

### Tax Rate (24 data points, FY03-FY26)
- **What it is:** Residential property tax rate per $1,000 assessed value
- **Source:** MA Department of Revenue, Division of Local Services, "Tax Rates by Class" report. Downloaded as Excel.
- **File:** `DOR_Marblehead_tax_rates_FY03-26.xlsx`
- **Also available for:** Swampscott, Melrose, Stoneham (separate files)
- **Confidence:** High. Official state data.

### Total FTE (24 data points, FY01-FY24)
- **What it is:** Full-time equivalent employees across all town departments. Part-time employees counted as fractions (e.g., 20 hrs/wk = 0.5 FTE).
- **Source:** ACFR Statistical Section, "Full-time Equivalent Town Employees by Function"
- **Caveat:** FY23 jumped +40.5 total town <abbr class="g" title="Full-Time Equivalent">FTE</abbr> (668.50 to 709.00); education gained +54.31, other functions dropped. Not real hiring: General Fund salaries grew 2.6% the same year, nowhere near what 54 new positions would have cost. The FY23 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> also rounded its values and restructured the schedule. The Town's payroll roster (released via PRR April 2026, see `town_employee_headcount_FY08-26.csv`) shows school-side headcount went from 705 in FY22 to 699 in FY23, a decline of 6 &ndash; ruling out actual hiring as the source of the +54.31 jump. Likely a reporting change involving funding-source recategorization (Circuit Breaker spending tripled FY22 to FY23). Full breakdown at `inside-school-staffing.html#the-fy23-mystery`.
- **Confidence:** High for trend; high that FY23 jump is a reporting change, not real hiring.

### Education FTE (24 data points, FY01-FY24)
- **What it is:** Education department FTE only (teachers, paraprofessionals, administrators, custodial, all school staff)
- **Source:** Same ACFR table as Total FTE, education row only
- **Confidence:** Same caveats as Total FTE

### Population (24 data points, FY01-FY24)
- **What it is:** Census-based population estimate
- **Source:** ACFR "Demographic and Economic Statistics" table
- **Confidence:** Medium. Census estimates between decennial counts.

### School Enrollment (24 data points, FY01-FY24)
- **What it is:** Total students enrolled in Marblehead Public Schools
- **Source:** ACFR "Demographic and Economic Statistics" table
- **Caveat:** May include or exclude charter school students depending on year. FY26 DESE data shows 2,389 district + 226 charter = 2,615.
- **Confidence:** Medium-high.

### Group Insurance (21 data points, FY06-FY27)
- **What it is:** Total health insurance spending (Line 221 in the town budget). Includes active employee health insurance, Medicare supplement (Medex), and Medicare reimbursement for all town AND school employees.
- **Source:** ACFR budget schedules (FY06-FY13), Finance Committee reports (FY14-FY25), FY27 Proposed Budget (FY26-FY27)
- **Caveat:** FY20 not available. FY26-FY27 are proposed/budgeted, not actual. FY24-FY25 actuals came in below budget (favorable claims).
- **Confidence:** High for actuals, medium for proposed years.

### Pension Expenditure (24 data points, FY01-FY24)
- **What it is:** "Pension benefits" line from ACFR Changes in Fund Balances
- **Source:** ACFRs
- **Caveat:** VERY volatile year to year (swings of 30%+) due to GASB accounting methodology changes, not actual cost changes. Do not treat single-year changes as meaningful. The FY26 budget line "Contributory Retirement" ($5,380,625) is a different, more stable measure.
- **Confidence:** High for the numbers themselves, but misleading as a trend line.

### OPEB Active Members (8 data points, FY11-FY24)
- **What it is:** Active employees enrolled in the health insurance plan. Counts every benefits-eligible employee (20+ hrs/wk) as 1, regardless of hours worked.
- **Source:** ACFR Other Postemployment Benefits actuarial notes
- **Caveat:** Only 8 data points because actuarial valuations are done every 2 years. Range: 642-748. Bouncy. Does NOT equal FTE (a 20-hr employee is 0.5 FTE but 1 OPEB member). FY13 spike (748) may be GIC transition artifact.
- **Confidence:** Medium. Small sample, volatile, different measurement than FTE.

### OPEB Retired Members (7 data points, FY12-FY24)
- **What it is:** Retirees and survivors receiving health insurance benefits
- **Source:** Same ACFR OPEB notes
- **Caveat:** FY24 jumped from 515 to 731. Likely terminology change ("inactive receiving benefits" vs "retired members and beneficiaries" which may include dependents). Do not assume 216 new retirees joined in 2 years.
- **Confidence:** Low-medium due to terminology inconsistency.

### GIC Premium - Family Plan (6 data points, FY19-FY26)
- **What it is:** Full annual cost of one Harvard Pilgrim family health insurance plan through the GIC (before the 83%/17% employer/employee split)
- **Source:** GIC published rate sheets. FY19 from Wayback Machine archive. FY20 derived from state employee rate sheet. FY23-FY26 from mass.gov.
- **Caveat:** Plan name changed from "Independence Plan" (FY19-FY23) to "Access America" (FY24+). FY20 is derived from state rates, not municipal. FY21-FY22 rate sheets not publicly available.
- **Confidence:** High for FY23-FY26. Medium for FY19-FY20.

### PERAC Active/Retired Members (2 data points, FY22 and FY24)
- **What it is:** Members of the Marblehead Contributory Retirement System (pension, NOT health insurance)
- **Source:** PERAC Actuarial Valuation Report, January 1, 2024
- **Caveat:** Only 2 data points. This is pension membership, a DIFFERENT population than health insurance membership.
- **Confidence:** High. Audited actuarial report.

### Total Revenue (10 data points, FY15-FY24)
- **What it is:** Total governmental fund revenue: Property Taxes + Excise Taxes + Intergovernmental + Charges for Services
- **Source:** Computed from `revenues_FY15-24.csv` (sum of the four columns), which in turn comes from ACFR Changes in Fund Balances
- **Caveat:** Excludes "other" revenue categories (licenses/permits, fines, investment income, contributions) to keep the definition consistent across years. FY20-FY21 intergovernmental is inflated by federal COVID aid.
- **Confidence:** High for the four underlying columns.

### Per Pupil Spending - Total (17 data points, FY08-FY24)
- **What it is:** Total per-pupil spending (in-district + out-of-district + transportation), one of the standard DESE metrics
- **Source:** `marblehead_per_pupil.csv` (DESE End-of-Year Report)
- **Confidence:** High. Official state data.

### Employee Benefits Total (20 data points, FY05-FY24)
- **What it is:** ACFR "Employee benefits" line from Changes in Fund Balances. Includes group health insurance, pension contributions, OPEB, workers comp, unemployment, Medicare, and other fringe benefits for all town and school employees.
- **Source:** `employee_benefits_FY05-24.csv`, from ACFRs
- **Caveat:** Broader than Group_Insurance alone. Overlaps with Group_Insurance and Pension_Expenditure - do NOT sum these three columns.
- **Confidence:** High. Audited.

### Free Cash - Certified and Appropriated (21 data points, FY04-FY24)
- **What it is:** Per fiscal year: certified free cash pool available at the start of that year, free cash appropriated into that year's operating budget, and the cushion left over.
- **File:** `marblehead_free_cash.csv`
- **Source:** Certified column from <abbr class="g" title="Department of Revenue">DOR</abbr> <abbr class="g" title="Division of Local Services">DLS</abbr> Gateway FreeCash2 report. Appropriated column from `general_fund_budgetary_FY15-24.csv`, which traces each value to its <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> original budget.
- **Coverage:** Certified series runs FY04-FY24 (21 years). Appropriated series runs FY15-FY24 (10 years); FY04-FY14 cells are intentionally blank.
- **Caveat:** Appropriated values FY15-FY19 reflect total budgeted fund balance use (slightly broader than pure operating free cash). FY20 onward is specifically operating draw per the post-FY20 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> schedule format. See per-row `notes` column.
- **Confidence:** High. State agency report (certified) and audited budget schedules (appropriated).

## Key Single-Year Data Points (not in MASTER_DATA.csv)

### FY26 Budget Detail
- **File:** `budgets/FY26_General_Fund_Budget.xlsx`
- Every line item, every position salary, for both town and school
- Town Grand Total: $57,086,093 / School Grand Total: $49,120,287

### FY27 Proposed Budget
- **File:** `budgets/FY27_Proposed_Budget_No_Override.pdf`
- FY25 actual, FY26 budget, FY27 proposed side by side for every department
- Key: Group Insurance $15,100,893 (FY26) to $16,754,748 (FY27), +11.0%
- Key: Pension $5,380,625 (FY26) to $5,843,360 (FY27), +8.6%

### State of the Town (January 2026)
- **File:** `2026_State_of_the_Town.pdf`
- Revenue projections: FY25 $99.6M, FY26 $103.3M, FY27 $101.0M (DECLINING)
- Expense projections: FY25 $94.1M, FY26 $103.3M, FY27 $109.5M (GROWING)
- FY27 deficit: $8,471,823
- Major cost drivers: HC +$1,951,708 (15%), pension +$462,735, trash +$844,575

### Average Single Family Tax Bill (4 towns)
- **File:** `DOR_AvgSingleFamTaxBill_4towns.xlsx`
- FY1988-FY2026 for Marblehead, Swampscott, Melrose, Stoneham
- FY26: Marblehead $11,055, Swampscott $11,478, Melrose $9,787, Stoneham $8,059

### GIC Premium Rate Sheets
- **Files:** `/tmp/gic_rates/FY19-FY26_rates.xlsx`
- Full premium tables by plan, individual vs family, full cost vs employee share

### Peer Teacher Compensation (8 towns, FY2024)
- **File:** `peer_teacher_compensation_FY24.csv`
- Average teacher salary, FTE count, total teacher salary expenditure, in-district and total per-pupil expenditure, and employer health insurance share for Marblehead, Hingham, Brookline, Wellesley, Winchester, Natick, Melrose, and Stoneham
- **Source:** DESE Teacher Salaries Report (school year 2023-24, updated Feb 2026) and DESE Per Pupil Expenditure Report (FY2024)
- **Confidence:** High. Official state data from district end-of-year financial reports.

### FY26 Vendor Payments (YTD snapshot)
- **File:** `open_finance_vendor_payments_FY26_snapshot_2026-04-17.csv`
- 1,965 vendors paid by the Town in FY26 through 2026-04-17, with cumulative dollars each. Ranges from $15.94M (Commonwealth of MA) down to $0.00 (vendors set up in the ledger but unpaid so far this year). Full total $84,709,576.43 matches the Open Finance dashboard headline. Top 5 vendors = 55% of spend; top 100 = 90.4%.
- **Source:** Town of Marblehead Open Finance portal (Tyler/Socrata), `townofmarblehead-ma-oe.spending.socrata.com/api/chart_data.json?child_entity=vendor&year=2026`. Fed from the Town's MUNIS ledger and updated at the end of each business day.
- **Caveats:**
  - Unaudited running totals, not ACFR figures. For historical or audited numbers, use the ACFRs instead.
  - Spans tax-funded and enterprise-fund spending together. Berkshire Wind Power ($11.80M, rank 2) is Municipal Light Department purchased power, self-funded by ratepayers, not the tax levy. Do not cite it as a tax-supported cost.
  - "Commonwealth of MA" ($15.94M, rank 1) aggregates unrelated state charges (MBTA assessment, charter school tuition, state retirement, etc.). The Cherry Sheet / FY27 Proposed Budget breaks these out line by line.
  - Only FY26 is available in the spending portal; earlier fiscal years return zero. For multi-year vendor trends, this file is insufficient.
  - Snapshot captured 2026-04-17 (FY26 Q3). A later snapshot would include year-end payments and reclassifications.
  - Superseded for ongoing analysis by `data/town_spending/` (refreshed daily by `.github/workflows/data-refresh.yml`). This dated file is kept as a fixed Q3 reference point.
- **Confidence:** High for vendor identities and dollar amounts at the snapshot instant. Low for year-end interpretation (8-10 weeks of FY26 still to post).

### Open Finance rollup (current fiscal year, daily, automated)
- **Files:** `town_spending/department_totals.csv`, `town_spending/vendor_totals.csv`, `town_spending/snapshot_meta.json`
- Year-to-date totals for the fiscal year in progress (FY27 since July 1, 2026), broken down by department and by vendor, refreshed daily at 10:00 UTC by `.github/workflows/data-refresh.yml`. Department sum equals vendor sum (built-in sanity check). Day-over-day diffs in the git log show which departments and vendors took new payments since the previous business day.
- **Source:** Same portal as the dated snapshot above (`townofmarblehead-ma-oe.spending.socrata.com/api/chart_data.json`). The `chart_data.json` endpoint only exposes current-FY rollups by a single dimension; date filters and parent/child drilldown are silently ignored. So this is an aggregate sidecar to the richer `checkbook_FY27_*.csv` transaction ledger below, not a replacement.
- **Caveats:** All the FY26 vendor-snapshot caveats above apply (Berkshire Wind, Commonwealth of MA, current-FY only). The "UNDEFINED" department bucket is the ledger's catch-all for payments not yet mapped to a department code at posting time; in FY26 it grew past $13M.
- **Confidence:** High for current-day totals. Day-to-day deltas are useful for "what got paid yesterday?" provenance, not for trend lines (no historical years available).

### FY27 Checkbook Ledger and Budget Portal Extracts (current, auto-refreshed)
- **What it is:** The transaction-level vendor-check ledger and budget-vs-actual extracts behind `/checkbook/` and `/monthly-pacing/`, for the fiscal year in progress.
- **Files:** `checkbook_FY27_<as-of>.csv` (dated by last covered payment; the 2026-07-01 snapshot has 49 rows, $7,490,746.48 paid), `budget_actual_FY27.json` (revised budget vs. actual by fund, department, category, division, and object), `monthly_burn_FY27.json` (cumulative monthly spend by fund), `budget_drill_FY27.json` (drill-down tree), `operating_budget_FY27.csv` (raw portal export), `checkbook_view.json` (current-FY choice-bucket rollup)
- **Source:** Spending portal checkbook export (`townofmarblehead-ma-oe.spending.socrata.com/api/checkbook_data.csv`) and Open Budget portal (`townofmarblehead-ma-ob.budget.socrata.com`), refreshed daily by `.github/workflows/checkbook-refresh.yml` and `.github/workflows/budget-refresh.yml` via `scripts/build_checkbook_csv.py`, `scripts/build_budget_actual.py`, and `scripts/build_monthly_burn.py`; `budget_drill_FY27.json` is rebuilt on demand by `scripts/crawl_budget_drill.py`. Endpoint details and the PII-redaction pass are in `SOURCE_LOOKUP.md`.
- **Caveats:**
  - Unaudited running ledger. Excludes payroll, inter-fund transfers, and intergovernmental remittances posted through the GL.
  - Early-FY27 portal load is partial: only the $129.7M annual operating envelope (Town and School general funds plus Water, Sewer, and Harbor enterprises) has posted. Capital and tax articles, grants, and revolving and trust funds have not. Do not cite an FY27 all-funds budget total until the portal finishes loading.
- **Confidence:** High for check-level amounts at the snapshot instant. Unaudited until the FY27 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr>.

### FY26 Checkbook Ledger and Budget Portal Extracts (archived)
- **What it is:** Year-end FY26 counterparts of the FY27 files above, frozen when the portals rolled to FY27 on July 1, 2026. No longer refreshed.
- **Files:** `checkbook_FY26_2026-06-30.csv` (16,804 rows, $107,185,588.25 paid 2025-07-01 through 2026-06-30), `budget_actual_FY26.json`, `monthly_burn_FY26.json`, `budget_drill_FY26.json`, `operating_budget_FY26.csv`, `checkbook_view_FY26.json` (frozen choice-bucket snapshot backing `/spending-by-vote/`)
- **Source:** Same portals and build scripts as the FY27 entry above; final pull covered payments through June 30, 2026.
- **Caveats:** FY26 figures remain subject to year-end close adjustments (late-posted invoices, reclassifications, audit entries) through fall 2026. The audited FY26 totals will be the FY26 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr>'s, not these.
- **Confidence:** High for check-level amounts as posted. Unaudited until the FY26 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr>.

### Auditor Management Letter Findings (6 fiscal years, FY18-FY23)
- **What it is:** Every internal-control comment in the Town's independent-auditor management letters, FY2018 through FY2023, as a finding-by-year matrix (23 rows). Each row records the finding, the year, its classification (current-year comment, prior-year comment, or material weakness), its status in that year's letter (Raised / Unresolved / Resolved / Ongoing / Carried), a one-line detail, and the source letter plus section/page. Tracks the cash-reconciliation material weakness from its FY2019 origin to its FY2023 resolution, plus accounts-receivable, OPEB-trust, internal-financial-statement, capital-asset, worker-comp, and payroll-withholding findings.
- **File:** `auditor_management_letter_findings_FY18-23.csv`
- **Source:** Management letters issued to the Select Board by the Town's outside auditor, FY2018-FY2023, published in the Town's Documents Center (uploaded May-June 2025). Raw <abbr class="g" title="Portable Document Format">PDF</abbr>s: `FY18_Management_Letter.pdf` through `FY23_Management_Letter.pdf` (gitignored; archived with the source set).
- **Caveats:**
  - The auditor's status labels apply only to **prior-year** comments. A current-year comment is "Raised"; its first Resolved/Unresolved verdict appears in the *following* year's letter. A material weakness that is current (FY18 SPED tuition, FY22 cash) is marked "Ongoing" until the next letter reports its status.
  - **FY24 is not included.** The Town has not published an FY2024 management letter; only the FY2024 <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> is posted. The FY24 audit was presented publicly to the Select Board on Oct 1, 2025, but that is a secondary source and is not in this file.
  - The cash-reconciliation material weakness is marked **Resolved in the FY2023 letter** (month-end checklist). Do not describe it as ongoing past FY2023 without the FY2024 primary letter.
- **Confidence:** High. Verbatim from the auditor's letters; statuses are the auditor's own.

### Town Payroll Headcount by Department (19 fiscal years, FY08-FY26)
- **What it is:** Annual headcount of every paid Town employee, by department, from the Town's payroll system. One row per employee (any pay frequency: annual, weekly, on-call, seasonal). Dept-level subtotals labeled "Number of Employees".
- **Source:** Public records request response, April 28, 2026 (<abbr class="g" title="Records Access Officer">RAO</abbr> Kyle A. Wiley). Raw file: `employee_count_FY2008-2026.xls`. Long-form <abbr class="g" title="Comma-Separated Values">CSV</abbr>: `town_employee_headcount_FY08-26.csv`. Schools/Town summary: `town_employee_headcount_summary_FY08-26.csv`.
- **Caveat:** Headcount, not <abbr class="g" title="Full-Time Equivalent">FTE</abbr>. A 0.1 FTE substitute counts as 1 employee. Year-over-year deltas are reliable because methodology is consistent. Use <abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr> FTE (with FY23 caveat) when an FTE-weighted figure is needed.
- **Confidence:** High. Direct payroll-system extract.

### <abbr class="g" title="Group Insurance Commission">GIC</abbr> Monthly Invoice History (13 fiscal years, FY14-FY26)
- **What it is:** Every monthly Group Insurance Commission invoice paid by the Town, with enrollment counts (active, retired, retiree dental, survivor, <abbr class="g" title="Consolidated Omnibus Budget Reconciliation Act">COBRA</abbr>) and dollar costs by category. FY26 partial (11 months).
- **Source:** Public records request response, April 28, 2026. Raw file: `gic_invoices_FY2014-2026.xlsx`. Monthly <abbr class="g" title="Comma-Separated Values">CSV</abbr>: `gic_monthly_invoices_FY14-26.csv`. Per-FY rollup: `gic_invoices_summary_FY14-26.csv`.
- **Caveat:** Total Amount Due is the full premium charged by <abbr class="g" title="Group Insurance Commission">GIC</abbr> (employer + employee share), not just the Town's own appropriation. Do not compare directly to the "Group Insurance" budget line, which is a different figure (Town's own share).
- **Confidence:** High. Direct invoice ledger.

### School-Age Population (10 data points, <abbr class="g" title="American Community Survey">ACS</abbr> end-years 2014-2023)
- **What it is:** Marblehead-resident kids ages 5-17, sum of male and female counts for ages 5-9, 10-14, 15-17 from <abbr class="g" title="American Community Survey">ACS</abbr> Table B01001.
- **Source:** US Census <abbr class="g" title="American Community Survey">ACS</abbr> 5-year estimates, table B01001, Marblehead town (county subdivision 38400).
- **File:** `acs_school_age_marblehead.csv`
- **Fetch script:** `scripts/fetch_acs_school_age.py`
- **Caveat:** Margin of error roughly &plusmn;400 on the 5-17 total; read trends, not exact counts. <abbr class="g" title="American Community Survey">ACS</abbr> includes 5-year-olds not yet enrolled in kindergarten, so this count runs higher than <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> school-attending counts.
- **Confidence:** Medium. Survey-based estimate.

### <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Enrollment by Reason (13 data points, SY 2014-2026)
- **What it is:** Marblehead district enrollment broken down by enrollment reason (Resident/Member, <abbr class="g" title="Metropolitan Council for Educational Opportunity">METCO</abbr>, Tuitioned-In variants, Foreign Exchange) crossed with town of residence.
- **Source:** <abbr class="g" title="Massachusetts">MA</abbr> <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Socrata dataset `8xyg-59b2`, "Reasons for Student Enrollment by Town (Receiving)". Filtered to `dist_code=01680000`.
- **File:** `dese_metco_nonresident.csv`
- **Fetch script:** `scripts/fetch_dese_selected_populations.py`
- **Categorization:** <abbr class="g" title="Marblehead Public Schools">MPS</abbr> resident = sum of rows with `town_name=Marblehead`. <abbr class="g" title="Metropolitan Council for Educational Opportunity">METCO</abbr> = sum of rows with `enr_reason=METCO`. Other non-resident = remainder.
- **Cross-check:** SY 2023-24 total matches the existing chart's hard-coded FY24 enrollment of 2,617 exactly.
- **Confidence:** High. Direct enumeration.

### <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> School-Attending Children (40 data points, SY 1985-2025)
- **What it is:** Where Marblehead-resident kids actually attend school: local public, regional academic, vocational, collaboratives, charter, out-of-district public, homeschool, in-state private, out-of-state private.
- **Source:** <abbr class="g" title="Massachusetts">MA</abbr> <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Socrata dataset `rdxw-mfv3`, "School Attending Children". Filtered to `town=Marblehead`.
- **File:** `dese_school_attending_marblehead.csv`
- **Fetch script:** `scripts/fetch_dese_school_attending_children.py`
- **Caveats:** SY 2020 missing from source. SY 2007 and SY 2008 have anomalous `total_cnt` values; for non-<abbr class="g" title="Marblehead Public Schools">MPS</abbr> calculations, sum the individual non-`loc_pub` category counts rather than subtracting from `total_cnt`.
- **Confidence:** High for individual category counts.

### Town Meeting Warrant Articles (348 articles, 7 meeting years)
- **What it is:** Every article (number and title) in the Annual Town Meeting warrant for meeting years 2016, 2019, 2021, 2022, 2023, 2025, and 2026.
- **Source:** Finance Committee Reports, which reprint the full warrant article by article. All source PDFs are in the `source-archive-v1` GitHub release; the 2026 list is cross-checkable against the 2026 Annual Town Meeting Warrant PDF in the same release.
- **File:** `town_meeting_warrant_articles.csv`
- **Provenance:** each row carries `source_doc`, `source_location`, and `extraction_method` columns.
- **Caveats:** First-pass extraction. Titles that wrap across two lines in the PDF may be truncated, and a few rows carry artifact titles (for example "-43" from a zoning bylaw section number). Meeting years 2017, 2018, 2020, and 2024 are gaps: no FinCom report for those years in the source archive yet. Years are Town Meeting calendar years, not fiscal years (the May 2026 meeting appropriates for FY27).
- **Confidence:** Medium-high for article numbers and core titles. Re-verify any individual title against the source PDF before quoting it.

### Town Meeting Results (398 articles, 2019-2025, 8 meetings)
- **What it is:** Every warrant article and its voted disposition for the Annual Town Meetings of 2019 through 2025 plus the October 17, 2020 Special Town Meeting. Counted Yes/No tallies where one was recorded (counted tallies for nearly every article from 2024 on via electronic keypad voting; a few omnibus or amended articles carry their tallies in notes instead).
- **Source:** Annual Town Reports (which reprint each warrant with a "Results of Annual Town Meeting" section) and official Town Meeting minutes PDFs on marbleheadma.gov. Per-row `source_doc` and `source_url` columns.
- **File:** `town_meeting_results.csv`
- **Dispositions:** `adopted`, `defeated`, `indefinitely_postponed`, `withdrawn`, `not_taken_up` (the last only for the COVID-trimmed June 29, 2020 session, which acted on Articles 7-31 and passed over the rest; most were re-warranted to the October STM).
- **Caveats:** Where an article was postponed or withdrawn by a counted motion (common in 2024-2025), the tally is on that motion, not the article; those rows say so in `notes`. 2025 Article 23 (3A overlay) was adopted 951-759 but overturned by the July 8, 2025 town-wide referendum; "adopted at Town Meeting" and "in effect" differ there. Dollar amounts are deliberately not transcribed here; take them from FinCom reports. Titles are normalized to ASCII (hyphens for the town's dashes). 2016 and 2026 dispositions are not yet included (2016 not gathered; 2026 results await the next Annual Town Report or posted minutes). Article counts here are authoritative where they differ from the first-pass `town_meeting_warrant_articles.csv` extraction (2025: 52 articles, not 54).
- **Confidence:** High for dispositions and tallies (read from official results sections); transcribed by research agents and spot-checkable against the linked PDFs.

### Warrant Article Series (generated)
- **What it is:** The recurring-article identity layer over `town_meeting_results.csv`: one row per article series (e.g. the omnibus operating budget, whatever its title that year), plus a normalized-title-to-slug map covering every observed title variant.
- **Files:** `article_series.csv`, `article_series_map.csv`
- **Generated by:** `node scripts/build_warrant_series.mjs` (deterministic; regenerate and commit after any change to `town_meeting_results.csv` or to the alias/kind maps in `scripts/warrant_lib.mjs`).
- **Caveats:** Rename merges (aliases) and kind assignments are curated code in `scripts/warrant_lib.mjs`, observed from the corpus, not invented. `budget_line` series (omnibus decomposed by department) are not yet generated.
- **Confidence:** Derived data; as good as the results CSV plus the alias map.

## What We Don't Have (identified gaps)

1. **<abbr class="g" title="Group Insurance Commission">GIC</abbr> premium rates FY12-FY18** - not publicly available online.
2. **Claims breakdown by category** - what's driving the 119% loss ratio. Would need <abbr class="g" title="Group Insurance Commission">GIC</abbr> or Hill Group consultant data.
3. **Peer town staffing comparisons** - need Melrose/Swampscott/Stoneham <abbr class="g" title="Full-Time Equivalent">FTE</abbr> data to validate "too many employees" claim.
4. **Grade-level enrollment breakdown from <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr>** - district totals are now in `dese_metco_nonresident.csv` and `dese_school_attending_marblehead.csv`, but per-grade counts are not yet pulled (available in <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Socrata dataset `t8td-gens`).
