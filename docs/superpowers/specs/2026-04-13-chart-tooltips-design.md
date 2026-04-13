# Chart Tooltip System -- Design Spec

**Date:** 2026-04-13
**Status:** Approved, ready for implementation

## Goal

Add hover/tap tooltips to all time-series SVG charts on marbleheaddata.org. Readers should be able to:

1. **See exact values** -- the chart shows the shape; hover reveals the number
2. **Get context** -- caveats, source notes, or flags on specific data points (e.g., "GASB 68 restatement year", "Joined GIC")
3. **Compare across series** -- hovering one year shows all series values side by side

## Interaction pattern: vertical year columns

The model is the NYT / FiveThirtyEight hover pattern. Each fiscal year on a chart has an invisible rectangular hit area spanning the full chart height. On hover (desktop) or tap (mobile):

- A **tooltip div** appears near the cursor showing:
  - Fiscal year heading (e.g., "FY2019")
  - Each series with a colored swatch, name, and value
  - Optional caveat note if one exists for that year
- A faint **vertical rule** appears at the hovered year column
- Non-hovered series **dim slightly** (reduced opacity) to focus attention

### Mobile behavior

- Tap a column to show the tooltip
- Tap outside the chart (or a different column) to dismiss
- No long-press required

### Exception: levy_vs_bill scatter chart

levy_vs_bill.html is a scatter plot, not a time series with a shared x-axis. It gets **per-dot tooltips** instead of year columns. Each existing `.data-dot` circle gets `data-` attributes and shows a tooltip on hover/tap with the town name and values.

## Architecture

### New file: `assets/chart-tooltips.js`

Shared module loaded via the chart layout. Responsibilities:

- On DOMContentLoaded, find all `.chart` SVGs that contain `.hit-columns`
- Attach mouseenter/mouseleave (desktop) and click (mobile) listeners to each `<rect>` inside `.hit-columns`
- Read `data-year`, `data-values`, and `data-note` from the rect
- Position and populate a tooltip `<div>` (created once, reused)
- Show/hide a vertical rule `<line>` element inside the SVG
- Apply `.dim` class to non-active series elements

### SVG markup changes (per chart)

Add a `<g class="hit-columns">` group at the end of each `<svg>` (so it sits on top for pointer events). Inside it, one `<rect>` per fiscal year:

```xml
<g class="hit-columns">
  <rect x="55" y="0" width="28" height="310"
        data-year="FY03"
        data-values='[{"series":"Marblehead","class":"s-marblehead","value":"$7.22"},{"series":"Swampscott","class":"s-swampscott","value":"$11.00"},{"series":"Melrose","class":"s-melrose","value":"$10.50"},{"series":"Stoneham","class":"s-stoneham","value":"$9.60"}]'
        data-note="" />
  <!-- ... one rect per year ... -->
</g>
```

- `data-year`: Fiscal year label
- `data-values`: JSON array of `{series, class, value}` objects
- `data-note`: Optional string caveat (empty string if none)
- Rects are transparent (`fill: transparent; pointer-events: all`)

### CSS additions to `site.css`

```
.hit-columns rect        -- transparent fill, pointer-events: all
.chart-tooltip            -- positioned overlay div, z-index, background, padding, shadow
.chart-tooltip .tt-year   -- year heading
.chart-tooltip .tt-row    -- series row (swatch + name + value)
.chart-tooltip .tt-swatch -- small colored square using series class
.chart-tooltip .tt-note   -- caveat text, smaller/muted
.chart .vline-hover       -- vertical rule, light stroke, shown on hover
svg.chart .dim            -- reduced opacity for non-active data-line / data-dot elements
```

Tooltip styling should match the existing `.vote-tooltip` pattern (absolute positioning, pointer-events: none on the tooltip itself, clean background).

### Chart layout change

`_layouts/chart.html` adds `<script src="/assets/chart-tooltips.js"></script>` so the module loads on all chart pages.

## Scope of annotation work

| Chart page | Approx years | Series | Rects needed |
|---|---|---|---|
| healthcare_costs (panel 1) | 22 (FY06-FY27) | 2 | 22 |
| healthcare_costs (panel 2) | 19 (FY06-FY24) | 2 | 19 |
| healthcare_costs (panel 3) | 14 (FY12-FY25) | 1 | 14 |
| four_town_rates (rate chart) | 24 (FY03-FY26) | 4 | 24 |
| four_town_rates (bill chart) | 24 (FY03-FY26) | 4 | 24 |
| enrollment_vs_staffing (panel 1) | ~19 | 1 | 19 |
| enrollment_vs_staffing (panel 2) | ~19 | 2 | 19 |
| tax_comparison | ~24 | varies | ~24 |
| per_capita_levy | ~24 | 1 | ~24 |
| rate_value_schools | varies | varies | ~20 |
| sustainability | ~10 | varies | ~10 |
| levy_vs_bill (scatter, per-dot) | n/a | 4 | ~39 dots |

**Total:** ~220 rects + ~39 dot annotations

## Data sourcing for tooltip values

Every value shown in a tooltip must trace to a primary source, consistent with project standards. The `data-values` JSON for each rect should use the same numbers that were used to compute the SVG coordinates. When the original source values are not already recorded in `data/*.csv`, they should be added there as part of the annotation work.

## What this does NOT include

- Pan, zoom, or brush interactions
- Animated transitions between states
- Any chart library dependency
- Changes to chart visual design (colors, line weights, labels)
- New charts -- this only adds tooltips to existing ones

## Implementation order (suggested)

1. Build `chart-tooltips.js` and CSS against one chart (four_town_rates is a good candidate -- 4 series, clear x-axis)
2. Verify tooltip positioning, mobile tap behavior, and dim effect
3. Annotate remaining time-series charts one at a time
4. Handle levy_vs_bill scatter as a special case
5. Final pass: add `data-note` caveats to years that need them (GASB restatements, GIC join, projections, etc.)
