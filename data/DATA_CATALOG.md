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
- **Confidence:** High for vendor identities and dollar amounts at the snapshot instant. Low for year-end interpretation (8-10 weeks of FY26 still to post).

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

## What We Don't Have (identified gaps)

1. **<abbr class="g" title="Group Insurance Commission">GIC</abbr> premium rates FY12-FY18** - not publicly available online.
2. **Claims breakdown by category** - what's driving the 119% loss ratio. Would need <abbr class="g" title="Group Insurance Commission">GIC</abbr> or Hill Group consultant data.
3. **Peer town staffing comparisons** - need Melrose/Swampscott/Stoneham <abbr class="g" title="Full-Time Equivalent">FTE</abbr> data to validate "too many employees" claim.
4. **Grade-level enrollment breakdown from <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr>** - district totals are now in `dese_metco_nonresident.csv` and `dese_school_attending_marblehead.csv`, but per-grade counts are not yet pulled (available in <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Socrata dataset `t8td-gens`).
