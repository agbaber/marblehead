# What's Actually Flexible — Design

**Date:** 2026-06-22
**Author:** Andrew Baber, with Claude
**Status:** Pre-implementation (awaiting user review)

## Summary

A new page at `/what-is-actually-flexible.html` that reframes the FY27
budget in two lenses that no existing page on the site captures:

1. **Locked vs flexible.** Of FY27's $109.78M general fund, what share
   is locked by law, contract, or funding schedule — and how small is
   the truly discretionary pool that remains?
2. **The cost to employ someone.** Total cost-to-employ for two
   archetypes (teacher and town employee), each as a stacked column:
   salary + healthcare + pension + Medicare + OPEB. Plus a small
   translator: type a dollar cut, see roughly how many positions it
   equals.

Inspired by James Laurenti's Beverly Budget Challenge (locked block at
top, FTE-cost ballpark), but stripped of the interactive
"cut-the-budget" game. The page is educational, not gamified.

## Goals

- Make visible the gap between "the $109.78M budget" and "the small pool
  the town can actually adjust this year." This is the single most
  misunderstood thing in the override comment threads.
- Translate dollar cuts into FTE equivalents so "just cut spending"
  threads have a defensible headcount number to discuss.
- Stay neutral. The same numbers should be useful to override
  supporters ("see how locked it is"), opponents ("here's exactly where
  the discretionary money is"), and undecided residents.
- Every dollar traceable to a primary source via the standard
  `<sup class="cite">` markers.
- Mobile-readable: bars collapse vertically, columns stack, translator
  has a touch-friendly input.

## Non-goals

- No interactive "balance the budget" sliders. (Considered as Tier 3
  scope and explicitly rejected by user.)
- No green/red comparison coloring; comparisons stay neutral semantic
  colors per STYLE_GUIDE.
- No per-line-item cost simulator. The translator is a single dollar
  input × archetype × per-FTE cost; not a multi-department model.
- Not a rewrite of `town-budget.html` (line-by-line drilldown). This
  page is a frame; the drilldown stays where it is.
- Not a senior-tax / override calculator — those exist on other pages.

## Voice & editorial stance

- Plain, neutral, factual. No "shocking", "crisis", or override-yes/no
  framing.
- The page's claim is presented once at the top, then numbers carry the
  argument. No tour-guide voice ("This page shows...") — per
  CLAUDE.md's "no meta-narration" rule.
- All caveats appear next to the number they qualify, not in a separate
  footnote section, per the STYLE_GUIDE pattern.
- "Locked this year ≠ locked forever" stated explicitly — every locked
  category is in principle changeable on a longer horizon (CBA
  expiration, debt refinancing, pension re-amortization). The page
  must not imply otherwise.

## Page structure

### Lead

One-line claim:

> Of the FY27 $109.78M general fund, roughly $X is locked by law,
> contract, or funding schedule. That leaves about $Y as discretionary
> — and most of that is salaries, so "cut spending" almost always
> means "cut positions."

`X` and `Y` are populated from the `_data/fixed_costs.yml` file at
build time so the lead always matches the data.

### Section 1: What's locked

**Visual:** a horizontal stacked bar at full FY27 budget scale, divided
into four segments:

- Tier 1 — hard-locked
- Tier 2 — contract-locked
- Tier 3 — schedule-locked
- Flexible (the residual)

Each tier is a distinct neutral hue (no green/red). The flexible
segment uses the site's "neutral highlight" tone to draw the eye
without implying good/bad.

Below the bar: three expandable cards, one per tier, listing the
underlying line items and their FY27 dollar values.

#### Tier 1 — Hard-locked this year

Legal or contractual obligations the town cannot reduce in FY27.

Line items (confirmed against `data/town_budget_FY27.json` and
`data/cherry_sheet_FY26.csv`):

| Item | FY27 | Source |
|---|---|---|
| Bonded debt service | $11.10M | town_budget_FY27.json, Maturing Bonds + Interest |
| State assessments (MBTA, charter school, county, MAPC, mosquito) | ~$2.5M (FY26 figure; FY27 cherry sheet TBD) | cherry_sheet_FY26.csv |
| SPED out-of-district tuition + transportation | TBD | FY27 school packet, agenda-and-materials-2-5-2026-fy27-budget-packet.txt |

Caveat shown inline: "The state assessment line uses the FY26 cherry
sheet because the FY27 cherry sheet has not yet been published by the
Department of Revenue. Update when available."

#### Tier 2 — Contract-locked

Set by current collective bargaining agreements; reducible only by
contract renegotiation (typically multi-year cycles).

| Item | FY27 | Source |
|---|---|---|
| Healthcare employer share (Group Insurance line, ~83% employer share) | $16.75M | town_budget_FY27.json |
| Salaries under current CBAs | TBD (most of remaining personnel cost) | derived from town_budget_FY27.json salary lines + CBA expiration dates |

Caveat shown inline: "CBA-bound salaries are locked only until the
contract expires. Marblehead's largest CBAs (MEA, MFFA, MPSO) renew
on staggered cycles; full schedule on the bottom of this page."

#### Tier 3 — Schedule-locked

Long-term funding obligations governed by actuarial schedules.

| Item | FY27 | Source |
|---|---|---|
| Pension assessment (Marblehead Contributory Retirement) | $5.84M | town_budget_FY27.json |
| OPEB contribution | TBD | town_budget_FY27.json or override presentation |
| Medicare (federal employer match, 1.45%) | $0.28M | town_budget_FY27.json |

Caveat shown inline: "Pension and OPEB schedules can be re-amortized
with PERAC approval; that would lower this year's payment but raise
later years."

### Section 2: What it actually costs to employ someone

**Visual:** two side-by-side stacked vertical columns (one per
archetype), each broken into stack segments for salary, healthcare,
pension, Medicare, OPEB. Same neutral color palette as Section 1; the
two columns sit on the same y-axis so reader can compare totals at a
glance.

#### Teacher archetype

| Component | Estimate | Source |
|---|---|---|
| Average salary | $90,696 (FY24 DESE), adjusted forward to FY27 with the contractual COLA from the Robidoux contract | dese_marblehead_avg_teacher_salary.csv + schools/negotiations files |
| Healthcare (employer share) | ~$15K (family plan share, GIC rate sheet) | health_premiums.csv + GIC rate sheet |
| Pension (MTRS) | $0 — state pays | flag this prominently; it's surprising |
| Medicare (1.45%) | ~$1,315 | derived |
| OPEB allocation | TBD per-employee allocation | ACFR OPEB note |
| **Total cost-to-employ** | ~$110K (placeholder; implementation to confirm) | |

#### Town employee archetype

| Component | Estimate | Source |
|---|---|---|
| Average salary | derived from town wages line / FTE count | town_budget_FY27.json + fy27_personnel.yml |
| Healthcare (employer share) | ~$15K | same |
| Pension (MCRS, town pays) | town's share of the $5.84M assessment ÷ FTE | town_budget_FY27.json |
| Medicare (1.45%) | derived | |
| OPEB allocation | TBD | |
| **Total cost-to-employ** | TBD | |

Each column carries an inline caveat: "Average hides spread. A
first-year teacher and a senior firefighter both count as one FTE but
cost very different amounts. The translator below uses the average
for each archetype."

### Section 3: The translator

Single input + radio toggle:

```
Cut amount:  [ $ __________ ]
Cut from:    ( ) schools  ( ) town side
             → ≈ N positions
```

Implementation:

- Two constants, computed at build time and embedded as `data-*` attrs:
  `data-teacher-cost` and `data-town-employee-cost`.
- On input, divide cut amount by the selected archetype's
  cost-to-employ, round down, render the integer.
- For round-down honesty, also render the literal expression beneath:
  "$1,000,000 ÷ $110,000 per teacher ≈ 9 positions."

No localStorage, no analytics event tagging beyond the standard
PostHog autocapture.

### Section 4: Caveats

A short bulleted list — same content as the inline caveats but
collected for the skim-reader:

- "Locked this year" ≠ "locked forever." CBAs expire, debt is paid off,
  pension and OPEB schedules can be re-amortized.
- The teacher pension being state-paid is a real thing — it does mean
  the town saves on direct pension contributions for teachers vs town
  employees, but the state's bill is funded from taxes Marblehead
  residents also pay.
- Averages hide spread. A senior position costs more than a junior
  one; the archetype is a midpoint, not a forecast.
- Figures use the FY27 Proposed Budget — No Override. The adopted FY27
  budget (with override revenue included) will be updated here when
  the town publishes it.

### Section 5: Sources & methodology

Standard `<sup class="cite">` markers throughout the body, collected
into a Sources section at page bottom by `assets/citations.js`. Every
dollar value links to one of:

- `data/town_budget_FY27.json` (and its source PDF)
- `data/cherry_sheet_FY26.csv` (Mass. DLS)
- `data/dese_marblehead_avg_teacher_salary.csv` (DESE)
- `data/health_premiums.csv` (GIC family-plan history)
- FY27 school budget packet
- Marblehead Contributory Retirement Board PERAC valuations
- Recent ACFR OPEB notes

## Data structure

New file: `_data/fixed_costs.yml`. Each entry carries:

- `tier`: 1, 2, or 3
- `category`: short label ("Bonded debt", "Group Insurance", etc.)
- `fy27_amount`: integer dollars
- `source_doc`: identifier the citations.js pipeline understands
- `source_note`: free text describing the line item
- `caveat`: optional inline qualifier (e.g. "FY26 cherry sheet — FY27
  not yet published")

The page reads this file via Jekyll templating at build time. The
total locked figure (`X` in the lead) is computed as a sum; the
flexible residual (`Y`) is `109,777,938 - X`.

FTE cost-stack constants live in a sibling file `_data/fte_cost.yml`
with the same source-citation pattern, one block per archetype.

## Visualizations

- All SVG inline. No Chart.js, no D3. Matches site convention.
- Reuses STYLE_GUIDE chart classes; no inline `style=""` on SVG
  elements.
- Horizontal stacked bar: full width on desktop, full width on mobile;
  segment labels move below the bar on mobile if they don't fit.
- Side-by-side FTE columns: 50/50 split on desktop, stacked vertically
  on mobile.
- All bars carry `<title>` and `<desc>` for screen readers.

## Linking strategy

Add links from:

- `the-debate.html` — in the "fiscal conservative" steelman section,
  link to this page as the source of the "small flexible pool" frame.
- `where-has-the-money-gone.html` — link from the "What grew faster"
  section, framed as "but how much of that growth was even cuttable?".
- `no-override-budget.html` — link from the cuts list, framed as
  "every dollar of cuts has a position attached".
- `town-budget.html` — add a one-line teaser near the top: "Want the
  fixed-vs-flexible lens first? See What's actually flexible."

The page itself does NOT link to the override-yes/override-no
campaign pages; it stays argument-agnostic.

## Implementation order (for the plan)

1. Build `_data/fixed_costs.yml` with confirmed Tier 1/2/3 dollar
   values from the primary sources listed above. Anything not yet
   confirmed gets a `TBD` marker that the build fails on, so the page
   never ships with placeholder numbers.
2. Build `_data/fte_cost.yml` with confirmed archetype components.
3. Write the page HTML with Jekyll templating against those two data
   files.
4. Add the SVG visualizations.
5. Wire the translator JS.
6. Add inbound links from the four pages listed.
7. Smoke-test with Playwright (mobile + desktop viewport).
8. Capture proof screenshot, open PR.

## Open questions for the user before implementation

These do NOT block writing the implementation plan, but each will need
a decision during implementation:

1. **OPEB sourcing.** OPEB appears in ACFR notes but I haven't yet
   confirmed it surfaces as a discrete FY27 appropriation line. If it
   doesn't, do we use the ACFR-actuarial annual required contribution
   (ARC), or fold OPEB silently into "other locked"? The override
   presentation mentions a $96,771 "Restore Town Portion of OPEB
   Transfer" line; that may be the operating piece.
2. **CBA-locked salaries.** Do we want the spec to estimate this as
   "salary lines under departments whose CBA expires after FY27" — or
   simply call it "most of the personnel budget" without a precise
   number? The latter is more honest and easier to defend.
3. **Tier color palette.** Three locked tiers + one flexible needs
   four distinct neutral tones. I'd default to the site's existing
   neutral chart palette (cool greys + accent); if you want something
   more visually striking that's a separate design call.
