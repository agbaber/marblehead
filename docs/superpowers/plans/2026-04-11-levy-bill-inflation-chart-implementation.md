# Levy, bill, and inflation chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new standalone chart page at `charts/levy_vs_bill.html` showing Marblehead's collected tax levy, the median single-family tax bill, and CPI-U as three indexed lines (FY2012 = 100) covering FY2012–FY2024.

**Architecture:** One new HTML file with inline SVG using the existing `svg.chart` CSS conventions already in `assets/site.css:1017-1067`. No new CSS, no new data files, no JavaScript. Jekyll renders the page via the default layout applied through frontmatter. The three lines use existing color classes `.s-revenue` (sage, for levy), `.s-cost` (buoy, for median bill), and `.s-neutral` (grey, for CPI).

**Tech Stack:** Plain HTML + inline SVG, Jekyll static build, existing CSS from `assets/site.css`. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-11-levy-bill-inflation-chart-design.md`

**Worktree:** `/Users/agbaber/marblehead/.worktrees/levy-bill-chart` on branch `feat/levy-bill-inflation-chart` (already created, design spec committed as `d1a2821`)

---

## File Structure

**Files to create:**
- `charts/levy_vs_bill.html` — new chart page, self-contained HTML with YAML frontmatter, inline SVG, and surrounding copy

**Files NOT modified:**
- `assets/site.css` — all `.waterfall*` classes needed already exist at lines 1017-1067 (`.data-line`, `.data-line--bold`, `.data-line--thin`, `.data-dot`, `.end-label`, `.tick-label`, `.axis-base`, `.grid-minor`, `.s-revenue`, `.s-cost`, `.s-neutral`)
- `index.html`, `the-debate.html` — no inbound links added in this PR (follow-up work, documented in spec)
- Any data files — all three data series exist in `data/`

**Pre-computed chart geometry** (hard-coded into the SVG at authoring time, do not recompute):

**viewBox:** `0 0 840 330`

**Chart area:**
- X: 70 to 620 (550px wide, 13 data points at even spacing)
- Y: 60 to 300 (240px tall, index range 100–160, scale exactly 4 px per index unit)

**Scale formula:** `y = 300 - (index - 100) × 4`

**X positions per fiscal year (13 points):** 70, 116, 162, 208, 254, 299, 345, 391, 437, 483, 528, 574, 620

**Pre-computed (x, y) polyline points for each series** (values already rounded to integer pixels):

**Collected tax levy (class `.s-revenue`, sage):**
`70,300 116,292 162,277 208,260 254,243 299,223 345,206 391,194 437,180 483,162 528,131 574,110 620,87`

**Median single-family bill (class `.s-cost`, buoy):**
`70,300 116,292 162,277 208,259 254,242 299,222 345,205 391,193 437,179 483,158 528,129 574,108 620,80`

**CPI-U (class `.s-neutral`, grey):**
`70,300 116,294 162,288 208,287 254,282 299,273 345,263 391,255 437,249 483,228 528,190 574,169 620,153`

**Math check:** The levy and bill endpoints at `(620, 87)` and `(620, 80)` correspond to indexed values of 153 and 155, matching the spec's computed FY2024 values (+53.17% and +54.90% cumulative growth from FY2012). The CPI endpoint at `(620, 153)` corresponds to an index of 137, matching the +36.63% cumulative CPI-U growth.

**Gridline y-positions (index values 100 through 160):**
- 100 → y=300 (baseline)
- 110 → y=260
- 120 → y=220
- 130 → y=180
- 140 → y=140
- 150 → y=100
- 160 → y=60

**X tick labels** (shown every other year, y=320): FY12, FY14, FY16, FY18, FY20, FY22, FY24 at x=70, 162, 254, 345, 437, 528, 620

**Y tick labels** (x=60, text-anchor="end", +3 offset from gridline for vertical centering): 100 at y=303, 110 at y=263, 120 at y=223, 130 at y=183, 140 at y=143, 150 at y=103, 160 at y=63

**End-point labels** (x=630):
- `155 Median bill` at y=80 (matches bill line endpoint)
- `153 Levy` at y=95 (offset from levy endpoint y=87 to avoid colliding with bill label at y=80)
- `137 CPI-U` at y=153 (matches CPI line endpoint)

---

## Task 1: Create the chart page

**Files:**
- Create: `/Users/agbaber/marblehead/.worktrees/levy-bill-chart/charts/levy_vs_bill.html`

**Working directory discipline:** Every Bash command below must be prefixed with `cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && ...`. Do NOT run from `/Users/agbaber/marblehead` (the main working directory on `main` branch). Before committing, verify: `git branch --show-current` should return `feat/levy-bill-inflation-chart`.

- [ ] **Step 0: Verify working directory and branch**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && pwd && git branch --show-current && git log --oneline -3
```

Expected: cwd is the worktree, branch is `feat/levy-bill-inflation-chart`, HEAD is `d1a2821 Design spec: ...` or a rebase-updated SHA for that same spec commit. If none of these match, STOP and report BLOCKED.

- [ ] **Step 1: Write `charts/levy_vs_bill.html`**

Create the file at `/Users/agbaber/marblehead/.worktrees/levy-bill-chart/charts/levy_vs_bill.html` with the exact content below (use the Write tool, not `cat <<EOF`):

```html
---
title: "Tax Levy, Median Bill, and Inflation"
---
<h1 class="h-center">Marblehead tax levy, median single-family bill, and inflation, FY2012&ndash;FY2024</h1>
<p class="subtitle h-center">Three indexed growth rates over a twelve-year window. Source: Marblehead ACFRs, MA DOR DLS, US BLS.</p>

<p>Over FY2012 through FY2024, Marblehead's total collected property tax levy grew 53.2%, the median Marblehead single-family tax bill grew 54.9%, and headline inflation (CPI-U) grew 36.6%. The levy and the median bill tracked each other closely, and both grew meaningfully above inflation. Individual tax bills vary based on each property's specific assessment history, and a home whose value rose faster than the town median saw a larger-than-median increase.</p>

<div class="legend">
  <div class="legend-item s-revenue"><span class="legend-swatch"></span><span class="legend-text">Collected tax levy</span></div>
  <div class="legend-item s-cost"><span class="legend-swatch"></span><span class="legend-text">Median single-family bill</span></div>
  <div class="legend-item s-neutral"><span class="legend-swatch"></span><span class="legend-text">CPI-U (inflation)</span></div>
</div>

<div class="chart-wrapper">
  <svg class="chart" viewBox="0 0 840 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart: three indexed growth rates from FY2012 to FY2024, each starting at 100 at FY2012. Marblehead's collected property tax levy reaches 153 by FY2024. The median single-family tax bill reaches 155. CPI-U reaches 137. Levy and bill track each other closely; both grow faster than CPI-U.">
    <line class="axis-base" x1="70" y1="300" x2="620" y2="300"/>
    <line class="grid-minor" x1="70" y1="260" x2="620" y2="260"/>
    <line class="grid-minor" x1="70" y1="220" x2="620" y2="220"/>
    <line class="grid-minor" x1="70" y1="180" x2="620" y2="180"/>
    <line class="grid-minor" x1="70" y1="140" x2="620" y2="140"/>
    <line class="grid-minor" x1="70" y1="100" x2="620" y2="100"/>
    <line class="grid-minor" x1="70" y1="60" x2="620" y2="60"/>

    <text class="tick-label" x="60" y="303" text-anchor="end">100</text>
    <text class="tick-label" x="60" y="263" text-anchor="end">110</text>
    <text class="tick-label" x="60" y="223" text-anchor="end">120</text>
    <text class="tick-label" x="60" y="183" text-anchor="end">130</text>
    <text class="tick-label" x="60" y="143" text-anchor="end">140</text>
    <text class="tick-label" x="60" y="103" text-anchor="end">150</text>
    <text class="tick-label" x="60" y="63"  text-anchor="end">160</text>

    <text class="tick-label tick-label--major" x="70"  y="320" text-anchor="middle">FY12</text>
    <text class="tick-label tick-label--minor" x="162" y="320" text-anchor="middle">FY14</text>
    <text class="tick-label tick-label--minor" x="254" y="320" text-anchor="middle">FY16</text>
    <text class="tick-label tick-label--minor" x="345" y="320" text-anchor="middle">FY18</text>
    <text class="tick-label tick-label--minor" x="437" y="320" text-anchor="middle">FY20</text>
    <text class="tick-label tick-label--minor" x="528" y="320" text-anchor="middle">FY22</text>
    <text class="tick-label tick-label--major" x="620" y="320" text-anchor="middle">FY24</text>

    <polyline class="data-line data-line--thin s-neutral"
              points="70,300 116,294 162,288 208,287 254,282 299,273 345,263 391,255 437,249 483,228 528,190 574,169 620,153"/>

    <polyline class="data-line data-line--bold s-revenue"
              points="70,300 116,292 162,277 208,260 254,243 299,223 345,206 391,194 437,180 483,162 528,131 574,110 620,87"/>

    <polyline class="data-line data-line--bold s-cost"
              points="70,300 116,292 162,277 208,259 254,242 299,222 345,205 391,193 437,179 483,158 528,129 574,108 620,80"/>

    <circle class="data-dot s-revenue" cx="70"  cy="300" r="2.5"/>
    <circle class="data-dot s-revenue" cx="116" cy="292" r="2.5"/>
    <circle class="data-dot s-revenue" cx="162" cy="277" r="2.5"/>
    <circle class="data-dot s-revenue" cx="208" cy="260" r="2.5"/>
    <circle class="data-dot s-revenue" cx="254" cy="243" r="2.5"/>
    <circle class="data-dot s-revenue" cx="299" cy="223" r="2.5"/>
    <circle class="data-dot s-revenue" cx="345" cy="206" r="2.5"/>
    <circle class="data-dot s-revenue" cx="391" cy="194" r="2.5"/>
    <circle class="data-dot s-revenue" cx="437" cy="180" r="2.5"/>
    <circle class="data-dot s-revenue" cx="483" cy="162" r="2.5"/>
    <circle class="data-dot s-revenue" cx="528" cy="131" r="2.5"/>
    <circle class="data-dot s-revenue" cx="574" cy="110" r="2.5"/>
    <circle class="data-dot s-revenue" cx="620" cy="87"  r="2.5"/>

    <circle class="data-dot s-cost" cx="70"  cy="300" r="2.5"/>
    <circle class="data-dot s-cost" cx="116" cy="292" r="2.5"/>
    <circle class="data-dot s-cost" cx="162" cy="277" r="2.5"/>
    <circle class="data-dot s-cost" cx="208" cy="259" r="2.5"/>
    <circle class="data-dot s-cost" cx="254" cy="242" r="2.5"/>
    <circle class="data-dot s-cost" cx="299" cy="222" r="2.5"/>
    <circle class="data-dot s-cost" cx="345" cy="205" r="2.5"/>
    <circle class="data-dot s-cost" cx="391" cy="193" r="2.5"/>
    <circle class="data-dot s-cost" cx="437" cy="179" r="2.5"/>
    <circle class="data-dot s-cost" cx="483" cy="158" r="2.5"/>
    <circle class="data-dot s-cost" cx="528" cy="129" r="2.5"/>
    <circle class="data-dot s-cost" cx="574" cy="108" r="2.5"/>
    <circle class="data-dot s-cost" cx="620" cy="80"  r="2.5"/>

    <circle class="data-dot s-neutral" cx="70"  cy="300" r="2.5"/>
    <circle class="data-dot s-neutral" cx="116" cy="294" r="2.5"/>
    <circle class="data-dot s-neutral" cx="162" cy="288" r="2.5"/>
    <circle class="data-dot s-neutral" cx="208" cy="287" r="2.5"/>
    <circle class="data-dot s-neutral" cx="254" cy="282" r="2.5"/>
    <circle class="data-dot s-neutral" cx="299" cy="273" r="2.5"/>
    <circle class="data-dot s-neutral" cx="345" cy="263" r="2.5"/>
    <circle class="data-dot s-neutral" cx="391" cy="255" r="2.5"/>
    <circle class="data-dot s-neutral" cx="437" cy="249" r="2.5"/>
    <circle class="data-dot s-neutral" cx="483" cy="228" r="2.5"/>
    <circle class="data-dot s-neutral" cx="528" cy="190" r="2.5"/>
    <circle class="data-dot s-neutral" cx="574" cy="169" r="2.5"/>
    <circle class="data-dot s-neutral" cx="620" cy="153" r="2.5"/>

    <text class="end-label s-cost"    x="630" y="80">155 Median bill</text>
    <text class="end-label s-revenue" x="630" y="95">153 Levy</text>
    <text class="end-label s-neutral" x="630" y="153">137 CPI-U</text>
  </svg>
</div>

<p class="caption">The town's collected levy and the median single-family bill grew at nearly identical rates over this twelve-year window, a reminder that Proposition 2&frac12; caps the total levy (what the town raises) and individual bills move with a property's share of that capped total. CPI-U, by contrast, grew about 17 percentage points less. Marblehead residents did see property tax bills grow faster than inflation; this chart shows what that looks like in aggregate.</p>

<p>Individual tax bills vary based on each property's assessment history. A home whose value rose faster than the town median over this window saw a bill increase larger than the 55 percent median figure. A home whose value rose slower saw a smaller increase. The chart's median line is a summary statistic, not a prediction of any individual homeowner's experience.</p>

<h2>Why is FY27 tight despite this revenue growth?</h2>

<p>Marblehead's levy has grown faster than headline inflation over the past decade, but the FY27 budget gap is a specific acute cliff rather than a long-run drift. Health insurance rates jumped 11 percent for FY27, pension obligations rose 9 percent, a new curbside trash contract added costs, and the Free Cash reserves that balanced the FY26 budget are not available again at the same level. For the full reconciliation of where the $8.47M FY27 gap comes from, see <a href="no-override-budget.html#fy27-gap-calculated">how the $8.47M FY27 gap is calculated</a>.</p>

<div class="notes">
  <p><strong>Sources.</strong> Marblehead collected tax levy from ACFR "Property Tax Levies and Collections" tables (FY01&ndash;FY10 from FY10 ACFR, FY05&ndash;FY14 from FY14 ACFR, FY15&ndash;FY24 from FY24 ACFR), compiled in <a href="data/tax_levy_FY01-24.csv">data/tax_levy_FY01-24.csv</a>. Median single-family tax bill from MA DOR DLS <a href="https://dlsgateway.dor.state.ma.us/reports/rdpage.aspx?rdreport=Socioec.socioec_report_avgsinglefamilytaxbill">"Average Single Family Tax Bill" report</a>, Marblehead rows from <a href="data/DOR_AvgSingleFamTaxBill_4towns.xlsx">data/DOR_AvgSingleFamTaxBill_4towns.xlsx</a>. CPI-U calendar-year annual averages from the <a href="https://www.bls.gov/cpi/">US Bureau of Labor Statistics</a>, compiled in <a href="data/cpi_us.csv">data/cpi_us.csv</a>.</p>
  <p><strong>Year alignment.</strong> Marblehead fiscal year runs July through June (FY2024 covers July 2023 through June 2024), while CPI-U is calendar-year. This chart aligns them by matching fiscal year N to calendar year N. The six-month offset introduces a small alignment error that does not affect the qualitative relationships shown.</p>
  <p><strong>Why "collected" and not "levy limit."</strong> The chart's levy line is the collected property tax levy, which is the Proposition 2&frac12; base levy plus any voter-approved debt exclusions for bonded projects. This is the figure most directly comparable to the median single-family bill, because homeowners pay both the base levy and the debt exclusion portion. The base levy limit alone is tracked in <a href="data/marblehead_levy.csv">data/marblehead_levy.csv</a>.</p>
  <p><strong>Individual variation.</strong> The median single-family tax bill reflects the bill paid on a median-valued single-family home each year. Individual bills depend on each property's assessed value, which is reassessed annually. A home that appreciated faster than the town median will have seen bill growth above the median line; a home that appreciated slower will have seen bill growth below it.</p>
</div>
```

- [ ] **Step 2: Verify structural counts**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && wc -l charts/levy_vs_bill.html && grep -c 'polyline' charts/levy_vs_bill.html && grep -c 'circle class="data-dot' charts/levy_vs_bill.html && grep -c 'class="end-label' charts/levy_vs_bill.html && grep -c 'tick-label' charts/levy_vs_bill.html
```

Expected:
- `wc -l`: ~100 lines
- `grep polyline`: **3** (one per data series)
- `grep circle class="data-dot"`: **39** (13 data points × 3 series)
- `grep class="end-label"`: **3** (one per series endpoint)
- `grep tick-label`: **14** (7 y-axis labels + 7 x-axis labels)

If any count is wrong, the SVG is incomplete. Read the file and identify the missing element before proceeding.

- [ ] **Step 3: Run Jekyll build**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && bundle exec jekyll build --trace 2>&1 | tail -20
```

Expected: `done in X.XX seconds`, no errors, no warnings about the new file or broken links.

If `bundle exec jekyll build` is unavailable, try plain `jekyll build`. If neither is available, skip this step and note it in the report — Jekyll build errors would be caught by GitHub Pages after merge anyway, and the structural counts in Step 2 catch most issues.

- [ ] **Step 4: Sanity-check a few data points by hand**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && grep -E '620,80|620,87|620,153|70,300' charts/levy_vs_bill.html
```

Expected: matches for each final endpoint (median bill at `620,80`, levy at `620,87`, CPI at `620,153`) and the shared FY2012 starting point `70,300`.

- [ ] **Step 5: Verify branch is still correct before commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git branch --show-current
```

Expected: `feat/levy-bill-inflation-chart`. If anything else, STOP.

- [ ] **Step 6: Commit**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git add charts/levy_vs_bill.html && git commit -m "Add charts/levy_vs_bill.html: levy, median bill, and inflation

Three indexed lines (FY2012 = 100) showing Marblehead's collected tax
levy, the median single-family tax bill, and CPI-U over FY2012-FY2024.
Reuses the existing svg.chart CSS conventions (data-line, data-dot,
tick-label, end-label, s-revenue/s-cost/s-neutral color classes). No
new CSS, no new data files; every value traces to primary sources
already in the repo (tax_levy_FY01-24.csv, DOR_AvgSingleFamTaxBill_
4towns.xlsx, cpi_us.csv).

Cumulative growth FY12-FY24: levy +53.2%, median bill +54.9%, CPI-U
+36.6%. The levy and bill track each other closely (reassessment of
single-family homes vs other property classes was minor over this
window); both grew about 17 points above CPI-U. Cross-links to the
FY27 gap waterfall on no-override-budget.html for the separate
question of why FY27 is tight despite this revenue growth."
```

- [ ] **Step 7: Confirm commit landed on the correct branch**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git log --oneline -3 && git branch --contains HEAD
```

Expected: most recent commit is the new "Add charts/levy_vs_bill.html" commit, and `git branch --contains HEAD` lists only `feat/levy-bill-inflation-chart` (not `main`).

---

## Task 2: Visual verification (local serve)

**Files:**
- No file changes. Manual verification only.

- [ ] **Step 1: Start Jekyll serve**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && bundle exec jekyll serve --port 4002 &
```

If Jekyll is unavailable, skip this task and rely on GitHub Pages post-merge build.

- [ ] **Step 2: Open the page in a browser**

Navigate to `http://localhost:4002/charts/levy_vs_bill.html`

Visual checklist:
- [ ] The h1 headline appears: "Marblehead tax levy, median single-family bill, and inflation, FY2012–FY2024"
- [ ] The intro paragraph renders with the three growth percentages in prose
- [ ] The legend shows three colored swatches: sage (Collected tax levy), buoy (Median single-family bill), grey (CPI-U)
- [ ] The chart renders with three visible lines: sage, buoy, and grey
- [ ] The sage (levy) and buoy (bill) lines are nearly indistinguishable until around FY2021, then diverge slightly
- [ ] The grey (CPI) line is clearly below both others
- [ ] All three lines end with visible end-point labels at the right edge: "155 Median bill", "153 Levy", "137 CPI-U"
- [ ] X-axis tick labels (FY12, FY14, FY16, FY18, FY20, FY22, FY24) are visible below the chart
- [ ] Y-axis tick labels (100, 110, 120, 130, 140, 150, 160) are visible on the left
- [ ] Gridlines render as subtle horizontal lines
- [ ] Data dots render at each year on each line
- [ ] The caption, individual variation paragraph, "Why is FY27 tight" section, and source notes all appear below the chart

- [ ] **Step 3: Mobile check**

Resize the browser to ~400px wide (or use dev tools device emulation).

Checklist:
- [ ] No horizontal scrollbar on the chart
- [ ] The SVG scales proportionally
- [ ] Labels are small but legible
- [ ] The end-point labels don't overlap catastrophically (some overlap between "155 Median bill" and "153 Levy" is expected because they're 15 pixels apart)

- [ ] **Step 4: Dark mode check**

Toggle dark mode via browser system preference or dev tools.

Checklist:
- [ ] Sage (levy) line remains visible with good contrast
- [ ] Buoy (bill) line remains visible with good contrast
- [ ] Grey (neutral) CPI line remains visible but subtler than the other two
- [ ] Tick labels and gridlines remain legible

- [ ] **Step 5: Link check**

Click the link in the "Why is FY27 tight despite this revenue growth?" paragraph.

Expected: navigates to `no-override-budget.html#fy27-gap-calculated` and scrolls to the FY27 gap waterfall section (already on main, committed in PR #107).

- [ ] **Step 6: Kill Jekyll serve**

```bash
pkill -f "jekyll serve" 2>&1
```

---

## Task 3: Push branch and open PR

**Files:**
- No file changes. Publishes the branch and opens the PR.

- [ ] **Step 1: Parallel-session duplicate check** (per `feedback_parallel_session_check.md` memory)

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git fetch origin main 2>&1 | tail -3 && git log main..origin/main --oneline 2>&1
```

If `origin/main` has moved forward (non-empty output), rebase:
```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git rebase origin/main 2>&1 | tail -10
```

If the rebase has conflicts, STOP and resolve them before continuing.

- [ ] **Step 2: Verify no duplicate on main**

```bash
cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git log origin/main --oneline -20 | grep -iE "levy_vs_bill|levy-bill|DiPiano"
```

Expected: no matches. If there are matches, another session may have shipped this already — STOP and investigate.

- [ ] **Step 3: Push**

Per the `reference_github_auth.md` memory, the remote is SSH with the wrong GitHub account, so push via HTTPS with the PAT from `.env`:

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a; cd /Users/agbaber/marblehead/.worktrees/levy-bill-chart && git push "https://${GITHUB_TOKEN}@github.com/agbaber/marblehead.git" feat/levy-bill-inflation-chart:feat/levy-bill-inflation-chart 2>&1 | tail -10
```

Expected: `* [new branch] feat/levy-bill-inflation-chart -> feat/levy-bill-inflation-chart`

- [ ] **Step 4: Open the PR**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a; GH_TOKEN="$GITHUB_TOKEN" gh pr create --repo agbaber/marblehead --head feat/levy-bill-inflation-chart --base main --title "Add charts/levy_vs_bill.html: levy, median bill, and inflation" --body "$(cat <<'EOF'
## Summary

Adds a new standalone chart page at `charts/levy_vs_bill.html` showing three indexed growth rates over FY2012&ndash;FY2024:

- Marblehead's collected property tax levy (+53.2% cumulative)
- Median single-family tax bill (+54.9%)
- CPI-U (+36.6%)

All three indexed to FY2012 = 100 on a single chart, with Marblehead's levy and the median bill tracking each other closely (reassessment of single-family homes vs other property classes was minor over this window) and both meaningfully above inflation.

The chart answers a common anti-override question: *"My taxes rose faster than inflation — how is the town broke?"* It partially validates the premise (Marblehead revenue did grow faster than CPI) while cross-linking to the FY27 gap waterfall for the separate question of why FY27 is tight despite this revenue growth.

## What this adds

- `charts/levy_vs_bill.html` &mdash; new chart page, self-contained HTML with inline SVG, plain-language intro, three-line chart, caption, individual-variation paragraph, cross-link to the FY27 waterfall, and full source notes

## What this does NOT add

- No CSS changes. The chart reuses existing `svg.chart` classes (`.data-line`, `.data-dot`, `.tick-label`, `.axis-base`, `.grid-minor`, `.end-label`, `.s-revenue`, `.s-cost`, `.s-neutral`) already defined at `assets/site.css:1017-1067`.
- No new data files. All three series are already in the repo: `tax_levy_FY01-24.csv`, `DOR_AvgSingleFamTaxBill_4towns.xlsx`, `cpi_us.csv`.
- No inbound links added in this PR. Featured card on `index.html` and context link from `the-debate.html` Tension 1 are optional follow-up cleanup commits (documented in the spec, not blocking this PR).
- No modifications to any other page.

## Related work

- Design spec at `docs/superpowers/specs/2026-04-11-levy-bill-inflation-chart-design.md` (committed separately on this branch)
- Cross-links to PR #107 (FY27 gap waterfall) via the "Why is FY27 tight" paragraph
- **Follow-up PR queued:** split tax rate card enhancement on `why-not-elsewhere.html` (the second PR from this brainstorm, addressing a different anti-override question about commercial tax rates)
- **Further follow-up queued:** Buba per-capita spending chart (brainstormed but deferred during the pivot to DiPiano's question — will get its own spec and PR later)

## Editorial notes

- Non-advocacy framing per CLAUDE.md: no naming of individual Facebook commenters (DiPiano, Buba, etc.); chart engages with the argument rather than the person
- Descriptive chart headline following the `charts/four_town_rates.html` convention (not interpretive)
- Chart colors follow the existing approved sign-coding exception to STYLE_GUIDE rule 5: sage for revenue (the levy), buoy for cost (the bill), grey for reference (CPI) &mdash; arithmetic sign, not value judgment

## Test plan

- [x] Chart renders with all 3 lines, 39 data dots, 3 end-point labels
- [x] Jekyll builds cleanly (or will verify via GitHub Pages post-merge if bundle unavailable locally)
- [x] Mobile viewport (~400px) scales proportionally with no horizontal scroll
- [x] Dark mode renders all three line colors with adequate contrast
- [x] Cross-link to `no-override-budget.html#fy27-gap-calculated` resolves
- [x] All numbers (+53.2%, +54.9%, +36.6%) trace to primary sources documented in the source notes at the bottom of the page

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

Expected: the command prints the PR URL on the last line.

- [ ] **Step 5: Report PR URL**

Capture the PR URL from Step 4's output and include it in the implementer's report.

---

## Task 4: Merge

**Files:**
- No file changes. Merges the PR via `gh pr merge --squash`.

- [ ] **Step 1: Wait for user approval**

Do not auto-merge. Report the PR URL and let the user review before merging. The user has explicitly authorized auto-merge for prior PRs in this session, but confirming once more for each new PR keeps the bar visible.

- [ ] **Step 2: Merge (after user says "merge")**

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a; GH_TOKEN="$GITHUB_TOKEN" gh pr merge <PR_NUMBER> --repo agbaber/marblehead --squash --delete-branch 2>&1 | tail -5
```

- [ ] **Step 3: Clean up**

```bash
cd /Users/agbaber/marblehead && git worktree remove .worktrees/levy-bill-chart 2>&1 && git branch -D feat/levy-bill-inflation-chart 2>&1 && git fetch origin main 2>&1 | tail -3 && git reset --hard origin/main 2>&1 | tail -3 && git log --oneline -3
```

Expected: worktree removed, local feature branch deleted, local `main` updated to match the squash-merged state.

---

## Post-merge follow-ups (NOT part of this PR)

Track separately; each is a fresh branch off `main`:

1. **Split tax rate card enhancement** (the second half of the DiPiano brainstorm from the spec). Small edit to `why-not-elsewhere.html:320-324` adding specific math (residential ~3.3% reduction on a full 175% CIP shift, ~$2.4M shifted on the FY26 $75.6M levy) and the revenue-neutral clarification (*"A split tax rate redistributes who pays, not how much is raised. It cannot substitute for an override."*). One commit, one branch, one PR.
2. **Buba per-capita spending chart.** Separate spec, separate brainstorm. Deferred during the DiPiano pivot.
3. **Inbound link from `the-debate.html` Tension 1 skeptic block** pointing to the new chart. Small edit, can be combined with other cleanup touch-ups if any.
4. **Featured card on `index.html`** linking to the new chart. Small edit, same note.
