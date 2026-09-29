---
title: "Site audit and prioritized next work (2026-04-28)"
---

# Site audit and prioritized next work — 2026-04-28

Audit run on 2026-04-28, six weeks before the June 9 ballot. Captures current site
state, recent shipping pattern, orphan pages, stale PRs and issues, and a prioritized
worklist through Election Day.

## Big picture

- 27 top-level HTML pages, 18 chart pages under `/charts`, 4 layouts, 7 includes.
- `index.html` is ~3,860 lines / 45 h2s organized into 4 themed groups (PR #700) of
  15 questions, each with three stance answers.
- Nav (`_includes/nav.html`) covers Vote / Budget / Schools / Insurance / Tax Bill /
  Compare / About — solid coverage of the chart-page set; everything else lives in
  `browse.html`.
- 9 open PRs and 31 open issues at the start of the audit; pruning brought open PRs
  to 7 and reduced issue noise via a `post-vote` label.

## Recent shipping rhythm (last ~2 weeks)

The work has shifted away from "ship more charts" toward polish, plain language, and
homepage information architecture:

- Plain-language rewrites of all 15 homepage Q sections (PRs #676, #687, #690).
- Votes-strip cleanup, countdown badges, Town Meeting line, descriptions stripped
  (PRs #683 through #693).
- Homepage Q-cards sectioned into 4 themed groups (#700).
- the-debate gets the side-by-side crux summary at the top (#701).
- Favicon iteration: chess-piece silhouette tried then reverted to detailed lighthouse
  (#705 / #706 / #708).
- Light dark-mode polish (#707).
- New page: `info-guides.html` summarizing the town's six FY27 dept information
  guides (#713).
- Style normalization: TL;DR bullets on chart pages match muted aesthetic (#712).
- Two real content adds: `after-the-no-vote.html` (#678), residential exemption
  section on `senior-tax-relief.html` (#710).

The site is in finishing-touches mode for the homepage and ballot pages, not
chart-expansion mode.

## Orphans (need pruning, featuring, or linking)

- **`fiscal-goals.html`** — 0 inbound links anywhere. Three-milestone tracker page;
  not in nav, not in browse, not on homepage. Decision: feature it or delete it.
- **`prop25-story.html`** — 0 inbound links. Just shipped 2026-04-26 (#681) as a
  Prop 2½ history page; never got wired up. Decision: link from
  `marblehead-voting-record.html` or `how-we-got-here.html` (or both), and add to
  browse.
- **`super-summary.html`** — only linked from `browse.html`. The "60-second version"
  of the override; intentionally a "front door" page that can't be reached from the
  front door. Either promote (CTA on the homepage hero) or accept as a sharing-only
  page.
- **`branches.html` ↔ `verify.html`** — only link to each other. Part of the dormant
  verification system. Decision: ship verification before the vote or hide these
  from the build until later.

## Stale content (fixed in PR #716)

- `senior-tax-relief.html` and `index.html` reported H.4225 as "awaiting Senate
  action" / "as of April 10, 2026: Not yet signed into law." Per the bill page and
  Marblehead Current (Apr 27), the Senate passed Apr 21, the bill was enacted Apr
  23, and is now awaiting Governor Healey's signature. Seven occurrences updated.

## Open PRs — triage outcome

Closed in this audit:

- **#533** — verification WIP, DIRTY since 2026-04-16, +6,374 lines. Closed; needs
  a fresh start if revived.
- **#541** — CLAUDE.md consolidation, DIRTY. Closed; CLAUDE.md has changed
  substantially since.
- **#610** — four-path landing-page sketch. Closed; superseded by #700's themed
  grouping.
- **#627** — narrative-pages stats-strip / TOC, DIRTY. Closed; easier to start fresh
  than rebase.

Still open, awaiting decision:

- **#716** — H.4225 status fix (this audit's first action item; closes #709).
- **#715** — statewide override-pass-rate context for `prop25-story` (recent, leave).
- **#714** — private feedback form (Turnstile + Slack). Likely contradicts the
  friction-as-feature stance per memory; leaning close.
- **#665** — free-cash CSV with provenance. Small data hygiene; merge.
- **#656** — Balance-the-Budget tool, spec-only (+2,239). Pre-vote ship, post-vote
  shelf, or close.
- **#609** — outcome-assessment data-gaps note (CLEAN). Could just merge.
- **#539** — voluntary-contribution research notes. Could just merge.

## Open issues — triage outcome

**Closed:** #555 (15th-question request, functionally satisfied by the homepage
service-level section).

**Labeled `post-vote`** (deferred to after June 9): #556, #557, #558, #559, #560,
#561, #562, #563, #587, #595, #596, #602, #604. These are real ballot-relevant ideas
but unlikely to ship in six weeks given the current cadence; the label removes them
from the active queue without losing the idea.

**Priority — should ship before the vote:**

- **#709** — H.4225 status update (fixed in PR #716).
- **#696** — Extend `peer_compensation.html` with Unit A step-and-lane scale data.
  Data was scraped in #680; charts page still uses DESE averages.
- **#581** — Source citations for Circuit Breaker numbers on `senior-tax-relief.html`.
- **#568** — Site-wide anchor audit: h2 ids on chart pages and multi-section pages
  so cross-page links land at the right section.
- **#564** — Trace where the $1.15M from the trash carve-out went in FY27.

**Reasonable but lower priority pre-vote:**

- **#591** — Q2 trash fallback fee: six open legal questions.
- **#616** — `question-2-trash` scroll-lock fix.
- **#666** — Stacked-bar free-cash for peer towns.
- **#549 / #571** — Budget ratcheting analysis + placement.
- **#647** — Move preview deploys from Actions to Cloudflare git integration (infra).
- **#662** — Ingest school committee agendas + materials packets (data).
- **#679** — Menu vs. tiered override structure research (analysis).

## New issues worth filing

- **Wire up `prop25-story.html`**: link from `marblehead-voting-record.html` (top
  intro), `how-we-got-here.html`, and `browse.html`. Optional: nav entry under
  "Vote" or "About this project."
- **Decide `fiscal-goals.html`'s fate**: feature with CTA from homepage hero or
  `the-debate.html`, OR delete it. 0 inbound links is failure mode either way.
- **Decide `super-summary.html`'s placement**: it was built as a sharing artifact;
  either promote it as the homepage hero CTA ("Whole override in 60 seconds") or
  document that it's a sharing-only page.

## Prioritized worklist (next 2-3 sessions)

1. **#716** — H.4225 status fix (in flight, this audit's first action).
2. **Wire up `prop25-story.html`** — small, high-leverage. Inbound links from
   voting-record / how-we-got-here / browse. Decide on nav placement.
3. **#581** — Source citations for Circuit Breaker numbers on
   `senior-tax-relief.html`.
4. **#696** — Unit A step-and-lane scale on `peer_compensation.html`. Real data
   work; biggest factual upgrade still on the table for the schools comparison.
5. **#568** — Anchor audit. Add h2 ids on chart pages and multi-section pages so
   evidence-chart-links actually land where they promise. Mechanical pass.
6. **`fiscal-goals.html` decision** — feature or delete.
7. **#564** — $1.15M trash carve-out trace. More research-heavy.

## Signals worth watching

- Election is June 9, 2026 — six weeks out as of this audit.
- H.4225 final status (passed both chambers, awaiting Governor signature).
- Town Meeting May 4-5 (Article 4 MBTA housing) may produce news worth surfacing on
  `whats-on-the-ballot.html` or homepage votes-strip.
