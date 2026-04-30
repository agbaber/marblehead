---
layout: page
body_class: doc-page
title: "Insurance Chart Source Check"
description: "Source-trace of the 'Marblehead Annual Insurance Costs' chart published in the April 2026 opinion piece."
---

# Insurance chart: source check

The opinion piece "Why Marblehead Should Reject the Override," published in the Marblehead Independent in April 2026, includes a chart titled **"Marblehead Annual Insurance Costs."** The chart shows three things:

1. A flat **red line at $18 million** running from FY2006 through FY2026, captioned "$18 million still in budget every year."
2. A **blue line** labeled "Marblehead insurance costs" that starts at $18M in FY2006, drops sharply to about $11.8M by FY2007 and to about $9.4M by FY2009, then rises slowly back to about $13.6M by FY2026.
3. A highlighted annotation reading **"$146 Million Saved and Spent &ndash; The difference between the Red line and the Blue line over these years amounts to a total huge savings."**

This note traces what each line actually represents and tests the cumulative-savings calculation against Marblehead's audited financial reports. It is a working note, not part of the published site analysis.

## TL;DR

- The blue line is from the **Massachusetts Department of Revenue's DLS Schedule A** export for Marblehead (DOR municipality code 168), specifically the "Fixed Costs minus pensions" rollup. It is **not** the town's group health insurance line on its own.
- Marblehead's **audited group health insurance** for FY2006, taken from the FY06 Annual Comprehensive Financial Report, is **$7,964,196** &mdash; less than half the chart's $18M baseline. The audited line climbs smoothly from $7.96M in FY06 to $13.92M in FY24, with no FY07 cliff.
- **Marblehead joined the Group Insurance Commission effective July 1, 2012 (FY2013)**, not FY2007. The blue line's $7M drop from FY06 to FY09 predates the actual GIC transition by five to seven years. The audited line shows the real GIC join effect: a one-time 7.8 percent dip from $11.74M to $10.82M, fully recouped by FY15.
- The "$146 Million Saved and Spent" calculation is the cumulative difference between the flat $18M red line and the blue Schedule A line over 21 years. It depends on three premises that the audited record does not support: that $18M was Marblehead's FY06 health insurance cost, that the blue line's drop was a real budget reduction, and that the drop was caused by joining the GIC. None of those holds up against the ACFRs.

## What the blue line actually plots

Three giveaways from a spreadsheet that backs the blue line, sent privately for context:

1. **The header format** &mdash; `DOR Code | Municipality | year | year | ...` &mdash; is the standard export shape from the [DLS Schedule A General Fund report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN) on the Massachusetts DOR Municipal Databank. Marblehead is municipality code 168.
2. **The 2025 column is zero** in the source data. Schedule A FY25 has not been filed yet, which produces an empty cell on every Marblehead Schedule A export.
3. **The shape &mdash; climb to FY06, plunge in FY07, slow rise after &mdash; matches the DOR Schedule A "Fixed Costs" column for Marblehead exactly.** Compare the chart's blue line to `data/peer_schedule_a_expenditures.csv` in this repo:

| FY   | Schedule A Fixed Costs | Chart's blue line |
|------|-----------------------:|------------------:|
| 2005 |             17,473,815 |        15,208,944 |
| **2006** |         **20,423,702** |    **18,043,023** |
| **2007** |         **14,404,346** |    **11,798,901** |
| 2008 |             14,051,616 |        11,558,645 |
| 2009 |             12,746,799 |         9,425,951 |
| 2024 |             18,519,860 |        12,152,022 |
| 2025 |                      0 |                 0 |

The blue line runs roughly $2M to $6M lower than total Schedule A Fixed Costs each year, consistent with the chart's blue series being "Fixed Costs minus pension contributions." That is, it bundles health insurance with retiree health pay-go, workers compensation, life insurance, and Medicare employer share, but excludes pensions. It is not the standalone group health insurance line.

The blue line's FY24 value of $12,152,022 happens to equal Marblehead's audited FY24 Group Insurance line exactly. But its FY06 value of $18,043,023 is more than double the audited FY06 Group Insurance line. So the contents of that single column were narrower in FY24 than in FY06, which is why the chart appears to "save" so much money.

## The pre-GIC trajectory

The cleanest way to test whether the blue line is plotting health insurance is to mark Marblehead's actual GIC join date and see how each line behaves across that boundary.

Marblehead joined the Group Insurance Commission effective **July 1, 2012 (start of FY2013)**, per the PEC-GIC Memorandum of Agreement at `data/schools/contracts/public-employee-committee-health-agreement.txt`:

> WHEREAS, the Board of Selectmen of the Town of Marblehead voted on January 31, 2012 to accept M.G.L. c. 32B, &sect;19 ("Section 19"), for the purpose of transferring the Town's health insurance subscribers to the Commonwealth of Massachusetts Group Insurance Commission ...

The audited Group Insurance trajectory across that boundary, taken from each year's ACFR budget schedule (`data/group_insurance_FY06-27.csv`):

| FY   | Group Insurance | Status              |
|------|---------------:|---------------------|
| 2006 |      7,964,196 | pre-GIC             |
| 2007 |      8,499,096 | pre-GIC             |
| 2008 |      9,331,501 | pre-GIC             |
| 2009 |     10,717,120 | pre-GIC             |
| 2010 |     10,062,084 | pre-GIC             |
| 2011 |     10,516,964 | pre-GIC             |
| 2012 |     11,739,905 | last pre-GIC year   |
| 2013 |     10,822,087 | first GIC year (&minus;7.8%) |
| 2014 |     11,581,448 | GIC                 |
| 2015 |     12,110,711 | GIC                 |

Three things to note:

1. The audited line climbs smoothly through the pre-GIC period, $7.96M to $11.74M. There is no FY07 cliff in the actual budget data.
2. The actual GIC join effect is the FY12 to FY13 dip: about &minus;$0.92M, or &minus;7.8%, fully recouped within two years.
3. The chart's "$18M to $9M" plunge spans FY06 to FY09, **three to seven years before Marblehead joined the GIC**. Whatever drove the chart's drop, it was not the GIC transition.

## The "$146 Million Saved and Spent" calculation

The annotation on the chart claims that the cumulative difference between the flat $18M red line and the blue line "amounts to a total huge savings." The math approximately works out: 21 years (FY06 through FY26) at a flat $18M is $378M; the blue line averages roughly $11M per year over that same window, totaling about $231M; the difference is about $147M, close to the chart's "$146 million" figure.

That calculation depends on three premises. Each fails against the audited record:

1. **That $18M was Marblehead's FY06 health insurance cost.** The audited group health insurance line for FY06 is $7,964,196 per the FY06 ACFR. The $18M figure comes from the Schedule A Fixed Costs minus pensions rollup, which bundles other categories.
2. **That the FY06-to-FY09 drop was a real budget reduction.** It does not appear in the audited data. The audited Group Insurance line *grows* from $7.96M in FY06 to $10.72M in FY09. The drop in the blue line reflects items being moved out of the Schedule A "Fixed Costs" bundle, primarily as Massachusetts municipalities phased in GASB Statement 45 reporting for retiree health benefits (effective FY09 for Marblehead, a Phase 2 entity by revenue size).
3. **That the drop was caused by joining the GIC.** The GIC transition was effective July 1, 2012, five years after the chart's drop begins. The actual audited effect of the GIC transition was a one-time 7.8 percent dip, recouped within two years, on a base of roughly $11.7M. Replacing that with a flat $18M-versus-actual difference inflates the apparent savings by an order of magnitude.

If you redo the calculation using the audited group insurance line and a hypothetical "FY06 baseline held flat" of $7.96M:

- 21 years &times; $7.96M flat = $167M hypothetical
- Sum of audited group insurance, FY06 through FY27 budgeted = roughly $245M
- The audited line is **$78M *higher* than a flat FY06 baseline**, not $146M lower.

The chart is built on a baseline that overstates FY06 group insurance by more than 2x and a "savings" event that did not happen on the date or scale shown. The "$146M saved" claim does not survive a comparison to the town's own audits.

## Two well-documented reasons the FY06 column on Schedule A is broader than today's

Two factors explain why the FY06 entry on the Schedule A Fixed Costs minus pensions line is roughly $10M higher than today's audited group health insurance:

1. **GASB Statement 45 (Other Postemployment Benefits)** required municipalities to begin recognizing retiree health (OPEB) as a distinct accounting category. Effective dates were phased by entity size: Phase 1 (annual revenues over $100M) for fiscal years beginning after December 15, 2006 (FY2008); Phase 2 (revenues $10M to $100M) for FYs beginning after December 15, 2007 (FY2009); Phase 3 (under $10M) for FYs beginning after December 15, 2008 (FY2010). Marblehead, with FY06 total general fund expenditures of $63.9M, was a Phase 2 entity, so GASB 45 took full effect for Marblehead in **FY2009**. Sources: [GASB Statement 45 Summary](https://gasb.org/page/pronouncement?pageId=/standards-and-guidance/pronouncements/summary-statement-no-45.html) (primary), and [GASB Statement 45 and Its Impact on Your Financial Statements](https://www.nhmunicipal.org/town-city-article/gasb-statement-45-and-its-impact-your-financial-statements) (more accessible explainer). Before GASB 45 took effect, retiree health pay-go was generally reported alongside active-employee Group Insurance under "Fixed Costs." After it took effect, retiree health moved into separate OPEB reporting.
2. **MA DOR DLS Schedule A taxonomy revisions.** DLS has updated the Schedule A account structure and category definitions multiple times since UMAS was first adopted under [G.L. c. 44, &sect; 38](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter44/Section38). The current Schedule A guidelines and reference material from the DLS Bureau of Accounts is published at [mass.gov/doc/schedule-a-guidelines-and-reference-material](https://www.mass.gov/doc/schedule-a-guidelines-and-reference-material/download) (PDF). Historical revisions to the line-item structure are not all individually documented online.

The combination of (1) and (2) explains why a single Schedule A column running from FY06 through FY24 does not contain the same items in the same proportions across the entire period. In FY06 it bundles health insurance with retiree-health pay-go and other employee benefits; by FY24, retiree health is reported separately under OPEB, and the column is essentially the standalone Group Insurance line.

## What the audited record shows

The orange-labeled "MHDData" series referenced in some private versions of the chart comes from `data/group_insurance_FY06-27.csv`, pulled per-year from primary documents:

- FY06 to FY13 from each year's ACFR budget schedule
- FY14 to FY16 from the 2016 Finance Committee Report
- FY17 to FY19 from the 2019 Finance Committee Report
- FY21 to FY23 from the 2022 Finance Committee Report
- FY24 to FY25 from the 2025 Finance Committee Report
- FY26 to FY27 from the FY27 Proposed Budget

Same line item every year &mdash; the Group Insurance appropriation in the General Fund budget. From $7.96M in FY06 to $16.75M budgeted for FY27, roughly a 2.1&times; increase or about 3.7 percent per year compounded.

That is the most defensible answer to the question "how much has Marblehead's group health insurance bill grown over time?" because it uses one definition, applied consistently, across every year, traceable to the town's own annual financial reports.
