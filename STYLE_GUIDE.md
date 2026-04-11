# Style Guide

Design system for marbleheaddata.org. All shared styles live in `assets/site.css`.

## Architecture

One shared stylesheet (`assets/site.css`) with CSS custom properties. All pages link to it. Page-specific styles go in a `<style>` block only when truly needed.

- Light/dark mode via `prefers-color-scheme`, with manual override via `data-theme="light|dark"` on `<html>`
- Mobile-first with breakpoint at 600px
- Coastal palette with semantic tokens

## Page Types

| Type | Body class | Max width | Examples |
|------|-----------|-----------|----------|
| **Index** | `.page--home` on wrapper | `--chart-max` (880px) | `index.html` |
| **Explainer** | (none) | `--page-max` (720px) | `what-is-the-override.html`, `no-override-budget.html` |
| **Chart** | `chart-page` | `--chart-max` (880px) | All files in `charts/` |

The home page uses the wider `--chart-max` container to accommodate a 2-column question-card grid on desktop (&ge;720px). Below that breakpoint the cards stack single-column. A lone `.question` in a `.question-list` spans both grid columns via `:only-child`, so sections with a single card don't leave an empty right column.

## Required `<head>` Elements (Every Page)

```html
<html lang="en">
<head>
<meta charset="utf-8">
<!-- Google Tag Manager -->
<script>...</script>
<!-- End Google Tag Manager -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F4F7FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1620" media="(prefers-color-scheme: dark)">
<title>[Page Title] - Marblehead Budget Data</title>
<link rel="icon" href="[../]favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="[../]assets/site.css">
</head>
<body class="chart-page"> <!-- or no class for text pages -->
<!-- Google Tag Manager (noscript) -->
<noscript>...</noscript>
<!-- End Google Tag Manager (noscript) -->
```

## CSS Custom Properties

### Color Tokens (Light)
| Token | Value | Use |
|-------|-------|-----|
| `--c-fog` | #F4F7FA | Page background |
| `--c-surface` | #FFFFFF | Card/container background |
| `--c-navy` | #1B3A57 | Marblehead, primary accent |
| `--c-buoy` | #C8553D | Melrose, costs, warnings |
| `--c-teal` | #2F7D8E | Links, Tier 1 |
| `--c-brass` | #B8860B | Swampscott |
| `--c-sage` | #5B7553 | Revenue, positive |
| `--c-plum` | #6C4A6E | Stoneham |

### Semantic Series Tokens
| Token | Maps to | Use |
|-------|---------|-----|
| `--series-marblehead` | navy | Marblehead data |
| `--series-swampscott` | brass | Swampscott data |
| `--series-melrose` | buoy | Melrose data |
| `--series-stoneham` | plum | Stoneham data |
| `--series-revenue` | sage | Revenue/levy lines |
| `--series-cost` | buoy | Cost/expense lines |
| `--series-neutral` | text | Single-series charts |

## SVG Chart Classes

All SVGs should have `class="chart"`. Use these classes instead of inline styles:

| Class | Use |
|-------|-----|
| `.axis-base` | Baseline x-axis |
| `.grid-major` / `.grid-minor` | Grid lines |
| `.tick` | Y-axis tick marks |
| `.tick-label` | Axis text |
| `.tick-label--major` / `--minor` | Minor labels hide on mobile |
| `.data-line` | Data polylines |
| `.data-line--bold` / `--thin` / `--dashed` | Line variants |
| `.data-dot` | Circle data points |
| `.end-label` | Direct labels at line endpoints |
| `.annotation` / `.annotation-line` | Callout text and dashed lines |
| `.annotation--hide-sm` | Hide annotation on mobile |
| `.s-marblehead`, `.s-melrose`, etc. | Series color (sets `color` for `currentColor` cascade) |

## Chart Principles

1. Direct label lines at endpoints. Legends only when 4+ series and end labels would overlap.
2. Solid lines for actual data, dashed for projected/estimated. Note the boundary in captions.
3. Minimal grid. Baseline + light reference lines.
4. No dual Y-axis charts. Use stacked panels.
5. Neutral semantic colors. No green/red value judgments on comparisons.
6. State facts in captions, not conclusions.
7. Note data gaps honestly with dashed connectors and explicit notes.

## What Not To Do

- No em-dashes (use &ndash; for ranges, or rewrite the sentence)
- No filling data gaps with modeled values presented as actual data
- No editorial language in captions or notes
- No inline `style=""` attributes on SVG elements (use CSS classes)
- No inline `font-family`, `fill`, `stroke` on SVG text/lines (use CSS classes)
- No data presented without a traceable source
- No standalone CPI/inflation comparisons as the sole or primary benchmark for a
  municipal cost category. CPI may appear when it is one of several benchmarks
  presented alongside more directly relevant yardsticks (enrollment, headcount,
  revenue, service levels), when it is disclosed as real-dollar context for a
  single number, or when inflation-adjusted comparison is the standard metric in
  the relevant field (e.g. DESE per-pupil spending in constant dollars). The
  rule is against rhetorical "beat inflation" framings that imply waste without
  analytical support, not against honest disclosure that a number is
  inflation-adjusted.
