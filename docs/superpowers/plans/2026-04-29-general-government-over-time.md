# General Government Over Time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone multi-view chart page at `charts/general_government_over_time.html` showing how Marblehead's general government spending has changed over time (FY02-FY24), in real per-capita dollars, and against an 8-town wealthy-suburb peer cohort.

**Architecture:** A single Jekyll page mirroring `charts/healthcare_costs.html`'s structure: H1 + subtitle + intro paragraph + three numbered H2 sections, each containing one inline SVG chart with the `data-chart-tooltip` JSON, a legend, and a 1-2 paragraph factual caption. A new helper script under `data/` precomputes all chart values from existing CSVs and emits them as JSON for paste-in.

**Tech Stack:** Jekyll 3.10 + kramdown (project-pinned), inline SVG charts (no JS chart library — site convention), `chart-tooltip` script for hover values, Python 3 helper for data prep, Playwright smoke test harness.

**Spec:** `docs/superpowers/specs/2026-04-29-general-government-over-time-design.md`.

---

### Task 1: Create the data-prep helper script

**Files:**
- Create: `data/build_general_government_chart_data.py`

This script loads the three source CSVs, computes the indexed series, real per-capita series, peer-comparison values, and the SVG coordinate arrays for each view. Emits JSON to stdout. Saving the script (rather than computing inline) makes the chart values reproducible — when DOR releases FY25 Schedule A data, re-running the script regenerates updated values.

- [ ] **Step 1: Create the script**

```python
#!/usr/bin/env python3
"""Compute chart values for charts/general_government_over_time.html.

Reads:
  data/peer_schedule_a_expenditures.csv  (DOR Schedule A, FY02-FY24)
  data/demographics_FY01-24.csv          (Marblehead population)
  data/cpi_us.csv                        (BLS CPI-U, calendar year)
  data/dor_income_eqv_pop_FY27.csv       (peer populations, current)

Emits JSON to stdout with the values needed by the chart page.
Run from the repo root:

  python3 data/build_general_government_chart_data.py > /tmp/gg_chart_values.json
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

PEERS = ["Brookline", "Wellesley", "Hingham", "Winchester",
         "Lexington", "Needham", "Newton", "Natick"]
COHORT = ["Marblehead"] + PEERS

# Layout constants matching healthcare_costs.html conventions.
CHART_LEFT, CHART_RIGHT = 60, 620
CHART_TOP, CHART_BOTTOM = 42, 246


def read_schedule_a():
    """Returns {(town, fy): {'gg': int, 'total': int}} for FY02-FY24."""
    out = {}
    with (DATA / "peer_schedule_a_expenditures.csv").open() as f:
        for row in csv.DictReader(f):
            fy = int(row["fiscal_year"])
            if not (2002 <= fy <= 2024):
                continue
            gg = int(row["general_government"].replace(",", "")) if row["general_government"] else 0
            tot = int(row["total_expenditures"].replace(",", "")) if row["total_expenditures"] else 0
            if gg == 0 or tot == 0:
                continue
            out[(row["municipality"], fy)] = {"gg": gg, "total": tot}
    return out


def read_population():
    """Marblehead population by FY (FY02-FY24) and peer populations (current vintage)."""
    mh_pop = {}
    with (DATA / "demographics_FY01-24.csv").open() as f:
        for row in csv.DictReader(f):
            mh_pop[int(row["FY"])] = int(row["Population"])
    peer_pop = {}
    with (DATA / "dor_income_eqv_pop_FY27.csv").open() as f:
        for row in csv.DictReader(f):
            if row["municipality"] in COHORT:
                peer_pop[row["municipality"]] = int(row["population"])
    return mh_pop, peer_pop


def read_cpi():
    """Calendar-year CPI-U All Urban Consumers, US average."""
    cpi = {}
    with (DATA / "cpi_us.csv").open() as f:
        for row in csv.DictReader(f):
            cpi[int(row["year"])] = float(row["cpi_u"])
    return cpi


def linspace(start, end, n):
    """n evenly spaced floats from start to end inclusive."""
    if n == 1:
        return [start]
    step = (end - start) / (n - 1)
    return [round(start + i * step, 2) for i in range(n)]


def y_for(value, vmin, vmax):
    """Map a value to a Y coordinate (top=CHART_TOP, bottom=CHART_BOTTOM)."""
    if vmax == vmin:
        return CHART_BOTTOM
    frac = (value - vmin) / (vmax - vmin)
    return round(CHART_BOTTOM - frac * (CHART_BOTTOM - CHART_TOP), 1)


def main():
    sched = read_schedule_a()
    mh_pop, peer_pop = read_population()
    cpi = read_cpi()

    years = list(range(2002, 2025))
    x_positions = linspace(CHART_LEFT, CHART_RIGHT, len(years))

    # ── View 1: indexed (FY02 = 100) ────────────────────────────────────
    mh_gg_base = sched[("Marblehead", 2002)]["gg"]
    mh_total_base = sched[("Marblehead", 2002)]["total"]
    cpi_base = cpi[2002]

    mh_gg_idx = [round(sched[("Marblehead", fy)]["gg"] / mh_gg_base * 100, 1) for fy in years]
    mh_total_idx = [round(sched[("Marblehead", fy)]["total"] / mh_total_base * 100, 1) for fy in years]
    cpi_idx = [round(cpi[fy] / cpi_base * 100, 1) for fy in years]

    v1_min = min(mh_gg_idx + mh_total_idx + cpi_idx)
    v1_max = max(mh_gg_idx + mh_total_idx + cpi_idx)
    # Round axis bounds to clean increments of 25.
    v1_axis_min = (int(v1_min) // 25) * 25
    v1_axis_max = ((int(v1_max) // 25) + 1) * 25

    def to_points(values, vmin, vmax):
        return " ".join(f"{x},{y_for(v, vmin, vmax)}" for x, v in zip(x_positions, values))

    view1 = {
        "x_labels": [f"FY{fy % 100:02d}" for fy in years],
        "x_positions": x_positions,
        "y_axis_min": v1_axis_min,
        "y_axis_max": v1_axis_max,
        "series": [
            {"name": "Marblehead general government", "className": "s-emphasis",
             "values": mh_gg_idx,
             "points": to_points(mh_gg_idx, v1_axis_min, v1_axis_max)},
            {"name": "Marblehead total expenditures", "className": "s-revenue",
             "values": mh_total_idx,
             "points": to_points(mh_total_idx, v1_axis_min, v1_axis_max)},
            {"name": "CPI-U (US, all items)", "className": "s-neutral",
             "values": cpi_idx,
             "points": to_points(cpi_idx, v1_axis_min, v1_axis_max)},
        ],
    }

    # ── View 2: real per-capita (2024 dollars) ──────────────────────────
    cpi_2024 = cpi[2024]
    real_pc = []
    for fy in years:
        gg = sched[("Marblehead", fy)]["gg"]
        pop = mh_pop[fy]
        real_dollars = gg * (cpi_2024 / cpi[fy])
        real_pc.append(round(real_dollars / pop, 0))

    v2_axis_min = (int(min(real_pc)) // 25) * 25
    v2_axis_max = ((int(max(real_pc)) // 25) + 2) * 25
    mean_v2 = round(sum(real_pc) / len(real_pc), 0)

    view2 = {
        "x_labels": view1["x_labels"],
        "x_positions": x_positions,
        "y_axis_min": v2_axis_min,
        "y_axis_max": v2_axis_max,
        "mean_value": mean_v2,
        "mean_y": y_for(mean_v2, v2_axis_min, v2_axis_max),
        "values": real_pc,
        "points": " ".join(f"{x},{y_for(v, v2_axis_min, v2_axis_max)}"
                           for x, v in zip(x_positions, real_pc)),
    }

    # ── View 3: peer comparison FY24 ─────────────────────────────────────
    rows = []
    for town in COHORT:
        gg = sched[(town, 2024)]["gg"]
        pop = peer_pop[town]
        rows.append({
            "town": town,
            "gg_pc": round(gg / pop, 0),
            "gg_pct_total": round(sched[(town, 2024)]["gg"] / sched[(town, 2024)]["total"] * 100, 2),
        })
    rows.sort(key=lambda r: r["gg_pc"])
    marblehead_rank = next(i for i, r in enumerate(rows, start=1) if r["town"] == "Marblehead")
    view3 = {
        "rows": rows,
        "marblehead_rank": marblehead_rank,
        "n_towns": len(rows),
    }

    print(json.dumps({"view1": view1, "view2": view2, "view3": view3}, indent=2))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make the script executable and run it**

Run from the repo root:

```bash
chmod +x data/build_general_government_chart_data.py
python3 data/build_general_government_chart_data.py > /tmp/gg_chart_values.json
cat /tmp/gg_chart_values.json | python3 -m json.tool | head -40
```

Expected: clean JSON with `view1`, `view2`, `view3` keys. Marblehead's FY24 GG indexed value should be ~191 (3.31M / 1.73M = 1.91), Marblehead's FY24 total expenditures indexed ~194, CPI ~174. Marblehead's FY24 real per-capita value should fall in the $150-$170 range. View 3 should show Marblehead with the lowest GG per capita of the 9 towns, around $161/capita.

- [ ] **Step 3: Commit the script**

```bash
git add data/build_general_government_chart_data.py
git commit -m "Add Schedule A general government chart data builder"
```

---

### Task 2: Create the page skeleton

**Files:**
- Create: `charts/general_government_over_time.html`

- [ ] **Step 1: Create the file**

```html
---
title: "General Government Over Time"
scripts: [chart-tooltip]
og_title: "General government spending in Marblehead, FY2002-FY2024"
og_description: "Marblehead's general government spending grew 92% over 22 years, slightly slower than the rest of the town budget and roughly in line with inflation. In FY24 it was 3.3% of the budget — the lowest share among nine wealthy Massachusetts suburbs."
og_url: https://marbleheaddata.org/charts/general_government_over_time.html
---
<h1 class="h-center">General Government Spending Over Time</h1>
<p class="subtitle h-center">Marblehead, FY2002&ndash;FY2024. Source: Massachusetts <abbr class="g" title="Department of Revenue">DOR</abbr> Schedule A municipal expenditure reports, <abbr class="g" title="Bureau of Labor Statistics">BLS</abbr> CPI-U All Urban Consumers (US), and <abbr class="g" title="Department of Revenue">DOR</abbr> per-capita income and population dataset.</p>

<p>"General government" is the budget category covering the select board, town administrator, finance department, town clerk, assessor, IT, legal, and treasurer/collector. It's a frequent target in override debates. Three views of the underlying state data show how it has actually moved over 22 years, what residents pay for it per person in real dollars, and where Marblehead sits compared to similar towns.</p>

<!-- View 1, definitional callout, View 2, View 3, Read next added in subsequent tasks -->
```

- [ ] **Step 2: Build the site and verify the page renders**

```bash
bundle exec jekyll build
ls _site/charts/general_government_over_time.html
```

Expected: file exists. Open in browser via `npm run dev` and confirm the H1, subtitle, and intro paragraph render with site nav and footer.

- [ ] **Step 3: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Scaffold General Government Over Time chart page"
```

---

### Task 3: Build View 1 — Indexed growth, FY02-FY24

**Files:**
- Modify: `charts/general_government_over_time.html`

This view shows three indexed lines (FY02 = 100): Marblehead general government, Marblehead total expenditures, and US CPI-U. Use the values from `/tmp/gg_chart_values.json` (`view1`).

- [ ] **Step 1: Append the View 1 section**

Replace the `<!-- View 1, ... -->` comment with the full View 1 block. Use the actual computed `points` strings, `x_positions`, `values`, `y_axis_min`, and `y_axis_max` from the JSON. The block below shows the structure; substitute concrete numbers from the JSON output.

```html
<h2 class="h-center">1. Indexed growth: general government vs. the rest of the budget</h2>

<div class="legend">
  <div class="legend-item s-emphasis"><span class="legend-swatch"></span><span class="legend-text">Marblehead general government</span></div>
  <div class="legend-item s-revenue"><span class="legend-swatch"></span><span class="legend-text">Marblehead total expenditures</span></div>
  <div class="legend-item s-neutral"><span class="legend-swatch"></span><span class="legend-text">CPI-U (US, all items)</span></div>
</div>

<div class="chart-wrapper" data-chart-tooltip>
  <script type="application/json" class="chart-tooltip-data">
  {
    "xLabels": ["FY02","FY03","FY04","FY05","FY06","FY07","FY08","FY09","FY10","FY11","FY12","FY13","FY14","FY15","FY16","FY17","FY18","FY19","FY20","FY21","FY22","FY23","FY24"],
    "xPositions": [/* paste view1.x_positions from JSON */],
    "valueDecimals": 1,
    "series": [
      {"name": "General government", "className": "s-emphasis",
       "values": [/* view1.series[0].values */]},
      {"name": "Total expenditures", "className": "s-revenue",
       "values": [/* view1.series[1].values */]},
      {"name": "CPI-U", "className": "s-neutral",
       "values": [/* view1.series[2].values */]}
    ]
  }
  </script>
  <svg class="chart" viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three lines from FY2002 to FY2024 indexed to FY02=100. Marblehead general government, total town expenditures, and US CPI-U end at roughly 192, 194, and 174 respectively.">
    <line class="axis-base" x1="60" y1="246" x2="620" y2="246"/>

    <!-- Y-axis ticks: FROM JSON, render ticks every 25 indexed points between view1.y_axis_min and view1.y_axis_max. Compute y position using linear interpolation: y = 246 - ((value - axis_min) / (axis_max - axis_min)) * (246 - 42). -->
    <!-- Example: if axis_min=100, axis_max=200, the tick at 100 lives at y=246, the tick at 150 at y=144, the tick at 200 at y=42. Render labels right-aligned at x=53. -->

    <text class="tick-label tick-label--major" x="60"  y="292" text-anchor="middle">FY02</text>
    <text class="tick-label tick-label--minor" x="140" y="292" text-anchor="middle">FY05</text>
    <text class="tick-label tick-label--minor" x="220" y="292" text-anchor="middle">FY08</text>
    <text class="tick-label tick-label--major" x="300" y="292" text-anchor="middle">FY11</text>
    <text class="tick-label tick-label--minor" x="380" y="292" text-anchor="middle">FY14</text>
    <text class="tick-label tick-label--minor" x="460" y="292" text-anchor="middle">FY17</text>
    <text class="tick-label tick-label--major" x="540" y="292" text-anchor="middle">FY20</text>
    <text class="tick-label tick-label--major" x="620" y="292" text-anchor="middle">FY24</text>

    <polyline class="data-line s-emphasis" points="/* view1.series[0].points */"/>
    <polyline class="data-line s-revenue"  points="/* view1.series[1].points */"/>
    <polyline class="data-line s-neutral"  points="/* view1.series[2].points */"/>
  </svg>
</div>

<div class="caption">
  <p>Marblehead's general government spending grew from $1.73M in FY02 to $3.31M in FY24, a 92% increase. Total town expenditures grew 94% over the same period. The US CPI-U rose 74%. General government tracked total spending closely and slightly outpaced inflation.</p>
  <p>Source: <a href="https://www.mass.gov/info-details/dls-public-databases-and-data-tools" rel="external">Massachusetts <abbr class="g" title="Department of Revenue">DOR</abbr> Division of Local Services Schedule A</a> (per-municipality expenditures by function) and <a href="https://www.bls.gov/cpi/" rel="external"><abbr class="g" title="Bureau of Labor Statistics">BLS</abbr> CPI-U</a>. Local file: <code>data/peer_schedule_a_expenditures.csv</code>, <code>data/cpi_us.csv</code>.</p>
</div>
```

**Implementation note on Y-axis ticks:** for the Y-axis ticks, calculate positions inline. If `view1.y_axis_min = 100` and `view1.y_axis_max = 200`, render ticks at 100, 125, 150, 175, 200 with y values computed by `y = 246 - ((tick - 100) / 100) * 204`. Use `<line class="tick" x1="56" y1="..." x2="60" y2="..."/>` paired with `<text class="tick-label" x="53" y="..." text-anchor="end">VALUE</text>`. Mirror the exact pattern shown in `charts/healthcare_costs.html:42-49`.

- [ ] **Step 2: Visual check**

Run `npm run dev`, open `http://localhost:4000/charts/general_government_over_time.html`. Verify three lines render, ascending left to right. Marblehead GG line and total expenditures line should track each other closely; CPI line should sit slightly below both at the right edge. Hover should show year and indexed value tooltip.

- [ ] **Step 3: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Add View 1 (indexed growth) to General Government chart page"
```

---

### Task 4: Add the definitional callout

**Files:**
- Modify: `charts/general_government_over_time.html`

This box appears between View 1 and View 2. It explains why this page's $3.3M figure differs from the $6.89M residents see on `budget_flow.html` and at Town Meeting.

- [ ] **Step 1: Append the callout block immediately after View 1's caption**

```html
<aside class="callout">
  <h3>Why this number is different from $6.89M</h3>
  <p>Marblehead's FY27 internal budget shows about $6.89M for "general government." This page shows $3.31M for FY24 because it uses the state <abbr class="g" title="Department of Revenue">DOR</abbr>'s Schedule A category, which classifies some functions Marblehead groups under general government locally (notably facilities and shared services) under different headings. The state definition is the only one that lets us compare 351 municipalities on the same line, so it's the basis for the long time series and the peer chart below. For the local FY27 figure see <a href="budget_flow.html">Where the money goes</a>.</p>
</aside>
```

If `assets/site.css` does not yet have `.callout` styling, reuse an existing pattern. Run `grep -nE "\.callout|aside" assets/site.css` to check; if `.callout` is not defined, replace `class="callout"` with whatever the project already uses for inline notes (search `tldr`, `note-block`, or similar in other chart pages — `charts/healthcare_costs.html` uses bare `<div class="caption">` paragraphs for similar inline asides).

- [ ] **Step 2: Visual check**

Reload page. Callout block should be visually distinct from the body text (background, border, or indent) without inline `style=""` attributes.

- [ ] **Step 3: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Add definitional callout reconciling \$3.3M vs \$6.89M"
```

---

### Task 5: Build View 2 — Real per-capita

**Files:**
- Modify: `charts/general_government_over_time.html`

Single-series line chart: Marblehead general government in 2024 dollars per resident, FY02-FY24, with a horizontal mean line for context.

- [ ] **Step 1: Append the View 2 section**

After the callout, add:

```html
<h2 class="h-center">2. Real spending per resident, in 2024 dollars</h2>

<p>Adjusted for inflation and Marblehead's resident population each year, this is what general government cost the average Marblehead resident.</p>

<div class="chart-wrapper" data-chart-tooltip>
  <script type="application/json" class="chart-tooltip-data">
  {
    "xLabels": ["FY02","FY03","FY04","FY05","FY06","FY07","FY08","FY09","FY10","FY11","FY12","FY13","FY14","FY15","FY16","FY17","FY18","FY19","FY20","FY21","FY22","FY23","FY24"],
    "xPositions": [/* view2.x_positions */],
    "valuePrefix": "$",
    "valueDecimals": 0,
    "series": [
      {"name": "GG per resident (2024 $)", "className": "s-emphasis",
       "values": [/* view2.values */]}
    ]
  }
  </script>
  <svg class="chart" viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Single line showing Marblehead general government spending per resident in 2024 dollars from FY2002 to FY2024. Mostly flat between $100 and $170 per resident with a peak around FY18.">
    <line class="axis-base" x1="60" y1="246" x2="620" y2="246"/>

    <!-- Y-axis ticks at every $25 between view2.y_axis_min and view2.y_axis_max. Same y-mapping formula as View 1. -->

    <!-- Mean reference line -->
    <line class="annotation-line" x1="60" y1="/* view2.mean_y */" x2="620" y2="/* view2.mean_y */" style="stroke-dasharray:2 4"/>
    <text class="annotation annotation--hide-sm" x="624" y="/* view2.mean_y + 4 */">23-yr mean: $/* view2.mean_value */</text>

    <text class="tick-label tick-label--major" x="60"  y="292" text-anchor="middle">FY02</text>
    <text class="tick-label tick-label--minor" x="140" y="292" text-anchor="middle">FY05</text>
    <text class="tick-label tick-label--minor" x="220" y="292" text-anchor="middle">FY08</text>
    <text class="tick-label tick-label--major" x="300" y="292" text-anchor="middle">FY11</text>
    <text class="tick-label tick-label--minor" x="380" y="292" text-anchor="middle">FY14</text>
    <text class="tick-label tick-label--minor" x="460" y="292" text-anchor="middle">FY17</text>
    <text class="tick-label tick-label--major" x="540" y="292" text-anchor="middle">FY20</text>
    <text class="tick-label tick-label--major" x="620" y="292" text-anchor="middle">FY24</text>

    <polyline class="data-line s-emphasis" points="/* view2.points */"/>
  </svg>
</div>

<div class="caption">
  <p>The 23-year mean is roughly $/* view2.mean_value */ per resident (2024 dollars). Real per-capita general government spending in FY24 is within the band Marblehead has paid for the past two decades. CPI deflator: <abbr class="g" title="Bureau of Labor Statistics">BLS</abbr> CPI-U All Urban Consumers, calendar year matched to fiscal year. Population from <code>data/demographics_FY01-24.csv</code>.</p>
</div>
```

Replace each `/* ... */` placeholder with the concrete value from the JSON.

- [ ] **Step 2: Visual check**

Reload page. Single line should be relatively flat (most values within $50 of the mean), no dramatic trend up or down. Mean line should be a dashed horizontal annotation near the middle of the chart.

- [ ] **Step 3: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Add View 2 (real per-capita) to General Government chart page"
```

---

### Task 6: Build View 3 — Peer comparison, FY24

**Files:**
- Modify: `charts/general_government_over_time.html`

Horizontal bar chart with 9 bars: Marblehead + 8-town wealthy-suburb cohort, sorted ascending by FY24 GG per capita.

- [ ] **Step 1: Append the View 3 section**

After View 2, add:

```html
<h2 class="h-center">3. How Marblehead compares to peer towns, FY24</h2>

<p>Nine wealthy Massachusetts suburbs ranked by general government spending per resident in FY24. Same cohort used on this site's <a href="peer_compensation.html">teacher compensation</a> page.</p>

<div class="chart-wrapper">
  <svg class="chart chart--bar" viewBox="0 0 760 /* compute: 60 + 9*36 */" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horizontal bar chart of FY24 general government spending per capita across nine wealthy Massachusetts suburbs. Marblehead is the lowest at about $161 per resident. Lexington is the highest at about $633.">
    <!-- Bars: render one row per town from view3.rows.
         Row N (0-indexed) baseline at y = 30 + N*36.
         Bar starts at x=160 and extends right by (gg_pc / max_gg_pc) * 480.
         Town label right-aligned at x=152, y centered on bar.
         Bar value labelled to the right of the bar at x=bar_end+8.
         Marblehead bar uses class "data-bar s-emphasis"; peers use "data-bar s-neutral".
    -->
    <!-- Concrete row example for Marblehead at rank 1 (lowest):
      <rect class="data-bar s-emphasis" x="160" y="20" width="/* (161/633)*480 = ~122 */" height="20"/>
      <text class="bar-label" x="152" y="34" text-anchor="end">Marblehead</text>
      <text class="bar-value" x="/* 160 + 122 + 8 */" y="34">$161</text>
    -->
  </svg>
</div>

<div class="caption">
  <p>Marblehead has the lowest general government spending per capita of the nine towns at $/* view3.rows[0].gg_pc */ per resident. Lexington and Wellesley are the highest, both above $500 per resident. As a share of total town expenditures, Marblehead's general government is /* view3.rows[0].gg_pct_total */%, also the lowest of the cohort. Source: FY24 Schedule A divided by FY27 <abbr class="g" title="Department of Revenue">DOR</abbr>-vintage population (towns' populations move under 2% over a few years; a small population revision would not change the rank order).</p>
</div>
```

If `chart--bar` and `data-bar` classes don't already exist in `assets/site.css`, check existing bar-chart pages first (`charts/per_capita_levy.html`, `charts/peer_compensation.html`) and reuse the established class pattern. Do not invent new class names; do not add inline `style=""`.

- [ ] **Step 2: Visual check**

Reload page. Nine bars stacked vertically, lowest to highest. Marblehead bar at top in the emphasis color. Town names left of bars, dollar values right of bars. No horizontal scroll on mobile (375px viewport).

- [ ] **Step 3: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Add View 3 (peer comparison) to General Government chart page"
```

---

### Task 7: Add Read-next block

**Files:**
- Modify: `charts/general_government_over_time.html`

- [ ] **Step 1: Append after View 3's caption**

```html
<div class="read-next">
  <div class="read-next-label">Read next</div>
  <a class="read-next-link" href="healthcare_costs.html">
    <div class="read-next-title">Why is health insurance outpacing the tax levy? &rarr;</div>
    <div class="read-next-desc">The single budget line growing faster than everything else, and why the town has limited control over it.</div>
  </a>
  <a class="read-next-link" href="budget_flow.html">
    <div class="read-next-title">Where does the money go in FY27? &rarr;</div>
    <div class="read-next-desc">Sankey of the proposed FY27 town budget. The "general government" slice on that page uses Marblehead's local definition.</div>
  </a>
  <a class="read-next-link" href="town_explorer.html">
    <div class="read-next-title">How do all 351 Massachusetts towns compare? &rarr;</div>
    <div class="read-next-desc">Filter, sort, and rank towns on dozens of fiscal measures.</div>
  </a>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add charts/general_government_over_time.html
git commit -m "Add Read-next block to General Government chart page"
```

---

### Task 8: Update SOURCE_LOOKUP.md

**Files:**
- Modify: `data/SOURCE_LOOKUP.md`

- [ ] **Step 1: Read the file first to find the right insertion point**

```bash
head -40 data/SOURCE_LOOKUP.md
grep -n "Schedule A\|peer_schedule_a" data/SOURCE_LOOKUP.md
```

If a Schedule A entry already exists, skip this task. If not, follow the existing entry pattern (one entry per file, with `**File:**`, `**Source:**`, `**Coverage:**`, `**Used by:**` sub-bullets — the exact shape varies; match what you see).

- [ ] **Step 2: Add the entry**

Insert at the right spot in the file (alphabetical or by-topic, whichever the file uses):

```markdown
### `peer_schedule_a_expenditures.csv`

**Source:** Massachusetts Department of Revenue Division of Local Services, Schedule A municipal expenditure reports. https://www.mass.gov/info-details/dls-public-databases-and-data-tools

**Coverage:** 17 towns (Marblehead + 16 peers), FY2002-FY2024. FY2025 is in the file but rows are zero-filled because the state has not yet released FY25 Schedule A.

**Columns:** `dor_code`, `municipality`, `fiscal_year`, then ten functional spending categories (`general_government`, `public_safety`, `education`, `public_works`, `human_services`, `culture_recreation`, `fixed_costs`, `intergov_assessments`, `other`, `debt_service`) and `total_expenditures`.

**Used by:** `charts/general_government_over_time.html`. Pull script: `pull_schedule_a.mjs`.

**Note on the "general government" category:** Schedule A's `general_government` is a state-standardized definition that lets all 351 Massachusetts municipalities be compared on the same line. It does not always match a town's internal budget grouping. For Marblehead in FY27, the local "general government" category is roughly twice the Schedule A value because some functions (notably facilities and shared services) are grouped differently locally.
```

- [ ] **Step 3: Commit**

```bash
git add data/SOURCE_LOOKUP.md
git commit -m "Document Schedule A source in SOURCE_LOOKUP"
```

---

### Task 9: Cross-link from `budget_flow.html`

**Files:**
- Modify: `charts/budget_flow.html`

- [ ] **Step 1: Find the General Government slice in the page**

```bash
grep -nE "General Government|gov.*label" charts/budget_flow.html | head -10
```

The slice has `id: 'gov'` (from earlier exploration). Find any descriptive text that mentions the `gov` slice and add an inline link.

- [ ] **Step 2: Add the cross-link**

Locate the prose paragraph that references general government (search for "general government" in the file body, not the SVG data). Append a sentence or wrap the existing reference:

```html
For the long-run trend on this category and a peer comparison, see <a href="general_government_over_time.html">General Government Over Time</a>.
```

If no such prose paragraph exists in `budget_flow.html`, skip the cross-link — do not invent a paragraph just to host the link. Surface the question to the user instead.

- [ ] **Step 3: Commit (only if a link was added)**

```bash
git add charts/budget_flow.html
git commit -m "Cross-link General Government Over Time from budget_flow"
```

---

### Task 10: Add smoke test entry

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Find an existing chart-page smoke test to copy the pattern**

```bash
grep -nE "healthcare_costs|peer_compensation|chart-page" tests/smoke-test.mjs
```

If an existing test loads chart pages and asserts content, follow that pattern. If no chart-page tests exist, add a minimal new test function.

- [ ] **Step 2: Add the test**

Pattern (insert before the runner that calls all `test*` functions):

```javascript
async function testGeneralGovernmentChart(page) {
  console.log('\n── General Government Over Time chart ──');
  await page.goto(SITE + '/charts/general_government_over_time.html', { waitUntil: 'domcontentloaded' });
  const h1 = await page.$('h1');
  const h1Text = h1 ? await h1.textContent() : '';
  /general government/i.test(h1Text)
    ? ok('H1 mentions general government')
    : fail('GG H1', `unexpected H1: ${h1Text}`);

  const sections = await page.$$('h2');
  sections.length >= 3
    ? ok(`${sections.length} H2 sections`)
    : fail('GG sections', `expected >= 3, got ${sections.length}`);

  const charts = await page.$$('svg.chart');
  charts.length >= 3
    ? ok(`${charts.length} charts`)
    : fail('GG charts', `expected >= 3, got ${charts.length}`);
}
```

Then call `await testGeneralGovernmentChart(page);` in the existing `main()` test runner alongside the other `test*` calls.

- [ ] **Step 3: Run the smoke tests locally**

Use the project's documented runner:

```bash
npm run test:local
```

Expected: all existing tests still pass, plus the three new GG assertions.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "Add smoke test for General Government chart page"
```

---

### Task 11: Capture proof-of-work screenshot

**Files:**
- Create: `proof/<branch-name>.png` (above-fold) and `proof/<branch-name>-full.png` (full page)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev &
sleep 5
curl -sI http://localhost:4000/charts/general_government_over_time.html | head -1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 2: Capture above-fold and full-page screenshots**

```bash
mkdir -p proof
BRANCH=$(git branch --show-current)
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/charts/general_government_over_time.html" \
  "proof/${BRANCH}.png"
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/charts/general_government_over_time.html" \
  "proof/${BRANCH}-full.png"
file "proof/${BRANCH}.png" "proof/${BRANCH}-full.png"
```

Expected output: both files report dimensions around 2880px wide. Above-fold should be roughly 2880x1800; full-page taller.

- [ ] **Step 3: Sanity-check the rendered output**

Open the above-fold screenshot. Verify:
- H1 reads "General Government Spending Over Time"
- Subtitle on one line at desktop width
- View 1 chart visible above the fold with three legend swatches and three lines
- No layout overflow (no horizontal scrollbar)

If any of those fail, fix the page before proceeding to commit and PR.

- [ ] **Step 4: Stop the dev server**

```bash
pkill -f "jekyll serve" || true
```

- [ ] **Step 5: Commit the proof artifacts**

```bash
git add proof/*.png
git commit -m "Add proof-of-work screenshots for General Government chart"
```

---

### Task 12: Open the PR

- [ ] **Step 1: Push the branch**

Use the PAT URL form on the first push (per project memory `feedback_pat_first_push`):

```bash
TOKEN=$(grep -E '^GITHUB_TOKEN=' /home/claude/marblehead/.env | cut -d= -f2-)
BRANCH=$(git branch --show-current)
git push "https://x-access-token:${TOKEN}@github.com/agbaber/marblehead.git" "${BRANCH}":"${BRANCH}"
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Add General Government Over Time chart" --body "$(cat <<'EOF'
## Summary

New chart page at `charts/general_government_over_time.html` with three views of Marblehead's DOR Schedule A general government spending:

- View 1: Indexed growth FY02-FY24 (GG vs total expenditures vs CPI)
- View 2: Real per-capita in 2024 dollars
- View 3: FY24 peer comparison vs the 8-town wealthy-suburb cohort

A definitional callout explains why the Schedule A figure ($3.31M FY24) differs from the $6.89M residents see at Town Meeting (different category boundaries).

## Spec and plan

- Spec: `docs/superpowers/specs/2026-04-29-general-government-over-time-design.md`
- Plan: `docs/superpowers/plans/2026-04-29-general-government-over-time.md`

## Preview URL

Cloudflare Pages preview will appear at the URL posted in the sticky preview comment once the workflow completes (~3-5 min).

**Reviewer paths:**
- `/charts/general_government_over_time.html` — the new page (start here)
- `/charts/budget_flow.html` — confirm the inline cross-link reads naturally

**Expected behavior:**
- Three SVG charts render at desktop and mobile widths
- Hover shows year + value tooltips on the line charts
- View 3 bars sorted ascending; Marblehead at the top in emphasis color
- Definitional callout reconciles $3.31M vs $6.89M

**Edge cases:**
- 375px viewport: no horizontal scroll
- Acronyms wrap with `<abbr>` on first use
- Caption attribution links resolve

## Test plan

- [ ] Smoke test passes locally (`npm run test:local`, 52+ pass / 0 fail)
- [ ] Above-fold and full-page proof screenshots committed under `proof/`
- [ ] Cloudflare preview URL added to the PR description once available

## Proof of Work

See `proof/<branch>.png` and `proof/<branch>-full.png` committed to this branch.

EOF
)"
```

- [ ] **Step 3: Wait for the Cloudflare preview, then update the PR body with the URL**

Per project memory `feedback_post_merge_flow`, link the preview URL when asking the user to review. Watch for the sticky `preview-url` comment, then:

```bash
PR=$(gh pr view --json number -q .number)
PREVIEW_URL=$(gh pr view "$PR" --json comments -q '.comments[] | select(.body | startswith("### Preview")) | .body' | grep -oE 'https://[^ )]+\.pages\.dev[^ )]*' | head -1)
echo "Preview: $PREVIEW_URL"
```

If empty, wait for the workflow to finish and re-run.

---

## Self-Review Notes

**Spec coverage:** All five spec sections (page location/shape, three views, definitional callout, data sources, style conformance, linking, out-of-scope) map to tasks. View 1/2/3 → Tasks 3/5/6. Definitional callout → Task 4. Sources → Task 8. Linking → Tasks 7, 9. Style conformance is enforced by reusing existing classes (no inline styles, `<abbr>` tags reused).

**Placeholder scan:** Each `/* ... */` in the SVG steps points to a specific JSON key from Task 1's output. The implementing agent runs the script, then substitutes — no actual placeholders ship to disk. The exact pattern (`/* view1.x_positions */`) is a paste marker, not a TBD.

**Type/name consistency:** The script output keys (`view1`, `view2`, `view3`, `series`, `points`, `values`, `x_positions`, `y_axis_min`, `y_axis_max`, `mean_value`, `mean_y`, `rows`, `gg_pc`, `gg_pct_total`, `marblehead_rank`, `n_towns`) are referenced consistently in subsequent tasks.

**Known unknowns flagged inline (not failures):**
- Task 4 may need to fall back to an existing class if `.callout` is not in the stylesheet.
- Task 6 reuses bar-chart classes from existing chart pages; the agent must look those up before inventing.
- Task 9 may skip the budget_flow cross-link if no prose paragraph exists to host it.
