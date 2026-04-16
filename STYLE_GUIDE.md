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

### Title casing convention

| Page type | Casing | Example |
|-----------|--------|---------|
| **Index** and **Explainer** | Sentence case | "What is the override?", "How did we get here?" |
| **Chart** | Title Case | "Residential Tax Rates: Four North Shore Towns" |

Sentence case (only the first word and proper nouns capitalized) applies to the home page, explainer pages, the debate page, and homepage card titles. It matches the editorial, voter-facing tone of the prose pages.

Title Case applies to files under `charts/` because chart pages are product-like (dashboards, calculators) where Title Case is conventional. The frontmatter `title` on chart pages may be a shorter label than the `<h1>` (the title becomes the browser tab and social share title; the h1 is the full descriptive headline).

Both the frontmatter `title` and the `<h1>` on a given page must use the same casing. Don't mix.

### Homepage card tag convention

Homepage question cards (`.question` inside a `.question-list`) can have an optional tag pill. The rule:

| Card content | Tag |
|---|---|
| Prose / article / explainer | **no tag** |
| Chart or data visualization | `<span class="tag tag-charts">Chart</span>` |
| Interactive calculator | `<span class="tag tag-charts">Calculator</span>` |

The purpose of the tag is to flag cards that behave *differently* from a standard reading experience. If a card is just text, it gets no tag, because every card is text by default and labeling them all is visual noise. A reader skimming the homepage sees most cards as unlabeled and the few pill tags as signals: "this one is a chart, this one is a calculator, they'll scan/work differently."

Do not reintroduce `Explainer`, `History`, `Analysis`, `Guide`, `Read`, or any other prose-content label. The category is "not a chart or calculator" and the correct representation of that category is the absence of a tag.

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
| `--c-teal` | #2F7D8E | Links, Tier 2 |
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
| `--series-tier-1` | #6BB8C9 | Override Tier 1 (light teal) |
| `--series-tier-2` | teal | Override Tier 2 |
| `--series-tier-3` | #133E4A | Override Tier 3 (dark teal) |
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

## Prose and Links

Rules for the prose layer of the site &ndash; the words readers actually read, not the CSS that frames them.

### Plain language

Write for a resident who has never attended a town meeting or read an ACFR. Assume they know what a tax is and what a school is; do not assume they know what "OPEB", "GASB 68", "free cash", "Proposition 2&frac12;", or "debt exclusion" mean without explanation.

- Prefer short, concrete sentences over bureaucratic phrasing. If a paragraph reads like it was lifted straight out of an ACFR, rewrite it.
- Define the concept in prose the first time it appears on a page, not in a glossary the reader has to go find.
- The `.page-lead` class exists for exactly this reason &ndash; a plain-English opener on data-heavy pages. Use it.

Plain language is not dumbing down. It is the minimum bar for a project whose stated goal is to let residents form their own opinions based on facts, not rhetoric.

### Acronyms

First use of a municipal-finance or governance acronym on a page **must** be wrapped in `<abbr class="g" title="...">` with the expansion in the `title` attribute. The `.g` ("glossary") class is already styled in `assets/site.css`: dotted underline, hover/focus tooltip on desktop, long-press tooltip on mobile. No JavaScript required.

```html
<p>The town's <abbr class="g" title="Other Post-Employment Benefits">OPEB</abbr>
liability is reported annually in the
<abbr class="g" title="Annual Comprehensive Financial Report">ACFR</abbr>.</p>
```

- The tooltip is the *minimum*. On pages where an acronym is central to the topic, expand it in prose on first use as well ("Other Post-Employment Benefits (OPEB)") and still wrap the acronym in `<abbr class="g">` so the tooltip is available on subsequent uses.
- Everyday acronyms like "US", "MA", or "FY" do not need `<abbr>`. Municipal-finance and governance acronyms (OPEB, ACFR, GIC, PERAC, GASB, FTE, DOR, DLS, DESE, FinCom, DPW) always do.

### Links

Internal and external links have different jobs and live in different places on the page.

- **Internal references to other pages on marbleheaddata.org must be hyperlinks**, not bare text. If the prose mentions the override explainer, the calculator, or a chart page, link it the first time it appears in a given section. Inline `<a href="...">` is correct for internal links; they keep the reader on the site.
- **External links must be footnoted**, not inlined in the reading flow. Use the existing citations runtime (`assets/citations.js`), which converts `<sup class="cite">` markers into numbered footnotes and auto-generates a "Sources" section at the bottom of the page:

```html
<p>The FY24 property tax levy was $102.4 million.<sup class="cite"
  data-href="https://marblehead.org/finance/fy24-acfr.pdf"
  data-source="FY24 ACFR, page 129, Property Tax Levies and Collections"></sup></p>
```

The same source cited more than once on a page shares a number; the script handles deduplication and back-links automatically.

Rationale: internal links help readers explore the site; external links take them away from it. Footnoting external sources keeps the reading flow intact and matches the primary-source discipline the README requires (*"every number should be traceable to a primary source"*). Cite aggressively &ndash; just cite in footnotes.

## What Not To Do

- No em-dashes (use &ndash; for ranges, or rewrite the sentence)
- No filling data gaps with modeled values presented as actual data
- No editorial language in captions or notes
- No inline `style=""` attributes on SVG elements (use CSS classes)
- No inline `font-family`, `fill`, `stroke` on SVG text/lines (use CSS classes)
- No data presented without a traceable source
- No bureaucratic or ACFR-voice prose in site copy; rewrite in plain language
- No meta-narration ("This page explains...", "This section covers...", "Below
  you'll find..."). Lead with the claim or finding, not a description of what the
  page is about to do. If removing the sentence loses nothing, remove it.
- No undefined municipal-finance acronyms; first use on a page needs `<abbr class="g" title="...">`
- No bare-text internal references where a hyperlink to the other page belongs
- No inline external links in the reading flow; use `<sup class="cite">` footnotes via `assets/citations.js`
- No standalone CPI/inflation comparisons as the sole or primary benchmark for a
  municipal cost category. CPI may appear when it is one of several benchmarks
  presented alongside more directly relevant yardsticks (enrollment, headcount,
  revenue, service levels), when it is disclosed as real-dollar context for a
  single number, or when inflation-adjusted comparison is the standard metric in
  the relevant field (e.g. DESE per-pupil spending in constant dollars). The
  rule is against rhetorical "beat inflation" framings that imply waste without
  analytical support, not against honest disclosure that a number is
  inflation-adjusted.
