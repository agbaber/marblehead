# Override primer page (Morpho-style narrative)

**Status:** approved 2026-05-01
**Owner:** Andrew Baber
**Implements:** new shareable 5-minute entry point for override-curious readers

## Goal

Create a single new page, `/override-primer.html`, that is a short, narrative-driven introduction to the FY27 override and a tightly distilled both-sides recap. It is a third entry point that sits *alongside* the existing `what-is-the-override.html` (deep reference) and `the-debate.html` (full six-dividing-line steelmanned debate), not a replacement for either.

The visual / structural inspiration is the "Morpho, From Scratch" narrative guide (`~/Downloads/Morpho Guide.html`): a chapter-by-chapter format where each chapter answers a question the previous chapter raised, with a numbered TOC, sticky chapter markers, and small typographic flourishes (mono labels, accent left-borders on callouts).

The site palette stays: no dark teal-and-orange Morpho colors, all `var(--c-*)` tokens from `assets/site.css`. Dark mode must work without modification.

## Non-goals

- Not a replacement for `what-is-the-override.html` or `the-debate.html`. Both remain.
- Not a homepage redesign. Retargeting the homepage hero / "start here" CTA at the new page is a possible follow-up, not part of this PR.
- Not a deep-dive on healthcare, pensions, or the CPI squeeze (covered by `where-has-the-money-gone.html` and the squeeze-mechanism pages).
- No reductions-already-made history (covered by `what-has-the-town-done.html`).
- No senior tax relief, Question 2 trash, or bias audit content.
- No new sources. Every fact reuses an existing citation from the four pages this primer compresses.
- No new images, no new JS, no new data files.
- No edits to `assets/site.css` — all CSS is page-scoped.

## Page identity

- **Slug / URL:** `/override-primer.html`
- **Layout:** standard `layout: page` (Jekyll default for the site). Site header, nav, and footer wrap the primer normally.
- **Frontmatter:**
  - `title: "The override, in 5 minutes"`
  - `scripts: [citations]` so source markers render and the auto-injected `<h2>Sources</h2>` appears at the bottom
  - `og_title`, `og_description`, `og_url` matching the same pattern as the other override pages
- **Page-scoped CSS:** single `<style>` block at the top of the file, every selector scoped under a top-level wrapper class (e.g., `.primer ...`). Same pattern as `the-debate.html`. No leakage to other pages.

## Page structure

Reading order, top to bottom:

1. **Hero** — eyebrow, large title, single-paragraph lead, meta row (Reading time / Vote date / Last updated)
2. **TOC** — numbered list of the six chapters
3. **Chapter 01 — The vote**
4. **Chapter 02 — The gap**
5. **Chapter 03 — The cap**
6. **Chapter 04 — The three tiers**
7. **Chapter 05 — What it costs**
8. **Chapter 06 — Either way**
9. **Both sides distillation block** (two-column for/against card)
10. **TL;DR card** (5-line definition list, screenshot-shareable)
11. **Go deeper footer** (5-card link grid)
12. **Sources** (auto-injected by `assets/citations.js`)
13. **Site footer** (from layout)

## Chapter outline

Each chapter ends in the question that the next chapter answers — this question-chain is the defining structural move borrowed from Morpho.

| # | Title | Question raised | Body content (~80-150 words) |
|---|---|---|---|
| 01 | The vote | *Why is this on the ballot?* | June 9, 2026 Annual Town Election. The question is whether to permanently raise property taxes via a Prop 2.5 operating override. First override attempt since 2005. |
| 02 | The gap | *If the town can't cover its costs, can't it just spend more?* | $8.47M projected FY27 deficit. Forecast a year in advance by FinCom. One short blockquote from the FinCom transmittal letter (already cited on `what-is-the-override.html`). |
| 03 | The cap | *How much over the cap is being asked?* | Prop 2.5 caps property tax growth at 2.5%/year (plus new growth). An override is the only permanent way past it. Two-line plain-language gloss on M.G.L. c. 59 § 21C. |
| 04 | The three tiers | *And what does that mean for my tax bill?* | $9M / $12M / $15M, nested. Highest tier with a majority sets the override amount. One sentence per tier (Restore / Build / Invest). |
| 05 | What it costs | *And if it fails?* | Per-household dollar impact at median home value, for each tier. Numbers reused from `super-summary.html`. |
| 06 | Either way | *So what's the actual disagreement?* | If it passes: when bills change, what gets funded. If it fails: no-override budget contents in two sentences. Frames both outcomes as real, setting up the both-sides block. |

## Both-sides distillation block

Sits as the final substantive content section, after Chapter 06.

**Three parts:**

1. **Heading + framing line** — `<h2>` like *"Where the disagreement is"*. One italic muted-text line gestures at the deeper page: *"Each side's strongest version, distilled. The full debate, with the six dividing lines residents argue over, is on the debate page."* (No em-dashes; comma-set per the `feedback_no_emdash_in_edits.md` memory.)
2. **Two-column card** —
   - Left card: `.perspective--for` (teal accent), label "Strongest case for the override". One paragraph, ~90-120 words, distilled from the strongest "for" arguments across the six dividing lines on `the-debate.html`.
   - Right card: `.perspective--against` (brass accent), label "Strongest case against the override". Same length, structure, and tone.
   - Class names mirror `the-debate.html` exactly so visual language stays consistent across the two pages.
   - `.perspective` styles are replicated locally in the primer's `<style>` block. No edits to `assets/site.css`.
   - Cards stack on mobile (single column under ~720px).
3. **Link-out CTA** — single line below the cards, mono-style label: `→ See all six dividing lines on the debate page`. Direct link to `the-debate.html`.

**Content rules:**
- Equal length, equal tone. Per CLAUDE.md editorial stance ("not an advocacy project").
- Every claim in either paragraph must already be backed by a citation on `the-debate.html` or `what-is-the-override.html`. Distillation, not extension.
- No third "neutral" card. No synthesis paragraph below.
- No reactions / no upvote-downvote (per `feedback_no_reactions_on_contested.md`).

## TL;DR card

Sits below the both-sides block, above the Go-deeper footer. Bottom placement is deliberate: the question-chain narrative depends on each chapter earning the next; a top-of-page TL;DR would spoil every reveal. At the bottom it works as a recap that can be screenshotted or shared.

**Visual:** single bordered card. Eyebrow `TL;DR · screenshot this`. Heading `The override, in five lines`. Body is a `<dl>`.

**The five lines (initial draft, refine during implementation):**

| Term | Definition |
|---|---|
| The vote | June 9, 2026. Annual Town Election. Yes/no on a Prop 2.5 operating override. |
| The gap | $8.47M projected deficit for FY27. Forecast a year in advance. |
| The ask | Three nested tiers: $9M / $12M / $15M. Highest tier with a majority sets the amount. |
| The cost | At a $1M home, roughly $XXX-$XXX per year depending on tier. *(actual range pulled from `super-summary.html`'s source table)* |
| The disagreement | Both sides agree costs outpace revenue. They disagree on whether the answer is more revenue or fewer expenses. |

The "disagreement" line is the single most editorially loaded sentence on the page; review it carefully before merge. It must summarize the both-sides block in one neutral sentence without favoring either reading.

## Go-deeper footer

A small grid of 5 link cards, one per existing site page that this primer compresses. Order matches the chapter sequence so readers can dive in at the point they want more.

| Linked page | One-line label |
|---|---|
| `what-is-the-override.html` | The full override reference: tier mechanics, history back to 2005, key terms |
| `where-has-the-money-gone.html` | Where the deficit came from: healthcare, pensions, the CPI squeeze |
| `no-override-budget.html` | What the FY27 budget looks like if the override fails |
| `the-debate.html` | The full debate: all six dividing lines residents argue over |
| `super-summary.html` | Per-household tax impact at every home value |

Mirrors Morpho's "we've built up the whole picture, here's where you go from here" closer, but as a reading-list rather than a narrative wrap-up paragraph (avoids meta-narration per CLAUDE.md).

## Visual treatment

Translate Morpho's structural moves into the existing site palette and typography. Every color is a `var(--c-*)` token; no hardcoded hex anywhere in the new `<style>` block.

**Layout patterns kept from Morpho:**

- Hero with eyebrow + large title + single-paragraph lead + meta row
- Numbered TOC, single column, hover-lift on rows
- Sticky chapter-marker gutter on left (≥880px screens) — big chapter number + tag, sticky inside its chapter. Inlines above the chapter title on mobile.
- Alternating chapter backgrounds — odd chapters `var(--surface)` (white), even chapters `var(--bg)` (fog). Hairline `var(--divider)` rules between chapters.
- `.question` callout — small left-border box, italicized question that the chapter is about to answer. Uses `var(--c-buoy)` for the border accent.
- `.key` callout — accent left-border panel for the chapter's takeaway sentence. Uses `var(--c-navy)`.
- `.big-stat` — for $8.47M, $9M / $12M / $15M tier totals, median-home cost.
- `.define` — for the Prop 2.5 / Override / Tier definitions.

**Typography:**

- Body: site's existing font stack. No DM Mono, no Sohne, no Google Fonts loaded.
- Chapter numbers, eyebrows, tags, labels: `ui-monospace, SFMono-Regular, Menlo, monospace`. Gives the small-data-label feel without a webfont fetch.
- Chapter titles: site heading style, slightly larger, `clamp(28px, 4vw, 40px)`. Allow `<br>` for line-break composition.

**Color mapping (Morpho → site):**

| Morpho role | Morpho color | Site variable |
|---|---|---|
| Primary background | `#0d1f1a` | `var(--bg)` |
| Soft alternating bg | `#0f2520` | `var(--surface)` |
| Body ink | `#e8e4d8` | `var(--text)` |
| Soft ink | `#b8b4a8` | `var(--text-muted)` |
| Accent (orange) | `#ff5938` | `var(--c-navy)` for chapter numbers; `var(--c-buoy)` sparingly for emphasis |
| Rule line | `#1f3a33` | `var(--border)` / `var(--divider)` |

**Deliberately not kept from Morpho:**
- Grid-paper background overlay
- Radial gradient body bleed
- Fixed back-to-top button (site has its own scroll behavior)
- Side-nav / next-prev chapter buttons on the right edge
- All-caps + large letter-spacing on every label (used sparingly for eyebrows only)

## Site nav placement

Add a single new entry to the existing override-related nav block. The new page goes *first* in the override cluster, labeled **"5-minute primer"** (final label TBD on inspection of the actual nav structure during implementation).

The exact file to edit (likely `_data/navigation.yml` or `_includes/header.html`) gets identified during plan-writing, not asserted here, since the nav structure can shift between sessions and the spec should not pin a stale path.

## Sources / citations

- Frontmatter: `scripts: [citations]`. Sources `<h2>` is auto-injected by `assets/citations.js` (per the `project_citations_h2_injection.md` memory) at the bottom of the page.
- The Sources block lives *after* the Go-deeper footer.
- Every `<sup class="cite">` marker in the chapters reuses the existing source IDs from `what-is-the-override.html`, `the-debate.html`, `where-has-the-money-gone.html`, or `super-summary.html`. No new sources defined.

## Editorial rules (enforced during implementation and review)

- **No em-dashes** (`--` or `&mdash;`) in any prose. Per `feedback_no_emdash_in_edits.md`. Self-check the diff before each commit.
- **No editorial language** (crisis, skyrocketing, shocking, outrageous) in chapter copy or labels. Per CLAUDE.md.
- **No green-good / red-bad** framing on the both-sides cards. Use existing teal/brass.
- **No reactions widget** (page is contested-question-adjacent).
- **No meta-narration** ("This page shows...", "In this section..."). Per CLAUDE.md.
- **For/Against blocks must be equal length and equal tone.**
- **All numbers traceable** to a primary source already cited on the four source pages.

## Verification before merge

- Cloudflare Pages preview URL posted in PR description (per CLAUDE.md).
- `npm run test:local` passes with the new page included.
- Manual phone-screen check: hero readability, sticky chapter-marker collapsing properly under 880px, two-column both-sides cards stacking under ~720px.
- Dark-mode check on every section: every `var()` resolves to a sensible dark-mode value.
- Specific screenshot to take and review: the TL;DR card on a phone, to confirm it's actually screenshot-shareable as intended.
- Diff scan for `--` and `&mdash;` before commit.

## Out of scope (follow-ups, not this PR)

- Retargeting the homepage hero / "start here" CTA at the new primer page.
- Adding the new page to `data/DATA_CATALOG.md` (this is a content page, not a data page).
- Reorganizing the existing override nav cluster beyond inserting one new entry.
- Any changes to `the-debate.html`, `what-is-the-override.html`, or other source pages.
