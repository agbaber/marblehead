---
layout: page
title: "School building maintenance: research notes"
permalink: /data/school-maintenance-notes/
body_class: doc-page
sitemap: false
---

# School building maintenance: research notes

> **Status: research handoff.** This file is raw material assembled
> from the minutes corpus and the 2021 EBI-derived Capital Facilities
> Plan. Pull what's useful into a real public-facing page. Verify each
> claim against the cited source before publishing &mdash; this was
> compiled from a single research pass, not a second-pair-of-eyes
> review.

## The story worth telling

After decades of deferred maintenance, **FY27 is the first year
Marblehead's schools are even trying to start a formal preventative
maintenance program.** The minutes document a $5M+ backlog of known
roof, boiler, HVAC, and plumbing problems &mdash; itemized in 2021,
mostly unfunded since. Repairs happen when things break. The one big
capital project moving (HS roof and HVAC, summer 2026 construction)
is the exception that proves the pattern. A subcontractor error this
February flooded classrooms at Veterans Middle School, displacing MHTV
and forcing emergency remediation paid out of operating &mdash; the
exact failure mode that a real PM program is supposed to prevent.

The override-debate angle: the FY27 budget cut maintenance and supplies
as part of a $3.2M reduction package. The tiered override pitch
($6.2M / $7.2M / $8.5M) is framed around restoring positions and SPED
prepayment. Building maintenance restoration is not explicitly a line
item. Worth surfacing.

## Source corpus

All citations below trace to files inside `data/schools/` (scraped
from marbleheadschools.org &mdash; see memory `project_schools_site_scrape`)
and `data/minutes/school_committee/` (the structured minutes catalog).

Primary documents drawn on:

- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-9-5-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-11-05-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-2-13-2026.txt`
- `data/schools/capital-facilities/capital-facilities-plan.txt`
- `data/schools/strategic-plan/planning-for-success-2021-2026.txt`
- `data/school_committee_2026-04-09_transcript.txt`

The **EBI acronym** is used throughout these minutes without being
spelled out. Likely a national property-condition-assessment firm
(EBI Consulting does this kind of work for school districts); the
minutes treat the term as already-known. **Verify with Facilities or
Mr. Bloodgood before publishing any expansion of the acronym.**

## Itemized backlog (from the 2021 EBI / Capital Facilities Plan)

The most detailed PM inventory in the corpus is
`data/schools/capital-facilities/capital-facilities-plan.txt`, which
rolls the 2021 EBI assessments into a multi-year cost spreadsheet.

### Coffin School (1949 / 1963 construction) &mdash; most deteriorated

- Roof: **$750,000** "regular leaks in main building" (line 125)
- Plumbing: **$250,000** "old plumbing fixtures hard to get parts for" (line 124)
- HVAC controls: **$150,000** "control system not working, many rooms overheat" (line 117)
- Electrical: **$200,000** "system past lifespan" (line 110)
- Windows: **$600,000** "rusted metal frames &mdash; staircase window leaks when it rains" (line 128)

### Gerry School (1906 construction) &mdash; historic building, significant deterioration

- Roof: **$750,000** "slate roofing materials loose and falling &mdash; many roof leaks" (line 153)
- Brick / exterior walls: **$250,000** "bricks need repointing in numerous locations. Wood trim rotted and falling off" (line 132)
- HVAC: **$150,000** "heat control very poor &mdash; system well past lifespan" (line 146)
- Boilers: **$175,000** "boiler well past life span &mdash; multiple sections blocked off" (line 130)

### Upper Bell School (1970 construction)

- Roof: **$1,000,000** "rubber membrane roof from 1994 failing. Multiple leaks throughout building. Insulation has sunk leaving membrane stretched over fasteners" (line 196)
- HVAC: **$200,000** "temp control system needs complete replacement. Classroom AC units very old and run off non-dedicated AC outlets" (line 178)
- Boilers: **$175,000** "boiler approaching end of life span &mdash; has 9 of 26 sections blocked off and leaks regularly" (line 162)

### Lower Bell School (1958 construction)

- Plumbing: **$200,000** "old plumbing systems past lifespan" (line 222)
- Boilers: **$100,000** "no issues present but unit past lifespan" (line 203)
- HVAC: **$100,000** "temp control system needs replacement" (line 216)

### Veterans Middle School (2004 construction)

- Flooring: **$75,000** "floor tile issues near expansion joints" (line 63)
- Security: **$100,000** "no swipe card system or panic buttons &mdash; no security cameras, no single lock down key" (line 76)

### Village School (2010 construction)

- Security: **$50,000** "no panic buttons &mdash; limited number of security cameras" (line 102)
- HVAC: "warm weather 3rd floor &amp; gym temp issues" (line 94)

### Glover School (2014 construction)

- No critical failures noted. Minor: HVAC circuit breaker "tripping during cold weather" (Feb 13, 2026 minutes, line 78)

### Cross-building total

Adding only the roof, boiler, and HVAC items at Coffin, Gerry, and
Upper Bell yields **$3.6M+** in identified-but-unfunded work in the
three oldest buildings alone. Including all other categories at all
buildings pushes the total well past $5M. The spreadsheet has more
detail than this digest captures &mdash; pull from it directly when
writing the public page.

## What's actually moving

### High School roof and HVAC &mdash; the one project in flight

Pre-qualification bidding Oct 2025, contract anticipated Nov 2025,
construction summer 2026, HVAC equipment delivery July 2026. Per
`facilities-subcommittee-minutes-7-24-2025.txt` (lines 15-27):

> "Roof re-cover (new membrane over coverboard) and roof restoration
> (liquid-applied coating), both with removal of wet insulation."
> "HVAC work proceeds in the same package."

The Capital Facilities Plan notes the High School roof has "some
persistent leaks &mdash; maintenance issue" dating to 2002.

### Veterans Middle School D-wing failure (Feb 2026)

Per `facilities-subcommittee-minutes-2-13-2026.txt` (lines 28-46):

> "Subcontractor wrapped new roofing over weep holes on upper roof
> section. Precipitation ran under roofing material, causing
> significant damage. One or two classrooms relocated; MHTV has not
> returned to building."

District declined payment until repairs were completed. Insurance
covered smoke detectors, sprinklers, pull stations, horn strobes,
outlets, lighting, and ceiling tiles. The kind of preventable, costly
emergency that a PM program is supposed to head off &mdash; and a
useful concrete example for the public page.

### CMMS procurement (target FY27)

Per `facilities-subcommittee-minutes-7-24-2025.txt` (lines 81-89):

> "Moving to a modern CMMS to barcode assets, schedule PM (filters,
> belts), and improve ticket data; procurement likely requires an RFP
> and startup plus annual subscription funds (target FY27)."

CMMS = Computerized Maintenance Management System. **This is the
headline.** As of summer 2025, the district had no formal way to
track which 2021 EBI items had been fixed vs. which were still open.

## Reactive-repair examples (summer 2025)

From `facilities-subcommittee-minutes-9-5-2025.txt` lines 42-62 &mdash;
the kind of work that's actually getting done day-to-day:

- Brown: wood paneling repairs, kitchen spray nozzle replacement
- Veterans: mini-splits in classroom, new carpeting in two classrooms,
  PAC seating reupholstering

Also: "All 30 custodians trained on standardized top-down cleaning
procedures." Custodial training, not preventative-maintenance scheduling.

## Selected component-level upgrades pre-2025

- 2014: Upper Bell roof (1994 membrane) flagged as "failing"
- 2015: Upper Bell fire alarm replaced
- 2016: Veterans burglar alarm main panel replaced
- 2017: HS boiler controls replaced; Coffin phone system replaced with
  refurb unit; Veterans hot water tanks scheduled
- 2025: Brown School fan motor failure; Glover HVAC circuit breaker
  tripping
- 2026 (Feb): Veterans D-wing contractor-error flood
- 2026 (April): HS roof sections completed over April break

## Budget context

Per `school_committee_2026-04-09_transcript.txt`:

- FY27 cuts total **$3.2M**, including "pausing the curriculum
  refresh cycle" and reducing maintenance/supplies (line 63)
- March 2026 unencumbered balance: "under 2.1 million" (line 13)
- Unavoidable commitments tied up free cash via SPED prepayment

The 2021&ndash;2026 Strategic Plan
(`planning-for-success-2021-2026.txt` line 35) identified as a core
objective: "Establish a comprehensive and equitable staffing,
compensation, &amp; maintenance capital plan, aligned to the facility
audit." Implementation constrained by funding.

Capital replacement requests totaling **$1.677M** for FY27
(`facilities-subcommittee-minutes-2-13-2026.txt` line 50) included two
replacement buses and wireless access points &mdash; not maintenance.

## What the minutes don't cover

Worth noting in any published page:

1. No pre-2021 maintenance history in the corpus (EBI 2021 is the
   earliest baseline available)
2. No cumulative reactive-repair spend
3. No MSBA accelerated repair program filings discussed
4. No asbestos / mold detail beyond passing mention
5. Enrollment dropped 2,727 (June 2025) &rarr; 2,511 (Dec 2025) with
   no discussion of how that reshapes per-building PM priorities

## Suggested angles for a public page

Ordered roughly by how much they'd add to the override debate without
straying into advocacy:

1. **"FY27 is when the district is trying to start a PM program at all."**
   The CMMS procurement is the headline. Easy, factual, surprising to
   most residents.

2. **"$5M in known-since-2021 maintenance, mostly unfunded."**
   Direct from the EBI-derived spreadsheet. Use the Coffin / Gerry /
   Upper Bell breakdowns; they're the most concrete.

3. **"What it looks like when deferred maintenance bites: the
   Veterans D-wing flood."** February 2026. Short, vivid, specific.
   Avoids "the system is broken" rhetoric by showing one concrete
   incident.

4. **"What the budget can't pay for."** Pair the $5M backlog against
   the FY27 $3.2M cut and the tiered override pitch. Make the gap
   visible; let the reader draw the conclusion.

Per `STYLE_GUIDE.md` and the editorial stance in `CLAUDE.md`: state
facts, don't editorialize. No "shocking," "crisis," or
"skyrocketing." Show the numbers, cite the source, let residents form
their own view.

## Open questions to chase before publishing

- What does **EBI** actually stand for? Ask Facilities or
  Mr. Bloodgood.
- Has the **Aug 31, 2025 written-status-by-school** deliverable
  (`facilities-subcommittee-minutes-7-24-2025.txt` line 95) been
  produced? If yes, that's a much richer dataset than the 2021 EBI.
- What did **Mr. Bloodgood's "completed vs. open" mapping** find?
- Was the **CMMS RFP** issued? Status?
- Does the **adopted FY27 override budget** restore any maintenance
  funding now that the override passed June 9?
