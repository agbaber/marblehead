---
title: "Site audit and prioritized next work (2026-04-28)"
---

# Site audit and prioritized next work — 2026-04-28

Audit run on 2026-04-28, six weeks before the June 9 ballot. Captures current site state,
recent shipping pattern, orphan pages, stale PRs and issues, and a prioritized worklist
through Election Day.

## Big picture

- 27 top-level HTML pages, 18 chart pages under `/charts`, 4 layouts, 7 includes.
- `index.html` is 3,863 lines / 45 h2s organized into 4 themed groups (PR #700) of 15
  questions, each with three stance answers.
- Nav (`_includes/nav.html`) covers Vote / Budget / Schools / Insurance / Tax Bill /
  Compare / About — solid coverage of the chart-page set; everything else lives in
  `browse.html`.
- 9 open PRs, 31 open issues — both lists are heavy with work that was queued mid-April
  and has since been overtaken by a different shipping rhythm.

## Recent shipping rhythm (last ~2 weeks)

The work has shifted away from "ship more charts" toward polish, plain language, and
homepage information architecture:

- Plain-language rewrites of all 15 homepage Q sections (PRs #676, #687, #690).
- Votes-strip cleanup, countdown badges, Town Meeting line, descriptions stripped
  (PRs #683 through #693).
- Homepage Q-cards sectioned into 4 themed groups (#700).
- the-debate gets the side-by-side crux summary at the top (#701).
- Favicon iteration: chess-piece silhouette tried then reverted to detailed lighthouse
  (#705/#706/#708).
- Light dark-mode polish (#707).
- New page: `info-guides.html` summarizing the town's six FY27 dept information guides
  (#713, just merged).
- Style normalization: TL;DR bullets on chart pages match muted aesthetic (#712).
- Two real content adds: `after-the-no-vote.html` (#678), residential exemption section
  on `senior-tax-relief.html` (#710).

Translation: the site is in finishing-touches mode for the homepage and ballot pages,
not chart-expansion mode.

## Orphans (need pruning, featuring, or linking)

- **`fiscal-goals.html`** — 0 inbound links anywhere. Three-milestone tracker page; not
  in nav, not in browse, not on homepage. Decision: either feature it or delete it.
- **`prop25-story.html`** — 0 inbound links. Just shipped 2026-04-26 (#681) as a Prop 2½
  history page; never got wired up. Decision: link from `marblehead-voting-record.html`
  or `how-we-got-here.html` (or both), and add to browse.
- **`super-summary.html`** — only linked from `browse.html`. The "60-second version" of
  the override; intentionally a "front door" page that can't be reached from the front
  door. Worth either promoting (CTA on the homepage hero) or accepting as a sharing-only
  page.
- **`branches.html` ↔ `verify.html`** — only link to each other. Part of the dormant
  verification system (PR #533 WIP from 2026-04-16). Decision: either land verification
  before the vote or hide these from the build until later.

## Stale content I can confirm

- **`senior-tax-relief.html` lines 389, 618, 638**: H.4225 status reads "as of April 10,
  2026: Not yet signed into law" and "Currently awaiting Senate action." Per issue #709,
  the Senate passed the bill April 21 and it now awaits the Governor's signature.
  This is the highest-impact stale fact on the site — the page is in nav and is the
  canonical place residents are sent on senior tax relief.
- Most pages have no other "TBD" / "WIP" / "coming soon" copy in user-facing HTML.

## Open PRs — triage

| PR | Status | Recommendation |
|---|---|---|
| #714 — Private feedback form (Turnstile + Slack) | BLOCKED | Land or close; per memory, friction-as-feature suggests GitHub-issue path is preferred over zero-friction widgets. Likely close. |
| #665 — Free cash CSV with provenance | BLOCKED | Small data hygiene PR. Resolve and merge. |
| #656 — Balance the Budget tool (spec + plan) | CLEAN, +2,239 | Spec only, no implementation. Decide pre-vote: ship or shelf. |
| #627 — Stats strip / TOC / landmark callouts | DIRTY | Covers narrative pages. Conflicts; rebase or close. |
| #610 — Four-path intent-based landing page | BLOCKED | Sketch from 2026-04-18; superseded by #700's themed grouping. Close. |
| #609 — Outcome-assessment data gaps note | CLEAN | Research note. Land or convert to issue. |
| #541 — Consolidate CLAUDE.md | DIRTY | CLAUDE.md has changed substantially since. Rebase or close. |
| #539 — Voluntary contribution research notes | BLOCKED | Can land as data; low risk. |
| #533 — Verification WIP | DIRTY, +6,374 | Stale 12+ days, conflicts. Close unless we plan to ship verification before the vote. |

## Open issues — triage

**Priority — should ship before the vote:**

- **#709** — H.4225 status update (senior-tax-relief.html). This is the most important
  open issue right now.
- **#696** — Extend `peer_compensation.html` with Unit A step-and-lane scale data.
  Data was scraped in #680; charts page still uses DESE averages. Hard data accuracy.
- **#581** — Source citations for Circuit Breaker numbers on senior-tax-relief.html.
  CLAUDE.md "every number traceable" rule, on a high-traffic ballot page.
- **#568** — Site-wide anchor audit (h2 ids on chart pages and multi-section pages).
  Cross-page links land at top of page rather than the named section. UX correctness.
- **#564** — Trace where the $1.15M from the trash carve-out went in FY27. Q10 makes
  this claim; needs grounding.

**Reasonable but lower priority:**

- **#591** — Q2 trash fallback fee: six open legal questions before relying on it.
- **#616** — question-2-trash scroll-lock fix.
- **#666** — Stacked-bar free-cash for peer towns.
- **#549/#571** — Budget ratcheting analysis + placement.
- **#647** — Move preview deploys from Actions to Cloudflare git integration (infra).
- **#662** — Ingest school committee agendas + materials packets (data).
- **#679** — Menu vs. tiered override structure research (analysis, not page).

**Likely close (deprioritized by recent shipping):**

- New-chart issues from 2026-04-16/17 that didn't ship and have been overtaken by the
  plain-language pass: **#555, #556, #557, #558, #559, #560, #561, #562, #563**.
- **#587** — Peer-town slope-continuation charts (deferred peer-chart work).
- **#595, #596** — Deficit-model variants.
- **#604** — Melrose bridge mechanism case study.
- **#602** — Stoneham GF-balance case study.

## New issues worth filing

- **Wire up `prop25-story.html`**: link from `marblehead-voting-record.html` (top intro),
  `how-we-got-here.html`, and `browse.html`. Optional: nav entry under "Vote" or
  "About this project".
- **Decide `fiscal-goals.html`'s fate**: feature with CTA from homepage hero or
  `the-debate.html`, OR delete it. 0 inbound links is failure mode either way.
- **Decide `super-summary.html`'s placement**: it was built as a sharing artifact;
  either promote it as the homepage hero CTA ("Whole override in 60 seconds") or
  document that it's a sharing-only page so future audits don't keep flagging it.

## Prioritized worklist (next 2-3 sessions)

1. **#709 — H.4225 status update on `senior-tax-relief.html`.** Replace lines 389,
   618, 638 + add the April 15/21 events. Source: malegislature.gov/Bills/194/H4225 +
   Marblehead Current Apr 27 article. (Smallest, highest-impact change.)
2. **Wire up `prop25-story.html`.** Add inbound links from voting-record / how-we-got-here
   / browse. Decide on nav placement.
3. **#581 — Source citations for Circuit Breaker numbers on `senior-tax-relief.html`.**
   Bundle with item 1 if it's a small enough delta.
4. **Triage and close stale PRs:** #533, #541, #610, #627. Each gets a one-paragraph
   close-reason comment.
5. **Triage and close stale chart issues** (#555-#563, #587, #595/596, #602, #604):
   one bulk close-comment explaining the shift to plain-language pass.
6. **#696 — Unit A step-and-lane scale on `peer_compensation.html`.** Real data work;
   biggest factual upgrade still on the table for the schools comparison.
7. **#568 — Anchor audit.** Add h2 ids on chart pages and multi-section pages so
   evidence-chart-links actually land where they promise. Mechanical pass.
8. **`fiscal-goals.html` decision.** Either feature or delete.
9. **#564 — $1.15M trash carve-out trace.** Worth doing but more research-heavy.

## Signals worth watching

- Election is June 9, 2026 — 6 weeks out as of this audit.
- H.4225 final status (passed both chambers, awaiting Governor signature).
- Town Meeting May 4-5 (Article 4 MBTA housing per memory) may produce news worth
  surfacing on `whats-on-the-ballot.html` or homepage votes-strip.
