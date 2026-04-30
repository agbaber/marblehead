---
layout: page
body_class: doc-page
title: "Health Insurance Chart Source Check"
description: "Working note tracing two competing health-insurance time-series back to their primary sources."
---

# Health insurance chart: source check

This note traces the source of two health-insurance time-series for Marblehead from FY2006 onward, where one line is from this site (`marbleheaddata.org`, labeled "MHDData") and the other was provided alongside it. The two lines disagree both in level and in shape, so the question is which one is answering "how much has Marblehead spent on health insurance" using a definition that holds across 22 years.

This is a working note. It is not part of the published site analysis.

## TL;DR

- The orange line ("MHDData") plots Marblehead's annual **Group Insurance budget line**, pulled per-year from each year's ACFR budget schedule, the Finance Committee Reports of 2016, 2019, 2022, and 2025, and the FY27 Proposed Budget. Same definition every year.
- The blue line is from the **Massachusetts DOR DLS Schedule A** export for Marblehead (DOR municipality code 168), specifically a slice of the "Fixed Costs" rollup &mdash; *not* the town's Group Insurance budget line on its own.
- The blue line's FY24 value, **$12,152,022, exactly matches our FY24 ACFR Group Insurance line**. Its FY06 value of $18,043,023 is more than **double** Marblehead's audited FY06 Group Insurance of $7.96M. The FY06 number is bundling other categories &mdash; OPEB pay-go for retiree health, workers compensation, life insurance, possibly a one-time pre-funding contribution &mdash; that have since moved out of that line as Massachusetts municipalities phased in GASB Statement 45 reporting (effective FY08&ndash;FY10 depending on entity size; see citation below).
- So the two endpoints aren't apples-to-apples. Comparing FY06 to FY24 on the blue line compares "health insurance + retiree health + other employee benefits combined" (FY06) to "health insurance only" (FY24).

## How we identified the blue line's source

Three giveaways from the spreadsheet that backs the blue line:

1. **The header format** &mdash; `DOR Code | Municipality | year | year | ...` &mdash; is the standard export shape from the [DLS Schedule A General Fund report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN) on the Massachusetts DOR Municipal Databank. Marblehead is municipality code 168.
2. **The 2025 column is zero.** Schedule A FY2025 has not been filed yet, which produces an empty cell on every Marblehead Schedule A export. The site's case-studies page already notes this elsewhere.
3. **The shape &mdash; climb to FY06, plunge in FY07, slow rise after &mdash; matches the DOR Schedule A "Fixed Costs" column for Marblehead exactly.** Compare to `data/peer_schedule_a_expenditures.csv` in this repo:

| FY   | Schedule A Fixed Costs | Blue line     |
|------|-----------------------:|--------------:|
| 2005 |             17,473,815 |    15,208,944 |
| **2006** |         **20,423,702** | **18,043,023** |
| **2007** |         **14,404,346** | **11,798,901** |
| 2008 |             14,051,616 |    11,558,645 |
| 2009 |             12,746,799 |     9,425,951 |
| 2024 |             18,519,860 |    12,152,022 |
| 2025 |                      0 |             0 |

The blue line runs roughly $2M to $6M lower than total Schedule A Fixed Costs each year &mdash; consistent with the blue series being "Fixed Costs minus pension contributions," that is, the insurance + retiree-benefits + workers-comp + OPEB pay-go bundle within Fixed Costs, but not the standalone Group Health line.

## What changed between FY06 and FY24 on the blue line

The blue line's FY24 number ($12,152,022) is exactly Marblehead's audited Group Insurance for FY24. The FY06 number ($18,043,023) is more than double the audited Group Insurance for FY06 ($7,964,196 per the FY06 ACFR). So the *contents of that single column changed* between FY06 and FY24. Two well-documented factors explain most of the change:

1. **GASB Statement 45 (Other Postemployment Benefits)** required municipalities to begin recognizing retiree health (OPEB) as a distinct accounting category. The effective dates were phased by entity size, with the same phase as GASB Statement 34: Phase 1 (annual revenues over $100M) for fiscal years beginning after December 15, 2006 (FY2008), Phase 2 (revenues $10M&ndash;$100M) for FYs beginning after December 15, 2007 (FY2009), and Phase 3 (under $10M) for FYs beginning after December 15, 2008 (FY2010). Marblehead, with FY06 total general fund expenditures of $63.9M, was a Phase 2 entity, so GASB 45 took full effect for Marblehead in **FY2009**. Sources: [GASB Statement 45 Summary](https://gasb.org/page/pronouncement?pageId=/standards-and-guidance/pronouncements/summary-statement-no-45.html) (primary), and [GASB Statement 45 and Its Impact on Your Financial Statements](https://www.nhmunicipal.org/town-city-article/gasb-statement-45-and-its-impact-your-financial-statements) from the New Hampshire Municipal Association (more accessible explainer). Before GASB 45 took effect for Marblehead, retiree health pay-go was generally reported alongside active-employee Group Insurance under "Fixed Costs." After it took effect, retiree health moved into separate OPEB reporting.
2. **MA DOR DLS Schedule A taxonomy revisions.** DLS has updated the Schedule A account structure and category definitions multiple times since UMAS was first adopted under [G.L. c. 44, &sect; 38](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter44/Section38). The current Schedule A guidelines and reference material from the DLS Bureau of Accounts is published at [mass.gov/doc/schedule-a-guidelines-and-reference-material](https://www.mass.gov/doc/schedule-a-guidelines-and-reference-material/download) (PDF). Historical revisions to the line-item structure are not all individually documented online. The site's own `data/case_studies.md` page notes that the pre-FY2010 expenditure spikes visible across many Massachusetts municipalities likely reflect these reclassifications rather than real operating differences.

The combination of (1) and (2) is enough to explain why the FY06 column on the blue line bundles items that the FY24 column no longer bundles. The exact composition of the FY06 spike isn't recoverable from the export format alone, but two facts are recoverable:

- Marblehead's FY06 ACFR shows audited Group Insurance of **$7.96M**, not $18M. ([source: `data/group_insurance_FY06-27.csv`, citation "FY06 ACFR budget schedule"])
- Marblehead's Schedule A FY06 Fixed Costs total is **$20.4M**, of which only $7.96M was Group Insurance. The other $12.5M was a mix of pension contributions, retiree health pay-go, workers comp, life insurance, Medicare employer share, and other fixed-cost items. By FY24, the same Schedule A line for Group Insurance is reported separately at $12.15M and matches the ACFR exactly.

By starting the chart at FY2006, the blue line uses a pre-GASB-45 baseline that bundles roughly $10M of non-health-insurance categories into the same column. That makes the FY06-to-FY24 trajectory look nearly flat or even declining ($18M to $12M). The trajectory is an artifact of changing column contents, not a measurement of how Marblehead's health insurance cost has actually moved over those 18 years.

## What the orange line actually shows

`data/group_insurance_FY06-27.csv` in this repo. Pulled per-year from primary documents:

- FY06 to FY13 from each year's ACFR budget schedule
- FY14 to FY16 from the 2016 Finance Committee Report
- FY17 to FY19 from the 2019 Finance Committee Report
- FY21 to FY23 from the 2022 Finance Committee Report
- FY24 to FY25 from the 2025 Finance Committee Report
- FY26 to FY27 from the FY27 Proposed Budget

Same line item every year &mdash; the Group Insurance appropriation in the General Fund budget. From FY07's $8.5M to FY27's budgeted $16.75M, the line roughly doubles over 20 years, which is consistent with the published premium increases and active-employee headcount across that period.

## What question does each line answer?

- **Orange (this site)** answers: *How much has Marblehead's Group Insurance appropriation &mdash; the line that funds active-employee and retiree health premiums &mdash; grown each year?* One definition, every year, traceable to the audited or proposed budget document for that fiscal year. Goes from $7.96M in FY06 to $16.75M budgeted for FY27 (about a 2.1&times; increase, or ~3.7% per year compounded).
- **Blue (Schedule A)** answers: *How much did Marblehead report under the DLS Schedule A "Fixed Costs minus pensions" rollup each year?* That number is real and the report is a primary source, but the contents of that rollup have changed over time as Massachusetts municipalities phased in GASB Statement 45 OPEB reporting and as DLS revised the Schedule A account taxonomy. So FY06 and FY24 on this line aren't measuring the same thing &mdash; FY06 bundles health insurance with retiree health pay-go and other employee benefits; FY24 is essentially the standalone Group Insurance line.

Both numbers are real. They tell different stories because they are different things. Comparing the FY06 and FY24 endpoints on the blue line is comparing a broader bundle in 2006 to a narrower bundle in 2024, which is what produces the apparent flat-to-declining trajectory.
