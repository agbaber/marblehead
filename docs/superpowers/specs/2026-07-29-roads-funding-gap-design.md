# Roads Funding Gap Page — Design

**Date:** 2026-07-29
**Branch:** `roads-funding-gap`
**Target file:** `roads.html` (new bespoke page)

## Purpose

A data page on Marblehead's road funding. The spine: for ~25 years the town
funded roads almost entirely from state Chapter 90 aid (avg ~$449K/yr) against
a level the town itself calls ~$3M/yr. Local budget dollars for road capital
did not begin until 2022 (Article 11). The page tells that gap and when it
started closing, in the town's own numbers, cross-checked against primary
sources.

This is not a rankings page. There is no statewide town-by-town pavement
ranking (see "Feasibility" below), so the page does not attempt one.

## Editorial guardrails (project-specific)

- The richest source, `data/town_docs/Marblehead-Roads-Information-Guide.txt`,
  is a **town-authored voter's guide** — persuasive, not neutral. The page
  cites its figures but:
  - attributes the town's framing as the town's ("the town says the sequencing
    is by design"), never adopts it as the page's voice;
  - labels the "$3M/yr needed" as the **town's own estimate**, not an
    independent or derived figure;
  - cross-checks every headline number against a primary source at write time
    (Chapter 90 apportionment tables, ACFR, budget/checkbook), per the citation
    discipline rule. Quote/read the source at write time; do not author figures
    from memory.
- No editorial adjectives (no "crumbling", "neglect", "shocking"). State the
  gap; let the reader judge.
- No green-good / red-bad coloring on the funding charts.
- Plain voice throughout, consistent with the site's other long-form pages.
- No meta-narration ("this page shows..."). Lead with the claim.

## Feasibility (settled during scoping)

- **No statewide municipal PCI ranking exists.** MassDOT scores condition only
  on state-owned / federal-aid roads; local streets are not condition-scored by
  the state. So a "Marblehead vs peers on pavement condition" chart is not
  buildable from public data. Not attempted in v1.
- **Chapter 90 per-town allocations are public** (mass.gov current + historical
  apportionment tables) — primary source for the funding time series.
- **Road ownership is public** (2024 Road Inventory Year-End Report, MassDOT):
  Marblehead has **0 state-maintained centerline miles**, 68.99 town-accepted,
  11.24 unaccepted (total 80.22).
- **No published Marblehead PCI.** The town runs a Pavement Management System
  (0–100 scale) but does not publish an average score. Treated as a noted gap,
  not chased for v1.

## Known data caveat to surface on the page

Road-mileage figures disagree between sources: the town guide says **89 miles**
of town roads; the 2024 state Road Inventory says **68.99 accepted + 11.24
unaccepted = 80.22**. The stat that uses mileage must footnote this
discrepancy and cite both sources rather than silently pick one.

## Page structure

Bespoke HTML page following the existing pattern (see `legal-fees.html`,
`library.html`): `layout: page`, STYLE_GUIDE palette/typography, inline SVG
charts using STYLE_GUIDE chart classes (no inline `style=""` on SVG elements),
`citations.js` `<sup class="cite">` markers (Sources h2 injected at runtime).

### 1. Lede + stat band
Plain-voice opener stating the funding gap. A `.stat` hero row:
- town road miles (with the 89-vs-80 footnote)
- sidewalk miles (~71)
- avg Chapter 90 / yr (~$449K) — verified against apportionment data
- town's stated annual need (~$3M) — labeled "town estimate"
- years sidewalks went without capital (15+)

Every stat carries a source citation.

### 2. "There's no state to blame" (ownership frame)
One tight block + a small stacked/segmented bar: 0 state miles vs ~69 accepted
vs ~11 unaccepted (2024 Road Inventory). Point: every road is a local funding
choice, which sets up why the gap is the town's to close.

### 3. The funding gap (core chart — Chart A)
Time series of Chapter 90 apportionment per year (target range ~FY00–FY27) with
the town's ~$3M "effective annual" figure as a reference line. Caption: the
reference line is the **town's own** estimate of what it can effectively spend,
not an independent needs assessment. Chapter 90 per-year values extracted from
annual reports / checkbook and reconciled to the mass.gov apportionment tables.

### 4. When local dollars entered (2022 → now — Chart B)
Annotated timeline / bar showing:
- Article 11 (2022): first-ever local road/sidewalk capital appropriation
- FY25 ACFR **$6.98M authorized-but-unissued** for roads/sidewalks
- the 3-year Capital Improvement Road Program corridors (Washington, Pleasant,
  Atlantic, Humphrey, Village, West Shore Drive)

Shows the gap starting to close, and how small that is relative to the stated
need.

### 5. Why it's slow (constraints, stated neutrally)
The utility-sequencing logic (gas → water/sewer → complete-streets → ADA →
tree/parking/drainage → sidewalk → final paving) and the three real-world
limits (traffic management, contractor availability, paving season). Presented
as the town's explanation for why ~$3M/yr is its stated ceiling — attributed,
not editorialized.

### 6. Roads and the override
The precise distinction, correcting the common "roads were left out"
shorthand:
- The override does **not** fund the road *capital program* — Article 11
  covers the 3-year program.
- The override **does** fund repair of roadway sections needing work not
  scheduled in the next 5+ years, beyond the current Capital Plan.

### 7. What we can't see yet
Honest gaps as open questions:
- town runs a PMS (0–100) but publishes no average PCI
- no public per-street condition data
- the "$3M need" is the town's figure, not independently verified

## Charts summary

- **A** — Chapter 90 per-year vs stated-need reference line (SVG line or bar)
- **B** — local capital timeline/bar (Article 11, authorized-but-unissued,
  program corridors)
- **Ownership** — small segmented bar (0 state / ~69 accepted / ~11 unaccepted)
- No peer chart in v1

## Data work required before build

1. **Chapter 90 time series** — the one new dataset. Extract per-year Chapter 90
   for Marblehead from annual reports (`data/town_docs/annual_reports/`) and
   checkbook (`CHAPTER 90` category), reconcile to mass.gov apportionment
   tables. Store as a small structured file (CSV or JSON) so the number traces
   to a source, mirroring how `debt_summary.json` isolates debt.
2. **Road Inventory row** — pull Marblehead's jurisdiction miles from the 2024
   Road Inventory Year-End Report for the ownership bar.
3. **Verify each headline figure** against a primary source at write time; do
   not rely on the town guide alone.

## Out of scope for v1

- Peer-town Chapter 90 comparison charts
- Any pavement-condition / PCI chart or per-street data
- Sidewalk-specific deep dive beyond the stat + one mention

## Sources

- `data/town_docs/Marblehead-Roads-Information-Guide.txt` (town voter's guide —
  framing + headline figures, to be cross-checked)
- `data/town_docs/Marblehead-Public-Works-Information-Guide.txt` (DPW org)
- mass.gov Chapter 90 apportionment (current + past) — primary funding data
- 2024 Road Inventory Year-End Report, MassDOT (ownership miles)
- FY25 ACFR (authorized-but-unissued roads/sidewalks $6.98M) — see
  `data/SOURCE_LOOKUP.md`
- `data/town_docs/annual_reports/Annual-Report-*.txt` (Chapter 90 history)
- checkbook CSVs + `data/checkbook_labels.json` (CHAPTER 90, PW MAINTAIN
  STREETS & SIDEWALK actuals)
