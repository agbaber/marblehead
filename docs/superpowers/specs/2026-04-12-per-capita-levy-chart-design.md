# Per-capita tax levy chart — design

**Date:** 2026-04-12
**Owner:** Andrew Baber
**Status:** Approved, ready for implementation plan

## Purpose

Add a chart showing per-capita property tax levy for four North Shore towns (Swampscott, Marblehead, Melrose, Stoneham), directly addressing the common anti-override argument that Marblehead spends more per person than its neighbors.

**Key finding:** on a per-capita *property tax levy* basis (what property taxpayers actually pay), Swampscott is the highest at $4,207/person and Marblehead is second at $4,113/person. This is the opposite of what the anti-override argument claims. The discrepancy arises because the anti-override calculation uses "total budget" as the numerator, which includes enterprise fund revenue (Municipal Light Department, water/sewer) funded by user fees rather than property taxes. Towns with large enterprise operations appear to "spend more" under that framing even though the additional cost isn't borne by property taxpayers.

## Scope

**One new file:** `charts/per_capita_levy.html` — standalone chart page with a vertical bar chart, intro paragraph, caveat paragraph, source line, and cross-links to related charts.

**No other files modified.** No CSS changes (uses existing `svg.chart` classes and town-specific color classes `.s-marblehead`, `.s-swampscott`, `.s-melrose`, `.s-stoneham`). No new data files (levy data from `peer_tax_levies_by_class_FY22-26.csv`, already in the repo). Populations from Census 2020.

## Data

### FY2026 total tax levy (DOR DLS)

Source: `data/peer_tax_levies_by_class_FY22-26.csv`, FY2026 rows for each municipality. This is the total property tax collected (residential + commercial + industrial + personal property), which equals the Proposition 2½ base levy plus any voter-approved debt exclusions.

| Town | DOR Code | FY26 Total Levy |
|---|---:|---:|
| Swampscott | 291 | $63,571,093 |
| Marblehead | 168 | $84,617,969 |
| Melrose | 178 | $95,928,471 |
| Stoneham | 284 | $71,741,745 |

### Population (Census 2020)

Source: US Census Bureau, 2020 Decennial Census. These are the most recent decennial counts. ACS 5-year estimates exist but introduce sampling error; decennial counts are authoritative. The 6-year lag between Census 2020 and FY2026 is noted in the source line. Ranking is robust to reasonable population shifts (Swampscott would need to have grown by ~700 residents, or ~4.6%, to fall below Marblehead on per-capita levy — larger than typical annual growth for a built-out coastal town).

| Town | Census 2020 Pop |
|---|---:|
| Swampscott | 15,111 |
| Marblehead | 20,412 |
| Melrose | 28,080 |
| Stoneham | 23,017 |

Note: Marblehead's ACFR-reported population for FY2024 is 20,576, slightly higher than Census 2020's 20,412. For cross-town consistency, the chart uses Census 2020 for all four towns. Using the ACFR figure for Marblehead alone would lower Marblehead's per-capita from $4,144 to $4,113 — the ranking is unchanged.

### Computed per-capita tax levy

| Town | FY26 Total Levy | Census 2020 Pop | Per-Capita Levy |
|---|---:|---:|---:|
| Swampscott | $63,571,093 | 15,111 | **$4,207** |
| Marblehead | $84,617,969 | 20,412 | **$4,144** |
| Melrose | $95,928,471 | 28,080 | **$3,416** |
| Stoneham | $71,741,745 | 23,017 | **$3,117** |

Derivation: total_levy / population, rounded to nearest dollar.

## Visual design

### Chart type

**Vertical bar chart, 4 bars.** Ordered by value descending (Swampscott, Marblehead, Melrose, Stoneham). Each bar labeled with the dollar amount above it and the town name below it.

### Colors

Uses existing town-specific color classes from `assets/site.css`:
- `.s-swampscott` → `var(--series-swampscott)` = `var(--c-brass)` (#B8860B)
- `.s-marblehead` → `var(--series-marblehead)` = `var(--c-navy)` (#1B3A57)
- `.s-melrose` → `var(--series-melrose)` = `var(--c-buoy)` (#C8553D)
- `.s-stoneham` → `var(--series-stoneham)` = `var(--c-plum)` (#6C4A6E)

### SVG conventions

- Uses `svg.chart` class from `assets/site.css`
- `role="img"` with descriptive `aria-label`
- `viewBox` dimensions and exact bar geometry computed during implementation
- Bar values labeled above each bar using `.value-label` class
- Town names below each bar using `.tick-label` class
- Y-axis with gridlines and dollar labels ($3,000, $3,500, $4,000, $4,500)
- No inline `style=""` on SVG elements

### Responsive

SVG scales proportionally via `preserveAspectRatio="xMidYMid meet"` and existing `svg.chart { width: 100%; height: auto; }` CSS.

## Copy

### Page title (frontmatter)

```
title: "Per-Capita Property Tax Levy"
```

### Headline (H1)

```
Per-Capita Property Tax Levy, Four North Shore Towns, FY2026
```

Title Case per STYLE_GUIDE.md chart-page rule.

### Intro paragraph

> Marblehead's per-capita property tax levy is the second-highest of these four North Shore towns, behind Swampscott. Per-capita levy measures the total property tax collected divided by population, showing what each resident's share of the property tax burden is. Swampscott collects $4,207 per resident; Marblehead collects $4,144; Melrose $3,416; Stoneham $3,117.

### Caveat paragraph (below chart)

> This chart shows per-capita *property tax levy*, not per-capita *total budget*. The property tax levy is what property taxpayers pay through their tax bills. A town's total budget also includes enterprise fund revenue (Municipal Light, water, sewer), state aid, local receipts, and other sources. Enterprise funds are paid through user fees, not property taxes, and vary by town: a town with a large Municipal Light Department will have a higher total budget without a correspondingly higher tax burden on homeowners. Per-capita tax levy is the more comparable denominator for measuring property tax burden across towns.

### Source line

> Sources: FY2026 total tax levy from MA DOR DLS "Tax Rates by Class" report, compiled in <a href="data/peer_tax_levies_by_class_FY22-26.csv">data/peer_tax_levies_by_class_FY22-26.csv</a>. Population from the US Census Bureau 2020 Decennial Census. Census population figures are six years old; the per-capita ranking is robust to reasonable population changes (see source notes below).

### Cross-links

> For the same four towns compared by tax rate and median single-family bill, see <a href="four_town_rates.html">Rate and Bill: Four North Shore Towns</a>. For how Marblehead's levy, median bill, and inflation grew over FY2012 to FY2024, see <a href="levy_vs_bill.html">Tax Levy, Median Bill, and Inflation</a>.

### Source notes (div.notes)

Two notes:
1. **On Census population.** The Census 2020 figures are the most recent decennial count. More recent ACS 5-year estimates exist but introduce sampling error and are not used here. Marblehead's FY2024 ACFR reports population as 20,576 (vs Census 2020's 20,412); using the ACFR figure would lower Marblehead's per-capita from $4,144 to $4,113 without changing the ranking.
2. **On total budget vs tax levy.** Some per-capita comparisons use total town budget as the numerator. A total-budget comparison would change the ranking because it includes enterprise fund revenue (e.g., Marblehead's Municipal Light Department), state aid, and other non-tax-levy revenue sources. This chart uses the property tax levy alone because it is the cost borne directly by property taxpayers and is the figure most relevant to the override question.

## Editorial stance

- Non-advocacy per CLAUDE.md
- No naming of Facebook commenters (Buba, DiPiano, etc.)
- Engages with the argument ("which town pays more per person?") not the person
- States numbers, lets reader conclude
- The finding that Swampscott is ahead of Marblehead is presented as data, not as an editorial conclusion about whether Marblehead's spending is appropriate

## Verification plan

1. Jekyll builds cleanly (or GitHub Pages post-merge)
2. Four bars render with correct values and town labels
3. Dark mode — all four town color classes have dark-mode counterparts
4. Accessibility — `role="img"`, `aria-label` enumerating all four values
5. Cross-links resolve (four_town_rates.html, levy_vs_bill.html)
6. Math check: each per-capita value matches total_levy / population rounded to nearest dollar
7. Source file `data/peer_tax_levies_by_class_FY22-26.csv` exists and contains the FY26 rows cited

## Out of scope

1. Inbound links from `index.html`, `the-debate.html`, `why-not-elsewhere.html` — optional follow-up edits after the chart lands
2. Per-capita total budget comparison — deferred because it requires data pulls for peer town total budgets and introduces enterprise fund comparability issues
3. Expanded peer set (archetype 1's 10 towns) — deferred; 4-town set is sufficient and matches existing `charts/four_town_rates.html` peer set
