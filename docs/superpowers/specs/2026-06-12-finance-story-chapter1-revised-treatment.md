# Finance story Chapter 1 — REVISED treatment (site-native aesthetic)

**Date:** 2026-06-12
**Owner:** Andrew Baber
**Status:** Approved 2026-06-12. Refactor plan: `docs/superpowers/plans/2026-06-12-finance-story-chapter1-refactor.md`.
**Supersedes:** `2026-06-11-finance-story-design.md` for Chapter 1's treatment; the conceptual arc and chapter list are unchanged.

## Locked decisions (2026-06-12)

1. **Real charts** for all 4 sections, sourced from existing data where available; §4 (grant capture) data lift accepted as part of scope.
2. **Hero diagram: scroll-by**, not pinned. Buckets reappear in §5 where the "they don't mix" argument needs them.
3. **Top sticky bar: copy m101** (Chapter X of N + percentage + Chapters button).
4. **Syllabus rail: deferred** until Chapter 3 lands.
5. **Path A: refactor in place** on `finance-story-ch1-impl`.
6. **Adopt Observable Plot** lazy-loaded on finance-story routes. Hand-roll SVG for the §5 blocked-arrows custom viz.

## Why revise

The first implementation (now on branch `finance-story-ch1-impl`) executed the v5 brand-report aesthetic from brainstorming. After seeing it rendered, the user's feedback was:

1. The prose was too jargon-heavy. Fixed in `081c2ae` with a plain-language rewrite.
2. The format itself feels too much like Bidwells, not enough like marbleheaddata.org. The static four-bucket diagram, repeated five times with one bucket highlighted, isn't pulling its weight. Each section needs its own chart that does real work, and transitions between sections should feel meaningful.

This spec replans Chapter 1's treatment to match the site's existing visual language and to give each section a chart that earns its place.

## What stays

- The arc: hero → General Fund → Enterprise → Capital → Restricted → why they don't mix → closing.
- The plain-language prose from `081c2ae`. Polish welcome; rewrites no.
- The page URL: `/finance-story/01-four-buckets`.
- The chapter is the prototype that locks Chapter 2-7's visual treatment.

## What changes

### Typography → site-native

- **Headlines:** Libre Franklin 600/700 (matches m101, town-history, town-budget). Drop Source Serif.
- **Body:** Source Sans 3 at 17px / line-height 1.55 (matches existing `.m101-main p`).
- **The italic-accent pattern** carries over (the `<em>` inside h2s) but renders in Libre Franklin italic, not Source Serif. Italic accents stay teal.
- **Headings cap at h1 42px / h2 24px** matching m101, not the 110px hero scale from v5.

### Layout → bounded `.page` with cards over fog

- **Page wrapper:** `max-width: 1180px` outer, body text in a 660px column matching `.m101-main p`. Drop the 1440px full-bleed grid.
- **Background:** `--c-fog` (site default), not alternating cream/navy/teal panels.
- **Sections:** white surface cards with the site's `--shadow-sm`, separated by ~64px vertical space, not 100vh full-bleed.
- **Hero:** smaller, denser, in the navy-flat pattern used by the existing site landing tiles. No 100vh, no mesh-grid backdrop. A single tile with the headline, the four buckets sized inline beside it (sneak peek of the diagram), and a scroll cue.

### Chart per section

The static bucket diagram (one SVG, repeated with different highlights) is replaced. Each section gets its own chart that does the work of THAT section. The four-bucket diagram appears **only in the hero** as the orientation visual; sections never repeat it.

**§1 General Fund chart: breakdown treemap or bar stack**
- What it shows: how $109.78M actually gets spent. Schools 47.6M, public safety 11.9M, fixed costs 25M, public works 6.9M, town admin 4.6M, culture/rec 1.9M, human services 0.9M.
- Source: `data/town_budget_FY27.json` or the FY27 Proposed Budget vote totals.
- Animation: bars draw left to right on scroll-in, sized to share.
- Why: lets the reader actually see why "the main bucket" matters and where the money goes.

**§2 Enterprise chart: small multiples (water, sewer, harbor)**
- What it shows: each utility's revenue vs cost over recent years. Three small line pairs side by side.
- Source: ACFR enterprise-fund statements; can use `data/budget_FY26_by_fund.json` if it segments enterprise.
- Animation: lines draw left to right on scroll-in, revenue then cost stacked.
- Why: makes "they pay for themselves" visible as a recurring fact, not just an assertion.

**§3 Capital chart: stacked debt-service over time**
- What it shows: annual debt-service payments, FY15-FY30, stacked by general-obligation vs excluded-debt. Recent debt exclusions are visible as a growing band on top.
- Source: `data/debt_summary.json` for total debt service, `data/dor_debt_exclusion_all.csv` for the exclusion lines (filter for Marblehead, DOR code 168).
- Animation: bars grow up in sequence (left to right) on scroll-in. Annotation lines for "May 2024 school feasibility approved" etc.
- Why: shows what "borrowing now and paying later" actually means as a curve, including the upcoming bump from the June 2026 votes.

**§4 Restricted chart: stacked bars of grant capture per year**
- What it shows: grant + revolving fund inflows per year, last 5 years. Possibly broken out by department (police, schools, rec).
- Source: ACFRs (Note: this data isn't pre-extracted; needs a one-time scrape from the last 5 ACFRs into a CSV in `data/`).
- Animation: bars stack on scroll-in.
- Why: makes "real workload" concrete by showing the amounts. If the data lift is too big for the first pass, we ship a static figure ($X captured last year) with a citation and revisit.

**§5 Why they don't mix: a small annotated diagram**
- What it shows: arrows from each bucket trying to cross into another, blocked by a wall labeled with the relevant authority (Mass. statute, bond covenant, grant agreement, etc.).
- Animation: arrows draw toward walls and stop. Walls flash teal.
- Why: gives the closing claim a final visual beat.

### Scroll transitions

When the user scrolls from §N to §N+1, the chart for §N+1 builds itself in (IntersectionObserver hooks, ~600-800ms animation). The hero's four-bucket diagram shrinks and pins to the top-left of the viewport as a small persistent reference, scrolling with the page but always visible. When you scroll past §5, the small reference dissolves and the closing CTA takes over.

This is a meaningful upgrade over the current implementation: the visualization is doing argument work in every section, not decoration.

### Sticky bottom progress bar → removed

The Bidwells-style fixed bottom bar with "Open the checkbook" doesn't fit the site. Replace with:
- A **top sticky progress bar** matching `.m101-stickybar` (chapter X of N, percentage fill, "Chapters" button).
- The "Open the checkbook" CTA moves to the closing section as a regular site button.
- The data-citations footnote section (auto-injected by `assets/citations.js`) stays at the bottom.

### Syllabus rail → consider

m101 has a left syllabus rail showing all chapters. Finance story will eventually have 7 chapters; a rail would orient the reader. For Chapter 1's prototype, ship without and revisit when Chapter 2 lands. Decision deferrable.

## What gets removed

- `_layouts/finance-story.html` heavy hero + sticky bottom bar treatment.
- `assets/finance-story.css` design tokens that duplicate site.css (the `.fs` palette, the alternating-section backgrounds).
- The repeated four-bucket SVG markup in §§1-4. One in the hero only.
- Source Serif font import.

## What gets kept from the current implementation

- The plain-language prose committed in `081c2ae`.
- The reveal-on-view JS infrastructure (still useful for the chart builds).
- The reduced-motion + dark-mode + a11y patterns established in Tasks 4-6.
- The citation footnote integration.
- The Chapter 1 Playwright test (`tests/finance-story-chapter1.mjs`), with updated assertions for the new structure.

## Implementation approach

Two paths, pick one:

**Path A: Refactor in place.**
- Open a new commit series on the same branch (`finance-story-ch1-impl`).
- Rewrite `finance-story/01-four-buckets.html` to use the site's layout primitives directly. Use `.page` wrapper, m101-flavored sticky bar, `--c-*` tokens.
- Delete or trim `assets/finance-story.css` to the bits the new design uses.
- Update `_layouts/finance-story.html` to remove the heavy hero and bottom bar.
- Update the test.
- Roughly 8-12 hours of work, plus chart-data prep.

**Path B: Treat as a separate iteration.**
- Open a new branch `finance-story-ch1-v2` off the same base.
- Old branch stays as a reference snapshot of the v5 attempt.
- Same scope of work in the new branch.
- Roughly the same hours, plus the bookkeeping cost of two parallel branches.

Path A is cleaner unless there's value in keeping the v5 implementation as a reference for what NOT to do.

## Per-chapter time estimate

Chapter 1 prototype + design-system rebuild: 10-15 hours.
Chapters 2-7: 4-6 hours each once the patterns are locked.

This is roughly the same lift as the original spec; the work shifts from "polish the v5 brand-report" to "build each chart and the new layout."

## Open questions

1. **Charts per section: full lift or static figures for now?** Building all 4 charts on real data (especially §2 enterprise multiples and §4 grant history) requires data sourcing from ACFRs not yet extracted. Quickest ship: §1 bar/treemap on data we have, §2/§3 from existing data, §4 as a static citation-backed paragraph until ACFR scrape lands. Slower but better: source all 4 charts now.

2. **Hero four-bucket diagram: scroll-pinned or scroll-by?** Option A keeps it visible as a constant orientation. Option B lets it scroll off after the hero and never returns. Pinned is more cohesive; scroll-by is less visual noise.

3. **Top sticky progress bar: copy m101 exactly or simplified?** Copying m101 means consistent chrome across both primers. Simplified means lighter on chapter pages without a full course context.

4. **Syllabus rail: this PR or next?** Argument for now: orientation is part of the story format. Argument for later: only 1 of 7 chapters exists; rail is mostly empty placeholders for now.

5. **Path A or B?** Refactor in place (cleaner history, current branch becomes the prototype) or new branch (snapshot of the rejected v5 attempt preserved for reference).

6. **Chart styling library or custom?** The site has `assets/chart-tooltip.js` used by existing charts. The bars + line drawings could be hand-rolled SVG (like existing charts) or use a small lib. Custom is more work but matches site convention.
