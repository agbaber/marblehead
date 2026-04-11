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
- **Caveat:** FY23 jumped +40 FTE (669 to 709), almost entirely in education. Cause unconfirmed (possibly ESSER-funded positions or methodology change). FY22 ACFR used decimals, FY23 switched to round numbers.
- **Confidence:** High for trend. FY23 jump is suspicious.

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

## What We Don't Have (identified gaps)

1. **Annual total headcount (not FTE)** - only have FY25: 1,185 (from Marblehead Independent). Public records request filed.
2. **Annual GIC enrollment by Marblehead** - only 8 OPEB data points. Public records request filed.
3. **GIC premium rates FY12-FY18** - not publicly available online.
4. **Claims breakdown by category** - what's driving the 119% loss ratio. Would need GIC or Hill Group consultant data.
5. **Peer town staffing comparisons** - need Melrose/Swampscott/Stoneham FTE data to validate "too many employees" claim.
6. **School enrollment from DESE** - have it from ACFRs but DESE would have grade-level breakdown.
