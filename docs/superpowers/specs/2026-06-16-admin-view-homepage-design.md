# Admin-view homepage design

Date: 2026-06-16
Status: approved, ready for implementation plan

## Overview

Reframe the marbleheaddata.org homepage from a primer-style landing with six
explainer tiles into an admin view of the town's finances. The site is split
into two halves: a **data half** (numbers, queries, the checkbook, the town
explorer) and an **information half** (override pages, healthcare findings,
the-debate, MBTA, the 101 primer). The homepage is the bridge.

Data is the spine. Every spending and revenue row carries a small "why?"
link to the relevant explainer. Returning residents stay on the dashboard;
new visitors scan, hit a row they care about, and click through to the
story.

Two layers are explicitly **out of scope** for this design:

1. An "organize and vote" action layer (verified neighbors, petitions,
   coordination). That's a separate product. The homepage gestures at
   active decisions through Zone 4 but does not promise tools that don't
   exist.
2. Creation of new explainer pages for spending/revenue categories that
   don't yet have them. The implementation uses the most-specific
   available link per row and omits the "why?" suffix where nothing
   reasonable exists. Filling in stubs is a follow-on.

## Goals

- Make the financial state of the town visible above the fold.
- Honor the editorial stance: data first, opinions optional. No green/red
  judgment colors on spending bars.
- Cut the navigation tile sprawl from six tiles to four (Checkbook
  becomes the top-fold CTA, Override becomes a row inside Zone 4).
- Preserve every existing page; this is a homepage rewrite, not a site
  restructure. Explainer URLs do not change.

## Non-goals

- No action / coordination UI on this page.
- No auto-pulling of meeting digest items into "What's in play" (rejected
  in brainstorm; meeting agendas have too much procedural noise).
- No new explainer pages in this scope.
- No URL changes for existing pages.

## Page structure

Five zones, top to bottom. Each zone is a `<section>` inside the page,
following the existing `.home-stop` / `.home-hero` pattern in `index.html`.

### Zone 1: Top fold

A three-KPI strip plus eyebrow line plus CTA. Replaces the current single
big-number hero.

```
TOWN OF MARBLEHEAD  ·  FY26 in progress  ·  as of May 29

$127.3M     Spent $98.1M (77%)     Reserves $4.2M
operating
budget

[Open the Checkbook →]
```

**Content sources:**
- Operating budget: FY26 adopted budget (currently hard-coded in
  `index.html` as $127.3M).
- Spent so far: latest checkbook snapshot. Currently hard-coded as
  $98.1M / May 29. Move to `_data/dashboard.yml` so the dashboard
  and the /checkbook/ page stay in sync.
- Reserves: most recent ACFR (FY24) plus FY25 update if available. Cite
  source in a `<sup class="cite">` per the existing citations pattern.

**Notes:**
- The eyebrow line ("FY26 in progress · as of May 29") carries the
  orientation-paragraph job that the hybrid option would have used.
  Keep it factual and dated; do not editorialize.
- The CTA button keeps the existing teal pill style
  (`.home-deeper` class).

### Zone 2: Where it's going

The spending tree. Six rows max, each with category name, dollar
amount, a horizontal bar showing proportion of total spending, and an
optional "why?" link to the relevant explainer.

```
WHERE IT'S GOING                              FY26 budget

Schools             $[XX.X]M  ████████████   why so much?
Town services       $[XX.X]M  █████████      what's in here?
Health insurance      $15.1M  ████           why up 12%?
Debt service         $[X.X]M  ███            which projects?
Pensions             $[X.X]M  ██             what's owed?
Capital              $[X.X]M  █              FY26 list
```

**Content sources:**
- Category amounts: FY26 adopted budget. Stored in
  `_data/dashboard.yml` under a `spending` array, each entry with
  `label`, `amount_millions`, `cite`, `why_link` (URL, optional),
  `why_text` (optional, the link copy).
- Bars: rendered as inline SVG sized proportionally to the largest
  category. No fixed pixel widths; CSS-driven.
- Health insurance: $15.1M is the verified number per project memory
  (override-debate work, FY27). Confirm the FY26 figure against the
  FY26 budget PDF before publishing.

**Why-link policy:**
- Link to the most specific available explainer.
- Health insurance → `/topics/health-insurance/` (exists, topic-feed page).
- Schools → `/topics/school-budget/` (exists).
- Debt service → `/town-debt.html` (exists) or `/topics/bonding-capital/`.
- Capital → `/topics/bonding-capital/` (exists).
- Override impact (if surfaced on a revenue row) → `/2026-override/`
  (exists, directory).
- MBTA / 40B → `/topics/40b-mbta/` (exists).
- Town services, Pensions, Free cash: no current dedicated explainer.
  For the first cut, link to a relevant `/charts/*` page if one fits,
  or omit the why-link entirely. Do not invent destinations or link to
  "coming soon" pages.

**Styling:**
- Bars use a muted neutral token from the existing palette. Must NOT
  be `--c-teal` (reserved for the Zone 1 CTA) and must NOT use red,
  green, or yellow (no judgment colors per the STYLE_GUIDE editorial
  stance). A subdued navy at low alpha or a surface-tinted gray fits.
- Row layout: 3 columns on desktop (label / amount + bar / why-link);
  stacks vertically on mobile.
- Why-links are de-emphasized: smaller font, muted color, arrow on
  hover. They should look like a quiet offer, not a CTA.

### Zone 3: Where it comes from

The revenue mirror to Zone 2. Same row shape, four rows max, same
why-link policy.

```
WHERE IT COMES FROM                           FY26 budget

Property taxes      $[XX.X]M  ████████████   override impact
State aid           $[XX.X]M  ██             what's Ch.70?
Local receipts       $[X.X]M  ██
Free cash            $[X.X]M  █              what is it?
```

**Content sources:**
- Same `_data/dashboard.yml`, `revenue` array, same schema.
- Property taxes: pull from FY26 budget. The override-impact why-link
  points at `/2026-override/` so visitors can see what the June 9
  vote did to this number.
- State aid: cite the most recent Cherry Sheet or House 1 figure.
- Free cash: cite the most recent DLS certification.

### Zone 4: What's in play

3 to 5 editorially curated open questions of town government, each a
card with a one-line summary and a link to its explainer page.

```
WHAT'S IN PLAY

◆ FY27 budget        Being built. $15M override passed;
                     the deficit is covered. → see numbers

◆ MBTA Article 4     Passed May 4. Compliance route
                     chosen. → what passed and why

◆ Glover HVAC        Open question on whether the
                     designed-for-20% scope was cut.
                     → what's known
```

**Content source:**
- New file: `_data/in_play.yml`.
- Schema per entry: `title`, `summary` (one line, <= 120 chars),
  `link` (URL on this site), `link_text`, optional `updated` date.
- Order is the order in the YAML (no auto-sorting).
- Cadence: update when something materially changes. No commitment
  to weekly cadence.

**Curation rules:**
- Items must be live open questions. Not "things that happened" and
  not "things we wish were debated."
- Each item must link to an explainer page that exists on the site.
  No external links.
- Maximum 5 items. If you have more than 5 live questions, the home
  page isn't the right surface; that's an `/issues/` index page.

### Zone 5: Go deeper

Bottom strip of 4 navigation tiles. Trimmed from the current 6.

```
GO DEEPER

Primer        Meetings        Town Explorer    Data catalog
How it works  What boards     Compare to 351   Charts,
in 8 chapters are talking     MA towns         tables,
              about           side by side     sources
```

**What changed from current homepage:**
- **Checkbook tile removed.** It's now the top-fold CTA.
- **2026 Override tile removed.** It's now a row inside Zone 4 (or
  inside Zone 3's revenue row, depending on which is more honest at
  publish time).
- **What can we do tile removed.** It was a placeholder for an action
  layer; per the architecture, action is a separate product.
- **Primer, Meetings, Town Explorer, Data catalog retained.**

Reuse the existing `.home-tile` CSS. Grid drops from 3 columns to 4
on desktop (since 4 tiles fits neatly), stacks at mobile breakpoints.

## Data files

### `_data/dashboard.yml` (new)

```yaml
fiscal_year: FY26
as_of_date: "2026-05-29"
operating_budget_millions: 127.3
spent_so_far_millions: 98.1
reserves_millions: 4.2
reserves_cite: "FY24 ACFR p.XX"

spending:
  - label: Schools
    amount_millions: 44.8
    cite: "FY26 budget p.XX"
    why_link: null      # no dedicated explainer yet
  - label: Health insurance
    amount_millions: 15.1
    cite: "FY26 budget p.XX, GIC rate sheet 2026"
    why_link: /healthcare/
    why_text: why up 12%?
  # ... etc

revenue:
  - label: Property taxes
    amount_millions: XX.X
    cite: "FY26 budget p.XX"
    why_link: /2026-override/
    why_text: override impact
  # ... etc
```

Placeholder dollar amounts in the spec are illustrative. The
implementation pulls verified numbers from the FY26 budget PDF and the
most recent ACFR. Every number gets a `cite`.

### `_data/in_play.yml` (new)

```yaml
- title: FY27 budget
  summary: Being built. $15M override passed; the deficit is covered.
  link: /budgets/fy27/
  link_text: see numbers
  updated: "2026-06-16"

- title: MBTA Article 4
  summary: Passed May 4. Compliance route chosen.
  link: /housing/mbta/
  link_text: what passed and why
  updated: "2026-05-05"

- title: Glover HVAC
  summary: Open question on whether the designed-for-20% scope was cut.
  link: /glover-hvac/
  link_text: what's known
  updated: "2026-06-10"
```

Link targets in the example above are illustrative. The implementation
checks which explainer pages exist and links to the closest available
match; if no acceptable target exists for an item, the item is not
included.

## Files touched

- `index.html` — full rewrite of `<section>` content. Existing inline
  `<style>` block is partly preserved (hero typography, tile styling)
  and partly extended (spending/revenue rows, in-play cards).
- `_data/dashboard.yml` — new file, schema above.
- `_data/in_play.yml` — new file, schema above.
- `assets/site.css` — possibly extended for new component styles if
  the inline `<style>` block in index.html grows beyond a reasonable
  size. Implementation chooses.

## Accessibility and mobile

- Each KPI in Zone 1 stacks vertically on narrow viewports.
- Spending/revenue rows reflow: on mobile, bar moves below the
  label+amount line.
- Bars are decorative; the dollar amount is the screen-reader signal.
  Bars get `aria-hidden="true"` or are rendered as SVG with no role.
- "Why?" links are real `<a>` tags, keyboard-focusable.

## Out of scope (explicit)

- Action layer, coordination tools, verified neighbors network.
- Creation of new explainer pages for spending/revenue categories.
- Changes to existing page URLs.
- Auto-pull of meeting digest items.
- Animations or transitions beyond the existing tile hover.

## Open questions for implementation

1. **What's the canonical FY26 spending breakdown?** Spec uses
   illustrative numbers; implementation must pull from the FY26
   adopted budget PDF and cite the page. If the budget categorizes
   differently than the spec's 6 buckets, the implementation may
   re-bucket but must document the mapping in `_data/dashboard.yml`.
2. **What's the canonical FY26 revenue breakdown?** Same as above for
   the 4 revenue buckets.
3. **Reserves figure currency.** $4.2M is from the current homepage
   copy. Implementation should verify against the most recent ACFR
   (FY24) and cite. If a more recent number exists in a Free Cash
   certification, use it.
4. **Initial set of "what's in play" items.** Spec proposes three
   candidates; the implementation finalizes the list (3-5 items)
   when populating `_data/in_play.yml`, with the constraint that
   every item links to an explainer that exists.
