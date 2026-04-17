---
layout: page
body_class: doc-page
title: Is budget ratcheting visible in Marblehead's history?
---

# Is budget ratcheting visible in Marblehead's history?

Ratcheting is the claim that temporary spending increases from an override become permanent baselines, and that future budgets compound on top of those higher baselines even after the original need has passed. Critics of overrides often raise it as a reason to vote no: once the levy ceiling is lifted, it never resets.

The claim has a specific empirical signature. If ratcheting is the mechanism driving Marblehead's structural budget gap, one pattern shows up in the data. If the gap is driven by something else (typically underlying cost drivers like healthcare, <abbr class="g" title="Special Education">SPED</abbr>, and labor contracts), a different pattern shows up. Marblehead's 21-year window since its last successful operating override lets both patterns be tested against real data.

## Marblehead's operating override history

Four successful operating overrides, all in the FY02 through FY06 window, together added **$4.92 million** in permanent levy authority.<sup class="cite"
  data-href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride"
  data-source="MA DOR, Proposition 2½ Override/Underride Database"></sup>

| FY effective | Vote date | Amount | Department cited on ballot |
|---|---|---|---|
| FY02 | 2001-06-18 | $300,000 | Sewers and surface drains |
| FY04 | 2003-06-16 | $1,381,017 | Supplemental budget expenses |
| FY05 | 2004-06-21 | $512,397 | School supplemental, waste collection, library |
| FY06 | 2005-06-15 | $2,730,167 | Supplemental expenses of several town departments |

No operating override has passed since FY06. Attempts in 2011, 2022, 2023, and 2025 all lost.<sup class="cite"
  data-href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride"
  data-source="MA DOR, Proposition 2½ Override/Underride Database"></sup> Debt exclusions have continued to pass, but debt exclusions sunset when the underlying bond is paid off and do not compound into the operating base, so they are outside the ratcheting question.

## What ratcheting would look like in the data

If ratcheting were the main driver of Marblehead's structural gap, the signature in the historical record would be:

- **Pre-override period:** spending grows close to the 2.5% levy cap, because the cap bounds revenue and the town can only spend what it can levy.
- **Override passes:** spending steps up by the override amount, absorbing the new revenue authority.
- **Post-override period:** spending growth resets to roughly 2.5% per year, compounding from the new, higher baseline. The long-run growth rate is capped by the cap itself; no further structural gap opens until another override passes.
- **Gap reopening:** only happens on the timescale of a new override cycle, not on its own.

Why this signature fits ratcheting: the ratchet is a mechanical argument. It says the baseline gets stuck at a higher level after each override, not that underlying cost pressures keep accelerating. Once the baseline is reset and absorbed, the system has no internal pressure; the 2.5% cap binds both revenue and expenses. The harm (in the ratcheting frame) is the elevated baseline, not a continuing slope mismatch.

## What cost-driver-structural would look like in the data

If the gap is driven by cost drivers the town does not control unilaterally (group-insurance premium growth, out-of-district SPED tuition, collective-bargaining agreements, mandates), the signature is different:

- **Pre-override period:** spending already grows faster than the 2.5% cap, creating accumulating pressure on the operating budget.
- **Override passes:** relieves the pressure temporarily by raising the revenue ceiling. Spending and revenue realign for a few years.
- **Post-override period:** spending growth continues at the cost-driver rate, which is above 2.5% plus new growth. The gap between spending and the cap begins reopening within a few years.
- **Gap reopening:** happens automatically, on a timescale set by the gap between cost-driver growth and statutory revenue growth.

Why this signature fits cost drivers: the growth rates for healthcare premiums, SPED tuition, and labor contracts are set by external forces (<abbr class="g" title="Group Insurance Commission, state-run health plans">GIC</abbr> rate increases, state aid formulas, collective bargaining, federal SPED regulations), not by whether Marblehead's last override passed. The override outcome changes how much the town can levy; it does not change how fast its costs grow. If cost drivers are the mechanism, a town can pass overrides indefinitely and still watch the gap reopen.

## What the Marblehead data shows

The clean post-cluster window is FY07 through FY27 (21 years with no successful operating override). Comparing the revenue ceiling (levy limit) and a representative cost line (education expenditure, the largest single category at about half of general-fund spend):

<figure class="chart-wrapper">
<svg class="chart" viewBox="0 0 740 380" role="img" aria-labelledby="ratchet-chart-title ratchet-chart-desc">
  <title id="ratchet-chart-title">Marblehead levy limit vs. education expenditure, FY01 to FY21</title>
  <desc id="ratchet-chart-desc">Two solid lines rise from FY01. The levy limit climbs steeply during the FY02 through FY06 override cluster then continues rising at a steady post-cluster rate. The education expenditure line rises more slowly overall but its post-FY06 slope is steeper than the post-FY06 slope of the levy limit, so the gap between the two lines narrows. A dashed counterfactual shows where education expenditure would be if post-FY06 growth had been 2.5 percent per year; actual education expenditure runs meaningfully above the counterfactual.</desc>

  <rect x="95" y="40" width="100" height="280" fill="var(--c-border)" opacity="0.25"/>
  <text x="145" y="55" class="annotation" text-anchor="middle">FY02-FY06</text>
  <text x="145" y="70" class="annotation" text-anchor="middle">override cluster</text>

  <line class="grid-major" x1="70" y1="320" x2="720" y2="320"/>
  <line class="grid-minor" x1="70" y1="250" x2="720" y2="250"/>
  <line class="grid-minor" x1="70" y1="180" x2="720" y2="180"/>
  <line class="grid-minor" x1="70" y1="110" x2="720" y2="110"/>
  <line class="grid-minor" x1="70" y1="40"  x2="720" y2="40"/>

  <text x="62" y="324" class="tick-label" text-anchor="end">$0M</text>
  <text x="62" y="254" class="tick-label" text-anchor="end">$20M</text>
  <text x="62" y="184" class="tick-label" text-anchor="end">$40M</text>
  <text x="62" y="114" class="tick-label" text-anchor="end">$60M</text>
  <text x="62" y="44"  class="tick-label" text-anchor="end">$80M</text>

  <text x="70"  y="340" class="tick-label tick-label--major" text-anchor="middle">FY01</text>
  <text x="195" y="340" class="tick-label tick-label--major" text-anchor="middle">FY06</text>
  <text x="320" y="340" class="tick-label tick-label--major" text-anchor="middle">FY11</text>
  <text x="445" y="340" class="tick-label tick-label--major" text-anchor="middle">FY16</text>
  <text x="570" y="340" class="tick-label tick-label--major" text-anchor="middle">FY21</text>
  <text x="695" y="340" class="tick-label tick-label--major" text-anchor="middle">FY26</text>

  <polyline class="data-line data-line--bold s-revenue" points="70,219.9 95,215.5 120,211.8 145,203.2 170,196.9 195,182.1 220,176.9 245,171.6 270,165.9 295,160.7 320,154.4 345,148.7 370,142.4 395,136.4 420,130.6 445,124.4 470,117.8 495,111.4 520,105.1 545,98.7 570,92.1 595,85.1 620,77.7 645,70.0 670,62.7 695,55.2 720,48.6"/>
  <text x="725" y="51" class="end-label s-revenue">Levy limit</text>

  <polyline class="data-line data-line--bold s-cost" points="70,244.8 95,239.7 120,243.7 145,233.3 170,231.3 195,224.9 220,221.3 245,214.9 270,210.0 295,205.5 320,203.6"/>
  <polyline class="data-line data-line--bold s-cost" points="370,199.3 395,193.5 420,191.3 445,183.3 470,176.8 495,169.2 520,162.4 545,161.4 570,161.7"/>
  <text x="575" y="158" class="end-label s-cost">Education (actual)</text>

  <polyline class="data-line data-line--dashed s-cost" points="195,224.9 220,222.5 245,220.0 270,217.5 295,215.0 320,212.3 345,209.7 370,206.9 395,204.1 420,201.2 445,198.2 470,195.2 495,192.0 520,188.8 545,185.6 570,182.2"/>
  <text x="575" y="186" class="end-label s-cost">Education (if post-FY06 had been 2.5%/yr)</text>
</svg>
<figcaption>
Solid lines are actuals through FY21 (chart stops before the FY22-FY24 <abbr class="g" title="Governmental Accounting Standards Board">GASB</abbr> reclassification anomalies). Levy limit extends through FY27. Dashed line is a ratcheting-only counterfactual: education expenditure compounded from the FY06 level at 2.5% per year, which is what spending would look like if the override had stepped up the baseline and then growth had stayed at the statutory cap. Sources: <a href="https://github.com/agbaber/marblehead/blob/main/data/marblehead_levy.csv">marblehead_levy.csv</a> for levy limit; <a href="https://github.com/agbaber/marblehead/blob/main/data/master_financial_data_FY01-24.csv">master_financial_data_FY01-24.csv</a> for education expenditure, traced to ACFR "Changes in Fund Balances" school-operations rows.
</figcaption>
</figure>

Two patterns are visible in the post-cluster window (FY07 onward):

- **Growth rates did reset.** The post-cluster levy-limit slope is about 3.25% per year, which matches the 2.5% statutory cap plus roughly 0.7% certified new growth.<sup class="cite"
  data-href="https://github.com/agbaber/marblehead/blob/main/why-not-elsewhere.html"
  data-source="Marblehead 5-year average new growth FY22-FY26 = 0.54%, sourced from MA DOR DLS (why-not-elsewhere.html)"></sup> That is the structural default for a built-out residential municipality and would have been the trajectory regardless of FY02-FY06 override outcomes.
- **The expense slope stayed above the revenue slope.** Education-expenditure growth of about 4.0% per year in the clean FY07 through FY19 window continues to run roughly 0.75 percentage points per year above the levy-limit slope. The actual line runs meaningfully above the dashed counterfactual. A pure ratchet would not predict that divergence; the divergence is what cost-driver growth looks like.

The visual test: if ratcheting were the driver, the solid actual-education line would track close to the dashed counterfactual after FY06. It does not. The gap between solid and dashed is the portion of post-FY06 growth that ratcheting-only cannot explain.

## What the record supports

- **Ratcheting exists mechanically.** By statute, the FY02 through FY06 overrides permanently raised Marblehead's levy ceiling, and that authority has compounded at roughly 2.5% per year ever since. Compounding the $4.92 million at 2.5% for 21 years produces roughly $8.3 million of embedded authority in the FY27 $77.5 million ceiling,<sup class="cite"
  data-href="https://github.com/agbaber/marblehead/blob/main/data/marblehead_levy.csv"
  data-source="Marblehead levy limit FY00-FY27 (data/marblehead_levy.csv); $4.92M compounded at 2.5%/yr for 21 years"></sup> or about 11%. That is an upper bound (a portion of the $4.92M was for specific items that might have been funded another way), but it is the right order of magnitude for the ratcheting contribution.
- **Ratcheting is not the main driver of today's gap.** Post-cluster growth rates reset to the statutory cap plus new growth, yet the gap between spending and revenue continued to widen for 20 years. The mechanism that keeps reopening the gap is cost-side (healthcare, SPED, labor, mandates), not override-baseline compounding. FY27's projected structural deficit would exist even if every FY02 through FY06 override had failed; the composition of revenue sources would differ, but the spend-versus-cap divergence is independent of override history.

## The peer comparison depends on which peers you pick

The peer list in `data/peer_override_history.csv` (Arlington, Brookline, Hingham, Lexington, Melrose, Natick, Needham, Stoneham, Wellesley, Winchester) shows Marblehead as the lone non-override outlier. Every one of those towns has passed at least two operating overrides since FY07. That cohort leans toward towns that override.

A different peer selection gives a different answer:

| Town | Years since last op-override win (as of FY27) |
|---|---|
| Duxbury | 37 |
| Cohasset | 22 |
| Swampscott | 21 |
| Dover | 21 |
| Marblehead | 21 |
| Concord | 20 |
| Weston | 20 |
| Sherborn | 20 |
| Southborough | 20 |

Source: MA DOR override database, applied across all 255 Massachusetts towns with any override win in the DOR record.<sup class="cite"
  data-href="https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride"
  data-source="MA DOR, Proposition 2½ Override/Underride Database; aggregated in data/dor_override_history_all.csv"></sup>

Among the 255 Massachusetts towns with any operating-override win in DOR history, the median time since the last successful operating override is 16 years. Marblehead's 21 years sits at roughly the 68th percentile. On the wealthy-suburb cohort in the table above, Marblehead's 21-year gap is typical.

The ratcheting tests in this page (the levy-limit compounding calculation and the post-cluster slope chart) are internal to Marblehead and do not depend on peer selection. The robustness note is here as context for any discussion of whether Marblehead is unusually override-resistant.

## Test 3: Prop 2½ unused capacity

Ratcheting critics often point at unused capacity between actual levy and levy limit, asking whether headroom reappears after an override is absorbed. That test cannot be run cleanly from the data currently in the repo.

Marblehead's total property tax levy as reported in ACFR "Property Tax Levies and Collections" exceeds the levy limit in every year since FY01, because the ACFR total includes debt-excluded levy on top of the operating limit.<sup class="cite"
  data-href="https://github.com/agbaber/marblehead/releases/download/source-archive-v1/FY24_ACFR.pdf"
  data-source="FY24 ACFR page 129, Property Tax Levies and Collections"></sup> Splitting debt-excluded levy from operating levy to get true excess capacity requires the <abbr class="g" title="Local Assessment form filed annually with the Department of Revenue">LA-4</abbr> filing's "excess levy capacity" line, which is not yet in the repo. Pulling the MA DOR <abbr class="g" title="Division of Local Services, within MA Department of Revenue">DLS</abbr> Tax Levies by Class series for Marblehead FY01 through FY27 would answer this.

## Caveats

- **Education-expenditure reclassifications:** FY12 and FY22 through FY24 education expenditure has large year-over-year swings driven by GASB accounting reclassifications, not by service-level changes. The FY07 through FY19 window is used as the clean trend and the chart stops at FY21 for that reason.
- **Counterfactual is a 2.5% projection, not a re-run of history.** The dashed line compounds FY06 education expenditure at the statutory cap rate. It does not recover the certified new-growth component, which would add roughly 0.5 to 0.7 percentage points per year. A fuller counterfactual would sit slightly above the dashed line; the qualitative finding (actual runs above counterfactual) is robust to that adjustment.
- **Education is one category.** The chart uses education because it is the largest single category and the longest clean series. General-fund total expenditure shows the same qualitative pattern (post-FY06 growth faster than the levy limit) but is harder to plot cleanly because the GASB reclassification swings hit the total too.
- **The values question is separate.** Whether the mechanically-ratcheted portion of the levy ceiling represents services residents value or a baseline that should have been reduced at some point is a question the data does not answer. Residents will reach different conclusions on it.
