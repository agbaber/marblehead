# Override tier line-item detail

**Date:** 2026-04-12
**Page:** `what-is-the-override.html`
**Data source:** `data/override_town_line_items.csv`

## Problem

The no-override page shows department-by-department cuts with dollar amounts.
The override page shows three tier cards with prose bullet points ("Firefighter
position," "School resource officer") and no dollar amounts. A voter can see
exactly what they lose without an override but not exactly what each tier buys.

## Design

Replace the three existing tier cards (lines ~94-132 of
`what-is-the-override.html`) with richer cards that show every town-side line
item from the CSV, grouped by department, with dollar amounts.

### Framing

- **Incremental, not cumulative.** Tier 1 shows its items. Tier 2 shows only
  what it adds beyond Tier 1. Tier 3 shows only what it adds beyond Tier 2.
  Consistent with the existing card headers ("Everything in Tier 1, plus...").
- **Restore vs Increase.** Each line item gets a subtle label distinguishing
  restorations of no-override cuts from genuinely new spending. The CSV
  encodes this in the description prefix ("Restore ..." vs "Increase ...").
  Tier 1 is almost entirely Restores; Tier 2/3 mix in more Increases.
- **Schools line.** Each card includes a "Schools" line at the bottom showing
  the school-side allocation (total tier amount minus town-side net). This
  accounts for the full tier amount so readers don't wonder where the rest
  went.
- **Offset line.** The unemployment savings offset (negative) appears in the
  card where it applies.

### Visual treatment

- Reuse the no-override page's `.cut-row` layout pattern: department/item name
  on the left, dollar amount on the right. No proportional bars (the existing
  stacked tier chart at the top of the page already communicates relative
  size).
- Department groupings as subheadings within each card.
- Small inline tag or text prefix for Restore/Increase distinction. Use
  existing site palette (no new colors). Suggested: muted text label before
  each item name, e.g. "Restore:" or "New:" in a lighter weight.
- Source citation at the bottom of each card referencing the Town
  Administrator's April 8, 2026 override presentation.

### Structure per tier card

```
Tier label (e.g. "Tier 1: Restore ($9 million)")
Existing h3 summary line

  Public Safety
    Restore: Police Department School Resource Officer    $65,482
    Restore: Police Department Equipment                   $2,000
    Restore: Inspections subscriptions & maintenance      $52,500

  Public Works
    Restore: DPW staffing                                $140,594
    Restore: DPW hot top                                  $60,000
    Restore: Cemetery laborer                             $58,692

  ... (remaining departments)

  Offset
    Unemployment reduction with restored positions       -$410,116

  Schools                                              ~$7,730,436

  Source: ...
```

### What stays unchanged

- The stacked tier bar chart at the top of the section
- The Dan Fox quote after Tier 1
- The trash card (Tier card--trash)
- The "tiers are nested" takeaway box and Ginny O'Brien quote
- The scrolly nesting visualization
- Everything else on the page outside the tier cards section

### Data mapping

Town-side line items come directly from `override_town_line_items.csv`.
Hardcoded in HTML (consistent with the no-override page; no JS build step).

School allocation per tier:
- Tier 1: $9,000,000 - town net = ~$7,730,436
- Tier 2: $12,000,000 - town net = ~$9,294,764
- Tier 3: $15,000,000 - town net = ~$10,803,282

Town net per tier (sum of all line items including the negative offset):
- Tier 1: $1,269,564
- Tier 2: $2,705,236
- Tier 3: $4,196,718

These are derived from the CSV. The school numbers should be presented as
approximate ("~$7.7M") since we're computing them as a remainder, not from a
school-specific source document.

### CSS

Minimal new CSS needed:
- `.tier-line-group` heading style for department category subheadings within
  each card
- `.tier-line` layout (name left, amount right) -- may be able to reuse
  `.cut-row` directly or create a thin variant
- `.tier-tag--restore` / `.tier-tag--new` for the Restore/Increase label

All scoped within the existing `.tier-card--1/2/3` card classes. Added to
`assets/site.css` or as a `<style>` block on the page (follow whichever
pattern the page already uses for page-specific styles).

### Source citation

> Source: Town Administrator's April 8, 2026 override presentation;
> FY27 Proposed Balanced Budget With No Override (for restoration
> baselines). School allocation is the tier total minus town-side
> line items.

### Editorial notes

- No editorial language. Items are listed factually with their dollar amounts.
- The Restore/Increase distinction is sourced from the official presentation,
  not an editorial judgment.
- School amounts are presented as approximate with an explanatory note.
- Neutral semantic colors per the style guide. No green/red value judgments.
