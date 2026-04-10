# Source Lookup: Where Every Number Comes From

Use this to trace any chart number back to its original document and page.

## Tax Levy ($30.2M in FY01 to $82.2M in FY24)
- FY01-FY10: FY10 ACFR page 121, "Property Tax Levies and Collections"
- FY05-FY14: FY14 ACFR page 117, same table
- FY15-FY24: FY24 ACFR page 129, same table
- Files: `data/acfr/FY10_ACFR.pdf`, `FY14_ACFR.pdf`, `FY24_ACFR.pdf`

## Tax Rate ($8.42 in FY03 to $8.56 in FY26)
- All years: MA DOR, Division of Local Services, "Tax Rates by Class" report
- File: `data/DOR_Marblehead_tax_rates_FY03-26.xlsx`
- Swampscott: `data/DOR_Swampscott_tax_rates_FY03-26.xlsx`
- Melrose/Stoneham: `data/DOR_Melrose_Stoneham_tax_rates_FY03-26.xlsx`

## Average Single Family Tax Bill ($11,055 in FY26)
- All years, all four towns: MA DOR "Average Single Family Tax Bill" report
- File: `data/DOR_AvgSingleFamTaxBill_4towns.xlsx`

## Total FTE (599.6 in FY01 to 706.0 in FY24)
- FY01-FY10: FY10 ACFR page 127, "Full-time Equivalent Town Employees by Function"
- FY05-FY14: FY14 ACFR page 123, same table
- FY15-FY24: FY24 ACFR page 136, same table
- Files: `data/acfr/FY10_ACFR.pdf`, `FY14_ACFR.pdf`, `FY24_ACFR.pdf`

## Education FTE (400.1 in FY01 to 537.0 in FY24)
- Same ACFR pages as Total FTE, "Education" row

## Population and School Enrollment
- FY01-FY10: FY10 ACFR page 125, "Demographic and Economic Statistics"
- FY05-FY14: FY14 ACFR page 121, same table
- FY15-FY24: FY24 ACFR page 134, same table

## Group Insurance Spending ($8.0M in FY06 to $16.8M in FY27)
- FY06: FY06 ACFR page 82, budget schedule, "Group Insurance" line
- FY07: FY07 ACFR page 84
- FY08: FY08 ACFR page 83
- FY09: FY09 ACFR page 85
- FY10: FY10 ACFR page 83
- FY11: FY11 ACFR page 83
- FY12: FY12 ACFR page 85
- FY13: FY13 ACFR page 85
- FY14-FY16: 2016 FinCom Report page 17, Line 221
- FY17-FY19: 2019 FinCom Report page 14, Line 221
- FY21-FY23: 2022 FinCom Report page 17, Line 221
- FY24-FY25: 2025 FinCom Report page 23, Line 221
- FY26-FY27: FY27 Proposed Budget page 4, Line 221
- Files: respective ACFRs in `data/acfr/`, FinCom reports in `data/`

## Pension Expenditure ($5.1M in FY01 to $12.5M in FY24)
- FY01-FY10: FY10 ACFR page 118, "Changes in Fund Balances," "Pension benefits" row
- FY05-FY14: FY14 ACFR page 114, same table
- FY15-FY24: FY24 ACFR page 126, same table
- CAUTION: This line is volatile due to GASB accounting changes. Not a clean trend.

## Pension Assessment - Budget Line ($5,380,625 in FY26)
- FY26: FY27 Proposed Budget page 4, Line 217 "Contributory Retirement Fund"
- FY27: Same document, $5,843,360
- File: `data/budgets/FY27_Proposed_Budget_No_Override.pdf`

## OPEB Insurance Membership (642-748 active, FY11-FY24)
- FY11: FY11 ACFR page 93
- FY12: FY12 ACFR page 95
- FY13: FY13 ACFR page 72 (also FY14 ACFR page 73)
- FY15: FY15 ACFR page 74 (also FY16 ACFR page 76)
- FY17: FY17 ACFR page 80 (also FY18 ACFR page 81)
- FY20: FY20 ACFR page 82
- FY22: FY22 ACFR page 81
- FY24: FY24 ACFR page 78

## GIC Premium Rates ($24,107 in FY19 to $38,562 in FY26)
- FY19: Wayback Machine archive of mass.gov GIC rate chart 1 (municipal active employee rates)
- FY20: Wayback Machine archive of mass.gov state employee rate sheet (derived from 20% employee share)
- FY23: mass.gov/doc/active-state-employee-rate-sheet/download
- FY24: mass.gov/doc/fy-24-active-employee-rate-chart/download
- FY25: mass.gov/doc/2025-monthly-insurance-rates-for-active-employee.../download
- FY26: mass.gov/doc/monthly-insurance-rates-for-active-employee.../download
- Plan: Harvard Pilgrim Independence Plan (FY19-FY23) / Access America (FY24-FY26), Family coverage, Full Cost column
- Files: `/tmp/gic_rates/` (not copied to project dir yet)

## PERAC Retirement System (358 active, 339 retired in FY24)
- File: `data/PERAC_Marblehead_Valuation_2024.pdf`, page 5 (Executive Summary) and page 14 (Section 8A)
- Funding schedule: same document, page 13

## FY26 Budget Line Items (every position and salary)
- File: `data/budgets/FY26_General_Fund_Budget.xlsx`
- Four sheets: TOWN BUDGET, SCHOOL BUDGET, TOWN PIVOT TABLE, SCHOOL PIVOT TABLE
- Key lookups:
  - Town Administrator salary: TOWN BUDGET, "SB-DEPT HEAD" = $207,732
  - Sustainability Coordinator: TOWN BUDGET, "PCD-SUSTAINABILITY COORD" = $79,445
  - Grant Coordinator: TOWN BUDGET, "PCD-GRANT COORDINATOR" = $79,064
  - Health Insurance Transfer: TOWN PIVOT TABLE, "HEALTH INS TSF" = $11,828,487
  - Pension: TOWN PIVOT TABLE, "CONTRIB RETIRE" = $5,380,625

## FY27 Deficit ($8,471,823)
- File: `data/2026_State_of_the_Town.pdf`, page 29
- Revenue $101,024,029 minus Expenses $109,495,852 = -$8,471,823

## Revenue and Expense Projections
- File: `data/2026_State_of_the_Town.pdf`, pages 13-29 (repeated on multiple slides)
- FY25 actual, FY26 projected, FY27 projected with line-by-line detail
- Also in: `data/state_of_town_financials.json` (structured data)

## Melrose/Stoneham Case Studies
- File: `data/case_studies.md`
- Sources listed within the document

## Override Tier Amounts and Tax Impact
- Source: Marblehead Independent, "Kezer presents $9M-to-$15M tiered override plan"
- Per-year impact on $1M home from Town Administrator's presentation:
  - Tier 1: Year 1 +$127, Year 2 +$503, Year 3 +$270 (cumulative $900/yr)
  - Tier 2: Year 1 +$281, Year 2 +$590, Year 3 +$329 (cumulative $1,200/yr)
  - Tier 3: Year 1 +$430, Year 2 +$624, Year 3 +$446 (cumulative $1,500/yr)
