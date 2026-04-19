---
layout: page
body_class: doc-page
title: case studies
---

<style>
  .case-chart { display: block; width: 100%; height: auto; max-width: 720px; margin: 10px auto 6px; }
  .case-chart .case-grid { stroke: var(--divider); stroke-width: 0.5; stroke-dasharray: 2 3; }
  .case-chart .case-gap-zero { stroke: var(--text-muted); stroke-width: 1.2; }
  .case-chart .case-tick { font-size: 10px; fill: var(--text-muted); font-family: inherit; }
  .case-chart .case-gap-line { stroke: var(--c-navy); stroke-width: 2; fill: none; }
  .case-chart .case-gap-surplus { fill: var(--series-revenue); opacity: 0.18; }
  .case-chart .case-gap-deficit { fill: var(--series-cost); opacity: 0.18; }
  .case-chart .case-vote-win { stroke: var(--c-navy); stroke-width: 1.5; opacity: 0.45; }
  .case-chart .case-vote-loss { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.45; }
  .case-chart-caption {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    margin: 2px 0 16px;
    line-height: 1.4;
  }
  .case-chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
    font-size: 12px;
    color: var(--text-muted);
    margin: 6px 0 2px;
  }
  .case-chart-legend-tick {
    display: inline-block;
    width: 0;
    height: 12px;
    vertical-align: middle;
    margin-right: 5px;
  }
  .case-chart-legend-tick--win { border-left: 2px solid var(--c-navy); }
  .case-chart-legend-tick--loss { border-left: 1.5px dashed var(--text-muted); opacity: 0.7; }
  .case-chart-legend-swatch {
    display: inline-block;
    width: 14px;
    height: 2px;
    vertical-align: middle;
    margin-right: 4px;
  }
  .case-chart-legend-swatch--surplus { background: var(--series-revenue); opacity: 0.5; height: 8px; }
  .case-chart-legend-swatch--deficit { background: var(--series-cost); opacity: 0.5; height: 8px; }
</style>

# Override Case Studies: Melrose, Stoneham, and the Statewide Pattern

> **What these case studies show.** The first two case studies (Melrose and Stoneham) are Massachusetts towns that rejected an operating override and later returned to the ballot with a larger ask. The third section ([towns that rejected and did not return](#rejected-and-did-not-return)) covers the opposite outcome: towns that rejected an override and absorbed the cuts for years without returning to the ballot. Both patterns exist. The [statewide data](#statewide-pattern) shows that return-to-ballot is the more common outcome, but it is not the only one. If you know of additional examples in either direction, [open an issue](https://github.com/agbaber/marblehead/issues/new?title=Case+study+town%3A+).

## Melrose (population ~28,000, median home ~$818K)

<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">$7.7M</div>
    <div class="key-stat-label">Failed Jun 2024</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$13.5M</div>
    <div class="key-stat-label">Passed Nov 2025</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">+75%</div>
    <div class="key-stat-label">Larger ask</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">61.4</div>
    <div class="key-stat-label">FTEs cut between</div>
  </div>
</div>

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--surplus"></span>Surplus (revenue above expenditure)</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--deficit"></span>Deficit (expenditure above revenue)</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-melrose" viewBox="0 0 720 220" role="img" aria-label="Melrose general fund surplus or deficit (revenue minus expenditure), FY2002 to FY2025, override ballot events marked.">
<line class="case-gap-zero" x1="58.0" x2="698.0" y1="114.6" y2="114.6" />
<line class="case-grid" x1="58.0" x2="698.0" y1="33.3" y2="33.3" />
<line class="case-vote-loss" x1="85.8" x2="85.8" y1="6" y2="190.0"><title>FY2003 override failed: $5.30M</title></line>
<line class="case-vote-loss" x1="447.6" x2="447.6" y1="6" y2="190.0"><title>FY2016 override failed: $2.25M</title></line>
<line class="case-vote-win" x1="558.9" x2="558.9" y1="6" y2="190.0"><title>FY2020 override passed: $5.18M</title></line>
<line class="case-vote-loss" x1="698.0" x2="698.0" y1="6" y2="190.0"><title>FY2025 override failed: $7.70M</title></line>
<path class="case-gap-surplus" d="M 105.9,114.6 L 113.7,108.1 L 136.3,114.6 L 143.3,114.6 L 169.3,93.6 L 184.7,114.6 L 267.2,114.6 L 280.6,79.1 L 308.4,96.7 L 336.3,98.4 L 364.1,81.6 L 391.9,78.7 L 419.7,105.3 L 447.6,60.7 L 475.4,93.5 L 503.2,81.2 L 531.0,59.5 L 558.9,36.6 L 586.7,41.7 L 614.5,31.0 L 631.9,114.6 L 691.2,114.6 L 698.0,95.7 L 698.0,114.6 Z" />
<path class="case-gap-deficit" d="M 58.0,114.6 L 58.0,121.2 L 85.8,131.1 L 105.9,114.6 L 136.3,114.6 L 141.5,116.0 L 143.3,114.6 L 184.7,114.6 L 197.1,131.5 L 225.0,161.4 L 252.8,153.0 L 267.2,114.6 L 631.9,114.6 L 642.3,164.8 L 670.2,173.0 L 691.2,114.6 Z" />
<polyline class="case-gap-line" points="58.0,121.2 85.8,131.1 113.7,108.1 141.5,116.0 169.3,93.6 197.1,131.5 225.0,161.4 252.8,153.0 280.6,79.1 308.4,96.7 336.3,98.4 364.1,81.6 391.9,78.7 419.7,105.3 447.6,60.7 475.4,93.5 503.2,81.2 531.0,59.5 558.9,36.6 586.7,41.7 614.5,31.0 642.3,164.8 670.2,173.0 698.0,95.7" />
<text class="case-tick" x="53.0" y="117.6" text-anchor="end">$0M</text>
<text class="case-tick" x="53.0" y="36.3" text-anchor="end">+$5M</text>
<text class="case-tick" x="58.0" y="210.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="169.3" y="210.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="280.6" y="210.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="391.9" y="210.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="503.2" y="210.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.5" y="210.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="210.0" text-anchor="middle">FY'25</text>
</svg>

<p class="case-chart-caption">Melrose general fund, FY2002 through FY2025 (DOR DLS Schedule A). The FY2020 win added $5.18M of permanent levy authority. The FY2025 loss came as expenditures were again pulling ahead of revenues. The November 2025 FY2026 follow-up override ($13.5M, passed) is described in the timeline below; FY2026 Schedule A has not yet been filed so it does not appear on the chart.</p>

### Timeline
- **June 2024:** $7.7M operating override [fails 55-45 on June 18, 2024, approximately 5,150 no to 4,280 yes](https://patch.com/massachusetts/melrose/melrose-override-special-election-results-live-updates) (roughly 900-vote margin).
- **FY25 cuts (July 2024):** 13 school positions, plus the Sustainability Manager, Economic Development Director, and Social Services Coordinator positions eliminated. 5% cuts to Police, Fire, and DPW overtime budgets. Salary freeze for 60+ non-union city employees. Reduced AP course offerings, fewer paraprofessionals, no Chromebook repairs. ([Yes for Melrose, "Why an Override?"](https://www.yesformelrose.org/why-an-override))
- **FY26 cuts (July 2025):** An additional $4 million in cuts. On the school side, [31 teacher positions and 4 administrator positions were eliminated, the Teaching and Learning office was effectively closed, and the middle school principal position was merged with the high school](https://themelrosemessenger.org/articles/2025/09/override.html). Class sizes proposed up to 32 in elementary, kindergarten from 17 to 25. Sunday library service eliminated. Senior van drivers cut.
- **Total damage:** [$6.3 million in cuts and 61.4 FTEs eliminated over the two FY25 and FY26 budgets combined](https://themelrosemessenger.org/articles/2025/09/override.html).
- **Staff exodus:** Melrose Public Schools held [its smallest new teacher orientation in many years, with only 17 new hires](https://themelrosemessenger.org/articles/2025/08/schools.html). Superintendent Julie Kukenberger: "We have lost staff members who barely kept their job this year because of the budget and are going somewhere more stable. I'm specifically thinking of a few great teachers who just can't afford to ride it out" ([Melrose Messenger, "Back to School Staffing Changes," August 2025](https://themelrosemessenger.org/articles/2025/08/schools.html)).
- **November 2025:** Three-tier override ($9.3M / $11.9M / $13.5M). [All three tiers passed; the top $13.5M tier won 6,018 to 5,052](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/) (54-46).
- **Largest in 35+ years.** Commonwealth Beacon: ["The funding level appears to be the largest approved by any Massachusetts community in at least 35 years," surpassing a $12 million override passed by Brookline voters in 2008](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/).
- **What $13.5M restores:** The override revenue will [fund salaries and benefits for 17 positions in the schools, five positions in public works, and two police officers](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/), plus curriculum and road maintenance.
- **Tax impact:** For the average single-family home in Melrose, assessed at $817,630, [the annual tax bill increases by $1,374](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/), per city estimates.
- **DOR data:** Marblehead peer-town data shows the Melrose residential tax rate spiking from $9.90 (FY25) to $11.47 (FY26), a +$1.57 / +16% jump. Source: [MA DOR Tax Rates by Class](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.taxratesbyclass.taxratesbyclass_main). Biggest single-year jump in the 24-year dataset.
- **Per-pupil spending:** Melrose ranks in the [bottom eight percent of Massachusetts school districts in spending per pupil, at $18,600 per child in FY2024, versus a state average of $21,300](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/) (Commonwealth Beacon citing DESE; primary source: [DESE per-pupil expenditures](https://profiles.doe.mass.edu/statereport/ppx.aspx)).

<div class="takeaway">
  <strong>Key lesson.</strong> Melrose rejected $7.7M in June 2024 and passed $13.5M in November 2025, 75% more than the original ask. The intervening 17 months included 61.4 FTE reductions, class sizes proposed up to 32, and the smallest new-teacher orientation in years.
</div>

---

## Stoneham (population ~23,000)

<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">$14.6M</div>
    <div class="key-stat-label">Failed Apr 2025</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">$9.3M</div>
    <div class="key-stat-label">Passed Dec 2025</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">43</div>
    <div class="key-stat-label">Votes separating $12.5M loss</div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">28</div>
    <div class="key-stat-label">School vacancies</div>
  </div>
</div>

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--surplus"></span>Surplus (revenue above expenditure)</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--deficit"></span>Deficit (expenditure above revenue)</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-stoneham" viewBox="0 0 720 220" role="img" aria-label="Stoneham general fund surplus or deficit (revenue minus expenditure), FY2002 to FY2025, override ballot events marked.">
<line class="case-gap-zero" x1="58.0" x2="698.0" y1="149.6" y2="149.6" />
<line class="case-grid" x1="58.0" x2="698.0" y1="50.9" y2="50.9" />
<line class="case-vote-loss" x1="225.0" x2="225.0" y1="6" y2="190.0"><title>FY2008 override failed: $3.00M</title></line>
<line class="case-vote-loss" x1="336.3" x2="336.3" y1="6" y2="190.0"><title>FY2012 override failed: $1.90M</title></line>
<path class="case-gap-surplus" d="M 60.0,149.6 L 85.8,120.7 L 102.1,149.6 L 146.3,149.6 L 169.3,145.4 L 197.1,127.4 L 225.0,135.3 L 252.8,143.6 L 272.9,149.6 L 320.8,149.6 L 336.3,132.9 L 364.1,134.7 L 391.9,133.1 L 419.7,131.8 L 447.6,114.5 L 475.4,100.3 L 503.2,114.9 L 531.0,124.3 L 558.9,110.5 L 586.7,86.3 L 614.5,93.3 L 642.3,83.9 L 670.2,33.7 L 698.0,100.8 L 698.0,149.6 Z" />
<path class="case-gap-deficit" d="M 58.0,149.6 L 58.0,151.9 L 60.0,149.6 L 102.1,149.6 L 113.7,170.3 L 141.5,150.5 L 146.3,149.6 L 272.9,149.6 L 280.6,151.9 L 308.4,163.0 L 320.8,149.6 Z" />
<polyline class="case-gap-line" points="58.0,151.9 85.8,120.7 113.7,170.3 141.5,150.5 169.3,145.4 197.1,127.4 225.0,135.3 252.8,143.6 280.6,151.9 308.4,163.0 336.3,132.9 364.1,134.7 391.9,133.1 419.7,131.8 447.6,114.5 475.4,100.3 503.2,114.9 531.0,124.3 558.9,110.5 586.7,86.3 614.5,93.3 642.3,83.9 670.2,33.7 698.0,100.8" />
<text class="case-tick" x="53.0" y="152.6" text-anchor="end">$0M</text>
<text class="case-tick" x="53.0" y="53.9" text-anchor="end">+$5M</text>
<text class="case-tick" x="58.0" y="210.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="169.3" y="210.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="280.6" y="210.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="391.9" y="210.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="503.2" y="210.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.5" y="210.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="210.0" text-anchor="middle">FY'25</text>
</svg>

<p class="case-chart-caption">Stoneham general fund, FY2002 through FY2025 (DOR DLS Schedule A). Revenues and expenditures tracked within roughly $1M of each other for 20 years. Two operating overrides failed in that window (FY2008 $3.0M, FY2012 $1.9M). The gap began widening in FY2023 and escalated into the April 2025 FY2026 $14.6M override (failed) and the December 2025 FY2027 two-tier vote ($12.5M failed, $9.3M passed); those three votes are described in the timeline below and do not appear on the chart because DLS Schedule A has not yet been filed for FY2026 or FY2027. How Stoneham maintained near-balance without override-added authority for two decades is worth separate study; see <a href="https://github.com/agbaber/marblehead/issues/602">issue #602</a>.</p>

### Timeline
- **April 2025:** $14.6M override [fails April 1, 2025, 3,432 no to 2,909 yes](https://saveourstoneham.org/blog/april-recap/) (523-vote margin, 53.6% to 45.5%; turnout 6,398 of 17,794 registered).
- **Summer 2025:** Town pulls [$1.2 million from stabilization reserves](https://stonehamcivicledger.substack.com/p/stonehams-free-cash-band-aid-to-its) to close the FY26 gap. Override Study Committee [meets weekly over the summer and votes 7-1 on August 26, 2025 that the town needs an override](https://stonehamcivicledger.substack.com/p/stonehams-override-study-committee-ab3).
- **Staff exodus:** [28 vacant school positions at the start of the school year; teachers earn up to 30% below market rate](https://saveourstoneham.org/why/); qualified candidates won't apply. Teachers have been [without a contract since July 2025](https://stonehamcivicledger.substack.com/p/collaboration-in-bargaining-an-update).
- **Firefighters:** Stoneham Fire Department reports [an 8-firefighter minimum staffing level per shift](https://www.stoneham-ma.gov/DocumentCenter/View/11032/Fire-Department-Presentation) (2024 average 8.27 per shift, at minimum 76% of the year). [NFPA 1710](https://www.nfpa.org/codes-and-standards/nfpa-1710-standard-development/1710) calls for 15-17 personnel on first-alarm residential response.
- **Library:** Finance Committee initially proposed eliminating all library funding; the Town Administrator instead proposed a [roughly 35% cut with weekend and evening closures, elimination of all paid programming, and four unfilled vacancies](https://stonehamlibrary.org/blog/announcements/stoneham-public-library-funding-update/). Loss of state certification would [forfeit approximately $57,000 in FY26 state aid plus reciprocal borrowing privileges across the Minuteman Library Network](https://stonehamcivicledger.substack.com/p/stonehams-public-library-a-fixture).
- **December 2025:** Two-tier override. [The $12.5M tier failed 3,640 to 3,596 (a 44-vote margin, reported as "43" in some accounts); the $9.3M tier passed 3,997 to 3,271](https://saveourstoneham.org/blog/dec-9-election-results/), a 726-vote margin. See also [Boston Globe, December 9, 2025](https://www.bostonglobe.com/2025/12/09/metro/stoneham-override/).
- **Result:** Stoneham received $9.3M instead of the $14.6M originally requested. Service gaps will persist.

<div class="takeaway">
  <strong>Key lesson.</strong> Even after living through cuts, the larger amount <em>still</em> nearly failed, by 43 votes. The community was deeply divided. An active information campaign (Override Study Committee, weekly public meetings) was critical to getting even the $9.3M across.
</div>

---

## Towns that rejected and did not return {#rejected-and-did-not-return}

Not every failed override leads to a return trip to the ballot. Some towns absorbed the cuts and managed within their levy limits for years. These cases are less covered in local media (sustained austerity is not a single-day news event), but they exist and represent a real alternative path.

### Easton (population ~25,000)

- **2016:** [$4.4M operating override fails](https://patch.com/massachusetts/easton-ma/easton-special-election-45m-tax-override), 3,225 no to 1,945 yes.
- **Outcome:** Easton did not return to the ballot with another operating override for **nine years**. The town's last approved operating override was in 2006. The 2016 rejection led to a decade of constrained budgets managed within the levy limit.
- **June 2025:** Easton finally returned with a [$7.3M operating override, which also failed](https://www.yahoo.com/news/7-3m-easton-override-fails-015746254.html), 3,754 no to 2,252 yes. The town then implemented what officials described as the most severe service reductions since the 2008 financial crisis, including the equivalent of 47 school FTEs.
- **Takeaway:** Easton rejected overrides in both 2016 and 2025 and absorbed the consequences each time. Nine years separated the two attempts.

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--surplus"></span>Surplus (revenue above expenditure)</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--deficit"></span>Deficit (expenditure above revenue)</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-easton" viewBox="0 0 720 220" role="img" aria-label="Easton general fund surplus or deficit (revenue minus expenditure), FY2002 to FY2025, override ballot events marked.">
<line class="case-gap-zero" x1="58.0" x2="698.0" y1="144.4" y2="144.4" />
<line class="case-grid" x1="58.0" x2="698.0" y1="17.1" y2="17.1" />
<line class="case-vote-loss" x1="475.4" x2="475.4" y1="6" y2="190.0"><title>FY2017 override failed: $4.40M</title></line>
<path class="case-gap-surplus" d="M 58.0,144.4 L 58.0,134.1 L 74.7,144.4 L 89.2,144.4 L 113.7,93.9 L 141.5,137.2 L 169.3,103.9 L 197.1,92.2 L 217.2,144.4 L 254.0,144.4 L 280.6,112.4 L 308.4,138.2 L 336.3,109.3 L 364.1,139.2 L 373.7,144.4 L 402.2,144.4 L 419.7,127.9 L 447.6,103.9 L 475.4,112.4 L 503.2,127.6 L 529.9,144.4 L 531.9,144.4 L 558.9,122.0 L 586.7,39.5 L 614.5,83.7 L 642.3,118.2 L 667.9,144.4 L 673.2,144.4 L 698.0,125.4 L 698.0,144.4 Z" />
<path class="case-gap-deficit" d="M 74.7,144.4 L 85.8,151.2 L 89.2,144.4 L 217.2,144.4 L 225.0,164.5 L 252.8,145.8 L 254.0,144.4 L 373.7,144.4 L 391.9,154.0 L 402.2,144.4 L 529.9,144.4 L 531.0,145.1 L 531.9,144.4 L 667.9,144.4 L 670.2,146.7 L 673.2,144.4 Z" />
<polyline class="case-gap-line" points="58.0,134.1 85.8,151.2 113.7,93.9 141.5,137.2 169.3,103.9 197.1,92.2 225.0,164.5 252.8,145.8 280.6,112.4 308.4,138.2 336.3,109.3 364.1,139.2 391.9,154.0 419.7,127.9 447.6,103.9 475.4,112.4 503.2,127.6 531.0,145.1 558.9,122.0 586.7,39.5 614.5,83.7 642.3,118.2 670.2,146.7 698.0,125.4" />
<text class="case-tick" x="53.0" y="147.4" text-anchor="end">$0M</text>
<text class="case-tick" x="53.0" y="20.1" text-anchor="end">+$5M</text>
<text class="case-tick" x="58.0" y="210.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="169.3" y="210.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="280.6" y="210.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="391.9" y="210.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="503.2" y="210.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.5" y="210.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="210.0" text-anchor="middle">FY'25</text>
</svg>

<p class="case-chart-caption">Easton general fund, FY2002 through FY2025 (DOR DLS Schedule A). Revenues and expenditures stayed within roughly $2M of each other for the entire period despite the FY2017 $4.4M override loss marked on the chart. The June 2025 FY2026 $7.3M override loss is described above and falls beyond the data window. Easton's pattern is balanced operation absent override-added authority, with the post-FY2025 service cuts (47 school FTEs) yet to appear in Schedule A.</p>

### Newton (population ~88,000)

- **March 2023:** [$9.2M operating override fails](https://www.wbur.org/news/2023/03/15/newton-tax-override-vote-results), 10,566 no to 9,428 yes. (Voters approved two debt exclusion questions on the same ballot.)
- **Outcome:** As of April 2026, Newton has not returned with another operating override attempt, more than three years later. Newton Public Schools faced an $8M shortfall in the FY2024 budget and implemented staff and program cuts. The austerity contributed to labor tensions that culminated in a [two-week teachers' strike in winter 2024](https://www.wbur.org/news/2024/02/01/newton-teachers-strike-explainer). The School Committee approved a FY2026 budget with a [$2-3M funding gap](https://www.figcitynews.com/2025/04/next-steps-after-school-committee-approves-nps-budget-with-2-3-million-funding-gap/) rather than returning to the ballot.
- **Takeaway:** Newton absorbed three years of budget pressure after rejecting a $9.2M override, including a teachers' strike driven partly by fiscal constraints.

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--surplus"></span>Surplus (revenue above expenditure)</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--deficit"></span>Deficit (expenditure above revenue)</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-newton" viewBox="0 0 720 220" role="img" aria-label="Newton general fund surplus or deficit (revenue minus expenditure), FY2002 to FY2025, override ballot events marked.">
<line class="case-grid" x1="58.0" x2="698.0" y1="142.6" y2="142.6" />
<line class="case-gap-zero" x1="58.0" x2="698.0" y1="93.0" y2="93.0" />
<line class="case-grid" x1="58.0" x2="698.0" y1="43.3" y2="43.3" />
<line class="case-vote-loss" x1="670.2" x2="670.2" y1="6" y2="190.0"><title>FY2024 override failed: $9.20M</title></line>
<path class="case-gap-surplus" d="M 189.1,93.0 L 197.1,60.4 L 225.0,91.8 L 225.9,93.0 L 331.0,93.0 L 336.3,84.8 L 364.1,75.0 L 391.9,73.9 L 419.7,80.3 L 447.6,56.7 L 475.4,65.0 L 497.7,93.0 L 512.0,93.0 L 531.0,78.1 L 558.9,73.1 L 586.7,68.6 L 614.5,31.0 L 642.3,47.8 L 670.2,40.9 L 698.0,49.2 L 698.0,93.0 Z" />
<path class="case-gap-deficit" d="M 58.0,93.0 L 58.0,149.3 L 85.8,150.4 L 113.7,160.2 L 141.5,101.7 L 169.3,173.0 L 189.1,93.0 L 225.9,93.0 L 252.8,124.6 L 280.6,114.2 L 308.4,128.2 L 331.0,93.0 L 497.7,93.0 L 503.2,99.8 L 512.0,93.0 Z" />
<polyline class="case-gap-line" points="58.0,149.3 85.8,150.4 113.7,160.2 141.5,101.7 169.3,173.0 197.1,60.4 225.0,91.8 252.8,124.6 280.6,114.2 308.4,128.2 336.3,84.8 364.1,75.0 391.9,73.9 419.7,80.3 447.6,56.7 475.4,65.0 503.2,99.8 531.0,78.1 558.9,73.1 586.7,68.6 614.5,31.0 642.3,47.8 670.2,40.9 698.0,49.2" />
<text class="case-tick" x="53.0" y="145.6" text-anchor="end">$-20M</text>
<text class="case-tick" x="53.0" y="96.0" text-anchor="end">$0M</text>
<text class="case-tick" x="53.0" y="46.3" text-anchor="end">+$20M</text>
<text class="case-tick" x="58.0" y="210.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="169.3" y="210.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="280.6" y="210.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="391.9" y="210.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="503.2" y="210.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.5" y="210.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="210.0" text-anchor="middle">FY'25</text>
</svg>

<p class="case-chart-caption">Newton general fund, FY2002 through FY2025 (DOR DLS Schedule A). The FY2024 override loss is marked. Newton has run general fund surpluses every year since FY2019 and was running a $21M surplus in FY2024 when the override question went to the ballot, which is one reason the failed override has not driven Newton back to the ballot. The pre-FY2010 expenditure spikes likely reflect UMAS reclassification of intergovernmental transfers rather than operating losses.</p>

### Structural alternatives towns have used

The cases above focus on what happened after a "no" vote. A separate question is whether structural changes can reduce the need for an override in the first place. Some Massachusetts towns have used these tools to close gaps or extend the runway before an override became necessary.

**Health insurance reform.** The single largest structural lever. Massachusetts's 2011 Municipal Health Insurance Reform Act ([Chapter 69 of the Acts of 2011](https://malegislature.gov/Laws/SessionLaws/Acts/2011/Chapter69)) allowed towns to change plan design (copays, deductibles, tiered networks) through a streamlined bargaining process. In the first year, [127 municipalities negotiated more than $178 million in savings](https://www.mma.org/advocacy/health-savings-for-cities-towns-and-taxpayers/) statewide (Massachusetts Taxpayers Foundation, July 2012). Specific examples:

- **Lynnfield:** In 2003, selectmen changed retiree health coverage despite union opposition, [saving roughly $150,000 per year](https://www.eagletribune.com/how-one-town-cut-costs-improved-benefits/article_a8960972-e234-5529-aae1-a52166597977.html). Town officials said the change "allowed us to fund government" and "avoided an override that year." Over time, retirees found the benefits were as good or better than the prior plan.
- **Framingham:** Plan design changes under the 2011 reform saved nearly $3 million in year one.
- In FY2027, [11 municipal entities are joining the GIC](https://www.statehousenews.com/news/healthcare/costs-push-13-municipal-entities-to-join-state-run-health-plan/article_dbe914fd-4342-4edb-90d5-a1bd50f0f57c.html) (the state employee health plan), the largest wave in over a decade, triggered by a 20% premium increase and GLP-1 drug cost pressures.

**Service regionalization.** Towns have consolidated dispatch, public health, and administrative functions to share fixed costs. [SEMRECC](https://www.se-mass911.org/home) (Southeastern MA Regional 911 District) consolidated emergency dispatch for Easton, Foxborough, Mansfield, and Norton into a shared center. A [Federal Reserve Bank of Boston analysis](https://www.bostonfed.org/publications/new-england-public-policy-center-policy-brief/2013/saving-costs-through-regional-consolidation-public-safety-answering-points-in-massachusetts.aspx) estimated that aggressive dispatch consolidation could save 25-60% in operating costs for those functions.

**Malden (population ~66,000): the 44-year case.** Malden never asked voters for an operating override from 1982 through early 2026, one of the longest such streaks among Massachusetts cities. The city restructured pension payments and [switched to the GIC](https://www.cityofmalden.org/faq.aspx?TID=24), projecting $3M in annual health insurance savings. The streak ended March 31, 2026, when Malden's [first-ever override ($5.4M) failed by 124 votes](https://www.bostonglobe.com/2026/04/01/metro/malden-election-results/) (48.5% to 50.7%), with roughly 60 positions now expected to be cut. Malden's history is both the strongest evidence that structural tools can extend a town's runway for decades and a reminder that those tools can eventually run out.

**Honest limits.** These structural changes are real and have generated significant savings. But most are one-time gains (switching to the GIC, consolidating dispatch) that get overwhelmed by ongoing cost growth. No Massachusetts town has been widely cited as a clean success story where an override rejection led to structural reform and long-term fiscal health. The research suggests that structural tools extend the timeline but do not eliminate the underlying math of costs growing faster than the levy limit.

---

## Statewide Pattern

- **Override surge.** In FY26 alone, [at least 54 Massachusetts municipalities put 74 override or debt-exclusion questions before voters, totaling more than $158 million in proposed new levy capacity](https://marbleheadcurrent.org/2026/03/17/overriding-considerations-tough-choices-prompts-surge-of-override-requests-statewide/) (Marblehead Current citing Mass. Budget and Policy Center). That is the second-largest single-year total since the early 1990s. FY25 added roughly $48 million more.
- **Fail, then return.** [Analysis of Massachusetts Department of Revenue data](https://saveourstoneham.org/blog/april-recap/) (compiled by Save Our Stoneham) finds that of towns that put a failed override back to voters, 590 passed within one year, and 100 passed within 60 days via special elections. The underlying primary data is [MA DOR Proposition 2½ Override and Underride Votes](https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride).
- **Towns that fail and return typically ask for more:**
  - Auburn (2006): $500K failed, $1.3M passed 33 days later (+160%). ([Save Our Stoneham](https://saveourstoneham.org/blog/april-recap/) analysis of DOR data.)
  - Reading (2003): $250K failed, $4.5M passed 42 days later (+1,700%). Same source.
  - Melrose (2024-2025): $7.7M failed, $13.5M passed 17 months later (+75%).
- **Operating override success rate.** The Massachusetts Municipal Association reports recent success rates around [58-60%](https://www.mma.org/communities-see-varying-success-with-overrides-this-spring/), with voters rejecting more than 40% of operating-override questions since the FY23 surge began. Debt exclusions historically pass at roughly 80-85% statewide.
- **Marblehead's own history** (MA DOR primary data, pulled 2026-04-11, see `data/marblehead_prop25_votes.csv`):
  - Operating overrides: 4 of 13 ballot attempts approved (31% success rate) since 1990, the earliest year in the DOR record. Last success: June 2005, $2.73M supplemental override for the FY2006 budget.
  - Debt exclusions: 28 of 29 ballot attempts approved (97% success rate) since 1982. The only loss in 43 years was the June 2002 Tucker's Wharf bond by 136 votes.
  - Source: [MA DOR Proposition 2½ Override and Underride Votes](https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride).

---

## Marblehead in Context

### What happened the last time Marblehead passed an override

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--surplus"></span>Surplus (revenue above expenditure)</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--deficit"></span>Deficit (expenditure above revenue)</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-marblehead" viewBox="0 0 720 220" role="img" aria-label="Marblehead general fund surplus or deficit (revenue minus expenditure), FY2002 to FY2024, override ballot events marked.">
<line class="case-grid" x1="58.0" x2="698.0" y1="180.1" y2="180.1" />
<line class="case-grid" x1="58.0" x2="698.0" y1="121.7" y2="121.7" />
<line class="case-gap-zero" x1="58.0" x2="698.0" y1="63.3" y2="63.3" />
<line class="case-vote-win" x1="58.0" x2="58.0" y1="6" y2="190.0"><title>FY2002 override passed: $0.30M</title></line>
<line class="case-vote-win" x1="116.2" x2="116.2" y1="6" y2="190.0"><title>FY2004 override passed: $1.38M</title></line>
<line class="case-vote-loss" x1="134.0" x2="134.0" y1="6" y2="190.0"><title>FY2005 override failed: $0.48M</title></line>
<line class="case-vote-win" x1="138.5" x2="138.5" y1="6" y2="190.0"><title>FY2005 override passed: $0.42M</title></line>
<line class="case-vote-loss" x1="143.0" x2="143.0" y1="6" y2="190.0"><title>FY2005 override failed: $0.13M</title></line>
<line class="case-vote-win" x1="147.5" x2="147.5" y1="6" y2="190.0"><title>FY2005 override passed: $0.07M</title></line>
<line class="case-vote-loss" x1="152.0" x2="152.0" y1="6" y2="190.0"><title>FY2005 override failed: $0.06M</title></line>
<line class="case-vote-win" x1="156.5" x2="156.5" y1="6" y2="190.0"><title>FY2005 override passed: $0.02M</title></line>
<line class="case-vote-win" x1="174.4" x2="174.4" y1="6" y2="190.0"><title>FY2006 override passed: $2.73M</title></line>
<line class="case-vote-loss" x1="348.9" x2="348.9" y1="6" y2="190.0"><title>FY2012 override failed: $0.67M</title></line>
<line class="case-vote-loss" x1="668.9" x2="668.9" y1="6" y2="190.0"><title>FY2023 override failed: $3.05M</title></line>
<line class="case-vote-loss" x1="698.0" x2="698.0" y1="6" y2="190.0"><title>FY2024 override failed: $2.47M</title></line>
<path class="case-gap-surplus" d="M 266.6,63.3 L 290.7,56.7 L 319.8,62.7 L 348.9,46.4 L 378.0,47.3 L 407.1,31.0 L 436.2,36.5 L 465.3,34.4 L 494.4,41.4 L 523.5,61.1 L 545.3,63.3 L 554.1,63.3 L 581.6,50.5 L 610.7,58.4 L 639.8,58.9 L 657.7,63.3 Z" />
<path class="case-gap-deficit" d="M 58.0,63.3 L 58.0,128.1 L 87.1,152.6 L 116.2,173.0 L 145.3,164.7 L 174.4,152.0 L 203.5,91.2 L 232.5,65.9 L 261.6,64.7 L 266.6,63.3 L 545.3,63.3 L 552.5,64.1 L 554.1,63.3 L 657.7,63.3 L 668.9,66.1 L 698.0,72.0 L 698.0,63.3 Z" />
<polyline class="case-gap-line" points="58.0,128.1 87.1,152.6 116.2,173.0 145.3,164.7 174.4,152.0 203.5,91.2 232.5,65.9 261.6,64.7 290.7,56.7 319.8,62.7 348.9,46.4 378.0,47.3 407.1,31.0 436.2,36.5 465.3,34.4 494.4,41.4 523.5,61.1 552.5,64.1 581.6,50.5 610.7,58.4 639.8,58.9 668.9,66.1 698.0,72.0" />
<text class="case-tick" x="53.0" y="183.1" text-anchor="end">$-10M</text>
<text class="case-tick" x="53.0" y="124.7" text-anchor="end">$-5M</text>
<text class="case-tick" x="53.0" y="66.3" text-anchor="end">$0M</text>
<text class="case-tick" x="58.0" y="210.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="174.4" y="210.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="290.7" y="210.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="407.1" y="210.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="523.5" y="210.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="639.8" y="210.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="210.0" text-anchor="middle">FY'24</text>
</svg>

<p class="case-chart-caption">Marblehead general fund, FY2002 through FY2024 (DOR DLS Schedule A; FY2025 not yet filed). Expenditures exceeded revenues by $5M to $9M per year FY2002 through FY2006. Six override questions passed in that cluster (FY2002 sewers, FY2004 supplemental budget, FY2005 school, library, waste collection, and FY2006 operating) added $4.92M of permanent levy authority. The gap closed within three years and the town ran roughly balanced for eleven years. From FY2018 through FY2024 the gap reopened and three operating overrides (FY2012, FY2023, FY2024) failed at the ballot.</p>

### Comparison table

<div class="table-wrap">
  <table class="data">
    <thead>
      <tr>
        <th></th>
        <th>Marblehead</th>
        <th>Melrose</th>
        <th>Stoneham</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Deficit</td>
        <td>$8.47M</td>
        <td>$7.7M (2024)</td>
        <td>$14.6M</td>
      </tr>
      <tr>
        <td>Override structure</td>
        <td>3-tier $9M / $12M / $15M</td>
        <td>3-tier $9.3M / $11.9M / $13.5M</td>
        <td>2-tier $9.3M / $12.5M</td>
      </tr>
      <tr>
        <td>FY26 residential rate</td>
        <td>$8.56</td>
        <td>$11.47 (post-override)</td>
        <td>$10.06</td>
      </tr>
      <tr>
        <td>Tier 3 / max post-override rate</td>
        <td>~$10.06</td>
        <td>$11.47</td>
        <td>N/A yet</td>
      </tr>
      <tr>
        <td>Previous failed attempt</td>
        <td>FY24 (~400 votes)</td>
        <td>Jun 2024 (~900 votes)</td>
        <td>Apr 2025</td>
      </tr>
      <tr>
        <td>Median home</td>
        <td>$1,010,100</td>
        <td>$817,630</td>
        <td>lower</td>
      </tr>
    </tbody>
  </table>
</div>

Even at Tier 3 ($15M), Marblehead's rate ($10.06) would be lower than Melrose's post-override rate ($11.47) and roughly equal to Stoneham's current rate ($10.06). Marblehead has the lowest baseline rate of all four comparison towns and would still have the lowest rate after any tier passes.

---

## Sources

**Melrose**
- [Commonwealth Beacon, "After a Prop 2.5 defeat, Melrose passes $13.5 million override," November 2025](https://commonwealthbeacon.org/government/local-government/after-a-prop-2-%C2%BD-defeat-last-year-melrose-passes-13-5-million-override/)
- [Melrose Messenger, "Back to School Staffing Changes," August 2025](https://themelrosemessenger.org/articles/2025/08/schools.html)
- [Melrose Messenger, "Override" (September 2025)](https://themelrosemessenger.org/articles/2025/09/override.html)
- [Melrose Messenger, "Results" (November 2025)](https://themelrosemessenger.org/articles/2025/11/results.html)
- [Yes for Melrose, "Why an Override?"](https://www.yesformelrose.org/why-an-override)
- [Patch, "Melrose Override Special Election: Results & Live Updates" (June 2024)](https://patch.com/massachusetts/melrose/melrose-override-special-election-results-live-updates)
- [DESE per-pupil expenditures](https://profiles.doe.mass.edu/statereport/ppx.aspx)

**Stoneham**
- [Save Our Stoneham, "April Recap"](https://saveourstoneham.org/blog/april-recap/)
- [Save Our Stoneham, "Dec 9 Election Results"](https://saveourstoneham.org/blog/dec-9-election-results/)
- [Save Our Stoneham, "Why Stoneham Needs an Override"](https://saveourstoneham.org/why/)
- [Stoneham Civic Ledger, "Free Cash Band-Aid to its Budget"](https://stonehamcivicledger.substack.com/p/stonehams-free-cash-band-aid-to-its)
- [Stoneham Civic Ledger, "Override Study Committee"](https://stonehamcivicledger.substack.com/p/stonehams-override-study-committee-ab3)
- [Stoneham Civic Ledger, "Stoneham's Public Library, A Fixture"](https://stonehamcivicledger.substack.com/p/stonehams-public-library-a-fixture)
- [Stoneham Civic Ledger, "Collaboration in Bargaining: An Update"](https://stonehamcivicledger.substack.com/p/collaboration-in-bargaining-an-update)
- [Stoneham Fire Department, "Why the Override Matters" (town document)](https://www.stoneham-ma.gov/DocumentCenter/View/11032/Fire-Department-Presentation)
- [Stoneham Public Library, funding update](https://stonehamlibrary.org/blog/announcements/stoneham-public-library-funding-update/)
- [Boston Globe, Stoneham override coverage, December 9, 2025](https://www.bostonglobe.com/2025/12/09/metro/stoneham-override/)

**Easton**
- [Patch, "Easton Special Election: $4.5M Tax Override" (2016)](https://patch.com/massachusetts/easton-ma/easton-special-election-45m-tax-override)
- [Yahoo News, "$7.3M Easton override fails by nearly two-to-one margin" (June 2025)](https://www.yahoo.com/news/7-3m-easton-override-fails-015746254.html)
- [Town of Easton, FY2026 override page](https://www.easton.ma.us/override/)

**Newton**
- [WBUR, "With tax override defeated, Newton leaders fear student impacts" (March 2023)](https://www.wbur.org/news/2023/03/15/newton-tax-override-vote-results)
- [Fig City News, "Next steps after School Committee approves NPS budget with $2-3 million funding gap" (April 2025)](https://www.figcitynews.com/2025/04/next-steps-after-school-committee-approves-nps-budget-with-2-3-million-funding-gap/)

**Structural alternatives**
- [Eagle Tribune, "How one town cut costs, improved benefits" (Lynnfield health insurance reform)](https://www.eagletribune.com/how-one-town-cut-costs-improved-benefits/article_a8960972-e234-5529-aae1-a52166597977.html)
- [Massachusetts Taxpayers Foundation / MMA, "Health Savings for Cities, Towns, and Taxpayers" (2012)](https://www.mma.org/advocacy/health-savings-for-cities-towns-and-taxpayers/)
- [State House News, "Costs push 13 municipal entities to join state-run health plan" (FY2027 GIC wave)](https://www.statehousenews.com/news/healthcare/costs-push-13-municipal-entities-to-join-state-run-health-plan/article_dbe914fd-4342-4edb-90d5-a1bd50f0f57c.html)
- [Federal Reserve Bank of Boston, "Saving Costs Through Regional Consolidation" (dispatch consolidation analysis)](https://www.bostonfed.org/publications/new-england-public-policy-center-policy-brief/2013/saving-costs-through-regional-consolidation-public-safety-answering-points-in-massachusetts.aspx)
- [SEMRECC, Southeastern MA Regional 911 District](https://www.se-mass911.org/home)
- [GBH, "Malden residents head to polls to vote on first-ever tax override" (March 2026)](https://www.wgbh.org/news/local/2026-03-31/malden-residents-head-to-polls-to-vote-on-first-ever-tax-override)
- [Boston Globe, "Malden election results" (April 2026)](https://www.bostonglobe.com/2026/04/01/metro/malden-election-results/)
- [City of Malden, Override FAQ](https://www.cityofmalden.org/faq.aspx?TID=24)
- [Chapter 69 of the Acts of 2011 (Municipal Health Insurance Reform)](https://malegislature.gov/Laws/SessionLaws/Acts/2011/Chapter69)

**Statewide**
- [Marblehead Current, "Overriding Considerations: Tough choices prompt surge of override requests statewide," March 17, 2026](https://marbleheadcurrent.org/2026/03/17/overriding-considerations-tough-choices-prompts-surge-of-override-requests-statewide/)
- [Massachusetts Municipal Association, "Communities see varying success with overrides this spring"](https://www.mma.org/communities-see-varying-success-with-overrides-this-spring/)
- [MA DOR Proposition 2½ Override and Underride Votes](https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride)
- [MA DOR Tax Rates by Class](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.taxratesbyclass.taxratesbyclass_main)
- [NFPA 1710, Standard for the Organization and Deployment of Fire Suppression Operations](https://www.nfpa.org/codes-and-standards/nfpa-1710-standard-development/1710)
