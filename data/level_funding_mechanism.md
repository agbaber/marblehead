---
title: "What Actually Squeezed Marblehead's Operating Budget, FY18-FY27"
body_class: doc-page
sitemap: false
---

# What actually squeezed Marblehead's operating budget, FY18 to FY27

*Working analysis. Not a public page. Compiled 2026-04-24 while attempting
to visualize "level-funded cuts." The popular narrative blames healthcare
and pensions; the data does not support that for the FY18-FY27 window.
Documenting the finding so the override conversation can be honest.*

## The popular narrative

The dominant override-debate framing is: "healthcare and pension costs are
exploding, eating the budget, forcing cuts to operations." It is the lead
sentence in many local news pieces and FinCom transmittal letters.

## What the data says

Compound annual growth rates over the FY18-FY27 window:

| Series | Period | CAGR | vs. levy growth |
|---|---|---:|---|
| **Property tax levy** | FY18-FY27 | **+2.97%/yr** | baseline |
| **Group insurance (healthcare)** | FY18-FY27 | **+2.76%/yr** | -0.21 pp |
| **Pension assessment** | FY18-FY24 | **+0.91%/yr** | -2.06 pp |
| **CPI-U (US, all items)** | FY18-FY24 | **+3.78%/yr** | +0.81 pp |

Healthcare grew *slower* than the levy. Pensions grew *much* slower than the
levy in the FY18-FY27 window (the aggressive pension-funding catch-up
happened in FY15-FY21 and tapered after).

CPI grew *faster* than the levy, by about 80 basis points per year.

## The implication

If healthcare and pensions both grew below the rate of allowed levy growth,
they *cannot* be the mechanism that forced operating cuts. Their share of
the general fund actually *decreased* over the window:

- HC share of general fund FY18: 16.0% ($13.1M / $81.8M)
- HC share of general fund FY24: 13.6% ($13.9M / $102.3M)

The thing that grew faster than the levy is **CPI**. So whichever line items
tracked CPI rather than the levy cap absorbed the pressure:

- Materials and supplies (roads, parts, paper, food, fuel)
- Vendor contracts (engineering, legal, IT, software)
- Utilities (electricity, gas, water)
- Equipment (vehicles, machinery, tools)
- Outsourced services (cleaning, IT, professional)

These line items live inside operating department budgets. When those
budgets are "level-funded" in nominal dollars, CPI eats their real
purchasing power at roughly 80 basis points per year above the levy cap,
plus the full gap between zero nominal growth and CPI when the budget is
actually level.

A budget held flat at $533,544 (Energy Reserve, FY11-FY20) loses 100% of
CPI inflation in real purchasing power each year. Over 10 years at ~2.5%
CPI, that's ~22% lost purchasing power before the line was zeroed in FY26.

## Why the mismatch with the public narrative

A few hypotheses worth investigating:

1. **The public narrative is anchored on FY27 specifically.** Healthcare
   spiked +11% in the FY27 budget proposal (from $15.1M FY26 to $16.75M
   FY27). That's the single year people are seeing now. It is not
   representative of the FY18-FY26 period that preceded it.

2. **Pension catch-up FY15-FY21 was real but ended.** Pension assessment
   went from $6.2M (FY15) to $16.0M (FY21), then dropped to ~$10-12M for
   FY22-FY24. The catch-up phase shaped a generation of FinCom narratives
   that did not update when pensions stabilized.

3. **It is rhetorically easier to blame named state mandates** (GIC,
   PERAC) than to explain that operating departments are being eaten by
   general inflation on level-funded line items. The first has a villain;
   the second is mechanical and abstract.

4. **The headline number on free cash usage masks the structural issue.**
   $10.2M (FY23) of free cash papered over the hole. As that drops to
   $5M (FY27), the structural gap becomes visible all at once.

## What this implies for the override case

The most defensible version of the "we have been cutting services to keep
the levy flat" claim is not:

> "Healthcare and pensions are eating the budget, leaving nothing for
> services."

It is:

> "Marblehead's operating departments have been held to flat or
> near-flat nominal budgets for nine years. Over that window, CPI ran
> 80 basis points hotter per year than the levy could grow. The
> resulting real-dollar erosion (~25-30% over the window for fully
> level-funded line items) is what drove the documented attrition: 9
> net positions lost, the Engineering Department zeroed, Energy Reserve
> ($533,544 flat for 10 years) eliminated, the SRO program ended, Fire
> on 96-hour shifts."

This is more boring than "healthcare crisis," but it is what the data
supports.

## Open questions to investigate

These are the threads worth pulling next:

1. **Department-level operating budget growth FY18-FY27.** Without
   benefits and pensions baked in, did operating department budgets
   actually stay flat in nominal terms? Need DPW, Fire, Police,
   Engineering, Library, etc. line-by-line from FinCom Annual Reports.

2. **Wage growth from collective bargaining.** COLAs in MOAs/MOUs run
   2-3.5%/yr. With ~190 town employees on payroll, that's $300k-$500k
   per year of structural cost growth on a flat top-line. Where did
   that come from in the budget?

3. **The FY27 cliff decomposition.** What does the $8.47M FY27 deficit
   actually consist of? How much is healthcare jump, how much is the
   end of free-cash bandaid, how much is wages, how much is pensions
   reverting?

4. **Peer-town comparison.** Did Swampscott / Melrose / Stoneham see
   the same pattern (HC and pensions sub-CPI, operations squeezed by
   inflation)? Or is Marblehead structurally different?

5. **What grew above CPI in the budget?** Total general fund grew from
   $81.8M to $102.3M (+25% over 6 years, ~3.8%/yr) — that's right at
   CPI. Where did the +$20M go if not HC and pensions? Possibilities:
   schools (+$12M-ish?), debt service from exclusions (Bell, Mary
   Alley, MHS roof), one-time ARPA, growing local receipts.

## Sources used in this analysis

- `data/marblehead_levy.csv` — town total levy by fiscal year
- `data/group_insurance_FY14-27.csv` — FinCom-reported healthcare cost
- `data/pension_expenditure_FY15-24.csv` — Essex pension assessment
- `data/cpi_us.csv` — US BLS CPI-U
- `data/general_fund_spending_FY15-26.csv` — total general fund spending
- `data/savings_measures_compiled.md` — staff attrition, level-funded items
- CLAUDE.md memory note `project_healthcare_trend_vs_cliff` — corroborates
  the FY18-FY26 sub-CPI HC growth finding
- CLAUDE.md memory note `feedback_data_accuracy` — corrects FY26 HC to
  $15.1M and FY27 deficit to $8.47M

## Caveats

- Pension data has GASB volatility; the FY22 drop ($10.4M from $16.0M
  the prior year) is likely an accounting artifact, not a real cost
  decrease. The CAGR figure absorbs this noise.
- General fund spending FY15-FY26 was decoded from chart polygons and
  is precision ~+/-$50K. Re-extract from ACFR General Fund schedules
  for any published claims.
- Healthcare FY24 ($13.9M) and FY25 ($13.7M) appear lower than the
  underlying trend; CLAUDE memory `feedback_data_accuracy` flags FY26
  as $15.1M (corrected upward from a $13.6M stale reference). Treat
  the FY24-FY25 dips as suspect until verified against primary FinCom
  reports.
- This is a back-of-envelope analysis from existing CSVs in the repo.
  No primary FinCom reports were re-opened. Treat as a working
  hypothesis, not a published finding.
