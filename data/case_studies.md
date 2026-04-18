---
layout: page
body_class: doc-page
title: case studies
---

<style>
  .case-chart { display: block; width: 100%; height: auto; max-width: 720px; margin: 10px auto 6px; }
  .case-chart .case-axis { stroke: var(--divider); stroke-width: 1; }
  .case-chart .case-grid { stroke: var(--divider); stroke-width: 0.5; stroke-dasharray: 2 3; }
  .case-chart .case-tick { font-size: 10px; fill: var(--text-muted); font-family: inherit; }
  .case-chart .case-rev { stroke: var(--series-revenue); stroke-width: 1.8; fill: none; }
  .case-chart .case-exp { stroke: var(--series-cost); stroke-width: 1.8; fill: none; }
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
  .case-chart-legend-swatch--rev { background: var(--series-revenue); }
  .case-chart-legend-swatch--exp { background: var(--series-cost); }
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
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--rev"></span>Total revenues</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--exp"></span>Total expenditures</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-melrose" viewBox="0 0 720 260" role="img" aria-label="Melrose general fund revenue and expenditure, FY2002 to FY2025, with override ballot results marked at top.">
<line class="case-grid" x1="54.0" x2="698.0" y1="220.1" y2="220.1" />
<line class="case-grid" x1="54.0" x2="698.0" y1="193.9" y2="193.9" />
<line class="case-grid" x1="54.0" x2="698.0" y1="167.8" y2="167.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="141.6" y2="141.6" />
<line class="case-grid" x1="54.0" x2="698.0" y1="115.5" y2="115.5" />
<line class="case-grid" x1="54.0" x2="698.0" y1="89.3" y2="89.3" />
<line class="case-grid" x1="54.0" x2="698.0" y1="63.2" y2="63.2" />
<line class="case-grid" x1="54.0" x2="698.0" y1="37.0" y2="37.0" />
<line class="case-axis" x1="54.0" x2="698.0" y1="226.0" y2="226.0" />
<line class="case-vote-loss" x1="82.0" x2="82.0" y1="6" y2="226.0"><title>FY2003: 1 override question, failed, $5.30M total</title></line>
<line class="case-vote-loss" x1="446.0" x2="446.0" y1="6" y2="226.0"><title>FY2016: 1 override question, failed, $2.25M total</title></line>
<line class="case-vote-win" x1="558.0" x2="558.0" y1="6" y2="226.0"><title>FY2020: 1 override question, passed, $5.18M total</title></line>
<line class="case-vote-loss" x1="698.0" x2="698.0" y1="6" y2="226.0"><title>FY2025: 1 override question, failed, $7.70M total</title></line>
<polyline class="case-exp" points="54.0,218.4 82.0,213.4 110.0,216.4 138.0,209.9 166.0,208.1 194.0,190.7 222.0,171.3 250.0,165.4 278.0,178.5 306.0,172.5 334.0,151.5 362.0,162.7 390.0,155.7 418.0,147.0 446.0,145.3 474.0,133.8 502.0,129.8 530.0,123.5 558.0,89.9 586.0,101.9 614.0,92.5 642.0,77.5 670.0,59.6 698.0,48.3" />
<polyline class="case-rev" points="54.0,219.4 82.0,216.1 110.0,215.4 138.0,210.1 166.0,204.7 194.0,193.4 222.0,178.8 250.0,171.5 278.0,172.8 306.0,169.6 334.0,148.9 362.0,157.3 390.0,149.9 418.0,145.5 446.0,136.7 474.0,130.4 502.0,124.4 530.0,114.6 558.0,77.3 586.0,90.1 614.0,79.0 642.0,85.6 670.0,69.0 698.0,45.3" />
<text class="case-tick" x="49.0" y="223.1" text-anchor="end">$50M</text>
<text class="case-tick" x="49.0" y="196.9" text-anchor="end">$60M</text>
<text class="case-tick" x="49.0" y="170.8" text-anchor="end">$70M</text>
<text class="case-tick" x="49.0" y="144.6" text-anchor="end">$80M</text>
<text class="case-tick" x="49.0" y="118.5" text-anchor="end">$90M</text>
<text class="case-tick" x="49.0" y="92.3" text-anchor="end">$100M</text>
<text class="case-tick" x="49.0" y="66.2" text-anchor="end">$110M</text>
<text class="case-tick" x="49.0" y="40.0" text-anchor="end">$120M</text>
<text class="case-tick" x="54.0" y="248.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="166.0" y="248.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="278.0" y="248.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="390.0" y="248.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="502.0" y="248.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.0" y="248.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="248.0" text-anchor="middle">FY'25</text>
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
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--rev"></span>Total revenues</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--exp"></span>Total expenditures</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-stoneham" viewBox="0 0 720 260" role="img" aria-label="Stoneham general fund revenue and expenditure, FY2002 to FY2025, with override ballot results marked at top.">
<line class="case-grid" x1="54.0" x2="698.0" y1="198.0" y2="198.0" />
<line class="case-grid" x1="54.0" x2="698.0" y1="163.7" y2="163.7" />
<line class="case-grid" x1="54.0" x2="698.0" y1="129.3" y2="129.3" />
<line class="case-grid" x1="54.0" x2="698.0" y1="95.0" y2="95.0" />
<line class="case-grid" x1="54.0" x2="698.0" y1="60.6" y2="60.6" />
<line class="case-axis" x1="54.0" x2="698.0" y1="226.0" y2="226.0" />
<line class="case-vote-loss" x1="222.0" x2="222.0" y1="6" y2="226.0"><title>FY2008: 1 override question, failed, $3.00M total</title></line>
<line class="case-vote-loss" x1="334.0" x2="334.0" y1="6" y2="226.0"><title>FY2012: 1 override question, failed, $1.90M total</title></line>
<polyline class="case-exp" points="54.0,218.0 82.0,212.1 110.0,206.0 138.0,206.8 166.0,201.0 194.0,195.7 222.0,187.8 250.0,187.7 278.0,189.4 306.0,183.8 334.0,166.1 362.0,177.4 390.0,166.6 418.0,165.6 446.0,159.2 474.0,152.7 502.0,144.5 530.0,134.6 558.0,130.1 586.0,128.3 614.0,116.6 642.0,84.4 670.0,71.4 698.0,54.7" />
<polyline class="case-rev" points="54.0,218.4 82.0,207.1 110.0,209.6 138.0,207.0 166.0,200.3 194.0,191.8 222.0,185.3 250.0,186.7 278.0,189.8 306.0,186.2 334.0,163.2 362.0,174.8 390.0,163.7 418.0,162.5 446.0,153.1 474.0,144.1 502.0,138.4 530.0,130.2 558.0,123.3 586.0,117.3 614.0,106.8 642.0,73.0 670.0,51.3 698.0,46.2" />
<text class="case-tick" x="49.0" y="201.0" text-anchor="end">$50M</text>
<text class="case-tick" x="49.0" y="166.7" text-anchor="end">$60M</text>
<text class="case-tick" x="49.0" y="132.3" text-anchor="end">$70M</text>
<text class="case-tick" x="49.0" y="98.0" text-anchor="end">$80M</text>
<text class="case-tick" x="49.0" y="63.6" text-anchor="end">$90M</text>
<text class="case-tick" x="54.0" y="248.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="166.0" y="248.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="278.0" y="248.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="390.0" y="248.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="502.0" y="248.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.0" y="248.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="248.0" text-anchor="middle">FY'25</text>
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
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--rev"></span>Total revenues</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--exp"></span>Total expenditures</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-easton" viewBox="0 0 720 260" role="img" aria-label="Easton general fund revenue and expenditure, FY2002 to FY2025, with override ballot results marked at top.">
<line class="case-grid" x1="54.0" x2="698.0" y1="222.8" y2="222.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="193.2" y2="193.2" />
<line class="case-grid" x1="54.0" x2="698.0" y1="163.7" y2="163.7" />
<line class="case-grid" x1="54.0" x2="698.0" y1="134.1" y2="134.1" />
<line class="case-grid" x1="54.0" x2="698.0" y1="104.5" y2="104.5" />
<line class="case-grid" x1="54.0" x2="698.0" y1="74.9" y2="74.9" />
<line class="case-grid" x1="54.0" x2="698.0" y1="45.3" y2="45.3" />
<line class="case-axis" x1="54.0" x2="698.0" y1="226.0" y2="226.0" />
<line class="case-vote-loss" x1="474.0" x2="474.0" y1="6" y2="226.0"><title>FY2017: 1 override question, failed, $4.40M total</title></line>
<polyline class="case-exp" points="54.0,219.9 82.0,215.2 110.0,212.5 138.0,204.8 166.0,197.9 194.0,185.2 222.0,168.0 250.0,166.4 278.0,165.3 306.0,155.9 334.0,156.0 362.0,148.8 390.0,139.8 418.0,131.1 446.0,128.2 474.0,121.5 502.0,113.6 530.0,110.1 558.0,105.8 586.0,104.6 614.0,88.6 642.0,70.5 670.0,56.7 698.0,47.0" />
<polyline class="case-rev" points="54.0,218.7 82.0,216.0 110.0,206.6 138.0,204.0 166.0,193.2 194.0,179.2 222.0,170.3 250.0,166.5 278.0,161.6 306.0,155.2 334.0,151.9 362.0,148.3 390.0,140.9 418.0,129.2 446.0,123.5 474.0,117.8 502.0,111.6 530.0,110.1 558.0,103.2 586.0,92.4 614.0,81.6 642.0,67.5 670.0,57.0 698.0,44.8" />
<text class="case-tick" x="49.0" y="225.8" text-anchor="end">$40M</text>
<text class="case-tick" x="49.0" y="196.2" text-anchor="end">$50M</text>
<text class="case-tick" x="49.0" y="166.7" text-anchor="end">$60M</text>
<text class="case-tick" x="49.0" y="137.1" text-anchor="end">$70M</text>
<text class="case-tick" x="49.0" y="107.5" text-anchor="end">$80M</text>
<text class="case-tick" x="49.0" y="77.9" text-anchor="end">$90M</text>
<text class="case-tick" x="49.0" y="48.3" text-anchor="end">$100M</text>
<text class="case-tick" x="54.0" y="248.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="166.0" y="248.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="278.0" y="248.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="390.0" y="248.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="502.0" y="248.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.0" y="248.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="248.0" text-anchor="middle">FY'25</text>
</svg>

<p class="case-chart-caption">Easton general fund, FY2002 through FY2025 (DOR DLS Schedule A). Revenues and expenditures stayed within roughly $2M of each other for the entire period despite the FY2017 $4.4M override loss marked on the chart. The June 2025 FY2026 $7.3M override loss is described above and falls beyond the data window. Easton's pattern is balanced operation absent override-added authority, with the post-FY2025 service cuts (47 school FTEs) yet to appear in Schedule A.</p>

### Newton (population ~88,000)

- **March 2023:** [$9.2M operating override fails](https://www.wbur.org/news/2023/03/15/newton-tax-override-vote-results), 10,566 no to 9,428 yes. (Voters approved two debt exclusion questions on the same ballot.)
- **Outcome:** As of April 2026, Newton has not returned with another operating override attempt, more than three years later. Newton Public Schools faced an $8M shortfall in the FY2024 budget and implemented staff and program cuts. The austerity contributed to labor tensions that culminated in a [two-week teachers' strike in winter 2024](https://www.wbur.org/news/2024/02/01/newton-teachers-strike-explainer). The School Committee approved a FY2026 budget with a [$2-3M funding gap](https://www.figcitynews.com/2025/04/next-steps-after-school-committee-approves-nps-budget-with-2-3-million-funding-gap/) rather than returning to the ballot.
- **Takeaway:** Newton absorbed three years of budget pressure after rejecting a $9.2M override, including a teachers' strike driven partly by fiscal constraints.

<div class="case-chart-legend">
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--rev"></span>Total revenues</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--exp"></span>Total expenditures</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-newton" viewBox="0 0 720 260" role="img" aria-label="Newton general fund revenue and expenditure, FY2002 to FY2025, with override ballot results marked at top.">
<line class="case-grid" x1="54.0" x2="698.0" y1="224.7" y2="224.7" />
<line class="case-grid" x1="54.0" x2="698.0" y1="198.8" y2="198.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="172.8" y2="172.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="146.8" y2="146.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="120.8" y2="120.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="94.8" y2="94.8" />
<line class="case-grid" x1="54.0" x2="698.0" y1="68.9" y2="68.9" />
<line class="case-grid" x1="54.0" x2="698.0" y1="42.9" y2="42.9" />
<line class="case-axis" x1="54.0" x2="698.0" y1="226.0" y2="226.0" />
<line class="case-vote-loss" x1="670.0" x2="670.0" y1="6" y2="226.0"><title>FY2024: 1 override question, failed, $9.20M total</title></line>
<polyline class="case-exp" points="54.0,208.8 82.0,197.9 110.0,193.9 138.0,201.7 166.0,181.5 194.0,198.6 222.0,185.6 250.0,174.8 278.0,172.9 306.0,167.9 334.0,172.5 362.0,166.5 390.0,155.6 418.0,146.9 446.0,141.0 474.0,132.4 502.0,116.8 530.0,111.2 558.0,106.4 586.0,101.4 614.0,85.2 642.0,77.9 670.0,66.1 698.0,53.4" />
<polyline class="case-rev" points="54.0,220.6 82.0,210.0 110.0,208.0 138.0,203.5 166.0,198.2 194.0,191.8 222.0,185.4 250.0,181.4 278.0,177.4 306.0,175.3 334.0,170.8 362.0,162.8 390.0,151.7 418.0,144.3 446.0,133.5 474.0,126.5 502.0,118.2 530.0,108.1 558.0,102.2 586.0,96.2 614.0,72.3 642.0,68.5 670.0,55.2 698.0,44.2" />
<text class="case-tick" x="49.0" y="227.7" text-anchor="end">$200M</text>
<text class="case-tick" x="49.0" y="201.8" text-anchor="end">$250M</text>
<text class="case-tick" x="49.0" y="175.8" text-anchor="end">$300M</text>
<text class="case-tick" x="49.0" y="149.8" text-anchor="end">$350M</text>
<text class="case-tick" x="49.0" y="123.8" text-anchor="end">$400M</text>
<text class="case-tick" x="49.0" y="97.8" text-anchor="end">$450M</text>
<text class="case-tick" x="49.0" y="71.9" text-anchor="end">$500M</text>
<text class="case-tick" x="49.0" y="45.9" text-anchor="end">$550M</text>
<text class="case-tick" x="54.0" y="248.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="166.0" y="248.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="278.0" y="248.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="390.0" y="248.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="502.0" y="248.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="614.0" y="248.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="248.0" text-anchor="middle">FY'25</text>
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
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--rev"></span>Total revenues</span>
  <span><span class="case-chart-legend-swatch case-chart-legend-swatch--exp"></span>Total expenditures</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--win"></span>Override passed</span>
  <span><span class="case-chart-legend-tick case-chart-legend-tick--loss"></span>Override failed</span>
</div>

<svg class="case-chart" id="case-chart-marblehead" viewBox="0 0 720 260" role="img" aria-label="Marblehead general fund revenue and expenditure, FY2002 to FY2024, with override ballot results marked at top.">
<line class="case-grid" x1="54.0" x2="698.0" y1="202.7" y2="202.7" />
<line class="case-grid" x1="54.0" x2="698.0" y1="171.6" y2="171.6" />
<line class="case-grid" x1="54.0" x2="698.0" y1="140.5" y2="140.5" />
<line class="case-grid" x1="54.0" x2="698.0" y1="109.4" y2="109.4" />
<line class="case-grid" x1="54.0" x2="698.0" y1="78.3" y2="78.3" />
<line class="case-grid" x1="54.0" x2="698.0" y1="47.2" y2="47.2" />
<line class="case-axis" x1="54.0" x2="698.0" y1="226.0" y2="226.0" />
<line class="case-vote-win" x1="54.0" x2="54.0" y1="6" y2="226.0"><title>FY2002: 1 override question, passed, $0.30M total</title></line>
<line class="case-vote-win" x1="112.5" x2="112.5" y1="6" y2="226.0"><title>FY2004: 1 override question, passed, $1.38M total</title></line>
<line class="case-vote-loss" x1="130.6" x2="130.6" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-win" x1="135.1" x2="135.1" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-loss" x1="139.6" x2="139.6" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-win" x1="144.1" x2="144.1" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-loss" x1="148.6" x2="148.6" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-win" x1="153.1" x2="153.1" y1="6" y2="226.0"><title>FY2005: 6 override questions, 3W/3L, $1.18M total</title></line>
<line class="case-vote-win" x1="171.1" x2="171.1" y1="6" y2="226.0"><title>FY2006: 1 override question, passed, $2.73M total</title></line>
<line class="case-vote-loss" x1="346.7" x2="346.7" y1="6" y2="226.0"><title>FY2012: 1 override question, failed, $0.67M total</title></line>
<line class="case-vote-loss" x1="668.7" x2="668.7" y1="6" y2="226.0"><title>FY2023: 1 override question, failed, $3.05M total</title></line>
<line class="case-vote-loss" x1="698.0" x2="698.0" y1="6" y2="226.0"><title>FY2024: 1 override question, failed, $2.47M total</title></line>
<polyline class="case-exp" points="54.0,197.4 83.3,195.3 112.5,182.6 141.8,174.4 171.1,159.6 200.4,171.6 229.6,172.5 258.9,170.3 288.2,165.8 317.5,160.4 346.7,157.5 376.0,154.3 405.3,148.2 434.5,139.6 463.8,131.9 493.1,120.3 522.4,107.4 551.6,98.0 580.9,94.7 610.2,89.9 639.5,58.1 668.7,57.8 698.0,45.6" />
<polyline class="case-rev" points="54.0,214.7 83.3,219.0 112.5,211.8 141.8,201.4 171.1,183.2 200.4,179.0 229.6,173.1 258.9,170.7 288.2,164.0 317.5,160.2 346.7,153.0 376.0,150.0 405.3,139.6 434.5,132.5 463.8,124.2 493.1,114.5 522.4,106.8 551.6,98.2 580.9,91.2 610.2,88.6 639.5,56.9 668.7,58.6 698.0,47.9" />
<text class="case-tick" x="49.0" y="205.7" text-anchor="end">$50M</text>
<text class="case-tick" x="49.0" y="174.6" text-anchor="end">$60M</text>
<text class="case-tick" x="49.0" y="143.5" text-anchor="end">$70M</text>
<text class="case-tick" x="49.0" y="112.4" text-anchor="end">$80M</text>
<text class="case-tick" x="49.0" y="81.3" text-anchor="end">$90M</text>
<text class="case-tick" x="49.0" y="50.2" text-anchor="end">$100M</text>
<text class="case-tick" x="54.0" y="248.0" text-anchor="middle">FY'02</text>
<text class="case-tick" x="171.1" y="248.0" text-anchor="middle">FY'06</text>
<text class="case-tick" x="288.2" y="248.0" text-anchor="middle">FY'10</text>
<text class="case-tick" x="405.3" y="248.0" text-anchor="middle">FY'14</text>
<text class="case-tick" x="522.4" y="248.0" text-anchor="middle">FY'18</text>
<text class="case-tick" x="639.5" y="248.0" text-anchor="middle">FY'22</text>
<text class="case-tick" x="698.0" y="248.0" text-anchor="middle">FY'24</text>
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
