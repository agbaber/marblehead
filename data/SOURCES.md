---
layout: page
body_class: doc-page
title: "Data File Methodology"
og_title: "Data File Methodology"
og_description: "Per-CSV methodology notes for Marblehead budget data files: how each number was compiled, why specific data sources were chosen, and the tradeoffs involved."
og_url: https://marbleheaddata.org/data/SOURCES.html
---

# Data File Methodology

Methodology notes for specific data files on marbleheaddata.org. Unlike the [Source Lookup](SOURCE_LOOKUP), which is organized by metric and traces each number to its primary document, this file is organized by CSV and explains *how* each dataset was compiled, *why* specific sources were chosen, and what the tradeoffs are. Use this to verify, challenge, or reproduce the data.

## `marblehead_levy.csv`: Marblehead property tax levy limit

**Source:** Massachusetts Department of Revenue, Division of Local Services (DLS), via Levy Limit reports filed annually by the Town of Marblehead (municipality code 168). Retrieved from the DLS Gateway at https://dlsgateway.dor.state.ma.us/ via the "Municipal Levy Limit" report.

**Coverage:** FY2000 through FY2027 (FY2026 and FY2027 are forward-looking budget-planning values, not yet finalized).

**What this number means:** This is the **Prop 2½ levy limit**, the maximum that can be raised from property taxes under the Prop 2½ statute. It is built year-over-year by compounding the prior year's limit by 2.5%, then adding new growth (from new construction) and any voter-approved overrides.

**What it does NOT include:** Debt exclusions (voter-approved borrowing for specific projects), capital expenditure exclusions, and stabilization fund overrides. Those bring the "Maximum Allowable Levy" higher. For example, for FY2024 Marblehead's levy limit was $71.4M but Maximum Allowable Levy (with $10.8M in debt exclusions) was $82.2M.

**Override years visible in the data:** FY2004 (+7.9% YoY), FY2005 (+5.4% YoY), and FY2006 (+12.0% YoY) are all meaningfully above the baseline ~3-4% annual growth, indicating voter-approved overrides in that period. No override has happened since FY2006; growth since has been steady at 3.0-3.9%/year (2.5% baseline + new growth).

**Methodology note:** Retrieved as 28 individual PDF reports from DLS Gateway. Each report shows the current and previous year's levy limit, allowing cross-verification between consecutive years. All values cross-validated with no discrepancies.

## `cpi_us.csv`: U.S. Consumer Price Index (CPI-U, All Items)

**Source:** U.S. Bureau of Labor Statistics, CPI-U All Urban Consumers, U.S. City Average, annual averages, base period 1982-84=100. Series ID: CUUR0000SA0.

**Coverage:** 2000 through 2024.

**Methodology note:** National CPI-U is used instead of the Boston-Cambridge-Newton metropolitan CPI because (a) national CPI is what the original chart and most public debate references, and (b) the two series track very closely (within ~2 percentage points cumulatively over 25 years). If comparing to the Boston metro CPI is preferred for a revision, the Boston series (CUURA103SA0) averaged slightly higher than national CPI over this period, meaning the gap between CPI and health/education costs would be modestly narrower, but the qualitative conclusion would be unchanged.

**Confidence:** High. These are canonical BLS published values.

## `health_premiums.csv`: Average Annual Family Health Insurance Premium

**Source:** Kaiser Family Foundation (KFF) Employer Health Benefits Annual Survey, "Average Annual Premiums for Single and Family Coverage" (Exhibit 1.1 in each annual report). Published annually at https://www.kff.org/health-costs/.

**Coverage:** 2000 through 2024.

**What this number means:** The total annual premium for employer-sponsored family coverage (employer + worker contributions combined). This is the "all-in" cost of health insurance for a family, regardless of who pays what share.

**Anchor values (directly verified from 2024 KFF report):**
- 2024: $25,572
- 2019: $19,569
- 2024 premium represents a 24% increase over 2019 (confirmed in report summary).

**Other years:** Compiled from annual KFF EHBS reports 2000–2023. Intermediate year values may be off by tens of dollars but the cumulative trajectory is accurate to within <1%. The key shape (roughly 5-7% annual growth from 2000 to ~2020, plateau in 2021-22, then 7% jumps in 2023-24) is well-documented in KFF summary commentary and cross-referenced against their cumulative growth statistics.

**Why this proxy:** KFF national employer family premium is used because (a) it is the longest consistent time series for employer-sponsored health insurance, (b) Marblehead town employees are covered by health insurance whose costs track broader employer insurance cost trends, and (c) there is no publicly available time series specifically for Marblehead's municipal health insurance costs. If anything, municipal plans (often GIC-based in Massachusetts) have tracked above the KFF national average in recent years, meaning this proxy is conservative.

## `marblehead_per_pupil.csv`: Marblehead per-pupil school spending

**Source:** Massachusetts Department of Elementary and Secondary Education (DESE) District Profiles, "Total Expenditure Per Pupil, All Funds, By Function" for Marblehead (district code 01680000). Retrieved from https://profiles.doe.mass.edu/profiles/finance.aspx?orgcode=01680000&orgtypecode=5&fycode={year}.

**Coverage:** FY2008 through FY2024. DESE's District Profiles system does not host consistent data prior to FY2008; this is why the school spending line on the chart starts at FY2008 rather than FY2000.

**What these numbers mean:**
- `in_district_per_pupil`: Expenditures on students educated within Marblehead's own schools, divided by in-district FTE enrollment.
- `total_per_pupil`: Includes out-of-district placements (special education, vocational, etc.). This is typically the headline figure.

**For the chart:** The `total_per_pupil` value is used (matches the headline number cited in state reports).

## `marblehead_prop25_votes.csv`: Marblehead Proposition 2½ ballot history

**Source:** Massachusetts Department of Revenue, Division of Local Services (DLS), Municipal Databank. Two reports combined:

- Operating override and underride votes: https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride (filtered to Marblehead, DOR municipality code 168)
- Debt exclusion votes: https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.debtexclusionvotes (filtered to Marblehead)

**Coverage:** All Marblehead ballot questions in the DOR record. Earliest vote date: June 19, 1982 (debt exclusion for sewer reconstruction). Latest vote date: June 30, 2025. Data pulled April 11, 2026.

**Row counts:**
- Operating overrides: 20 questions (6 WIN, 14 LOSS). The DOR operating-override record for Marblehead starts with the FY1991 ballot (vote date June 1, 1990); there are no pre-1990 operating override records.
- Debt exclusions: 50 questions (49 WIN, 1 LOSS). The single loss is the FY2003 Tucker's Wharf bond (vote date June 24, 2002).

**Schema:**
- `measure_type`: `Override` (operating override under MGL c. 59 s. 21C(g)) or `Debt Exclusion` (temporary exclusion for specific borrowing under MGL c. 59 s. 21C(k)).
- `fiscal_year`: Fiscal year of first collection, as assigned by DOR. For debt exclusions in particular, `fiscal_year` often lags `vote_date` by several years because borrowing may not begin immediately.
- `vote_date`: The date of the ballot vote (ISO format, yyyy-mm-dd).
- `win_loss`: `WIN` or `LOSS` at the ballot.
- `yes_votes`, `no_votes`: Raw vote totals.
- `department`: DOR's department classification. Casing differs between the two source reports (override report uses ALL CAPS, debt exclusion report uses Title Case); preserved as-is from source.
- `description`: DOR's description of the ballot question. Verbatim, including spelling errors.
- `amount`: Dollar amount of the override. Populated for operating overrides; blank for debt exclusions (DOR does not report dollar amounts in the debt exclusion table).

**Notes:**
- The FY2025 "Fix Clerk Error" row (vote date June 30, 2025) has 0 yes votes, 0 no votes, and $0 amount. This is a procedural/corrective record from DOR, not a substantive ballot attempt. Charts and narrative counts should consider whether to include or exclude it.
- The FY2005 ballot (vote date June 21, 2004) contained six distinct operating override line items: three won (school supplementals, library expenses, waste collection) and three lost (two police items, general operating). The "last successful operating override" commonly cited as "2005" refers to the calendar-year 2005 vote (June 15, 2005) that authorized the $2.73M FY2006 supplemental override. That is DOR's FY2006 record.
- "Since 1982" is supportable for debt exclusions (earliest DOR vote date 1982-06-19) but NOT for operating overrides (earliest DOR vote date 1990-06-01). Any "since 1982" framing should be scoped to debt exclusions or to "in the DOR ballot record."

## `peer_premium_splits.csv`: Massachusetts peer-town health insurance premium contribution splits

**Source:** Per-town primary rate sheets, collective bargaining memoranda, and published contribution schedules. Each town's specific URL is in the CSV's `source_url` column. Data pulled April 2026.

**Coverage:** Eight Massachusetts municipalities with firm primary-source data: Marblehead, Brookline, Stoneham, Melrose, Wellesley, Winchester, Natick, Hingham. The set intentionally spans the residential-dominant suburb peer group used elsewhere on the site (see `why-not-elsewhere.html`) plus Natick (West Suburban Health Group comparator) and Brookline (closest match to Marblehead's flat 83% structure).

**What `modal_town_pct` means:** The employer contribution percentage on the plan most representative of typical enrollment. For towns with **flat** structures (Marblehead, Hingham), the single percentage applies to every plan. For towns with **tiered** structures (Winchester, Wellesley, Natick, Brookline, Stoneham), the modal value is the percentage that applies to the benchmark or most-enrolled plan; exceptions with different percentages are listed in the `exceptions` column. The `structure` column describes how the split is organized.

**Methodology notes per town:**
- **Marblehead (83%):** The 83/17 split is set by the Public Employee Committee agreement under M.G.L. c.32B s.19. The agreement itself is not publicly posted. The 83% figure is documented in the Marblehead GIC Benefit Guide FY2026 context, the site's PEC glossary entry on `what-is-the-override.html`, and the caption of `charts/healthcare_costs.html`. It has also been referenced (without the exact percentage) in Marblehead Independent coverage including "Possible insurance break gives Marblehead budget outlook a lift" (Finance Committee Vice Chair Molly Teets asked about adjusting "the employer-employee premium split"). If a publicly-posted Marblehead rate sheet surfaces, this source should be upgraded.
- **Brookline (83%/65%):** Page 2 footer note on the FY26 Active Employee Rate Sheet reads: "Currently, the Town pays 83% of the premium and employees/retirees pay 17% of the premium, except for the Wellpoint Total Choice/Harvard Pilgrim Access America for which the Town pays 65% of the premium and the employee/retiree pays 35% of the premium."
- **Stoneham (80% modal):** Stoneham's rate sheet segments by hire date. Employees hired on or after July 1, 2009 pay 20% (town pays 80%) on most plans and 40% on Wellpoint Total Choice. Teachers and retirees who retired before July 1, 2009 pay 10% (town pays 90%) — a legacy tier. The 80% figure used in the comparison is the rate applicable to the current active workforce (post-2009 hires).
- **Melrose (~80%):** The precise percentage is not publicly posted. The Melrose Messenger's "FY26 Budget Approved" (June 2025) quotes Mayor Jennifer Grigoraitis saying the city is contractually required to pay "over 80%" of health insurance premiums. Listed as 80 in the CSV as a conservative floor; actual rate could be 80-85%.
- **Wellesley (78% BCBS benchmark):** Section 4a of the FY2026-2027 Memorandum of Agreement with Wellesley's unions specifies: 78% BCBS Benchmark, 60% Harvard Pilgrim HMO Benchmark, 50% Harvard Pilgrim PPO. Wellesley is a member of the West Suburban Health Group (WSHG), not the GIC. The BCBS benchmark rate is used as the modal percentage in the comparison because it applies to the largest plan enrollment.
- **Winchester (75% HMO modal):** FY26 rate sheet shows 75% town contribution on three HMO plans (Blue New England, Blue Select HMO family and individual+one) and 50% on Blue Care Elect PPO (family and individual). Three of four plan rows are 75%, one is 50%; modal is 75%. Winchester uses Blue Cross Blue Shield directly, not GIC or WSHG.
- **Natick (75% BCBS benchmark):** West Suburban Health Group FY26 Approved Monthly Rates. 75% on BCBS Network Blue NE and its HSAQ variants (four plans), 62% on Harvard Pilgrim EPO/HSAQ (two plans), 50% on HPHC PPO. Modal is 75% (BCBS benchmark). Note: Natick's FY24 rate sheet included Tufts plans; those appear dropped from FY26.
- **Hingham (50% flat):** Derived from the published employee-contribution schedule. Hingham's sheet reports employee contribution in multiple pay-schedule formats plus a COBRA rate. COBRA under federal law is the full premium plus 2% admin fee, so full premium = COBRA / 1.02. Across all eight plans on the sheet (HMO, PPO, POS, and indemnity), employee monthly contribution divided by derived full premium equals 50% to within rounding. This is an unusually low town share relative to other residential suburbs; worth confirming against a primary source that states the percentages directly if one becomes available.

**Confidence:** High for seven towns (Marblehead, Brookline, Stoneham, Wellesley, Winchester, Natick, Hingham) where primary rate sheets or collective bargaining agreements explicitly state the percentages or support derivation from total and employee amounts. Moderate for Melrose, where the percentage is known to be above 80% but no exact primary figure has been located.

**Gaps in peer coverage:** Arlington, Cohasset, Newton (active employees), and Swampscott were targeted but primary-source percentages could not be located via web search within reasonable effort. Cohasset's FY27 rate sheet publishes only the employee share, not the total premium, so the percentage cannot be derived. These should be added if the underlying sources are later located.

**Legal framework:** M.G.L. c.32B s.19 permits municipal employer contributions between 50% and 99%. The specific percentage is set by Public Employee Committee agreement, which all unions and retiree representatives must ratify. This is why percentages differ so widely across Massachusetts municipalities: each town's split reflects local collective bargaining history, not a statewide formula.

## Chart methodology

All lines normalized to 2000 = 100 (FY2000 for Marblehead levy) for direct visual comparison. Marblehead per-pupil line normalized at its first available year (FY2008) to its value *relative to where the other lines are at FY2008*, so the starting points align visually. Specifically: the per-pupil line is scaled so that its FY2008 value shows where Marblehead per-pupil would be indexed if we assumed it had tracked exactly with CPI from 2000-2008. This is labeled explicitly on the chart to avoid confusion.

(Alternative: show raw index starting at 100 in FY2008, which would visually under-state per-pupil growth relative to the other 2000-indexed lines. The chosen approach is more directly comparable but requires a note.)
