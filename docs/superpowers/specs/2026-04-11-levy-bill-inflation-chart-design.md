# Levy, median bill, and inflation chart — design

**Date:** 2026-04-11
**Owner:** Andrew Baber
**Status:** Approved, ready for implementation plan

## Purpose

Add a chart to the site that answers a common anti-override question: *"My property taxes have risen much faster than inflation. How is the town broke?"* The question, as commonly phrased (John DiPiano's formulation on Facebook: "inflation was 39-42% 2012-2025 but my property taxes rose almost 84%"), conflates three different growth rates:

1. **The town's total collected property tax levy** (what the town actually raised from property tax)
2. **The median single-family tax bill in Marblehead** (what the average Marblehead homeowner paid)
3. **Headline inflation** (CPI-U, what DiPiano was comparing against)

Each of the three has grown at a different rate over FY2012–FY2024, and the relationships between them are not obvious. The chart makes all three visible simultaneously.

**What the chart reveals, honestly:**

- Over FY2012–FY2024, Marblehead's collected levy grew **+53%**.
- The median single-family tax bill grew **+55%**.
- CPI-U grew **+37%**.
- The levy and the median bill grew at nearly identical rates; reassessment of single-family homes vs other property classes was a minor factor.
- **Both** grew meaningfully above CPI (~16-18 percentage points over 12 years).
- Individual tax bills vary based on each property's specific reassessment history (renovations, above-average appreciation, etc.). A reader reporting an 84% personal increase is seeing reassessment on their specific property on top of the 55% median growth.

**So the chart partially validates the premise of DiPiano-style questions:** the town's revenue did grow faster than national inflation. But it refutes the implicit conclusion ("therefore the town should be flush with cash"): the FY27 gap is about *specific acute cost pressures and reserve exhaustion*, not about chronic revenue lag. That second half of the answer is already on the site in the FY27 gap waterfall (`no-override-budget.html#fy27-gap-calculated`). This chart cross-links to it.

## Editorial stance

Non-advocacy, per CLAUDE.md:
- No naming of individual Facebook commenters (DiPiano, Buba, etc.). The chart engages with the argument, not with the person.
- No "shocking", "runaway", "skyrocketing", or similar advocacy framing.
- No framing that implies the reader was confused — plain factual description of each growth rate.
- The chart title is descriptive, not interpretive.
- The explainer below the chart states facts, not conclusions.
- Colors follow the existing approved exception for arithmetic sign vs value judgment: `--c-sage` for levy (revenue), `--c-buoy` for bill (cost to homeowner), neutral grey for CPI (reference).

## Scope

**Two separate PRs from this brainstorm:**

### PR 1: `charts/levy_vs_bill.html` (this spec)

A new standalone chart page with:
- A headline
- A three-line SVG chart (indexed to FY2012 = 100)
- An explainer paragraph below the chart
- A source line
- Cross-link to the FY27 gap waterfall on `no-override-budget.html`
- Linked from `index.html` (as a featured card) and `the-debate.html` Tension 1

### PR 2: Split rate card enhancement on `why-not-elsewhere.html` (separate PR, separate branch)

A targeted edit to the existing "Split tax rates (CIP shift)" card at `why-not-elsewhere.html:320-324`. Adds specific math and corrects a common misconception:

- **Current card:** *"Marblehead already uses a single tax rate (no split) and the CIP class is only 4.5% of the levy. Even the maximum allowable shift would reduce residential taxes by a small single-digit percentage."*
- **Enhanced card:** adds explicit math (residential bills drop ~3.3%, commercial rises the equivalent amount, ~$2.4M shifted on the FY26 $75.6M levy) and the revenue-neutral clarification (*"A split tax rate redistributes who pays, not how much is raised. It cannot substitute for an override."*)

This is a 2-3 sentence addition to an existing card. One commit, separate branch, one PR.

## Data

All values come from primary sources already in the repo. No new data pulls required.

### Series 1: Marblehead collected tax levy

**Source:** `data/tax_levy_FY01-24.csv` (from ACFR "Property Tax Levies and Collections" table, multiple fiscal years)

**Values (FY2012–FY2024):**

| FY | Levy | Index (FY12=100) |
|---:|---:|---:|
| 2012 | 53,651,430 | 100.00 |
| 2013 | 54,785,294 | 102.11 |
| 2014 | 56,761,148 | 105.80 |
| 2015 | 59,015,212 | 110.00 |
| 2016 | 61,337,920 | 114.33 |
| 2017 | 63,948,938 | 119.19 |
| 2018 | 66,315,447 | 123.61 |
| 2019 | 67,829,212 | 126.42 |
| 2020 | 69,813,033 | 130.12 |
| 2021 | 72,154,578 | 134.49 |
| 2022 | 76,282,235 | 142.18 |
| 2023 | 79,085,270 | 147.41 |
| 2024 | 82,171,513 | 153.17 |

**Cumulative growth FY2012 → FY2024: +53.2%**

Note: this is *collected* levy (what the town actually raised), which includes Prop 2.5 base levy + debt exclusions. It is the figure that appears on residents' tax bills. The alternative series `data/marblehead_levy.csv` tracks the base levy limit (before debt exclusions); this chart uses collected levy because it's the figure most comparable to what the median single-family bill actually pays.

### Series 2: Median single-family tax bill, Marblehead

**Source:** `data/DOR_AvgSingleFamTaxBill_4towns.xlsx` (DOR DLS "Average Single Family Tax Bill" report, multiple fiscal years; full file contains 4-town peer set — this chart uses only the Marblehead rows)

**Values (FY2012–FY2024):**

| FY | Median Bill | Index (FY12=100) |
|---:|---:|---:|
| 2012 | $6,958 | 100.00 |
| 2013 | $7,092 | 101.93 |
| 2014 | $7,360 | 105.78 |
| 2015 | $7,669 | 110.22 |
| 2016 | $7,974 | 114.60 |
| 2017 | $8,307 | 119.39 |
| 2018 | $8,607 | 123.70 |
| 2019 | $8,816 | 126.70 |
| 2020 | $9,068 | 130.32 |
| 2021 | $9,424 | 135.44 |
| 2022 | $9,935 | 142.79 |
| 2023 | $10,305 | 148.10 |
| 2024 | $10,778 | 154.90 |

**Cumulative growth FY2012 → FY2024: +54.9%**

### Series 3: CPI-U (US)

**Source:** `data/cpi_us.csv` (BLS, calendar-year annual averages)

**Values (2012–2024):**

| Year | CPI-U | Index (2012=100) |
|---:|---:|---:|
| 2012 | 229.6 | 100.00 |
| 2013 | 233.0 | 101.48 |
| 2014 | 236.7 | 103.09 |
| 2015 | 237.0 | 103.22 |
| 2016 | 240.0 | 104.53 |
| 2017 | 245.1 | 106.75 |
| 2018 | 251.1 | 109.36 |
| 2019 | 255.7 | 111.37 |
| 2020 | 258.8 | 112.72 |
| 2021 | 271.0 | 118.03 |
| 2022 | 292.7 | 127.48 |
| 2023 | 304.7 | 132.71 |
| 2024 | 313.7 | 136.63 |

**Cumulative growth 2012 → 2024: +36.6%**

### Note on year alignment

Marblehead fiscal year runs July–June (FY2024 = July 2023 through June 2024), while CPI is calendar-year. This chart aligns them by matching fiscal year N to calendar year N (i.e., FY2024 ↔ 2024). The six-month misalignment introduces a small error but does not change the qualitative story. The source line below the chart will disclose this.

## Visual design

### Chart type and orientation

**Horizontal line chart, three lines.** The standard chart type for "multiple indexed time series starting from the same base year." Matches the existing `svg.chart` convention used by `charts/four_town_rates.html`.

### Layout

- **viewBox:** `0 0 840 360`
- **Chart area:** x=80 to x=780, y=40 to y=300 (leaves 80px left margin for y-axis labels, 60px right margin for end-point labels, 40px top margin, 60px bottom margin for x-axis labels)
- **X-axis:** 13 evenly-spaced ticks for FY2012 through FY2024 (one per year)
- **Y-axis:** range from 100 to 160 (covers the full data range with a bit of headroom)
- **Gridlines:** horizontal reference lines at 100, 110, 120, 130, 140, 150, 160 (subtle divider color, not prominent)

### Three lines

1. **Marblehead collected tax levy:** `var(--c-sage)` (salt marsh green). Approved sign-coding per STYLE_GUIDE rule 5 — revenue is conventionally sage on this site.
2. **Median single-family tax bill:** `var(--c-buoy)` (buoy red). Same sign-coding convention: costs paid by residents are conventionally buoy.
3. **CPI-U:** `var(--text-subtle)` (neutral grey). The reference line, not a revenue or cost signal.

Each line has a **dot at each data point** (13 dots per line, 39 total), matching the existing convention on `charts/four_town_rates.html`. Each line has an **end-point label** at the right side (e.g., "Levy: 153", "Bill: 155", "CPI: 137") so readers can identify the lines without a separate legend.

### Styling approach

- **Uses existing `svg.chart` class** from `assets/site.css`, which provides the baseline axes, labels, and dot styling. This chart won't need new CSS — it can reuse what's already there.
- **Colors via inline `class=` attributes** pointing to existing palette variables — same approach used by `charts/four_town_rates.html`. No inline `style=""` attributes on SVG elements.
- **No new CSS classes added to `assets/site.css`** unless the existing `svg.chart` patterns don't cover a specific need we discover during implementation.

### Responsive behavior

- SVG scales proportionally via `preserveAspectRatio="xMidYMid meet"` and `.chart { width: 100%; height: auto; }` (already in existing CSS)
- On mobile (<600px), text labels may become small but the chart shape and relative line positions remain legible
- Minimum tested width: 320px (iPhone SE)

### Accessibility

- `role="img"` on the `<svg>`
- `<title>` child with chart title
- `<desc>` child with detailed prose description of the three series and their end values
- Intro paragraph above the chart states the key findings in prose so screen-reader users get the content without parsing the SVG description

## Copy (final, locked)

### Page title (browser tab)

```
Marblehead tax levy, median home bill, and inflation — FY2012–FY2024 | Marblehead Budget Data
```

### Page headline (H1)

```
Marblehead tax levy, median single-family bill, and inflation, FY2012–FY2024
```

Descriptive, matches `charts/four_town_rates.html` ("Average single-family tax bill") convention. No "why they're not the same thing" or other implicit-confusion framing.

### Intro paragraph (above chart)

> Over FY2012 through FY2024, Marblehead's total collected property tax levy grew 53.2%, the median Marblehead single-family tax bill grew 54.9%, and headline inflation (CPI-U) grew 36.6%. The levy and the median bill tracked each other closely, and both grew meaningfully above inflation. Individual tax bills vary based on each property's specific assessment history, and a home whose value rose faster than the town median saw a larger-than-median increase.

### Chart caption (below chart)

> The town's collected levy and the median single-family bill grew at nearly identical rates over this twelve-year window, a reminder that Prop 2½ caps the total levy (what the town raises) and individual bills move with a property's share of that capped total. CPI-U, by contrast, grew about 17 percentage points less. Marblehead residents did see property tax bills grow faster than inflation; this chart shows what that looks like in aggregate.

No em-dashes (STYLE_GUIDE.md:129). The sentence is structured with a comma-led clause instead.

### Source line (below caption)

> Sources: Marblehead tax levy from ACFR "Property Tax Levies and Collections" tables (`data/tax_levy_FY01-24.csv`); median single-family tax bill from [Massachusetts DOR DLS "Average Single Family Tax Bill" report](https://dlsgateway.dor.state.ma.us/reports/rdpage.aspx?rdreport=Socioec.socioec_report_avgsinglefamilytaxbill) (`data/DOR_AvgSingleFamTaxBill_4towns.xlsx`); CPI-U calendar-year annual averages from the [US Bureau of Labor Statistics](https://www.bls.gov/cpi/) (`data/cpi_us.csv`). Fiscal year FY2024 covers July 2023 through June 2024 and is aligned to calendar year 2024 for this comparison; the six-month offset introduces a small alignment error that does not affect the qualitative relationships shown.

### Cross-link to the FY27 gap waterfall

> **Why is FY27 tight despite this revenue growth?** Marblehead's levy has grown faster than inflation over the past decade, but the FY27 budget gap is a specific acute cliff rather than a long-run drift. Health insurance rates jumped 11% for FY27, pension obligations rose 9%, a new curbside trash contract added costs, and the Free Cash reserves that balanced the FY26 budget are not available again at the same level. For the full reconciliation of where the $8.47M FY27 gap comes from, see [how the $8.47M FY27 gap is calculated](no-override-budget.html#fy27-gap-calculated).

### What readers should take away

(Not on the page, but guidance for implementation and future edits:)
1. The town's collected levy and the median bill grew at about the same rate, both meaningfully above inflation.
2. Individual bills vary — a home with above-average appreciation will have seen above-median bill growth.
3. The FY27 tight budget is not explained by a long-run revenue-vs-inflation story. It is explained by acute FY26→FY27 cost cliffs and reserve exhaustion.

## Primary sources cited

All already in the repo:

1. `data/tax_levy_FY01-24.csv` — Marblehead total tax levy FY2001-FY2024, from ACFR "Property Tax Levies and Collections" tables (multiple fiscal years)
2. `data/DOR_AvgSingleFamTaxBill_4towns.xlsx` — DOR DLS "Average Single Family Tax Bill" report, covering Marblehead, Swampscott, Melrose, Stoneham, FY1988-FY2026. This chart uses only the Marblehead rows.
3. `data/cpi_us.csv` — BLS CPI-U calendar-year annual averages, 2000-2024

## Verification plan

Before merging:

1. **Jekyll build.** The new chart page must build without errors.
2. **Visual check, desktop (≥1024px).** Three lines render with labels, gridlines, dots, and end-point labels. No overlap issues.
3. **Visual check, mobile (~400px).** SVG scales cleanly, labels remain legible, no horizontal scroll.
4. **Dark mode.** `--c-sage`, `--c-buoy`, `--text-subtle` all have dark-mode counterparts already; confirm they render correctly.
5. **Accessibility.** Screen reader reads `<title>` and `<desc>` intelligibly. Intro paragraph above chart conveys key numbers in prose for non-visual readers.
6. **Math verification.** All indexed values match the tables in this spec; cumulative growth figures (+53%, +55%, +37%) match the source data.
7. **Link check.** The `no-override-budget.html#fy27-gap-calculated` cross-link resolves to the FY27 gap waterfall section.
8. **Inbound link check.** After the chart page ships, add featured card to `index.html` and a context link from `the-debate.html` Tension 1 (skeptic block) as a separate cleanup commit or follow-up PR.

## Out of scope (separate follow-up work)

1. **Split tax rate card enhancement** (PR 2 from this brainstorm). Separate branch, separate PR, documented in this spec's Scope section but built independently.
2. **Buba per-capita spending chart.** Queued as a separate brainstorm and implementation. Explicitly deferred during the DiPiano pivot discussion.
3. **Featured card on `index.html`** and **context link from `the-debate.html`** — optional follow-up cleanup commits after the chart lands. Not required for this PR.
4. **Individual property tax estimator** (given a home's assessed value, show what the 2012-2024 bill trajectory would have been for that home) — out of scope, potential future interactive tool.

## Notes for the reviewer / future maintainer

- **Do not extend the time window without verifying all three series have data.** `tax_levy_FY01-24.csv` ends at FY2024; `cpi_us.csv` ends at 2024; `DOR_AvgSingleFamTaxBill_4towns.xlsx` has FY2025 and FY2026 data but the other two do not. Extending the chart past FY2024 requires adding data to the levy and CPI files first.
- **If the indexed values look different from the tables above when re-running the calculation,** suspect a data file update (e.g., DOR republished a year). The spec's numbers are authoritative as of 2026-04-11.
- **Do not name DiPiano or any other Facebook commenter on the page.** The chart engages with the argument, not the person. Keep the editorial tone neutral.
