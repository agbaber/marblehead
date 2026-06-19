# OG cards for the 10 tool pages

Date: 2026-06-16
Status: Approved for plan.

## Problem

The site has 10 active tool pages that get shared on Facebook (Thursday
"tool feature" slot in [SOCIAL_MEDIA_PLAN.md](../../../SOCIAL_MEDIA_PLAN.md))
and elsewhere. Today, every one of them previews in a feed with the
same generic lighthouse image and a not-built-for-the-scroll
description. That preview is the first thing a stranger sees; the
share is the first chance to earn the click.

Goal: each of the 10 tools gets a bespoke OG image and a punchier
claim-leading title/description that loads the page's most surprising
number.

## Scope

In: the 10 tool pages listed below.

Out (this pass):
- Long-form explainer pages (`marblehead-101/*`, `2026-override/`).
- Homepage.
- Static/policy pages (privacy, terms, 404, about).
- A reusable card *template* for non-tool pages. Each tool gets a
  hand-designed visual; templating is a follow-up if we ever extend
  to the 30+ remaining pages.

## The 10 pages

| # | Page | What the tool does |
|---|---|---|
| 1 | `checkbook.html` | FY26 spending + pacing explorer |
| 2 | `town-budget.html` | Line-by-line FY27 budget |
| 3 | `town-debt.html` | $116M debt, project by project |
| 4 | `where-has-the-money-gone.html` | Multi-year general-fund growth FY15-FY26 |
| 5 | `senior-tax-relief.html` | Circuit Breaker calculator |
| 6 | `inside-school-staffing.html` | 430 positions, role breakdown |
| 7 | `school-building-maintenance.html` | 5-school condition assessment |
| 8 | `org-chart.html` | Town + school admin structure |
| 9 | `branches.html` | Verification network |
| 10 | `meetings.html` | MHTV transcripts + summaries |

Note: `meetings.html` and `marblehead-voting-record.html` were considered. `marblehead-voting-record.html` is now a redirect to `/2026-override/` and dropped; `meetings.html` ships today with no `og_title` or `og_description`, so its frontmatter is a from-scratch write, not a rewrite.

## Voice rules for og_title and og_description

Per [STYLE_GUIDE.md](../../../STYLE_GUIDE.md) and override-debate memory:

- Title leads with the claim, not a description of the page.
- No rhetoric: no "shocking", "huge", "crisis", "skyrocketing".
- No em-dashes.
- Description loads the most surprising verifiable number from the
  page. Source implied (the data is already on the linked page).
- No green/red value judgments on the-debate-adjacent content.
- All numbers must be re-verified against the live page at write
  time. Do NOT author from memory of the page.

## Image spec

- Output: PNG, 1200x630 px, device-scale-factor 1 (Facebook serves at
  this resolution; 2x is wasted bytes).
- Typography: Libre Franklin (same as the site).
- Palette: site CSS variables in light theme.
- Common shell on every card:
  - "marbleheaddata.org" wordmark, small, top-left or bottom-left.
  - Bespoke visual fills the middle two-thirds.
  - Headline echoes or sharpens the page's og_title.
- Cards look like a family at a glance (same shell, same fonts, same
  palette) even though the middle visual is bespoke per page.

## Per-page brief

Exact phrasing finalized during implementation by reading each live
page first. These are the *angles*:

| Page | Title angle | Description loads | Image concept |
|---|---|---|---|
| `checkbook.html` | "Every check the town wrote" | Vendor-check total YTD; adopted total across all funds | Receipt-style ledger with sample lines and a total stamp |
| `town-budget.html` | "$122.76M, line by line" | FY27 No-Override total; school + town split | Stacked horizontal bar of top departments, schools highlighted |
| `town-debt.html` | "$116M of debt. Voters approved every dollar." | 51 ballot questions since 1988, 50 yes, 1 no | Tally mark with 50 yes / 1 no plus the $116M big number |
| `where-has-the-money-gone.html` | "Marblehead's GF grew $35.7M in a decade" | $70.5M to $106.2M FY15-FY26, six categories explain it | Ascending area or bar chart with the six callouts |
| `senior-tax-relief.html` | "Two senior tax breaks worth claiming" | Circuit Breaker up to $2,820/yr; Article 28 pending | Calculator UI mockup: home value + income to credit |
| `inside-school-staffing.html` | "What 430 school positions actually do" | 5.6 students per staff member vs Melrose's 7.8 | Pictograph: 430 figures clustered by role category |
| `school-building-maintenance.html` | "5 schools, by condition" | Glover roof + HVAC contract size and timeline | 5 school cards (HS, Veterans, Village, Glover, Brown) with year built |
| `org-chart.html` | "Two parallel governments run Marblehead" | Town side clusters + school side clusters | Simplified org tree: voters to elected boards to admins |
| `branches.html` | "How Marblehead residents verify each other" | Verification network with Revolutionary War branch names | Small network graph with branch name labels |
| `meetings.html` | "Every public meeting, transcribed" | AI summaries from MHTV video | Stack of meeting cards with one expanded |

## Production mechanism

- New top-level directory `og-cards/` at the repo root.
- One standalone HTML file per page: `og-cards/checkbook.html`,
  `og-cards/town-budget.html`, etc. Each is dimensioned exactly
  1200x630 with inline CSS, pulling site palette variables and Libre
  Franklin.
- Add `og-cards/` to `_config.yml` `exclude:` so Jekyll never
  publishes the source HTML.
- New npm script `og:build` in `package.json`. It:
  1. Starts a static file server over `og-cards/` on a local port.
  2. For each card, uses Playwright (already on the box) to navigate
     to the served HTML and screenshot at viewport 1200x630,
     device-scale-factor 1.
  3. Writes PNGs to `assets/og/<page>.png`.
- Both the source HTML cards and the generated PNGs are committed.
  Regenerating later is a one-command operation, but day-to-day
  changes to a single card mean editing one HTML and re-capturing
  just that one. Per-card npm script variant is optional.

## Wiring on each page

For each of the 10 pages, three frontmatter additions or edits:

```yaml
og_title: "<punchier rewrite>"
og_description: "<loads the killer number>"
og_image: /assets/og/<page>.png
```

The existing `head.html` already consumes these. No layout/template
changes needed.

## Verification

Per box-wide CLAUDE.md "Definition of Done":

- New PNG cards committed to `assets/og/` on the branch.
- The PR (or PRs) body shows the new cards inline so reviewers can
  eyeball them in one scroll.
- For at least one card, the PR includes a screenshot of how that
  card actually previews via the Facebook Sharing Debugger (or
  opengraph.xyz) hitting the Cloudflare PR preview URL. We need
  evidence FB picks up the image, not just that the PNG exists.

## Risks and mitigations

- **Image drift over time.** If a page's headline number changes
  (e.g. checkbook YTD total advances), the card goes stale. Mitigation:
  cards lean on durable framings ("Every check the town wrote") rather
  than dated numbers in the image itself; dated numbers go in the
  description, which is easy to edit.
- **Cards drift from each other visually if 10 are designed
  separately.** Mitigation: shared shell (wordmark, fonts, palette,
  footer) is mandatory; the middle visual is the only varying
  element.
- **Hand-designed means slow.** Mitigation: scope is locked at 10. No
  scope creep to long-form pages or the homepage in this pass.

## Out of scope

- A reusable card template for non-tool pages.
- An npm script to verify FB picked up the images.
- Dark-mode card variants.
- Animation or video OG variants.

## What "done" looks like

- 10 source HTML cards committed under `og-cards/`.
- 10 PNGs committed under `assets/og/`.
- 10 pages' frontmatter wired to og_title + og_description + og_image.
- `npm run og:build` regenerates all 10 PNGs from source.
- `_config.yml` excludes `og-cards/`.
- One PR per tool, or one PR for all 10. Decision deferred to the
  implementation plan.
