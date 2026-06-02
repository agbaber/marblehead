# Your True Cost — design spec

**Status:** approved 2026-06-02 (pre-implementation)
**Implements:** the "Lovable-style" scrolly personal-cost calculator the user proposed in conversation
**Lives at:** `your-true-cost.html` (top-level)

## Goal

Help a Marblehead resident understand, for **their specific situation**, what the override actually costs after every state / federal benefit they qualify for — and where that money ends up. Pair Lovable.app's animated, satisfying, scroll-progressive UX with strict source-traceability for every number.

## Page shape

Single long-scroll page. Five story sections + a hero. A pinned answer card stays in view from the moment you scroll past the hero, with live tier / Q4 / year selectors.

### Hero / inputs (always visible at top)

| Input | Default |
|---|---|
| Home assessed value | $1,291,507 (town avg, single-family) |
| Household income | $182,132 (ACS median, Marblehead) |
| Filing status | Married joint |
| Age of oldest owner | 50 |
| "I itemize on federal" toggle | Off |
| "More exemptions" expander | Closed |
| └ Veteran, blind, surviving spouse | Off |

State persisted in `localStorage`. Reuses key `mh_override_calc_assessed_value` so users coming from the override calc don't re-enter.

### Pinned answer card

Sticky after hero scrolls past. Top-right on desktop, bottom bar on mobile.

```
[FY27 | FY28 | FY29*]  [Q1 | Q1+Q2 | Q1+Q2+Q3* | None]  [Q4 pass* | fail]   [⌕ Receipts]

Your total tax bill              The override's share
$11,847                          +$1,488/yr
↑$2,792 vs. today                after $3,420 benefits
```

Both numbers visible (per user). Both update live as user scrolls and as they toggle selectors. As user scrolls into each story section, the relevant number / sub-line gently pulses with a small connecting caption.

### Story sections (scrolled top-to-bottom)

1. **"This is already happening"** — Prop 2½ 2.5%/yr baseline growth, FY26→FY29. Frames the rest. *Source: MGL c.59 § 21C; FY26 ACFR.*
2. **Override tiers (Q1 / Q1+Q2 / Q1+Q2+Q3)** — stacked bars; the selected tier adds a layer to the baseline from §1. Tier toggle synced to pinned card. *Source: Town Administrator's Override Presentation, April 15 2026, slide 8.*
3. **Trash (Q4)** — side-by-side: Q4 passes (levy share) vs Q4 fails (flat BoH fee). Crossover insight at your home value. Q4 toggle synced to pinned card. *Source: same as §2; question-2-trash.html.*
4. **Deductions** — bill-with-bites-taken-out animation. Each eligible benefit slides in as a card and ticks the running total down. Ineligible benefits shown greyed with one-line "why not". *Sources per benefit: MA DOR Schedule CB; MGL c.59 § 5 cl.41C, cl.22, cl.37A, cl.17D, cl.41A; OBBBA 2025 federal SALT.*
5. **Where your money goes** — Lovable-style. Per-day / per-month / per-year stat row above; animated SVG donut; "Full Breakdown" cards with icon + title + dollar + % + $/day + animated progress bar; expand for line items. *Source: FY27 proposed budget; mapping mirrors `charts/your_tax_bill.html` categories.*

## Verifiable citations ("Receipts" system)

Treats every computed number as a claim. Three layers:

### Inline citation chips
Every non-trivial dollar/percent gets a small superscript chip next to it (≥24×24 hit area, smaller visual). Click/tap opens a popover.

### Citation popover
Shows source title + doc + page + the exact quoted snippet from the source + (when applicable) the derivation math + link to source PDF (anchored to the page).

### "Receipts" drawer
Off-canvas drawer accessible from the pinned card. Lists every source on the page, grouped by topic, with title / doc type / size / external link.

Three high-scrutiny numbers (override rates, Circuit Breaker max, FY26 residential rate) get extra-rich popovers with cropped source-image previews when feasible.

Citations live in a single registry (top of script block, or extracted to `_data/true_cost_sources.json` if it grows). Each entry: `id`, `title`, `doc`, `page`, `quote`, `link`. Number-rendering helpers accept a `cite` parameter and wrap the rendered DOM accordingly.

## Computations

### Override (Y1/Y2/Y3)
Reuses `RATES` constant from `charts/override_calculator.html` verbatim. Scaled linearly by `assessedValue / AVG_ASSESSED`. Cumulative Prop 2½ compounding already baked into Town Admin numbers per existing override calc footnote.

### Q4 trash
- Pass: `TRASH_LEVY_TOTAL[year] * (assessedValue / TOTAL_RESIDENTIAL_AV)`
- Fail: flat $281/household

### Benefits
- **Circuit Breaker:** age ≥ 65 AND income ≤ thresholds AND property_tax > 0.10 * income AND assessed_value ≤ $1,026,000 → credit = `min(2730, property_tax - 0.10 * income)` (TY2024 numbers; update to TY2025 when DOR publishes)
- **Senior 41C:** age ≥ 70 AND income/asset limits → $1,000 (subject to verifying Marblehead's adopted amount)
- **Veteran 22 series:** simple input → mapped to MGL-set amount
- **Blind 37A:** toggle → $500
- **Surviving spouse 17D:** toggle → $175
- **Federal SALT** (only if itemize = on):
    - estimated_marginal_bracket = lookup(income, filing_status) → e.g. 22% / 24% / 32% / 35%
    - capped_property_tax_deduction = min(property_tax, $40,000_cap - other_state_taxes_assumed_zero)
    - savings = capped * marginal_bracket
    - shown as range (±15%) labeled "estimate"
- **Tax deferral 41A:** info-only card; not subtracted

### "Where your money goes" donut
Categories (mirroring `charts/your_tax_bill.html` exactly):
- Schools (Marblehead Public + Essex North Shore Tech assessment)
- Public safety (police + fire)
- Public works (DPW, streets, water/sewer)
- Library + recreation
- Health + human services
- General government
- Debt service + financing
- Capital + other

Each user's slice = their_total_tax_bill * (category_dollars / total_residential_tax_levy).

## Tech stack

- **Single HTML file** (matches site convention; ~1000 lines).
- **Vanilla JS** — no framework. Use `IntersectionObserver` for scroll reveals, `requestAnimationFrame` for counter tweens, CSS transitions for bar-width and donut stroke-dasharray.
- **Hand-rolled SVG donut** (no chart lib).
- **Style:** uses existing CSS custom properties (`var(--text)`, `var(--c-buoy)`, `var(--series-tier-1)` etc.) per STYLE_GUIDE. Body class `body.true-cost` to scope page-specific styles.
- **Citations:** new module, inspired by the existing `assets/citations.js` pattern but distinct (custom popover/drawer rather than the existing static Sources injection).

## Accessibility & motion

- Respects `prefers-reduced-motion`: animations replaced with instant value updates and static reveals.
- Pinned card not pinned at narrow widths (just stays at top after hero).
- Citation chips: ≥24×24 px hit area, ARIA-described.
- Donut + bars have data tables as fallback (visible to screen readers; sighted users see the chart).
- Inputs keyboard-navigable, ARIA-labeled.

## Out of scope for v1

- Address autocomplete / Patriot Properties lookup (defer to v2; current "look it up here →" link is fine).
- Tier deferral interest accumulation calculator (just informational mention).
- A/B link sharing (URL-encoded inputs) — v2.
- "Did You Know?" cards (Lovable feature; not adding equivalent now).
- Compare scenarios overlay — v2.

## Acceptance / done

- Page renders correctly on chrome/safari/firefox at 360/768/1280/1920 widths.
- All numbers have at least one citation chip; clicking it produces a popover with quoted source text.
- `npm run test:local` passes (existing smoke tests).
- Playwright screenshots saved to `proof/<branch>.png` (hero) and `proof/<branch>-full.png` (full page).
- PR opened with preview URL.
