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

## Side by side

Plotted on the same axis: the chart's blue line (Massachusetts DOR Schedule A "Fixed Costs minus pensions" rollup, FY06 through FY24) against Marblehead's audited group insurance budget line (each year's ACFR budget schedule plus subsequent FinCom Reports and the FY27 Proposed Budget).

<div class="chart-wrapper" data-chart-tooltip>
  <script type="application/json" class="chart-tooltip-data">
  {
    "xLabels": ["FY06","FY07","FY08","FY09","FY10","FY11","FY12","FY13","FY14","FY15","FY16","FY17","FY18","FY19","FY20","FY21","FY22","FY23","FY24","FY25","FY26","FY27"],
    "xPositions": [70,98,125,153,181,209,236,264,292,320,347,375,403,430,458,486,514,541,569,597,625,652],
    "series": [
      {
        "name": "Schedule A: Fixed Costs minus pensions (chart's blue line)",
        "className": "s-cost",
        "valuePrefix": "$",
        "valueSuffix": "M",
        "valueDecimals": 2,
        "values": [18.04,11.80,11.56,9.43,9.68,9.87,10.44,9.22,9.52,9.28,9.74,9.94,10.39,10.45,10.68,11.24,11.44,11.68,12.15,null,null,null]
      },
      {
        "name": "Audited group insurance budget (ACFR / FinCom)",
        "className": "s-neutral",
        "valuePrefix": "$",
        "valueSuffix": "M",
        "valueDecimals": 2,
        "values": [7.96,8.50,9.33,10.72,10.06,10.52,11.74,10.82,11.58,12.11,12.66,13.06,13.12,13.48,null,13.81,14.48,15.24,13.92,13.70,15.10,16.75]
      }
    ]
  }
  </script>
  <svg class="chart" viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart comparing two health insurance time-series for Marblehead, FY2006 to FY2027. The Schedule A 'Fixed Costs minus pensions' series starts at 18 million dollars in FY06, drops to 11.8 million by FY07 and to 9.4 million by FY09, and rises slowly to 12.2 million by FY24. The audited group insurance series starts at 7.96 million in FY06 and climbs steadily to 16.75 million budgeted for FY27. The two lines cross around FY11 to FY12 and diverge in opposite directions thereafter.">

    <line class="axis-base" x1="70" y1="320" x2="680" y2="320"/>

    <line class="tick" x1="66" y1="320" x2="70" y2="320"/>
    <text class="tick-label" x="63" y="324" text-anchor="end">$0</text>
    <line class="tick" x1="66" y1="250" x2="70" y2="250"/>
    <text class="tick-label" x="63" y="254" text-anchor="end">$5M</text>
    <line class="tick" x1="66" y1="180" x2="70" y2="180"/>
    <text class="tick-label" x="63" y="184" text-anchor="end">$10M</text>
    <line class="tick" x1="66" y1="110" x2="70" y2="110"/>
    <text class="tick-label" x="63" y="114" text-anchor="end">$15M</text>
    <line class="tick" x1="66" y1="40"  x2="70" y2="40"/>
    <text class="tick-label" x="63" y="44"  text-anchor="end">$20M</text>

    <text class="tick-label tick-label--major" x="70"  y="342" text-anchor="middle">FY06</text>
    <text class="tick-label tick-label--minor" x="153" y="342" text-anchor="middle">FY09</text>
    <text class="tick-label tick-label--major" x="236" y="342" text-anchor="middle">FY12</text>
    <text class="tick-label tick-label--minor" x="320" y="342" text-anchor="middle">FY15</text>
    <text class="tick-label tick-label--minor" x="403" y="342" text-anchor="middle">FY18</text>
    <text class="tick-label tick-label--minor" x="486" y="342" text-anchor="middle">FY21</text>
    <text class="tick-label tick-label--major" x="569" y="342" text-anchor="middle">FY24</text>
    <text class="tick-label tick-label--major" x="652" y="342" text-anchor="middle">FY27</text>

    <line class="annotation-line" x1="264" y1="40" x2="264" y2="320"/>
    <text class="annotation annotation--hide-sm" x="268" y="48">Joined GIC (state plan) FY13</text>

    <polyline class="data-line s-cost"
              points="70,67 98,155 125,158 153,188 181,184 209,182 236,174 264,191 292,187 320,190 347,184 375,181 403,175 430,174 458,171 486,163 514,160 541,157 569,150"/>
    <text class="end-label s-cost" x="575" y="148">Schedule A FCMP</text>

    <polyline class="data-line s-neutral"
              points="70,209 98,201 125,189 153,170 181,179 209,173 236,156 264,169 292,158 320,151 347,143 375,137 403,136 430,131"/>
    <polyline class="data-line s-neutral"
              points="486,127 514,117 541,107 569,125 597,128 625,109 652,86"/>
    <text class="end-label s-neutral" x="658" y="84">Audited group insurance</text>

  </svg>
</div>

<p class="caption">Both lines are sourced. The blue series is what the published chart plots; the audited series is from each year's ACFR budget schedule, the FinCom Reports of 2016, 2019, 2022, 2025, and the FY27 Proposed Budget. The audited line has a gap at FY20 because the data is not in the FinCom Reports for that period; the FY20 ACFR Budget and Actual schedule shows $11.98M actual expended for context. The Schedule A series ends at FY24 because Schedule A has not been filed for FY25 yet. Marblehead joined the state Group Insurance Commission effective July 1, 2012, marked at FY13.</p>

The two lines start $10M apart in FY06, cross around FY11, and end with the audited line $4.6M higher than the Schedule A line by FY24. The chart's "$146M saved" annotation describes the area between a flat $18M baseline and the blue line. None of that area is recoverable from the audited group insurance series, which has no FY07 cliff and no $18M starting point.

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
