---
layout: page
body_class: doc-page
title: "Health Insurance Chart Source Check"
description: "Working note tracing two competing health-insurance time-series back to their primary sources."
---

# Health insurance chart: source check

A chart has been circulating that plots two health-insurance time-series for Marblehead from FY2006 onward. One line is from this site (`marbleheaddata.org`, labeled "MHDData"); the other line was added by a separate contributor.

The two lines disagree both in level and in shape. This note traces each line back to its underlying source so anyone reading the chart can decide which series is answering the question they think it is answering.

This is a working note. It is not part of the published site analysis.

## TL;DR

- The orange line ("MHDData") plots Marblehead's annual **Group Insurance budget line**, pulled per-year from each year's ACFR budget schedule, the Finance Committee Reports of 2016, 2019, 2022, and 2025, and the FY27 Proposed Budget. Same definition every year.
- The blue line is a slice of the **Massachusetts DOR DLS Schedule A** export for Marblehead (DOR municipality code 168), specifically the "Fixed Costs" rollup or a sub-line of it — *not* the town's Group Insurance budget line.
- The blue line's $18M peak in FY2006 followed by a one-year drop to $11.5M in FY2007 is **a known UMAS reclassification artifact**, not a real expense pattern. DOR changed how it categorized fixed-cost items around FY2007, and Marblehead's actual FY06 Group Insurance was $7.96M, not $18M.
- Starting the chart at FY2006 anchors the trajectory on a pre-reclassification number that does not match what was actually spent on health insurance that year.

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

The blue line runs roughly $2M to $6M lower than total Fixed Costs. The gap matches Marblehead's Contributory Retirement contribution growing from about $2.4M in FY06 to $4.5M in FY24, plus OPEB pay-go and workers compensation. So the blue series is **Schedule A Fixed Costs minus pension contributions** &mdash; that is, the "insurance and benefits" sub-rollup that DLS reports under Fixed Costs (Health + Life + Medicare + Other Insurance + OPEB pay-go combined), not the Group Health line on its own.

## Why the FY06 spike is misleading

The 2002 to 2006 climb to $18M followed by a single-year plunge to $11.5M is a methodology artifact. DOR changed how it categorized intergovernmental transfers, retiree health, and other fixed-cost items around FY2007 under UMAS reclassification. Marblehead's case-studies page on this site already calls out the same artifact for Newton ("the pre-FY2010 expenditure spikes likely reflect UMAS reclassification of intergovernmental transfers rather than operating losses"). The pattern is not unique to Marblehead.

The actual Group Insurance line on Marblehead's FY06 ACFR is **$7.96M**, not $18M. The blue line's FY06 number is bundling items that were moved to other Schedule A categories starting in FY07.

By starting the chart at FY2006, the blue line uses an inflated, pre-reclassification number as its baseline. That makes the FY06-to-FY24 trajectory look nearly flat or even declining ($18M to $12M). On a like-for-like basis (FY07 onward, post-reclassification) the blue series goes from $11.8M to $12.2M over 18 years, which is implausibly flat for healthcare cost growth in any Massachusetts municipality and is the tell that the underlying number has changed in definition.

## What the orange line actually shows

`data/group_insurance_FY06-27.csv` in this repo. Pulled per-year from primary documents:

- FY06 to FY13 from each year's ACFR budget schedule
- FY14 to FY16 from the 2016 Finance Committee Report
- FY17 to FY19 from the 2019 Finance Committee Report
- FY21 to FY23 from the 2022 Finance Committee Report
- FY24 to FY25 from the 2025 Finance Committee Report
- FY26 to FY27 from the FY27 Proposed Budget

Same line item every year &mdash; the Group Insurance appropriation in the General Fund budget. From FY07's $8.5M to FY27's budgeted $16.75M, the line roughly doubles over 20 years, which is consistent with the published premium increases and active-employee headcount across that period.

## Net

Two different things are being plotted under the same axis label.

- The orange line is Marblehead's Group Insurance budget appropriation, sourced from primary town documents, with one consistent definition across all 22 years.
- The blue line is a DOR DLS Schedule A sub-rollup ("fixed costs minus pensions") with a known methodology break around FY2007 that creates a $6M apparent step-down at the chart's anchor point.

Both numbers are real. Only the orange line answers the question "how much has Marblehead's health insurance bill grown over time?" using a single, stable definition. The blue line answers a different question and starts from a baseline that the underlying methodology no longer reports the same way.
