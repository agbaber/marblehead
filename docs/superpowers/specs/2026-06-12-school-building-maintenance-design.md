---
title: "School building maintenance: page design"
status: spec
date: 2026-06-12
---

# School building maintenance &mdash; page design

## Context

PR #850 added `data/school_maintenance_notes.md` &mdash; a research handoff
identifying a $5M+ deferred-maintenance backlog from the 2021 EBI-derived
Capital Facilities Plan and recommending a public page. The notes flagged
several open questions: when older buildings actually closed, whether
Brown was assessed, status of the CMMS procurement, and what the
override does and doesn't restore.

The research-then-design pass refined the framing materially. The dollar
figures most prominent in the 2021 EBI plan sit at buildings that are no
longer operating as schools (Coffin, Gerry, Bell, Eveleth). The 2021
plan was effectively a final inventory of the legacy elementary buildings
as Brown opened to consolidate three of them. The current operating
schools (HS, Veterans, Village, Glover, Brown) have a different and
narrower maintenance profile, and Brown was not included in the 2021
assessment at all.

The story therefore is not "decades of doing nothing." It is:

1. The town did make a major investment &mdash; $42M in 2019 to consolidate
   three aging elementary schools into Brown.
2. The 2021 EBI plan is the only comprehensive condition assessment on
   record, it does not cover Brown, and it has not been updated.
3. The district has no central record of which 2021 items have been
   addressed since.
4. FY27 is the first year a Computerized Maintenance Management System
   (CMMS) is even budgeted. A written status-by-school deliverable
   targeted for August 31, 2025 was never produced or surfaced in
   subsequent facilities subcommittee minutes.
5. A subcontractor-caused flood at Veterans Middle School in February
   2026 is a concrete recent example of cost-of-failure.

## Goals

- Surface the tracking gap (no central record of what's been done) as
  the primary editorial frame, since that is the most consequential
  factual finding.
- Tell the history fairly: the BCG project was a real investment, not
  an absence of action.
- Show the 2021 backlog at currently operating schools without
  overclaiming, since the inventory is four years old and incomplete.
- Treat closed/decommissioned buildings in a separate track: their
  story is reuse and disposition, not deferred school maintenance.
- Earn every dollar figure with a primary-source citation.
- Match the editorial tone in CLAUDE.md and STYLE_GUIDE.md: state
  facts, avoid editorial framing, do not steer toward an override
  position.

## Non-goals

- Estimating a "current" backlog. Only the 2021 figures are sourced.
- Calling for a specific budget action.
- Mapping town-side buildings (Town House, Mary Alley, fire stations,
  etc.). Separate page if pursued.
- Interactive filtering of the bar chart (yagni for a 4-row view).
- Pie or treemap of funding sources (prose handles it).

## Page

### File and routing

- **Path:** `school-building-maintenance.html` at the repo root.
- **Permalink:** `/school-building-maintenance.html` (matches existing
  sibling pages).
- **Layout:** the default `page` layout, no special frontmatter beyond
  title, scripts, and OG metadata.
- **Scripts:** `[citations, deep-dive]` (citations injects the Sources
  h2; deep-dive provides the standard sticky on-page nav used by
  `inside-school-staffing.html`).
- **Nav placement:** add an entry to `_includes/nav.html` adjacent to
  the existing "Inside school staffing" link.

### Page lead

```
<h1>School building maintenance</h1>
<p class="page-lead">
  The only comprehensive condition assessment of Marblehead's school
  buildings was compiled in 2021. It identified more than $5 million
  in roof, boiler, HVAC, and other deferred work. The district has no
  central record of which items have been addressed since. FY27 is
  the first year a computerized maintenance system is budgeted.
</p>
```

### Above-the-fold key stats (`.key-stats` row)

| Stat | Caption |
|------|---------|
| $42M | 2019 debt-exclusion override that built the Lucretia and Joseph Brown Elementary School |
| 2021 | year of the only comprehensive building-condition assessment |
| 1 of 5 | currently operating school buildings not included in the 2021 assessment (Brown) |
| FY27 | first year a CMMS is budgeted |

### Section structure

Nine `<h2>` sections, each leading with the claim. Section 9 is short
and may be merged into section 8 as a closing callout if it reads as
its own section is too thin during implementation:

1. **The district can't tell you what's been fixed since 2021.**
   The tracking gap as the editorial lead. Quote the July 24 2025
   facilities minutes verbatim: "Mr. Bloodgood will provide written
   status by school (critical/non-critical/capital) by Aug 31, 2025"
   with plans to "circulate EBI reports and consolidated spreadsheet."
   Note that no reference to that deliverable appears in any of the
   subsequent facilities subcommittee minutes (Sep 5 2025, Nov 5 2025,
   Feb 13 2026). The forthcoming CMMS procurement (target FY27) is
   the first formal attempt to fix this.

2. **The town did make a major investment: Brown opened in 2021.**
   Recap the BCG project. $42M debt-exclusion override in 2019.
   Construction by Gilbane, finished 40 days early. Built on the
   former Malcolm L. Bell site on Baldwin Road, which required
   demolition of both the Upper and Lower Bell buildings in 2020.
   Brown consolidated students from Elbridge Gerry, L.H. Coffin, and
   Malcolm L. Bell elementary schools. First day for students October
   13, 2021; ribbon cutting October 17, 2021. This is the "what the
   town did do" section &mdash; matters for not letting the rest of
   the page read as "nothing has happened."

3. **The 2021 baseline, and what it didn't cover.**
   The EBI-derived Capital Facilities Plan assessed: HS, Veterans,
   Village, Glover, Coffin, Gerry, Upper Bell, Lower Bell. The plan
   does not include Brown. The corpus does not explain why; the
   simplest reading is that the assessment was compiled essentially
   as Brown was opening and the legacy buildings were going vacant,
   so the assessors documented what was about to be decommissioned
   rather than the building replacing them. State that as a careful
   inference, not a fact. **The largest operating elementary school
   by FY27 budget ($5.5M) was not assessed, and no replacement
   assessment has been produced.**

4. **What 2021 identified at operating schools.**
   Bar chart restricted to HS, Veterans, Village, Glover. Per-building
   itemized table linked below the chart. Caveat banner above the
   chart: "These are 2021 estimates. Current status of individual
   items is not centrally tracked." Plus an inline Brown-gap callout
   to its right (or below on mobile): "Brown Elementary is not in
   the 2021 baseline."

5. **The former school buildings carry most of the 2021 dollars.**
   Coffin, Gerry, Bell (demolished), Eveleth. Each gets a short
   paragraph (3-5 sentences) covering: build year, when it left
   regular school use, current disposition. Coffin gets the longest
   treatment because of the active Adaptive Reuse process &mdash;
   EOI August 2025, RFI October 2025, five EOI proposals received
   including Harborlight Homes 40-unit affordable housing ($28-32M,
   preserving the historic building and demolishing the annex),
   hazmat investigation completed January 2026, community meetings
   March and May 2026. Eveleth boiler condemned November 2025; under
   joint Park & Rec reuse discussion. The framing: these buildings'
   maintenance costs are not "deferred work at schools" &mdash; they
   are inputs to disposition decisions.

6. **What deferred maintenance looks like when it bites.**
   Lead with the Sarah Fox HS walking tour during the April 4 2024
   Northeaster, direct quote from the April 25 2024 SC transcript:
   "Custodians were everywhere with buckets and mops trying to keep
   up with the leaks." Teachers stepping out of classrooms to
   report new leaks; a previously remediated mold room was holding
   in the storm. She concluded the priority was clearly a new roof.
   Then the Veterans D-wing February 2026 contractor-caused flood,
   from the Feb 13 2026 facilities minutes. Insurance covered smoke
   detectors, sprinklers, pull stations, horn strobes, outlets,
   lighting, ceiling tiles; the district declined payment until
   repairs were complete; MHTV has not returned to the building.
   Two concrete vignettes, no editorial verbs between them.

7. **How it gets paid for.**
   Two layers: the capital plan (rare large projects like the HS
   roof and HVAC, summer 2026 construction) and the operating
   budget, which absorbs all the reactive repairs. The March 2026
   monthly variance showed surprise HVAC repairs at Brown and
   Glover, bus repairs, and elevator repairs eating $614K of the
   unencumbered balance in a single month, per the Apr 9 2026
   budget transcript. The FY27 budget cuts a maintenance position
   (1.0) and shifts 50% of a Facilities Assistant off the levy onto
   the rental revolving fund as part of the $3.2M reduction
   package. The June 9 2026 ballot approved Tier 3 of the override
   ($15M total, $8.5M school side); the school side of Tier 3
   includes a recurring **school-building capital fund of $500K/yr**.
   State the funding picture neutrally: the override created a new
   recurring building-capital line, even as the FY27 base budget
   trimmed maintenance staff.

8. **What's actually moving.**
   - HS roof and HVAC: pre-qualification bidding October 2025,
     contract anticipated November 2025, Feb 2026 vacation week
     pre-inspection by the contractor, three small sections done
     during April 2026 vacation (the section above the meeting
     room, one by the concession stand, one on the far side), full
     summer 2026 construction, HVAC equipment delivery July 2026.
   - The May 21 2026 SC voted 4-0 to issue a proclamation
     supporting Tier 3 of the override, which includes the new
     building capital fund; voters approved Tier 3 on June 9 2026.
   - CMMS RFP: target FY27. First formal asset-and-PM tracking
     system.
   - Coffin Adaptive Reuse community meeting #3 scheduled May 20
     2026.
   - Veterans D-wing repaired.

9. **Open questions to ask.** (Optional ninth section; can be merged
   into the closing callout if it feels long.)
   - Has the August 31 2025 written-status-by-school deliverable been
     produced?
   - What does EBI stand for and was an updated assessment performed?
   - Has the CMMS RFP been issued?
   - Does the adopted FY27 budget include any building-maintenance
     restoration?

## Charts

### Chart A &mdash; Backlog by operating school (the centerpiece)

A stacked horizontal bar chart. One row per **currently operating** building
present in the 2021 EBI plan: HS, Veterans, Village, Glover (in that order,
sorted by total $ descending). Brown is added as a row labeled "not
assessed" with no bar, to make the gap visible. Stacks split by category
(Roof / Boilers / HVAC / Plumbing / Electrical / Windows / Exterior /
Other).

- **Implementation:** inline SVG, hand-rolled. Matches the project's
  preference for small dependency-free charts (per existing inline
  SVG charts in `inside-school-staffing.html`, `town-budget.html`,
  etc.). No D3, no Plot.
- **Source data:** derived from `data/schools/capital-facilities/capital-facilities-plan.txt`,
  parsed into a small inline JS data structure embedded in the page.
  Numbers are visible in the source for trivial inspection.
- **Caveat banner above the chart:** "These are 2021 estimates.
  Current status of individual items is not centrally tracked."
- **Citation:** the chart's `<sup class="cite">` links to the
  capital-facilities-plan.txt file in the repo, source description
  "EBI-derived Capital Facilities Plan, 2021, lines [n]&ndash;[n]."

### Chart B &mdash; Timeline

A simple two-track horizontal SVG timeline.

- **Top track (construction):** 1906 Gerry, 1949 Coffin, 1958 Lower
  Bell, 1970 Upper Bell, 2002 MHS, 2004 Veterans, 2010 Village, 2014
  Glover, 2021 Brown.
- **Bottom track (PM-program events):** 2018 BCG plan announced,
  2018 Gerry students moved out (steam pipe leak), 2019 $42M override
  approved, 2020 Bell demolition, 2021 EBI assessment compiled, 2021
  Brown opens, 2025-08 written-status target (not met), 2025-10
  Coffin RFI released, 2025-11 Eveleth boiler condemned, 2026-02
  Veterans D-wing flood, FY27 CMMS RFP target, summer 2026 HS roof
  construction.
- **Why two tracks:** keeps the "how old the buildings are" and "the
  PM program is brand-new" stories visible without crowding either.
- **Implementation:** inline SVG, no interactivity, no JS. Static
  art rendered at build time would also work but SVG is more
  inspectable.

### Per-building itemized table (HS, Veterans, Village, Glover)

A standard `.peer-table`-style HTML table beneath Chart A. Columns:
Building / Category / 2021 estimate / 2021 condition note. Rows
limited to items with a non-blank dollar estimate. Sorted within
building by descending dollar value.

A separate, smaller table in the "former school buildings" section
shows Coffin / Gerry / Upper Bell / Lower Bell totals as a single line
each, since they aren't actionable maintenance for operating schools.

## Caveats baked into copy

- Every reference to the backlog labels it "2021 EBI" or "as of 2021"
  (per writing-style preferences).
- The bar chart caveat banner is visually adjacent to the chart, not
  a footnote.
- Brown-gap callout is inline and prominent, not hidden in a
  footnote.
- The "Bell School Evaluation Process" referenced in 2025-26 minutes
  is mentioned briefly with explicit acknowledgement that the corpus
  is ambiguous about which structure is under evaluation.

## Sources to cite (each with `<sup class="cite">`)

Primary:
- `data/schools/capital-facilities/capital-facilities-plan.txt`
  (EBI-derived 2021 Capital Facilities Plan)
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-9-5-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-11-05-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-2-13-2026.txt`
- `data/schools/sc-meetings-fy26/minutes-11-6-2025.txt` (Bell School Evaluation Process)
- `data/minutes/school_committee/2020-*.cleaned.txt` (Bell demolition)
- `data/minutes/school_committee/2021-*.cleaned.txt` (Brown opening,
  Eveleth swing-K use, Coffin vacancy)
- `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt`
  (FY27 budgets per operating school)
- `_transcripts/school-committee-2024-04-25.md` (Sarah Fox HS
  walking-tour during April 4 2024 Northeaster &mdash; first-person
  account, Todd Bloodgood, "custodians were everywhere with buckets
  and mops")
- `_transcripts/school-committee-2026-04-09.md` (FY27 budget
  hearing: $3.2M reduction package including 1.0 maintenance cut
  and 50% Facilities Asst shift; March 2026 surprise HVAC repairs
  at Brown and Glover; HS roof phasing; override tier framing with
  Tier 3 building capital fund)
- `_transcripts/school-committee-2026-05-21.md` (May 21 2026 4-0
  vote to support Tier 3 override proclamation including the
  school-building capital fund)
- `2026-override/index.html` (June 9 2026 ballot outcome: all four
  questions passed; Tier 3 governs FY27)
- `data/school_committee_2026-04-09_transcript.txt` (legacy copy of
  the April 9 2026 budget hearing; transcripts/ version above is
  the canonical one once main is merged in)

Secondary (web, only where primary is silent):
- `https://marbleheadma.gov/coffin-school-adaptive-reuse/` (Coffin
  EOI/RFI process and timeline)
- `https://itemlive.com/2018/04/06/marblehead-plan-replace-3-aging-elementary-schools/`
  (BCG project announcement, Bell demolition required)
- `https://itemlive.com/2021/10/17/lucretia-and-joseph-brown-elementary-opens-in-marblehead/`
  (Brown opening confirmation, Gilbane 40-day early finish)
- `https://itemlive.com/2018/02/07/students-marbleheads-gerry-school-relocated-due-steam-pipe-leak/`
  (Gerry steam pipe leak, students relocated)

Per CLAUDE.md and the `reference_sources.md` memory, primary sources
take precedence; news articles are paired with primary minutes wherever
possible and never used as the sole citation for a dollar figure.

## Editorial tone checklist

- [ ] No "shocking," "crisis," "skyrocketing," "outrageous," or
      similar editorial verbs.
- [ ] No em-dashes in body copy (per writing-preferences memory).
- [ ] No call to vote yes/no on the override.
- [ ] No green-good / red-bad coloring on the bar chart. Use the
      site's neutral palette (`--c-buoy`, `--c-brass`, `--c-teal`,
      `--c-navy`) for the stacked categories.
- [ ] Every dollar figure has a `<sup class="cite">` linking to the
      primary source.
- [ ] No meta-narration ("this page shows...", "below you'll find...").
- [ ] State facts in section headers, not topics.

## What this page is NOT (clarifications)

- Not a "we need an override" page. The override is mentioned twice
  (once as the $42M BCG investment, once as the FY27 tiered pitch in
  the funding context) and never editorialized.
- Not a closed-buildings-disposition page. The former buildings get
  one section with enough context to anchor the story, with a link
  out to the Town's Coffin Adaptive Reuse page for residents who
  want to engage that process directly.
- Not the override-debate page. That's `the-debate.html`. This page
  cross-links to it where relevant.

## Implementation order (high level)

The detailed implementation plan will come from a writing-plans pass.
At a high level the work is:

1. Parse the 2021 EBI capital plan items for HS, Veterans, Village,
   Glover into a small inline JS data structure embedded directly in
   `school-building-maintenance.html`, similar to how
   `inside-school-staffing.html` carries its DESE / FY27 data inline.
2. Build the bar chart, the timeline, and the per-building table.
3. Write the eight section copies with citations.
4. Add nav entry next to "Inside school staffing."
5. Verify on a local Jekyll build (`npm run dev`) and run
   `npm run test:local` Playwright smoke before pushing.
6. Capture proof-of-work screenshots into `proof/` before
   declaring done in any PR.

## Open questions that should NOT block this page

These were on the original research-notes list; they remain unknown
but the page can ship without them. They become "open questions to
ask" content rather than blockers.

- Has the August 31 2025 written-status-by-school deliverable been
  produced?
- What does EBI stand for?
- Has the CMMS RFP been issued?
- The override passed June 9 2026 with the school-building capital
  fund ($500K/yr) in Tier 3. When does the first allocation hit
  the budget, and how is the district planning to deploy it?
- What is the "Bell School Evaluation Process" really evaluating,
  given Bell buildings were demolished?

## Implementation note: branch setup

This worktree (brave-desert) is behind main by ~91 commits and
missing the auto-ingested transcripts under `_transcripts/`. The
research and quotes above were validated against `origin/main`
contents via `git show origin/main:...`. When the page is
implemented, it should be done in a fresh worktree off main so the
transcripts are present as files to cite, not just historical
references.
