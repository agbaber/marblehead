# Visualizing level-funded cuts: a failed chart and an unexpected finding

**Date:** 2026-04-24
**Status:** Experiment retrospective
**Working artifacts:** `docs/analysis/2026-04-24-level-funding-mechanism.md`, PR #658
**Outcome:** No chart shipped. One analytical finding worth keeping.

## What we set out to do

The opening question, verbatim: *"i cant stop thinking about 'level-funded' cuts that have been happening (https://marbleheaddata.org/what-have-we-tried.html), how can we visualize this? it seems like people not be aware that just to stay afloat (pre-override) we've been cutting services just to keep the budget balanced."*

The thesis to communicate:

> "Marblehead has been cutting services for years to keep the levy from rising. Residents do not realize this. A visualization would make the silent cuts visible."

Two assumptions baked into that thesis: (1) the cuts are real and substantial, (2) they have a cause that visualizes well. Neither survived contact with the data.

## Attempt 1: the dots chart

### The pitch

Hand-authored SVG chart at `charts/positions-lost.html`. One filled circle per FTE position still funded, one outlined circle per position eliminated, grouped by department. The thesis: "every outlined dot is a job that used to exist and doesn't anymore."

Spec: `docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md` (committed to PR #653). Plan: `docs/superpowers/plans/2026-04-24-positions-lost-chart.md`.

### Process

Standard brainstorming flow: clarifying questions, three approaches presented (dot grid / slopegraph / cards), user picked dots. Wrote spec, wrote plan, executed via subagents in three phases (data verification, chart scaffold + rows, caption + page link).

### What surfaced during data verification (Phase A)

The Phase A data-verification agent caught a spec error: Community Development was going to be "4 to 1 over FY18-FY27" in the chart, but the department was *created* in FY26. Trajectory is 0 → 4 → 1 over the window. A net *gain* of 1 position. Showing "4 to 1" would have been rhetorical sleight of hand.

The row was removed; "All other" residual was recalculated to ~134 → ~139 (net +5) accounting for the HR director hire (FY24), CD&P creation (FY26), and procurement director (FY26). Net town-wide stayed at -9.

This was already a warning sign about the underlying thesis: *some* departments lost positions, but other departments grew. The net is small.

### Why the chart did not work

Built it, pushed to Cloudflare preview, took screenshots at desktop (1280px) and mobile (375px).

**Desktop:** loss rows (DPW, Police, Engineering) read clearly at the top of the chart. Fire callout fits. The "All other" row was originally rendered as 139 filled dots, which visually dominated the page (a wall of black dots between the named-loss rows and the total). Inline edit converted "All other" to a text-only callout; that fix improved the layout.

**The actual problem**, on viewing the final preview:

- "199 → 190 over 9 years" reads as "1 position per year, no big deal." A skeptic skimming the chart concludes the cuts were not substantial.
- The Town total row (190 filled dots, 9 outlined dots in the corner) visually shouts "we mostly held the line."
- The honest "All other +5" disclosure pre-empts the obvious "but you also added jobs" rebuttal, but it also softens the story.
- The chart visualizes the *outcome* (FTE count) when the user's actual frame was the *mechanism* (level-funded budgets). Headcount is the wrong hero. By the time someone is "lost," the budget has been losing real purchasing power for years before the position even comes off the books.

The user's reaction to the preview: *"idk how helpful this is."*

That was the right reaction. The chart was honest, accurate, and unhelpful.

### What we wasted, what we didn't

Wasted: ~3 phases of subagent work building the chart. Spec, plan, six dot rows, captions, citations, parent-page link. ~6 commits on a branch we are unlikely to merge.

Did not waste: the data verification itself (caught the Community Development misframe; that finding survives independently of any chart). And the experience of building it, which made the next attempt sharper.

## Attempt 2: the budget squeeze chart

### The pitch

Pivot from outcome to mechanism. Stacked area chart of general fund composition over FY18-FY27. The thesis: "mandatory costs (healthcare, pensions, debt service) ate the levy growth, leaving the discretionary share to shrink. That contraction is the silent cut."

This was Story B, kicking around since the very beginning of the conversation when both A (headcount) and B (purchasing power) were on the table.

### What stopped it before a single SVG line was written

Pulled the actual data from `data/general_fund_spending_FY15-26.csv`, `data/group_insurance_FY14-27.csv`, `data/pension_expenditure_FY15-24.csv`, `data/cpi_us.csv`, and `data/marblehead_levy.csv`.

Did the math:

| Series | FY18-FY27 CAGR |
|---|---:|
| Property tax levy | +2.97%/yr |
| Healthcare (group insurance) | +2.76%/yr |
| Pension assessment FY18-FY24 | +0.91%/yr |
| CPI-U | +3.78%/yr |

Healthcare grew *slower* than the levy. Pensions grew *much* slower than the levy. As shares of the general fund, both *decreased* over the window (HC 16.0% → 13.6%; pension share also fell).

The squeeze chart concept does not survive this data. Mandatory costs did not squeeze operations over FY18-FY26. The CLAUDE.md memory note `project_healthcare_trend_vs_cliff` was already pointing at this for healthcare specifically (HC grew slower than CPI over FY12-FY26); the fuller analysis generalizes it.

This was a real "data resists desired story" moment. The override talking points commonly blame healthcare and pensions. The data does not back that up for this window.

## The unexpected finding

If healthcare and pensions did not eat the budget, what did? Decomposed the +$20M FY18-FY24 general fund growth from the polygon-encoded data on `where-has-the-money-gone.html`:

| Category | FY18 ($M) | FY24 ($M) | Δ ($M) | Growth rate | vs CPI (24.9%) |
|---|---:|---:|---:|---:|---|
| Schools | 37.45 | 46.16 | +8.71 | +23.3% | slightly below |
| Debt payments | 7.15 | 11.00 | +3.85 | +53.8% | well above |
| Public Safety | 8.16 | 11.32 | +3.16 | +38.8% | above |
| Pensions (budgetary) | 2.89 | 4.54 | +1.65 | +57.1% | well above |
| Health insurance | 11.74 | 12.88 | +1.15 | +9.8% | well below |
| **Everything else** | **14.39** | **16.37** | **+1.97** | **+13.7%** | **9 pp below** |
| Total | 81.78 | 102.27 | +20.49 | +25.1% | basically at CPI |

**The squeeze concentrates in "Everything else."** That bucket (DPW, library, Council on Aging, general government, public works support, state and county charges) was held to roughly half the rate of CPI growth over six years. About 9 percentage points of real-dollar decline.

That is where the documented attrition (Engineering eliminated, DPW down 12, library hours, COA staffing) actually lives. Not in healthcare. Not in pensions. Not even in schools or public safety.

Schools held to slightly below CPI even with enrollment dropping 16%, which means per-pupil real spending modestly *increased*. Schools are expensive because of structural inflation on a smaller student base, not because spending grew.

Debt payments grew +54%, but that growth is almost entirely from voter-approved capital exclusions (Bell PK-3, Mary A. Alley, MHS roof/HVAC, Abbot Library, fire pumper, Fort Sewall). Each was its own separate yes vote. That money was never available for operations; it was specifically authorized for buildings.

Public Safety grew +39%, mostly Police and Fire wages with collective bargaining COLAs.

## What we would do differently

The original ask presupposed a chart was the right deliverable. Two attempts at a chart both ran into trouble. The deliverable that would actually serve the original goal is not a new chart at all: it is a sharper opening paragraph on the existing `what-has-the-town-done.html` page.

That page already documents the staffing cuts, the consolidations, the level-funded items. What it lacks is a framing sentence that explains *why* this happened. We now have one:

> "Marblehead's general fund grew at the rate of inflation over FY18-FY24. Schools, the largest single category, held to inflation. Public Safety wages and voter-approved capital debt grew faster. The 'everything else' bucket of operations (DPW, library, Council on Aging, general government) was held to half the rate of inflation. That is where the documented cuts and unfilled positions came from."

Two sentences. Honest. Specific. Argues with itself rather than offering a slogan.

## Lessons

1. **Popular narratives about budget pressure can be wrong.** The "healthcare and pensions are eating the budget" framing is dominant in local override-debate coverage. For Marblehead's FY18-FY26 window the data does not support it. This is a finding worth surfacing publicly even though it cuts against the rhetorical preference of override proponents. Honesty is the editorial stance.

2. **A narrow, specific claim beats a broad, vague one.** "9 positions cut over 9 years" is true but reads as small. "DPW lost 12 of 31 workers, Engineering eliminated, library hours reduced, COA staffing trimmed, all because the 'everything else' bucket was held to half of CPI growth" is also true and reads as substantial. Same data, different framing, very different effect.

3. **Visualization is not always the right deliverable.** When the data resists a single dramatic story, prose can do the work better than a chart. The dots chart was honest but unpersuasive; the right move was to abandon it rather than add visual flourishes to compensate. Two sentences of sharp prose would do more for the override conversation than any chart we considered.

4. **Data verification before design pays for itself.** The Phase A agent caught the Community Development misframe before it shipped. The squeeze chart was killed before any SVG was written. Both saves came from doing the math before building the visual. The cheapest fix is the one made before code is written.

5. **The squeeze mechanism worth communicating is real, just narrow.** Operating departments outside schools, public safety, and capital debt have been held to roughly half the rate of inflation for six years. That is the actual cut. It is a smaller story than "healthcare crisis is eating Marblehead" but it is the true one.

6. **Charts that hide their math invite the wrong rebuttal.** The dots chart visualized 9 net positions lost. The skeptic's rebuttal: "that is one position per year, hardly a crisis." Without surfacing the *real* mechanism (CPI eating level-funded budgets across a specific bucket of departments), the chart left the rebuttal stronger than the claim.

## Working artifacts

- `docs/analysis/2026-04-24-level-funding-mechanism.md` (this branch): the analytical memo with the math
- `charts/positions-lost.html` (this branch): the failed dots chart, kept for reference
- `docs/superpowers/specs/2026-04-24-positions-lost-chart-design.md`: original spec
- `docs/superpowers/plans/2026-04-24-positions-lost-chart.md`: the implementation plan
- PR #653: branch where everything above lives. Likely to be closed without merge.
- CLAUDE.md memory `project_squeeze_mechanism`: persistent record of the finding for future sessions
- CLAUDE.md memory `project_healthcare_trend_vs_cliff`: pre-existing memory that pointed at the HC piece of this finding

## What to do with this experiment

Three paths forward, in increasing ambition:

1. **Stop here.** The finding is captured in the memo and memory; future work can build on it.
2. **Do the small page rewrite.** Open a new small PR that adds the two-sentence framing to `what-has-the-town-done.html`. No new chart, no new data. ~30 minutes of work. Probably the highest-value next step.
3. **Make this experiment public on the site.** Lift portions of this retrospective into a methodology page, alongside `bias-audit.html`. Demonstrates analytical transparency. Useful for civic-data credibility. Slower; needs polish for public consumption.

Recommendation: do #2 first. Decide on #3 separately, when not in the immediate aftermath of having spent a day on a chart that did not ship.
