# FY27 gap waterfall — design

**Date:** 2026-04-11
**Owner:** Andrew Baber
**Status:** Approved, ready for implementation plan

## Purpose

Add a visual reconciliation of Marblehead's FY27 operating budget gap to the marbleheaddata.org site. The $8.47M FY27 deficit figure is already referenced on several existing pages, but no page shows how the gap is composed or derived, and the revenue side of the cliff (one-time reserves running out) is absent from the site entirely.

The goal is to answer one question clearly and verifiably: *where does $8.47M come from?* A reader should be able to see the components, audit each against a primary source, and understand both halves of the problem — recurring cost growth and one-time reserves no longer available — in a single image.

## Editorial framing

Non-advocacy. Per CLAUDE.md and STYLE_GUIDE.md:
- State facts, not conclusions. No "shocking", "crisis", "skyrocketing".
- The chart is a calculation, not a rebuttal of anyone's argument.
- Every value traces to a primary source cited on the page.
- Multiple denominators / both halves of the math shown honestly, not framed to push readers toward a vote.
- Neutral tone throughout. Plain language in the takeaway.

This spec was written after a scope reassessment in which an earlier framing ("rebut the Prop 2.5 vs CPI chart circulating on Facebook") was abandoned because the chart in question is arithmetically correct. What the site actually needs is a clear reconciliation of the FY27 operating gap, which is a more honest and more useful addition.

## Scope

Three surgical changes to existing files. No new pages. No new data files.

### Change 1 — `no-override-budget.html` (new section)

Insert a new section directly **above** the existing `<h2 data-stance-section="what-stays-or-grows">What stays the same or goes up</h2>` heading (currently at `no-override-budget.html:91`). The new section contains:

- A new `<h2>` heading with id `fy27-gap-calculated`, text "How the $8.47M FY27 gap is calculated"
- One intro paragraph (plain language, 3 sentences)
- One horizontal waterfall SVG chart showing 10 component bars + FY26 baseline + FY27 gap total
- One primary caption sentence directly under the chart
- One source line
- One footnote explaining excluded debt service

The existing "What stays the same or goes up" card is **not modified**. It now reads as a natural follow-on providing the line-item detail behind the expense bars on the new waterfall.

### Change 2 — `how-we-got-here.html` (closing takeaway)

At the end of the `<h2 data-stance-section="vote-2026">2026: The vote before us</h2>` section — specifically, between the existing "Here we are..." paragraph (currently `how-we-got-here.html:75`) and the existing "This page is FinCom's own warning arc..." closing paragraph (currently `how-we-got-here.html:77`) — insert:

- A new `<div class="takeaway">` block (neutral variant, **not** `takeaway--pos`) containing the 3-sentence plain-language summary of the FY27 gap
- A single `<p>` immediately after the takeaway with an inline link to the new waterfall section

No structural change to the page. No modification to existing copy.

### Change 3 — `assets/site.css` (new component styles)

Add a new section to `assets/site.css` with all the waterfall-related styles (`.waterfall`, `.waterfall-row`, `.waterfall-bar--positive`, etc.) plus a mobile media query. This follows the existing pattern on `no-override-budget.html`: all component styles for that page's custom elements (`.cut-row-bar`, `.cut-list`, `.headcount-bar-track`, etc.) live in `assets/site.css` at lines 296-386, not inline on the page. `no-override-budget.html` has no page-level `<style>` block.

### Change 4 — no changes

Explicitly out of scope for this PR:
- `the-debate.html` — already cites the relevant numbers in Tension 1 prose; adding a chart would break the mirrored `.perspective--for` / `.perspective--against` symmetry
- `what-is-the-override.html` — Prop 2.5 mechanics page, already long
- `where-has-the-money-gone.html` — retrospective spending, wrong frame for a prospective one-year reconciliation

## Data

Every value below is derived from a calculation on numbers read directly out of one of two primary source documents:

- **SotT:** `data/2026_State_of_the_Town.pdf` (Town Administrator Thatcher Kezer and CFO Aleesha Benjamin, presented January 28, 2026)
- **FY27 Budget:** `data/budgets/FY27_Proposed_Budget_No_Override.pdf` (April 2026)

### Waterfall component list

| # | Bar label | Value | Direction | Source | Derivation |
|---|---|---:|---|---|---|
| 0 | FY26 balanced | $0 | baseline | SotT, "Net Budget Variance FY26" row | literal: shown as 0 |
| 1 | Levy growth | +$2.18M | positive | SotT, Projected Revenues table, Levy row | 77,543,708 − 75,365,013 = +2,178,695 |
| 2 | Other revenue growth (Cherry Sheets + enterprise indirect) | +$0.54M | positive | SotT, Projected Revenues, Cherry Sheets + Enterprise Funds Indirect Costs rows | (1,666,021 + 7,658,254 + 609,050) − (1,642,836 + 7,316,696 + 437,686) = +536,107 |
| 3 | Free Cash — operating | −$2.00M | negative | SotT, Projected Revenues, Free Cash - Levy row | 5,000,000 − 7,000,000 = −2,000,000 |
| 4 | Free Cash — capital/stabilization | −$2.00M | negative | SotT, Projected Revenues, Free Cash - Capital/Stabilization row | 0 − 2,000,000 = −2,000,000 |
| 5 | Local Receipts (interest, excise, permits) | −$0.96M | negative | SotT, Projected Revenues, Local Receipts row | 7,917,995 − 8,881,283 = −963,288 |
| 6 | Group Insurance (health) +11% | −$1.65M | negative | FY27 Budget line 221 Group Insurance | 15,100,893 → 16,754,748 = +1,653,855 (expense growth reads as negative on the balance) |
| 7 | Contributory Retirement (pension) +9% | −$0.46M | negative | FY27 Budget line 217 Contributory Retirement Fund | 5,380,625 → 5,843,360 = +462,735 |
| 8 | New curbside trash contract (net of old model removal) | −$0.84M | negative | SotT, Major Cost Drivers slide, "New Trash Contract" row | 844,575 (SotT's own net figure — see "Reconciliation notes" below) |
| 9 | All other expense growth (salaries, fire, police, town counsel, schools, contracted increases; net of BAN Interest removed) | −$3.23M | negative | SotT, Projected Expenses total (Total Projected Expenses Less Excluded Debt Service) minus itemized drivers | 6,195,953 − (1,653,855 + 462,735 + 844,575) = −3,234,788 |
| ⊦ | **FY27 operating gap** | **−$8.47M** | accumulated total | SotT, "Net Budget Variance FY27" row | (8,471,823) |

### Math check

Sum of components: 2,178,695 + 536,107 − 2,000,000 − 2,000,000 − 963,288 − 1,653,855 − 462,735 − 844,575 − 3,234,788 = **−8,444,439**

This differs from the official SotT figure of −8,471,823 by $27,384. The residual comes from small revenue items on the SotT table not broken out in this chart (small stabilization/overlay changes, a few $9,000-level rows, rounding between the cost-drivers slide and the full expense table). The source line below the chart discloses this: *"Components rounded to the nearest $10K; approximately $30K of small revenue items are grouped into 'other revenue growth.'"*

### Reconciliation notes

**On Group Insurance (Health) — the SotT vs FY27 Proposed Budget discrepancy.** SotT's "Major Cost Drivers" slide lists Health Insurance as *"est. 15%, $1,951,708"*. The FY27 Proposed Budget, published subsequently, shows Group Insurance at $15,100,893 → $16,754,748 = +$1,653,855 / +10.95%. The waterfall uses the **FY27 Proposed Budget figure** ($1,653,855 / +11%) because it is the later and more authoritative source. The $1.95M in the SotT was a January estimate that came in below projection. Noting this in the source line ensures a reader comparing the chart to the SotT presentation can reconcile the difference.

**On the New Trash Contract — why SotT's $844,575 and not the line-item arithmetic.** FY27 Proposed Budget line-item detail shows Waste Collection dropping from $2,943,402 (FY26) to $1,790,344 (FY27) = −$1,153,058, and a new Curbside Collection line adding $2,186,516, for a gross +$1,033,458 in trash-related operating spending. The SotT's Major Cost Drivers slide nets this differently and arrives at $844,575, likely by accounting for some overhead reallocations not visible at the line-item level. Because the SotT is the document that presents the $8.47M gap math, and because its cost-drivers slide is the authoritative "major drivers" framing, the waterfall uses SotT's $844,575 and attributes it to that presentation. The ~$189K residual from the difference falls into bar #9 ("All other expense growth").

**On Debt Service — why it is NOT a bar on this waterfall.** The SotT table makes this structurally unambiguous: the $8.47M deficit is computed from `Total Revenue/Available Funds` minus `Total Projected Expenses Less Excluded Debt Service`, and the parallel calculation from `Total Revenue Including Debt Exclusion` minus `Total Expenditures` produces the identical number. Both calculations yield −8,471,823, which proves that Excluded Debt Service is a wash: it appears as both revenue (+$1,981,257) and expense (+$1,981,257) and nets to zero impact on the operating gap.

The FY27 Proposed Budget line 214 + 215 (Maturing Debt + Interest) shows total debt service growing from $9,314,141 (FY26) to $11,098,398 (FY27) = +$1,784,257. The $9.31M FY26 figure includes $197,000 of BAN (Bond Anticipation Note) Interest that sat inside the operating budget; the $11.10M FY27 figure does not (BAN Interest drops to $0). The net impact on the operating budget is therefore **−$197K** (BAN Interest removed, a small savings), not +$1.78M. The +$1.78M figure that currently appears on `the-debate.html:286` and `no-override-budget.html:100-101` conflates operating and excluded debt service and is inaccurate as a cost driver of the $8.47M gap.

For this waterfall: debt service does not appear as a bar. The −$197K BAN Interest removal is absorbed into bar #9. A footnote below the chart explains excluded debt service as a pass-through. The cleanup of the existing incorrect claims on `the-debate.html` and the existing `no-override-budget.html` card is **out of scope for this PR** and should be handled in a separate follow-up PR.

## Visual design

### Chart type and orientation

**Horizontal waterfall.** Rows stacked vertically, bars extending from a central zero axis left (negative) or right (positive). Horizontal chosen over vertical because:
- 10 bars is too many for a readable vertical column chart, especially on mobile
- Horizontal bar charts are more mobile-friendly for long labels
- Reading order matches natural top-to-bottom scanning

### Layout per row

Each row is an SVG group containing:
- A left-aligned text label (short description, max ~40 chars)
- A proportional rectangle extending from the zero axis in the direction of the value
- A right-aligned text label at the end of the bar showing the dollar amount

On screens ≥720px: labels are fixed-width on the left, bars occupy a central columns, dollar amounts sit immediately after each bar.
On screens <720px: labels wrap under the bar, dollar amounts move to the right-of-bar position, bar column narrows to preserve readability. Minimum supported width: ~320px (iPhone SE).

### Grouping

The 10 bars are visually clustered into three groups by vertical spacing:
1. **FY26 baseline** (bar 0) — a short grey reference bar at the top, labeled "FY26 balanced budget"
2. **Revenue changes** (bars 1–5) — +$2.18M, +$0.54M, −$2.00M, −$2.00M, −$0.96M
3. **Expense changes** (bars 6–9) — −$1.65M, −$0.46M, −$0.84M, −$3.23M
4. **FY27 gap total** (bar ⊦) — a wider grey bar at the bottom showing the accumulated −$8.47M

A subtle horizontal divider (`<line>` with `stroke="var(--divider)"`) separates each group. No group headings — the grouping is visual, not textual.

### Color palette

Uses existing CSS custom properties from `assets/site.css`. No new color variables.

- **Positive bars** (bars 1, 2): `var(--c-sage)` (#5B7553, "salt marsh green"). STYLE_GUIDE.md:84 already designates this as "Revenue, positive."
- **Negative bars** (bars 3–9): `var(--c-buoy)` (#C8553D, "buoy red"). Existing color from `assets/site.css:22`.
- **Baseline and total bars** (bars 0, ⊦): `var(--text-subtle)` — muted grey, same treatment used for non-interactive reference elements elsewhere on the site.
- **Text labels**: `var(--text)` for primary labels, `var(--text-muted)` for dollar amounts.
- **Dark mode**: all variables have dark-mode counterparts already defined in `assets/site.css:89-103`, so the chart works automatically in both themes.

**On the STYLE_GUIDE.md:123 rule against green/red:** that rule specifically prohibits green/red *value judgments on comparisons* — e.g., coloring "Marblehead spends more than Swampscott" in red because residents disagree on whether spending more is bad. In this chart, green and red are being used to convey *literal sign* (positive contributions to balance vs negative contributions), which is arithmetic, not judgment. The user has confirmed this interpretation matches the editorial stance.

### Numeric formatting

- All component bar values: `$X.XXM` with two decimal places (e.g., `+$2.18M`, `−$1.65M`, `−$0.46M`). Two decimals is used uniformly across component bars for visual consistency and precision. Even for sub-million values, two-decimal millions (e.g., `−$0.96M`) avoid the rounding dishonesty of `−$1.0M` (which would round $963K up by $37K).
- Total label: `−$8.47M` — also two decimals, visually matching the components.
- Sign always explicit (`+` for positive, `−` for negative with U+2212 minus, not U+002D hyphen, for typographic consistency)

### Styling approach

- **No inline `style=""` attributes** on any SVG element, per STYLE_GUIDE.md:132
- **No inline `font-family`, `fill`, `stroke`** on SVG text/lines, per STYLE_GUIDE.md:133
- All visual properties driven by CSS classes defined in a new section at the end of `assets/site.css`. This is the convention used by the existing component styles on `no-override-budget.html` — `.cut-row-bar`, `.cut-list`, `.headcount-bar-track` all live in `site.css` at lines 296-386. There is no page-level `<style>` block on `no-override-budget.html`.
- **Bar widths** are set via SVG `<rect>` `width` and `x` attributes computed at authoring time from the known values. Because all 10 bars have known constant values (this chart is not data-driven at runtime — it's a static illustration of one specific year's budget math), widths can be hard-coded as SVG attributes rather than driven by inline CSS or JavaScript. This sidesteps the "no inline `style=""`" rule entirely. If values later need to update (e.g., after the town publishes FY28 numbers), the fix is to edit the SVG attributes in the HTML, which is the same workflow as updating any other content on the site.

### New CSS classes

All scoped to the new `.waterfall` container. Added to a new section at the end of `assets/site.css`:

```css
.waterfall { /* container */ }
.waterfall-svg { /* the <svg> element sizing and responsive rules */ }
.waterfall-row { /* each component row, for vertical spacing */ }
.waterfall-row--spacer { /* divider rows between groups */ }
.waterfall-label { /* left-side text label */ }
.waterfall-bar { /* base bar rect */ }
.waterfall-bar--positive { fill: var(--c-sage); }
.waterfall-bar--negative { fill: var(--c-buoy); }
.waterfall-bar--baseline { fill: var(--text-subtle); }
.waterfall-bar--total { fill: var(--text-subtle); }
.waterfall-value { /* right-side dollar amount */ }
.waterfall-zero-axis { /* the central vertical reference line */ }
.waterfall-divider { /* horizontal group divider */ }
```

Media query at `@media (max-width: 720px)` handles the mobile rearrangement.

### Accessibility

- `<svg>` element receives `role="img"` and a descriptive `aria-label` stating the FY27 gap total and the three largest components in prose
- First child of the `<svg>` is a `<title>` element with a short title
- Second child is a `<desc>` element with a longer narrative description stating all 10 components and the total
- Color is not the only signal: the `+` and `−` signs on dollar amounts, and the bar positions (left vs right of zero axis), together convey direction for readers who cannot distinguish the green/red bar colors
- The intro paragraph above the chart states the $8.47M total and both halves of the calculation in prose, so non-visual readers get the content even without reading the chart's description

### Performance

Static SVG, no JavaScript. Inline in the HTML. No external assets. Negligible page weight added (~3-5KB for the SVG markup + CSS).

## Copy (final, locked)

All text below is the approved copy from brainstorming, to be used verbatim. Implementation may polish punctuation and entity encoding (em-dashes converted to `&ndash;` or `&mdash;` per STYLE_GUIDE, etc.) but wording is final.

### Section heading

```
How the $8.47M FY27 gap is calculated
```

Id: `fy27-gap-calculated`

### Intro paragraph (above chart)

> Marblehead's FY26 budget is balanced: revenue equals expenses. Looking one year ahead, the Town Administrator projects FY27 expenses will grow by roughly $6.2M while revenue drops by roughly $2.3M, leaving an $8.47M gap. The chart below shows the components of that gap, starting from a balanced FY26 baseline: revenue changes first (both positive and negative), then expense changes, ending at the FY27 gap.

### Primary caption (below chart)

> The four expense increases total roughly $6.2M and the revenue changes net to roughly −$2.3M, together reconciling to the $8.47M FY27 operating gap the Town Administrator and CFO presented at State of the Town on January 28, 2026.

### Source line (smaller, below caption)

> Sources: [2026 State of the Town presentation](data/2026_State_of_the_Town.pdf) (January 28, 2026); [FY27 Proposed Balanced Budget With No Override](data/budgets/FY27_Proposed_Budget_No_Override.pdf) (April 2026). Components rounded to the nearest $10K; approximately $30K of small revenue items are grouped into "other revenue growth." The Group Insurance figure reflects the FY27 Proposed Budget's +10.95% / +$1.65M (April 2026), which came in below the SotT's January estimate of +15% / +$1.95M.

### Footnote on excluded debt service (smaller, below source line)

> **On debt service.** Voter-approved debt exclusions for projects such as the Abbot Library renovation and the Mary Alley Building HVAC grow $1.98M for FY27, but they are paid from a separate debt exclusion levy surcharge that sits outside the operating budget. They do not contribute to the $8.47M operating gap. Residents pay the debt service either way via the debt exclusion, and will pay the operating gap either way — through spending cuts (if no override passes) or through the operating override (if one does).

### Takeaway block on `how-we-got-here.html`

Placed at the end of the "2026: The vote before us" section, between the existing "Here we are..." paragraph and the existing "This page is FinCom's own warning arc..." closing paragraph.

```html
<div class="takeaway">
  The $8.47M FY27 gap breaks into two pieces. Roughly three-quarters is specific costs going up &ndash; health insurance, pension contributions, the new curbside trash contract, and regular salary and contract increases. The remaining quarter is one-time reserves &ndash; Free Cash, interest income, motor vehicle excise &ndash; that balanced the FY26 budget but aren't available at the same level again in FY27.
</div>

<p>For the full calculation, see <a href="no-override-budget.html#fy27-gap-calculated">how the $8.47M FY27 gap is calculated</a>.</p>
```

Uses the base `.takeaway` class **without** the `--pos` modifier. The existing CSS at `assets/site.css:732-743` defines only two variants: base `.takeaway` (subtle `--c-buoy` tint at 8% mix, the default) and `.takeaway.takeaway--pos` (`--c-sage` tint, the reassuring variant used by the existing opening takeaway at `how-we-got-here.html:7`). Base is the closest thing to neutral available — a very muted warm cast, not an alarm color. The `--pos` variant would be wrong here because the takeaway is describing a gap calculation, not reassurance. No third "neutral" variant needs to be added for this work.

## Primary sources cited

Each of these is already in the `data/` directory in the repo:

1. `data/2026_State_of_the_Town.pdf` — Town of Marblehead State of the Town presentation, presented by Town Administrator Thatcher Kezer and CFO Aleesha Benjamin, January 28, 2026. Contains the authoritative $8.47M FY27 deficit calculation, the revenue and expense tables, and the "Major Cost Drivers" slide with the $844,575 trash figure.
2. `data/budgets/FY27_Proposed_Budget_No_Override.pdf` — FY27 Proposed Balanced Budget With No Override, April 2026. Contains line-item detail for lines 126-130 (Waste Collection / new Curbside Collection), line 217 (Contributory Retirement Fund), line 221 (Group Insurance), lines 214-215 (Maturing Debt + Interest).

Both source links in the source line point to the local PDFs, not to `marbleheadma.gov`, because the local copies are permanent and the town site sometimes moves documents.

## Verification plan

Before marking the PR ready:

1. **Visual check on desktop and mobile.** Load `no-override-budget.html` on a desktop browser at ≥1024px and on a mobile device or browser dev tools at 375px. Confirm the waterfall is legible at both widths, bars are proportional, dollar amounts are not clipped, and the chart does not cause horizontal scroll on mobile.
2. **Dark mode check.** Toggle to dark mode via `data-theme="dark"` on `<html>` or via system preference. Confirm all colors render correctly (sage, buoy, subtle grey all have dark-mode counterparts in `assets/site.css:89-103`).
3. **Accessibility check.** Run the page through a screen reader (VoiceOver on macOS or similar). Confirm the `<title>` and `<desc>` read the chart's content intelligibly. Confirm the intro paragraph above the chart also conveys the key numbers so readers who skip SVG content still get the content.
4. **Math verification.** Hand-compute the math from primary sources: sum all component values, confirm the result equals $8,444,439 (the chart's stated sum) and that the difference from SotT's $8,471,823 is the ~$27K rounding residual. Confirm every individual bar value matches its source-line derivation.
5. **Links check.** Click every link in the new section (source PDFs, cross-page link from `how-we-got-here.html`) and confirm they resolve.
6. **Jekyll build check.** Run `bundle exec jekyll build` (or the project's equivalent) in the worktree. Confirm no build errors, no broken `{% link %}` tags, no validation warnings on the new HTML.
7. **Existing section comparison.** Scroll from the new section to the existing "What stays the same or goes up" card. Confirm the two sections read as a coherent sequence: gap calculation first, then the line-item detail behind the cost drivers.

## Out of scope (follow-up items)

These should be tracked as separate work after this PR merges:

1. **Correct the "+$1.78M (+19%) debt service" framing on `the-debate.html:286`.** Rewrite the Tension 1 "For the override" block's debt-service mention to either drop it entirely or clarify it's excluded debt service paid outside the operating budget.
2. **Correct the "Debt Service +$1.78M (+19%)" entry in the existing "What stays the same or goes up" card on `no-override-budget.html:100-101`.** Either remove it or annotate it as a pass-through.
3. **Consider pulling DESE per-pupil and DOR Schedule A per-capita data for peer towns** to complete the "honest denominators" section on `why-not-elsewhere.html` (the separate Section 2 that was brainstormed but deferred from this spec).
4. **Long-run levy vs cost drivers indexed comparison** — deferred from the original framing of this work because the long-run data shows group insurance growing at roughly the same rate as the levy (3.15% vs 3.36% over FY06–FY24), which is a less dramatic story than the FY26→FY27 cliff. If the indexed comparison is useful independently of the override question, it could be built later as a separate page or section.

## What this spec deliberately does not do

- Does not rebut the Prop 2.5 vs CPI chart circulating on Facebook. That chart is arithmetically correct; Marblehead's levy ceiling CAGR over FY00–FY24 is roughly 4.04% (including the three FY04–FY06 operating overrides) or 3.4% (excluding them), both above headline CPI of 2.53%. The honest response is not to "rebut" the chart but to show the more relevant comparison (levy growth vs specific cost drivers) — and that more relevant comparison turns out to be less dramatic than expected over the long run, which is why it was deferred.
- Does not add a chart to `the-debate.html`. That page is a mirrored both-sides layout; an asymmetric chart would break the structure.
- Does not introduce new styling patterns. New waterfall classes live in `assets/site.css` following the existing component-style convention used by `.cut-row-bar`, `.cut-list`, `.headcount-bar-track`, etc. (all in `site.css` at lines 296-386).
- Does not introduce new CSS color variables. Uses `--c-sage`, `--c-buoy`, and `--text-subtle`, all already defined.
- Does not include a text "by the numbers" table alongside the waterfall. A well-labeled waterfall with dollar amounts already serves the audit-the-math audience; the duplication was ruled out during brainstorming.
