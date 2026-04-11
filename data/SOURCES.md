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

## Chart methodology

All lines normalized to 2000 = 100 (FY2000 for Marblehead levy) for direct visual comparison. Marblehead per-pupil line normalized at its first available year (FY2008) to its value *relative to where the other lines are at FY2008*, so the starting points align visually. Specifically: the per-pupil line is scaled so that its FY2008 value shows where Marblehead per-pupil would be indexed if we assumed it had tracked exactly with CPI from 2000-2008. This is labeled explicitly on the chart to avoid confusion.

(Alternative: show raw index starting at 100 in FY2008, which would visually under-state per-pupil growth relative to the other 2000-indexed lines. The chosen approach is more directly comparable but requires a note.)
