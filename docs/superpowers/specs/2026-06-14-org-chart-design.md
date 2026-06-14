# Org chart page design — "Who runs Marblehead?"

**Date:** 2026-06-14
**URL:** `/org-chart.html`
**Title:** *Who runs Marblehead?*

## Goal

A standalone page that shows the two parallel administrative structures
(town + schools), the elected boards above them, and what a resident's
levers actually are. Visual centerpiece is a side-by-side org chart with
a two-tier expand toggle (dept heads visible by default, click to expand
to named staff roles).

## Why this page exists

`town-school-admin.html` already argues *why* Marblehead runs two
administrations — state law forces it, and the consolidation savings
ceiling is $200–400K. That page is an argument about overhead.

This page is the **diagram of the system itself**: who runs what, who
oversees them, and where the voter fits. It is descriptive, not
argumentative. It is meant to be the link someone shares when another
resident asks "who do I email about this?" or "who actually decides X?"

No cross-link from `town-school-admin.html` for now (per user decision
during brainstorming) — the page lives on its own URL and earns inbound
links over time.

## Editorial stance

Descriptive, not advocacy. No "bloated administration" framing, no
"lean government" framing. The chart shows what exists; the voter-role
section shows what levers exist. Readers form their own conclusions.

Cite every box on the chart to a primary source (marbleheadma.gov dept
page, marbleheadschools.org, FY27 budget line items). Snapshot date in
the lead — this is point-in-time and will go stale.

## Page structure (top to bottom)

### 1. Lead + key stats

- One-sentence lead: Marblehead is run by two parallel administrations,
  overseen by elected boards, all answerable to the town's registered
  voters. (Exact voter count comes from the key-stat box, verified
  against the most recent town clerk figure.)
- Snapshot date: "as of [date]"
- Key-stat boxes (4 across):
  - Town departments (count, from chart)
  - School buildings + central office (count)
  - Elected board seats (sum across all boards)
  - Registered voters (most recent annual figure from town clerk)

### 2. The two administrations (the chart)

**Layout:**

- Desktop: two columns side-by-side. Left = Town, right = Schools.
- Mobile: stacked, Town first.
- Each column has a single root card (Town Administrator / Superintendent)
  with a vertical connector down to a grid of department-head cards.
- Cards in the grid are siblings; no inter-departmental connectors.
- No SVG — HTML/CSS with border-based connectors.

**Default card content:**

- Department name (e.g., "Finance")
- Head's role title (e.g., "Finance Director")
- Total FTE for the department
- `▾ staff` toggle if there's an expandable sub-tier

**Expanded state:**

- Native `<details>` element so it works without JS and is keyboard accessible.
- Reveals a nested list of named positions/roles beneath the head
  (role titles only — e.g., "Town Accountant", "Treasurer/Tax Collector").
- No personal names. Roles only.

**Town column** (verify final list against marbleheadma.gov during build):

Finance, HR, IT, Facilities, DPW, Police, Fire, Harbormaster, Health,
Recreation & Parks, Library, Council on Aging, Planning & Community
Development, Assessor, Town Clerk

**Schools column** (verify against marbleheadschools.org + FY27 budget):

Central office (Asst Supt Finance, Asst Supt C&I, HR, IT, Facilities)
plus 7 building principals: MHS, MVMS, Bell, Coffin, Glover, Village, Brown.

### 3. The boards above them

Brief panel intro: every administrator on the chart above answers to
one or more elected boards. Here they are.

**Top row (emphasized — larger cards or distinct row):**

The three boards that drive the override debate and overall budget:

- Select Board (5 elected, 3-year staggered terms) — hires Town
  Administrator; sets town policy; warrants for Town Meeting
- School Committee (5 elected, 3-year staggered terms) — hires
  Superintendent; sets school policy; negotiates teacher contracts
- Finance Committee (9 appointed by Town Moderator, 3-year terms) —
  reviews and recommends on every Town Meeting article with fiscal impact
  *(Flag explicitly: FinCom is appointed, not elected — common confusion.)*

**Grid below (smaller cards, alphabetized):**

Elected: Town Moderator, Town Clerk, Light Commission, Planning Board,
Board of Health, Board of Assessors, Recreation & Parks, Housing
Authority, Cemetery Commission, Trustees of the Public Library, Water
& Sewer Commission

Appointed: ZBA, Conservation Commission, Historical Commission, Old &
Historic Districts, Affordable Housing Trust

**Each card includes:**

- Board name (linked to its marbleheadma.gov page)
- Composition: elected/appointed, # seats, term length
- One-sentence "what they decide"
- Meeting cadence

### 4. Your role

Plain-language list. Three buckets. ~150–200 words total. Concrete
actions, not civic-textbook abstractions.

**Vote**

- Annual town election (early May) — picks Select Board, School
  Committee, Moderator, Light Commission, and other elected seats
- Town Meeting — every registered voter is a member; you vote directly
  on the budget, overrides, and bylaws
- Ballot questions — overrides, debt exclusions, and charter changes
  appear on the May ballot

**Show up**

- Public comment at board meetings (most boards take comment at the
  start of the meeting)
- Town Meeting attendance — quorum matters; this is the only body that
  can approve the budget
- Run for a seat — most boards have at least one seat up every May

**Ask**

- Public records request (MGL c.66 §10)
- Email or call elected reps directly — Select Board and School
  Committee members publish email addresses on marbleheadma.gov and
  marbleheadschools.org
- File a citizen petition for Town Meeting (10 signatures)

Tone: "here's what the lever does," not "here's why you should pull it."
No links to advocacy organizations. No editorial language.

### 5. Sources

Auto-injected `<h2>Sources</h2>` from `assets/citations.js` based on
the `<sup class="cite">` markers throughout the page.

## Data sourcing

**Pass 1 — gather positions and structure**

- Town departments and roles: scrape current marbleheadma.gov
  department pages; cross-check FTE counts against the FY27 town budget.
- Schools side: marbleheadschools.org/administration + FY27 school
  budget (already available under `data/schools/`).
- Boards: marbleheadma.gov board pages for current composition, term
  lengths, and meeting cadence.

**Pass 2 — cite every box**

- Each dept-head card gets a `<sup class="cite">` pointing to the
  marbleheadma.gov department page or schools.org administration page.
- Each board card gets a citation to its official town/schools page.
- Expanded staff lists cite the FY27 budget PDF section that lists those
  positions, where available.

## Implementation notes

**Data file vs inline HTML:**

If the total card count is large (15+ town depts, 7 school buildings,
~20 boards), factor the data into `_data/org_chart.yml` and render via
a Liquid loop. Decide during implementation based on actual card count.
Goal is to avoid 300+ lines of repetitive hand-written HTML.

**No JS dependency:**

Use native `<details>` for expand/collapse. Works without JS. Inherits
accessibility. CSS can style the marker.

**CSS:**

- New scoped block in `assets/site.css` (e.g., `.org-chart`, `.org-card`,
  `.org-connector`, `.board-grid`).
- Connector lines via `border-left` / `border-top` on pseudo-elements,
  not SVG.
- Mobile: stack columns, simplify connectors (or drop them on small
  screens).

**Snapshot framing:**

Lead includes "as of [date]". Footer note: this page is a point-in-time
snapshot and will go stale after the May 2026 election. Re-verify
quarterly.

## Out of scope (deferred)

- Personal names. Role titles only. Names rot fast and the page would
  need monthly updates.
- Budget amounts per dept (already covered by `town-budget.html` and
  `where-has-the-money-gone.html`).
- Org change history (e.g., when HR was created in 2024) — covered in
  `town-school-admin.html`.
- Homepage placement — decide after the page exists and we see how it
  performs.
- Cross-link from `town-school-admin.html` — explicit user decision to
  hold off.

## Definition of done

- Page renders correctly in `npm run dev` and in the Cloudflare PR
  preview, desktop and mobile widths.
- Every box on the chart and every board card has a primary-source
  citation.
- `<details>` expand/collapse works without JS in a browser with JS
  disabled.
- Playwright smoke (`tests/smoke-test.mjs`) still passes 52/0.
- Proof-of-work screenshots committed to `proof/<branch>.png` (above the
  fold) and `proof/<branch>-full.png` (full page).
- PR body includes the Cloudflare preview URL and a list of specific
  paths/screens for the reviewer to inspect.
