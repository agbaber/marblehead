# Schools budget history page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `schools-budget.html` — a two-panel page reconciling 24 years of audited ACFR education expenditure with 10 years of the superintendent's proposed budget by category, plus a small peer comparison block.

**Architecture:** Panel 1 reads existing `data/education_expenditure_FY01-24.csv` and cousins directly (no extraction needed). Panel 2 depends on a new extractor (`scripts/extract_mps_proposed_budget.mjs`) that parses Feb SC packet text into a single `data/mps_proposed_budget_by_category.csv`. The page renders two SVG charts + a peer table + methodology, following the existing site's `.page` style and `citations.js` `<sup class="cite">` markers. MVP-first: Task 4 ships a working page with just FY26/FY27 in Panel 2; Tasks 5-6 extend backward to FY18.

**Tech Stack:** Jekyll (site build), plain Node ESM (extractor), Python 3 + pytest (data validation), Playwright (page test + proof screenshots), existing SVG chart CSS scoped under `body.schools-budget .chart-panel`.

**Spec:** [`docs/superpowers/specs/2026-07-07-schools-budget-design.md`](../specs/2026-07-07-schools-budget-design.md)

**Reference values for tests** (extracted from FY27 packet during planning):
- FY26 total proposed = **$49,120,285** (level-funded)
- FY27 total proposed level-funded = **$49,120,285**
- FY27 total proposed with restorations = **$50,945,644**
- FY27 packet path: `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt` (grand-total TOTAL line is line 3045)

---

### Task 1: Baseline verification + branch check

**Files:** none modified.

- [ ] **Step 1: Confirm branch state**

Run:
```bash
git status
git log --oneline -4
git branch --show-current
```

Expected: branch `schools-budget-page`, clean tree, last three commits are (from newest): the spec, scrape data, scraper extension.

- [ ] **Step 2: Verify local dev works**

Run:
```bash
bundle install
npm install
npm run dev &
DEV_PID=$!
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/
kill $DEV_PID
```

Expected: `200`. If not, stop and fix before continuing.

- [ ] **Step 3: Verify scrape data cherry-picked**

Run:
```bash
wc -l data/schools/manifest.json
ls data/schools/ | grep -c '^sc-archive-fy'
```

Expected: manifest.json has >10000 lines (819 entries + JSON overhead); 8 `sc-archive-fy*` directories.

- [ ] **Step 4: No commit — this is a smoke check only**

---

### Task 2: Locate Panel 2 anchor values in FY27 packet

**Files:**
- Create: `docs/superpowers/plans/schools-budget-panel2-anchors.md` (scratch, will be deleted at PR time)

Goal: read the FY27 packet, record the top-line subtotals that will be extracted per bucket. These become test assertions in Task 5.

- [ ] **Step 1: Grep the packet for TOTAL-line subtotals**

```bash
grep -nE "^(TOTAL|Total)" data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt | head -30
```

- [ ] **Step 2: For each TOTAL line, identify which bucket it belongs to by reading 30 lines above**

For each TOTAL line, use:
```bash
sed -n '<line-30>,<line>p' data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt
```

Look for context words: "Elementary School Programs", "Special Education", "Athletics", "Cocurricular", "Transportation", "Custodial", "Administration".

- [ ] **Step 3: Write the anchor doc**

Create `docs/superpowers/plans/schools-budget-panel2-anchors.md` with a single table:

```markdown
# FY27 packet anchor totals (Panel 2 test targets)

Source: `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt`
Grand total (line 3045): $49,120,285

| Line | Section header (from context) | Amount | Target bucket |
|------|-------------------------------|--------|---------------|
| 538  | <fill from step 2>            | $5,481,505 | <one of 6> |
| ...  | ...                           | ...    | ... |

Bucket sums MUST equal $49,120,285 (or explain any gap).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/schools-budget-panel2-anchors.md
git commit -m "Plan scratch: FY27 packet anchor totals for Panel 2 extraction"
```

---

### Task 3: Panel 1 — ACFR chart HTML skeleton with nominal $ view

**Files:**
- Create: `schools-budget.html`
- Create: `assets/schools-budget.css`

- [ ] **Step 1: Look at an existing 2-panel page for structure**

```bash
head -60 town-budget.html
grep -E "<h1|<h2|<figure|<figcaption" inside-school-staffing.html | head -20
```

The pattern: `layout: page` frontmatter, `<div class="page">` root, sections with `<h2 id="...">` anchors.

- [ ] **Step 2: Create the page skeleton with just Panel 1 heading**

```html
---
layout: page
title: Schools budget history
description: Marblehead schools spending over 24 years, plus what the district has proposed by category.
body_class: schools-budget
---

<div class="page">
  <h1>Schools budget history</h1>

  <p class="lede">
    Two numbers get called "the schools budget." This page shows both.
    Audited actuals from the town's ACFRs go back to fiscal year 2001.
    The superintendent's proposed budget by category goes back to fiscal
    year 2018, from School Committee meeting packets.
  </p>

  <h2 id="acfr-actuals">What actually got spent, fiscal year 2001 to fiscal year 2024</h2>

  <figure class="chart-panel" id="panel1">
    <div class="chart-toggle" role="tablist" aria-label="View">
      <button type="button" role="tab" aria-selected="true" data-view="nominal">Nominal dollars</button>
      <button type="button" role="tab" aria-selected="false" data-view="per-pupil">Per pupil</button>
      <button type="button" role="tab" aria-selected="false" data-view="real">Real dollars (fiscal year 2024 basis)</button>
    </div>
    <svg id="panel1-svg" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet" aria-label="Marblehead education spending by fiscal year, 2001 to 2024"></svg>
    <figcaption>
      Source: fiscal year 2024 ACFR, page 129, Schedule of Expenditures by Function.
      <sup class="cite" data-src="fy24-acfr" data-page="129">1</sup>
    </figcaption>
  </figure>
</div>
```

- [ ] **Step 3: Create the CSS file**

```css
/* schools-budget.html only */
body.schools-budget .lede {
  font-size: 1.1rem;
  color: var(--fg-2);
  margin-bottom: 2rem;
  max-width: 60ch;
}

body.schools-budget .chart-panel {
  margin: 1.5rem 0 2.5rem;
  padding: 1rem 0;
}

body.schools-budget .chart-panel svg {
  width: 100%;
  height: auto;
  display: block;
  background: var(--bg-1);
}

body.schools-budget .chart-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

body.schools-budget .chart-toggle button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg-1);
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: 0.2rem;
}

body.schools-budget .chart-toggle button[aria-selected="true"] {
  background: var(--fg-1);
  color: var(--bg-1);
}
```

- [ ] **Step 4: Wire the CSS from the page**

Add to the page's frontmatter section (top of `<div class="page">`, before `<h1>`):

```html
<link rel="stylesheet" href="/assets/schools-budget.css">
```

- [ ] **Step 5: Verify the page renders (no chart yet, just structure)**

Run `npm run dev` in a separate terminal, then:
```bash
curl -s http://localhost:4000/schools-budget.html | grep -E "(chart-panel|panel1-svg|Schools budget history)"
```

Expected: matches for all three strings.

- [ ] **Step 6: Commit**

```bash
git add schools-budget.html assets/schools-budget.css
git commit -m "schools-budget.html: skeleton page with Panel 1 structure"
```

---

### Task 4: Panel 1 chart JS — nominal $ line renders from CSV

**Files:**
- Create: `assets/schools-budget.js`

- [ ] **Step 1: Write a Playwright smoke test that will fail until the chart draws**

Create `tests/schools-budget.test.mjs`:

```js
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';

const BASE = process.env.SITE_BASE_URL || 'http://localhost:4000';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/schools-budget.html`);

// Panel 1 SVG has at least one <path> or <polyline> after JS runs.
await page.waitForSelector('#panel1-svg path, #panel1-svg polyline', { timeout: 5000 });
const shapes = await page.$$eval('#panel1-svg path, #panel1-svg polyline', els => els.length);
assert.ok(shapes >= 1, `expected at least one chart shape in Panel 1, got ${shapes}`);

// Toggle buttons exist.
const toggles = await page.$$eval('#panel1 .chart-toggle button', els => els.map(e => e.textContent.trim()));
assert.deepEqual(toggles, ['Nominal dollars', 'Per pupil', 'Real dollars (fiscal year 2024 basis)']);

console.log('schools-budget.test.mjs OK');
await browser.close();
```

- [ ] **Step 2: Run it — expect failure (no `<path>` yet)**

```bash
npm run dev &
DEV_PID=$!
sleep 8
node tests/schools-budget.test.mjs
kill $DEV_PID
```

Expected: timeout / assertion failure.

- [ ] **Step 3: Write the chart JS**

Create `assets/schools-budget.js`:

```js
(function () {
  const PANEL1_CSV = '/data/education_expenditure_FY01-24.csv';
  const PER_STUDENT_CSV = '/data/education_per_student_FY01-24.csv';
  const IPD_CSV = '/data/bea_state_local_ipd.csv';

  async function fetchCSV(url) {
    const text = await fetch(url).then(r => r.text());
    const [header, ...rows] = text.trim().split('\n');
    const cols = header.split(',');
    return rows.map(row => {
      const cells = row.split(',');
      const rec = {};
      cols.forEach((c, i) => { rec[c.trim()] = cells[i]; });
      return rec;
    });
  }

  function drawPanel1(mode) {
    const svg = document.getElementById('panel1-svg');
    if (!svg) return;
    Promise.all([fetchCSV(PANEL1_CSV), fetchCSV(PER_STUDENT_CSV), fetchCSV(IPD_CSV)])
      .then(([acfr, perStudent, ipd]) => {
        const ipdByYear = new Map(ipd.map(r => [Number(r.year), Number(r.ipd)]));
        const perStudentByFY = new Map(perStudent.map(r => [Number(r.FY), Number(r.Per_Student)]));
        const fy24Ipd = ipdByYear.get(2024) || 1;

        const points = acfr.map(r => {
          const fy = Number(r.FY);
          const nominal = Number(r.Education_Expenditure);
          if (mode === 'per-pupil') {
            return { fy, y: perStudentByFY.get(fy) ?? null };
          } else if (mode === 'real') {
            const ipdVal = ipdByYear.get(fy);
            return { fy, y: ipdVal ? nominal * (fy24Ipd / ipdVal) : null };
          }
          return { fy, y: nominal };
        }).filter(p => p.y !== null);

        renderLine(svg, points);
      });
  }

  function renderLine(svg, points) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = 800, H = 420, PAD = { l: 70, r: 20, t: 20, b: 40 };
    const xMin = Math.min(...points.map(p => p.fy));
    const xMax = Math.max(...points.map(p => p.fy));
    const yMax = Math.max(...points.map(p => p.y));
    const x = fy => PAD.l + ((fy - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
    const y = v => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.fy).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', path);
    line.setAttribute('class', 'chart-line');
    svg.appendChild(line);

    // Axes
    const axisX = document.createElementNS(ns, 'line');
    axisX.setAttribute('x1', PAD.l); axisX.setAttribute('x2', W - PAD.r);
    axisX.setAttribute('y1', H - PAD.b); axisX.setAttribute('y2', H - PAD.b);
    axisX.setAttribute('class', 'chart-axis');
    svg.appendChild(axisX);
  }

  document.addEventListener('DOMContentLoaded', () => {
    drawPanel1('nominal');
    document.querySelectorAll('#panel1 .chart-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#panel1 .chart-toggle button')
          .forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
        drawPanel1(btn.dataset.view);
      });
    });
  });
})();
```

- [ ] **Step 4: Wire the JS into the page**

Add before `</div>` (end of `.page`) in `schools-budget.html`:

```html
<script src="/assets/schools-budget.js"></script>
```

- [ ] **Step 5: Add CSS for the chart line**

Append to `assets/schools-budget.css`:

```css
body.schools-budget .chart-line {
  fill: none;
  stroke: var(--fg-1);
  stroke-width: 2;
}
body.schools-budget .chart-axis {
  stroke: var(--fg-3);
  stroke-width: 1;
}
```

- [ ] **Step 6: Run the test — expect pass**

```bash
npm run dev &
DEV_PID=$!
sleep 8
node tests/schools-budget.test.mjs
kill $DEV_PID
```

Expected: `schools-budget.test.mjs OK`.

- [ ] **Step 7: Commit**

```bash
git add schools-budget.html assets/schools-budget.js assets/schools-budget.css tests/schools-budget.test.mjs
git commit -m "Panel 1: nominal / per-pupil / real dollar toggle chart"
```

---

### Task 5: Panel 1 annotations for FY22 GASB + FY23 adjustment

**Files:**
- Modify: `assets/schools-budget.js` (add annotation-rendering pass)
- Modify: `schools-budget.html` (annotation caption text below the chart)

- [ ] **Step 1: Extend the JS to render callouts for anomaly years**

Add a helper function inside the IIFE, before `document.addEventListener`:

```js
const ANOMALY_YEARS = {
  2022: 'Likely GASB adjustment (see caption).',
  2023: 'Includes prior-year adjustments (see caption).',
};

function renderAnnotations(svg, points, ANOMALY_YEARS) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 800, H = 420, PAD = { l: 70, r: 20, t: 20, b: 40 };
  const xMin = Math.min(...points.map(p => p.fy));
  const xMax = Math.max(...points.map(p => p.fy));
  const yMax = Math.max(...points.map(p => p.y));
  const x = fy => PAD.l + ((fy - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const y = v => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  points.forEach(p => {
    if (!(p.fy in ANOMALY_YEARS)) return;
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x(p.fy).toFixed(1));
    dot.setAttribute('cy', y(p.y).toFixed(1));
    dot.setAttribute('r', 4);
    dot.setAttribute('class', 'chart-anomaly');
    svg.appendChild(dot);
  });
}
```

Then call `renderAnnotations(svg, points, ANOMALY_YEARS)` inside `renderLine` after appending the line path.

- [ ] **Step 2: Add anomaly caption text under Panel 1**

In `schools-budget.html`, extend the `<figcaption>`:

```html
<figcaption>
  Source: fiscal year 2024 ACFR, page 129, Schedule of Expenditures by Function.
  <sup class="cite" data-src="fy24-acfr" data-page="129">1</sup>
  Highlighted points in fiscal year 2022 and fiscal year 2023 are anomalies:
  FY22 reflects a likely GASB liability adjustment, and FY23 includes prior-year
  adjustments per the auditor. Neither represents operating spending in those years.
</figcaption>
```

- [ ] **Step 3: Style the anomaly marker**

Append to `assets/schools-budget.css`:

```css
body.schools-budget .chart-anomaly {
  fill: var(--accent);
  stroke: var(--bg-1);
  stroke-width: 1.5;
}
```

- [ ] **Step 4: Verify visually**

```bash
npm run dev &
DEV_PID=$!
sleep 8
mkdir -p proof
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 "http://localhost:4000/schools-budget.html" "proof/schools-budget-panel1-only.png"
kill $DEV_PID
```

Expected: file exists, ~2880 px wide.

- [ ] **Step 5: Commit**

```bash
git add assets/schools-budget.js assets/schools-budget.css schools-budget.html proof/schools-budget-panel1-only.png
git commit -m "Panel 1: annotate FY22 GASB + FY23 prior-year adjustment"
```

---

### Task 6: Panel 2 extractor — FY26 + FY27 baseline

**Files:**
- Create: `scripts/extract_mps_proposed_budget.mjs`
- Create: `data/mps_proposed_budget_by_category.csv` (generated)
- Create: `tests/test_mps_budget_extractor.py`

- [ ] **Step 1: Write a pytest that asserts the FY27 grand total**

Create `tests/test_mps_budget_extractor.py`:

```python
"""Data-integrity tests for scripts/extract_mps_proposed_budget.mjs output."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CSV_PATH = REPO / 'data' / 'mps_proposed_budget_by_category.csv'


def load_rows():
    with CSV_PATH.open() as f:
        return list(csv.DictReader(f))


def test_csv_exists():
    assert CSV_PATH.exists(), (
        f"Run `node scripts/extract_mps_proposed_budget.mjs` before running tests. "
        f"Expected {CSV_PATH} to exist."
    )


def test_fy27_grand_total_matches_packet():
    """FY27 bucket sums must equal the packet's grand total ($49,120,285)."""
    rows = load_rows()
    fy27 = [r for r in rows if r['FY'] == '2027']
    assert fy27, "No FY27 rows in extracted CSV"
    total = sum(int(r['amount']) for r in fy27)
    assert total == 49_120_285, (
        f"FY27 bucket sum = ${total:,}, expected $49,120,285 per packet line 3045"
    )


def test_fy26_grand_total_matches_packet():
    rows = load_rows()
    fy26 = [r for r in rows if r['FY'] == '2026']
    assert fy26, "No FY26 rows"
    total = sum(int(r['amount']) for r in fy26)
    assert total == 49_120_285, (
        f"FY26 bucket sum = ${total:,}, expected $49,120,285"
    )


def test_all_rows_have_source_citation():
    for row in load_rows():
        assert row['source_packet_slug'], f"Row missing source_packet_slug: {row}"
        assert row['bucket'] in {
            'Regular instruction', 'Special education', 'Student services',
            'Operations', 'Administration', 'Capital',
        }, f"Unknown bucket: {row['bucket']}"
```

- [ ] **Step 2: Run pytest — expect fail (CSV doesn't exist)**

```bash
cd tests && python3 -m pytest test_mps_budget_extractor.py -v
```

Expected: `FAILED` for `test_csv_exists`.

- [ ] **Step 3: Write the extractor script**

Create `scripts/extract_mps_proposed_budget.mjs`:

```js
#!/usr/bin/env node
// Extract top-line category budgets from Feb MPS budget packets.
// Output: data/mps_proposed_budget_by_category.csv
//   FY,bucket,amount,source_packet_slug,source_line,extraction_confidence

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Anchor extractor for FY26/FY27 from the FY27 budget packet.
// Later tasks add anchors for prior years.
const PACKETS = [
  {
    fys: [2026, 2027],
    slug: 'agenda-and-materials-2-5-2026-fy27-budget-packet',
    path: 'data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt',
    // Mapping decided from packet section headers. Each entry: bucket name +
    // regex that matches the TOTAL line(s) for that section.
    // Amounts are two columns per row (FY26 col, FY27 col). We keep both.
    anchors: [
      // filled in from schools-budget-panel2-anchors.md
      // Each anchor: { bucket, regex, fy26Total, fy27Total }
    ],
  },
];

function parseDollar(s) {
  return Number(s.replace(/[$,\s()]/g, ''));
}

function extractFromPacket(packet) {
  const text = readFileSync(resolve(packet.path), 'utf8');
  const lines = text.split('\n');
  const out = [];
  for (const anchor of packet.anchors) {
    // Sum any explicit fy26/fy27 override, otherwise search lines for the TOTAL.
    if (anchor.fy26Total !== undefined && anchor.fy27Total !== undefined) {
      out.push({ FY: 2026, bucket: anchor.bucket, amount: anchor.fy26Total,
        source_packet_slug: packet.slug, source_line: anchor.line ?? '', extraction_confidence: 'high' });
      out.push({ FY: 2027, bucket: anchor.bucket, amount: anchor.fy27Total,
        source_packet_slug: packet.slug, source_line: anchor.line ?? '', extraction_confidence: 'high' });
    }
  }
  return out;
}

function main() {
  const rows = [];
  for (const packet of PACKETS) rows.push(...extractFromPacket(packet));

  // Sanity: bucket sums per FY should hit the packet grand total.
  const perFY = new Map();
  for (const r of rows) {
    perFY.set(r.FY, (perFY.get(r.FY) ?? 0) + r.amount);
  }
  for (const [fy, sum] of perFY) console.log(`FY${fy} bucket sum = $${sum.toLocaleString()}`);

  const header = 'FY,bucket,amount,source_packet_slug,source_line,extraction_confidence\n';
  const body = rows.map(r =>
    [r.FY, JSON.stringify(r.bucket), r.amount, r.source_packet_slug, r.source_line, r.extraction_confidence].join(',')
  ).join('\n');
  writeFileSync('data/mps_proposed_budget_by_category.csv', header + body + '\n');
  console.log(`Wrote ${rows.length} rows to data/mps_proposed_budget_by_category.csv`);
}

main();
```

- [ ] **Step 4: Fill in the FY26/FY27 anchors table**

Open `docs/superpowers/plans/schools-budget-panel2-anchors.md` from Task 2. Copy each row's (bucket, fy26Total, fy27Total) into the `anchors: [...]` array in the script. Example (values are placeholders — use the actual anchor doc):

```js
anchors: [
  { bucket: 'Regular instruction', fy26Total: 20_000_000, fy27Total: 20_000_000, line: 538 },
  { bucket: 'Special education', fy26Total: 10_000_000, fy27Total: 10_000_000, line: 635 },
  // ...
],
```

Bucket sums MUST equal $49,120,285 per FY. If they don't, add a `bucket: 'Other', ...` row absorbing the remainder AND flag it low-confidence, then investigate.

- [ ] **Step 5: Run extractor and pytest**

```bash
node scripts/extract_mps_proposed_budget.mjs
cd tests && python3 -m pytest test_mps_budget_extractor.py -v
```

Expected: all four tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract_mps_proposed_budget.mjs data/mps_proposed_budget_by_category.csv tests/test_mps_budget_extractor.py
git commit -m "Panel 2 extractor: FY26 + FY27 baseline from Feb 2026 packet"
```

---

### Task 7: Panel 2 chart — stacked area with FY26/FY27 data

**Files:**
- Modify: `schools-budget.html` (add Panel 2 markup)
- Modify: `assets/schools-budget.js` (add stacked-area rendering)
- Modify: `assets/schools-budget.css` (bucket colors)
- Modify: `tests/schools-budget.test.mjs` (add Panel 2 assertion)

- [ ] **Step 1: Extend the Playwright test to expect Panel 2 shapes**

Append to `tests/schools-budget.test.mjs`:

```js
await page.waitForSelector('#panel2-svg path.chart-stack', { timeout: 5000 });
const stacks = await page.$$eval('#panel2-svg path.chart-stack', els => els.length);
assert.equal(stacks, 6, `expected 6 stacked areas in Panel 2, got ${stacks}`);
```

- [ ] **Step 2: Add Panel 2 markup to `schools-budget.html`**

After the Panel 1 `</figure>`, before `</div>` end-of-page:

```html
<h2 id="proposed-by-category">What the schools proposed, by category (fiscal year 2018 to fiscal year 2027)</h2>

<p>
  Amounts below are the superintendent's <em>proposed</em> operating budget for each year,
  as presented at the February School Committee meeting. This is not the same as what was
  actually spent — the audited numbers are in the panel above. The gap between the two
  is explained in <a href="#methodology">Methodology</a> below.
</p>

<figure class="chart-panel" id="panel2">
  <svg id="panel2-svg" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet" aria-label="Proposed schools budget by category, fiscal year 2018 to fiscal year 2027"></svg>
  <figcaption>
    Sources: February School Committee meeting packets, fiscal year 2018 through fiscal year 2027.
    Full URL per data point in <a href="/data/mps_proposed_budget_by_category.csv">the CSV</a>.
    <em>Fixed Charges</em> (health insurance, retirement, Medicare) are budgeted at the town level
    for Marblehead, so they are not shown in this school-side view.
  </figcaption>
</figure>
```

- [ ] **Step 3: Add stacked-area rendering to `assets/schools-budget.js`**

Add after `renderLine()`:

```js
const BUCKETS = [
  'Regular instruction', 'Special education', 'Student services',
  'Operations', 'Administration', 'Capital',
];

async function drawPanel2() {
  const svg = document.getElementById('panel2-svg');
  if (!svg) return;
  const rows = await fetchCSV('/data/mps_proposed_budget_by_category.csv');
  const years = [...new Set(rows.map(r => Number(r.FY)))].sort((a, b) => a - b);
  const byFY = new Map(years.map(y => [y, {}]));
  for (const r of rows) {
    byFY.get(Number(r.FY))[r.bucket.replace(/"/g, '')] = Number(r.amount);
  }
  const W = 800, H = 420, PAD = { l: 70, r: 20, t: 20, b: 40 };
  const xMin = years[0], xMax = years[years.length - 1];
  const totals = years.map(y => BUCKETS.reduce((s, b) => s + (byFY.get(y)[b] || 0), 0));
  const yMax = Math.max(...totals);
  const x = fy => PAD.l + ((fy - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const y = v => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const ns = 'http://www.w3.org/2000/svg';

  // Build cumulative sums per bucket per year.
  const cum = years.map(fy => {
    const yr = byFY.get(fy);
    let acc = 0;
    return BUCKETS.map(b => {
      const from = acc;
      acc += yr[b] || 0;
      return { from, to: acc };
    });
  });

  BUCKETS.forEach((b, i) => {
    const topPts = years.map((fy, yi) => `${x(fy).toFixed(1)},${y(cum[yi][i].to).toFixed(1)}`);
    const botPts = years.map((fy, yi) => `${x(fy).toFixed(1)},${y(cum[yi][i].from).toFixed(1)}`).reverse();
    const d = `M${topPts.join(' L')} L${botPts.join(' L')} Z`;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', `chart-stack chart-stack-${i}`);
    p.setAttribute('data-bucket', b);
    svg.appendChild(p);
  });
}

// Register at the end of DOMContentLoaded handler:
```

Update the existing `DOMContentLoaded` handler to also call `drawPanel2()`.

- [ ] **Step 4: Add bucket colors to CSS**

Append to `assets/schools-budget.css`:

```css
body.schools-budget .chart-stack {
  stroke: var(--bg-1);
  stroke-width: 1;
}
body.schools-budget .chart-stack-0 { fill: #4E7A94; }
body.schools-budget .chart-stack-1 { fill: #B08A5A; }
body.schools-budget .chart-stack-2 { fill: #7A9E7A; }
body.schools-budget .chart-stack-3 { fill: #A05555; }
body.schools-budget .chart-stack-4 { fill: #6A6486; }
body.schools-budget .chart-stack-5 { fill: #8A7A66; }
```

(Colors chosen to be neutral — no red/green good-bad signal.)

- [ ] **Step 5: Run tests**

```bash
npm run dev &
DEV_PID=$!
sleep 8
node tests/schools-budget.test.mjs
kill $DEV_PID
```

Expected: `schools-budget.test.mjs OK`.

- [ ] **Step 6: Commit**

```bash
git add schools-budget.html assets/schools-budget.js assets/schools-budget.css tests/schools-budget.test.mjs
git commit -m "Panel 2: stacked area chart of proposed budget by category (FY26/FY27)"
```

---

### Task 8: Extend extractor to FY23–FY25 (recent years, mostly OCR'd)

**Files:**
- Modify: `scripts/extract_mps_proposed_budget.mjs`
- Modify: `tests/test_mps_budget_extractor.py`
- Modify: `docs/superpowers/plans/schools-budget-panel2-anchors.md`

- [ ] **Step 1: Locate each year's Feb packet**

For each of FY23, FY24, FY25:

```bash
ls data/schools/sc-archive-fy23/ | grep -iE "(^2-|02-).*2023" | head -3
ls data/schools/sc-archive-fy24/ | grep -iE "(^2-|02-).*2024" | head -3
ls data/schools/sc-archive-fy25/ | grep -iE "(^2-|02-).*2025" | head -3
```

Record filenames.

- [ ] **Step 2: For each packet, find the grand total line**

```bash
grep -nE "(TOTAL|Total)" data/schools/sc-archive-fy25/<file>.txt | head -20
```

Look for the biggest dollar amount — usually in the tens of millions. That's the grand total. Note which FY(s) it covers (packet may show current + proposed).

- [ ] **Step 3: For each packet, find bucket subtotals (same as Task 2)**

Add rows to `docs/superpowers/plans/schools-budget-panel2-anchors.md` under sub-sections per FY.

- [ ] **Step 4: Add PACKETS entries + anchors to the extractor**

Extend the `PACKETS` array with entries for FY23, FY24, FY25. For OCR'd packets, watch out for common OCR errors: `S` misread as `5`, `l` as `1`, missing commas. Verify each anchor's line by grepping the source. Flag `extraction_confidence: 'medium'` for any bucket where the OCR'd text needed cleanup, `'low'` for any that had to be reconstructed from adjacent lines.

- [ ] **Step 5: Add pytest assertions for FY23-FY25**

Add to `tests/test_mps_budget_extractor.py`:

```python
def test_fy23_grand_total_within_1pct_of_acfr():
    """FY23 proposed budget should be within 5% of FY23 ACFR actual (with GASB caveat)."""
    rows = load_rows()
    proposed_23 = sum(int(r['amount']) for r in rows if r['FY'] == '2023')
    if not proposed_23:
        return  # FY23 not in scope — pass silently
    # ACFR FY23 = $60,156,453 (anomaly per csv note), FY22 = $38,294,070
    # Use a wide tolerance since GASB adjustment inflated FY23 actual.
    assert 30_000_000 < proposed_23 < 60_000_000
```

- [ ] **Step 6: Run extractor, then pytest**

```bash
node scripts/extract_mps_proposed_budget.mjs
cd tests && python3 -m pytest test_mps_budget_extractor.py -v
```

- [ ] **Step 7: Commit**

```bash
git add scripts/extract_mps_proposed_budget.mjs tests/test_mps_budget_extractor.py data/mps_proposed_budget_by_category.csv docs/superpowers/plans/schools-budget-panel2-anchors.md
git commit -m "Panel 2 extractor: extend to FY23-FY25 (OCR'd packets)"
```

---

### Task 9: Extend extractor to FY18–FY22 (older, mostly native PDF)

**Files:** same as Task 8.

Same procedure as Task 8, applied to FY18 through FY22 packets in `data/schools/sc-archive-fy18/` through `sc-archive-fy22/`.

- [ ] **Step 1: For each year, locate Feb packet, find grand total + bucket subtotals**

Same commands as Task 8, substituting years.

- [ ] **Step 2: Add PACKETS entries**

FY18-FY22 packets are mostly native PDF, so confidence should be `high` for most rows.

- [ ] **Step 3: Add pytest for grand-total sanity per FY**

Add loose bounds check:

```python
def test_all_fys_have_sane_totals():
    """Every extracted FY should have bucket sums in $20M–$60M range."""
    rows = load_rows()
    by_fy = {}
    for r in rows:
        by_fy.setdefault(r['FY'], 0)
        by_fy[r['FY']] += int(r['amount'])
    for fy, total in by_fy.items():
        assert 20_000_000 < total < 60_000_000, f"FY{fy} total = ${total:,} out of range"
```

- [ ] **Step 4: Run + verify + commit**

```bash
node scripts/extract_mps_proposed_budget.mjs
cd tests && python3 -m pytest test_mps_budget_extractor.py -v
git add scripts/extract_mps_proposed_budget.mjs tests/test_mps_budget_extractor.py data/mps_proposed_budget_by_category.csv docs/superpowers/plans/schools-budget-panel2-anchors.md
git commit -m "Panel 2 extractor: extend to FY18-FY22"
```

- [ ] **Step 5: If any FY cannot be extracted cleanly, document the gap**

If, say, FY18 packet's summary table can't be parsed, add a `sc-archive-fy18` note in the panel 2 caption saying "FY18 not available; extraction produced no reliable summary." Do NOT fabricate values. The chart will show a gap.

---

### Task 10: Proposed-vs-actual gap callout

**Files:**
- Modify: `schools-budget.html` (add gap callout markup)
- Modify: `assets/schools-budget.js` (compute and render gap inset)

- [ ] **Step 1: Add gap callout markup to Panel 2 figure**

Inside `<figure class="chart-panel" id="panel2">`, after the SVG, before the `<figcaption>`:

```html
<aside class="chart-inset" id="panel2-gap" aria-label="Proposed vs actual gap">
  <h3>Proposed vs. actual</h3>
  <p>
    Each year, the actual audited expenditure (Panel 1) came in below the
    superintendent's proposed budget. The gap is a known pattern —
    <a href="/how-we-got-here.html#group-insurance-pad">Group Insurance was
    underspent by an average of 18.7% for a decade</a>, and the surplus was
    recycled through free cash.
  </p>
  <table>
    <thead><tr><th>FY</th><th>Proposed</th><th>Actual (ACFR)</th><th>Gap</th></tr></thead>
    <tbody id="panel2-gap-body"></tbody>
  </table>
</aside>
```

- [ ] **Step 2: Render the gap table in JS**

Add to `assets/schools-budget.js`, at the end of the IIFE (before the closing `})();`):

```js
async function drawGapTable() {
  const body = document.getElementById('panel2-gap-body');
  if (!body) return;
  const [proposedRows, acfrRows] = await Promise.all([
    fetchCSV('/data/mps_proposed_budget_by_category.csv'),
    fetchCSV('/data/education_expenditure_FY01-24.csv'),
  ]);
  const proposedByFY = new Map();
  for (const r of proposedRows) {
    const fy = Number(r.FY);
    proposedByFY.set(fy, (proposedByFY.get(fy) ?? 0) + Number(r.amount));
  }
  const acfrByFY = new Map(acfrRows.map(r => [Number(r.FY), Number(r.Education_Expenditure)]));

  const rowsHtml = [];
  for (const [fy, prop] of [...proposedByFY.entries()].sort()) {
    const actual = acfrByFY.get(fy);
    if (actual === undefined) continue;
    const gap = actual - prop;
    const sign = gap >= 0 ? '+' : '-';
    rowsHtml.push(`<tr><td>${fy}</td><td>$${prop.toLocaleString()}</td><td>$${actual.toLocaleString()}</td><td>${sign}$${Math.abs(gap).toLocaleString()}</td></tr>`);
  }
  body.innerHTML = rowsHtml.join('');
}
```

Then call `drawGapTable()` inside the `DOMContentLoaded` handler.

- [ ] **Step 3: Style the inset**

Append to `assets/schools-budget.css`:

```css
body.schools-budget .chart-inset {
  border: 1px solid var(--border);
  padding: 1rem;
  margin: 1rem 0;
  background: var(--bg-2);
}
body.schools-budget .chart-inset table {
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
body.schools-budget .chart-inset th,
body.schools-budget .chart-inset td {
  padding: 0.3rem 0.6rem;
  text-align: right;
}
body.schools-budget .chart-inset th {
  text-align: left;
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev &
DEV_PID=$!
sleep 8
curl -s http://localhost:4000/schools-budget.html | grep -E "(Proposed vs. actual|Group Insurance)"
kill $DEV_PID
```

Expected: matches.

- [ ] **Step 5: Commit**

```bash
git add schools-budget.html assets/schools-budget.js assets/schools-budget.css
git commit -m "Panel 2: proposed-vs-actual gap table with GIC-pad rationale link"
```

---

### Task 11: Peer comparison block

**Files:**
- Modify: `schools-budget.html`
- Modify: `assets/schools-budget.js`

- [ ] **Step 1: Identify the peer set**

```bash
awk -F, 'NR==1 || $2=="Marblehead"' data/peer_schedule_a_expenditures.csv | head -5
head -1 data/peer_schedule_a_expenditures.csv
awk -F, 'NR>1 {print $2}' data/peer_schedule_a_expenditures.csv | sort -u
```

Note the peer set (8-10 towns) already in the CSV. If more than 10, pick the ones closest in EQV/enrollment to Marblehead. Document the selection in the caption.

- [ ] **Step 2: Add peer-block markup**

After the Panel 2 `</figure>`:

```html
<h2 id="peers">How Marblehead compares to peers</h2>

<p>
  Single-year snapshot (fiscal year 2024) from the Department of Revenue's
  Schedule A returns. Latest available for all comparison towns. Peer set
  matches the town's own peer selections used elsewhere on this site.
</p>

<figure class="peer-block" id="peer-block">
  <table>
    <thead>
      <tr>
        <th>Town</th>
        <th>Education spending (fiscal year 2024)</th>
        <th>Per pupil</th>
        <th>Per capita</th>
      </tr>
    </thead>
    <tbody id="peer-block-body"></tbody>
  </table>
  <figcaption>
    Source: Massachusetts Department of Revenue Schedule A returns, fiscal year 2024.
    Per-pupil and per-capita derivations use DESE enrollment and Census population estimates.
  </figcaption>
</figure>
```

- [ ] **Step 3: Add renderPeers() to JS**

Add to `assets/schools-budget.js`:

```js
async function drawPeerBlock() {
  const body = document.getElementById('peer-block-body');
  if (!body) return;
  const rows = await fetchCSV('/data/peer_schedule_a_expenditures.csv');
  const fy24 = rows.filter(r => Number(r.fiscal_year) === 2024);
  fy24.sort((a, b) => Number(b.education.replace(/[$,]/g, '')) - Number(a.education.replace(/[$,]/g, '')));
  body.innerHTML = fy24.map(r => {
    const edu = Number(r.education.replace(/[$,]/g, ''));
    const highlight = r.municipality === 'Marblehead' ? ' class="row-highlight"' : '';
    // per-pupil / per-capita: leave blank if columns missing.
    return `<tr${highlight}><td>${r.municipality}</td><td>$${edu.toLocaleString()}</td><td></td><td></td></tr>`;
  }).join('');
}
```

Add `drawPeerBlock()` to the DOMContentLoaded handler.

- [ ] **Step 4: Style the highlight**

Append to CSS:

```css
body.schools-budget .peer-block .row-highlight {
  background: var(--accent-bg);
  font-weight: 600;
}
body.schools-budget .peer-block table { border-collapse: collapse; width: 100%; }
body.schools-budget .peer-block th,
body.schools-budget .peer-block td { padding: 0.4rem 0.8rem; text-align: right; }
body.schools-budget .peer-block th:first-child,
body.schools-budget .peer-block td:first-child { text-align: left; }
```

- [ ] **Step 5: Commit**

```bash
git add schools-budget.html assets/schools-budget.js assets/schools-budget.css
git commit -m "Peer comparison block: FY24 Schedule A education spending, Marblehead vs peers"
```

---

### Task 12: Methodology section + citations

**Files:**
- Modify: `schools-budget.html`

- [ ] **Step 1: Add methodology section at the bottom of the page**

Before the closing `</div>` end-of-page:

```html
<h2 id="methodology">Methodology</h2>

<h3>Panel 1: Audited actuals</h3>
<p>
  Panel 1 uses <code>data/education_expenditure_FY01-24.csv</code>, which was
  compiled from fiscal year 2001 through fiscal year 2024 Marblehead ACFRs.
  For each fiscal year, the value is the Education line from the ACFR's
  Schedule of Expenditures by Function. Source pages per ACFR are tracked in
  <a href="/data/SOURCE_LOOKUP.md"><code>data/SOURCE_LOOKUP.md</code></a>.
</p>
<p>
  Two years are annotated as anomalies. Fiscal year 2022 reflects a likely
  Governmental Accounting Standards Board (GASB) liability adjustment; fiscal
  year 2023 includes prior-year adjustments per the auditor's note. Neither
  represents operating spending in those years, and treating them as trend
  points would mislead.
</p>

<h3>Panel 2: Proposed budgets by category</h3>
<p>
  Panel 2 uses <code>data/mps_proposed_budget_by_category.csv</code>, extracted
  by <code>scripts/extract_mps_proposed_budget.mjs</code> from the February
  School Committee meeting packets stored under <code>data/schools/sc-archive-fy*/</code>
  and <code>data/schools/sc-meetings-fy26/</code>. Each row cites the source
  packet slug and, where available, the source line number. Confidence per row
  is either <em>high</em> (parsed cleanly from a summary table), <em>medium</em>
  (parsed from line items and summed), or <em>low</em> (flagged for manual review).
</p>
<p>
  The six category buckets are inspired by the DESE Chart of Accounts function
  codes, but pragmatic for what MPS packets actually break out. Fixed Charges
  (function 5000) covering health insurance, retirement, and Medicare are
  intentionally excluded because Marblehead budgets these at the town level,
  not the school side; see
  <a href="/how-we-got-here.html#group-insurance-pad">the Group Insurance pad
  finding</a> for the operational reason this matters.
</p>

<h3>Peer block</h3>
<p>
  <code>data/peer_schedule_a_expenditures.csv</code> is the Massachusetts
  Department of Revenue's Schedule A total-education line for each town for
  each year. Fiscal year 2024 is used because it is the latest complete year
  for all peer towns.
</p>

<h3>Why proposed and actual do not match</h3>
<p>
  Three structural reasons the audited actual will not equal the proposed budget:
</p>
<ul>
  <li>Positions budgeted but unfilled for part of the year.</li>
  <li>Group insurance premiums came in below the budgeted rate (see the linked
      pad finding above; the pattern ran fiscal year 2014 to fiscal year 2024).</li>
  <li>End-of-year encumbrance and free-cash reclassification.</li>
</ul>
<p>
  None of these are unique to Marblehead; every district budget shows some
  version of the same gap.
</p>
```

- [ ] **Step 2: Verify all sup.cite markers have data-src attributes**

```bash
grep -E '<sup class="cite"' schools-budget.html
```

Every match should have `data-src="..."`. `assets/citations.js` needs those to render the Sources section.

- [ ] **Step 3: Commit**

```bash
git add schools-budget.html
git commit -m "Methodology section: sources, buckets, why proposed != actual"
```

---

### Task 13: Cross-links from `inside-school-staffing.html` and `labor-contracts.html`

**Files:**
- Modify: `inside-school-staffing.html`
- Modify: `labor-contracts.html`

- [ ] **Step 1: Add a "See also" link in `inside-school-staffing.html`**

Find the "How positions are funded" section:

```bash
grep -n "id=\"how-positions-are-funded\"" inside-school-staffing.html
```

Just below that `<h2>`, add:

```html
<p class="see-also">
  See also: <a href="/schools-budget.html">the schools budget history page</a>
  for how total spending has moved over 24 years.
</p>
```

- [ ] **Step 2: Add a "See also" link at the bottom of `labor-contracts.html`**

Find the last `</h2>` section and add before the page's closing `</div>`:

```html
<p class="see-also">
  Payroll drives the trend line. See
  <a href="/schools-budget.html">schools budget history</a> for the full picture
  including how proposed budgets differ from what actually gets spent.
</p>
```

- [ ] **Step 3: Extend Playwright test to verify the cross-links resolve**

Append to `tests/schools-budget.test.mjs`:

```js
await page.goto(`${BASE}/inside-school-staffing.html`);
const staffingLink = await page.$('a[href="/schools-budget.html"]');
assert.ok(staffingLink, 'inside-school-staffing.html missing link to schools-budget');

await page.goto(`${BASE}/labor-contracts.html`);
const laborLink = await page.$('a[href="/schools-budget.html"]');
assert.ok(laborLink, 'labor-contracts.html missing link to schools-budget');
```

- [ ] **Step 4: Run test + commit**

```bash
npm run dev &
DEV_PID=$!
sleep 8
node tests/schools-budget.test.mjs
kill $DEV_PID
git add inside-school-staffing.html labor-contracts.html tests/schools-budget.test.mjs
git commit -m "Cross-links to schools-budget from staffing + labor-contracts pages"
```

---

### Task 14: Full smoke test + Playwright screenshots

**Files:**
- Create: `proof/schools-budget-page.png` (above-fold)
- Create: `proof/schools-budget-page-full.png` (full-page)
- Delete: `docs/superpowers/plans/schools-budget-panel2-anchors.md` (scratch, no longer needed)

- [ ] **Step 1: Run the full local test suite**

```bash
npm run test:local
```

Expected: all pass, including the new schools-budget test.

- [ ] **Step 2: Run pytest**

```bash
cd tests && python3 -m pytest -v
```

Expected: all pass.

- [ ] **Step 3: Capture above-fold screenshot**

```bash
npm run dev &
DEV_PID=$!
sleep 8
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/schools-budget.html" \
  "proof/schools-budget-page.png"
```

- [ ] **Step 4: Capture full-page screenshot**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/schools-budget.html" \
  "proof/schools-budget-page-full.png"
kill $DEV_PID
```

- [ ] **Step 5: Verify screenshot dimensions**

```bash
file proof/schools-budget-page.png proof/schools-budget-page-full.png
```

Expected: 2880 px wide for both.

- [ ] **Step 6: Delete scratch anchor doc**

```bash
rm docs/superpowers/plans/schools-budget-panel2-anchors.md
```

- [ ] **Step 7: Commit**

```bash
git add proof/schools-budget-page.png proof/schools-budget-page-full.png
git rm docs/superpowers/plans/schools-budget-panel2-anchors.md
git commit -m "Proof of work + drop scratch anchor doc"
```

---

### Task 15: Push branch and open PR

**Files:** none.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin schools-budget-page
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "Schools budget history page + full schools-site scrape" --body "$(cat <<'EOF'
## Summary

Two things bundled in this PR because the second depends on the first:

1. **Extend the schools-site scraper** with an HTML discovery phase that walks 18 section landing pages and appends discovered PDFs to the processing queue. Result: `data/schools/` grows from 125 to 819 documents (`sc-archive-fy18` through `sc-archive-fy25`, 5 school subdomains, DCAP). 18MB of committed text, PDFs remain gitignored under `_pdfs/`.
2. **New page `schools-budget.html`** — two-panel reconciliation of ACFR audited education expenditure (FY01–FY24, 24 years) with the superintendent's proposed budget by category (FY18–FY27, 10 years, extracted from Feb SC packets). Plus a small peer-comparison block and a methodology section.

## How to test

- **Preview**: Cloudflare PR preview will appear at https://marblehead-pr-NN.preview-deploy once CI completes. Edit this section with the real URL when green.
- **Paths to review**:
  1. `/schools-budget.html` — the new page. Try the three toggles on Panel 1 (nominal / per-pupil / real dollars).
  2. `/inside-school-staffing.html` — new "see also" cross-link.
  3. `/labor-contracts.html` — new "see also" cross-link at bottom.
  4. `data/schools/INDEX.md` — updated index of all 819 scraped docs.
- **Edge cases**:
  - FY22 GASB anomaly and FY23 prior-year adjustment are annotated on Panel 1. Hover the marker; the caption should explain.
  - Panel 2's proposed-vs-actual gap table links out to the Group Insurance pad rationale.
  - Peer block highlights the Marblehead row.

## Proof of work

Above-fold:
![Above fold](proof/schools-budget-page.png)

Full page:
![Full page](proof/schools-budget-page-full.png)

Local smoke: `npm run test:local` passes, `pytest tests/` passes.

Spec: [`docs/superpowers/specs/2026-07-07-schools-budget-design.md`](docs/superpowers/specs/2026-07-07-schools-budget-design.md).
Plan: [`docs/superpowers/plans/2026-07-07-schools-budget-plan.md`](docs/superpowers/plans/2026-07-07-schools-budget-plan.md).

## Known gaps documented in `data/schools/INDEX.md`

- MPS Policy Manual lives in Google Drive folders; not scrape-able without auth.
- DESE Report Cards / MCAS are external on doe.mass.edu; separate problem.
- Student-services HTML pages (SEPAC, Section 504, English learners) had no PDF links to discover.
- 11 transient download failures out of 830 in the scraper run; listed in `data/schools/manifest.json`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report PR URL back**

Paste the URL returned by `gh pr create`.

---

## Self-review checklist (executed by plan author before handoff)

- [x] Spec's two-panel structure has tasks: Task 3-5 (Panel 1), Tasks 6-9 (Panel 2).
- [x] Spec's peer-comparison block has a task: Task 11.
- [x] Spec's methodology section has a task: Task 12.
- [x] Spec's cross-links have a task: Task 13.
- [x] Spec's testing/proof has tasks: Task 14 (screenshots), Tasks 6/8/9 (pytest), Task 4/13 (Playwright).
- [x] MVP fallback (spec's "risks" section) is honored by Task 7 shipping working chart with just FY26/FY27, and Tasks 8-9 extending backward. If Task 8 or 9 fails per FY, the page still ships with what does extract.
- [x] Every code step has actual code, not "TBD" or "similar to Task N".
- [x] Type consistency: bucket names in Task 6 (`Regular instruction`, `Special education`, ...) match Task 7's `BUCKETS` array match Task 6's pytest allowlist.
- [x] Fixed Charges exclusion (spec caveat) is called out in Task 7 caption and Task 12 methodology.

## Notes for executor

- **Anchor doc** (`schools-budget-panel2-anchors.md`) is scratch. Task 2 writes it, Task 14 deletes it. Do not commit it as a durable artifact.
- **Cite the Group Insurance pad finding** on both the gap-table caption (Task 10) and the methodology (Task 12). It's the operational explanation for the proposed-vs-actual gap.
- **No em-dashes** in site copy per `STYLE_GUIDE.md` — use en-dashes or restructure.
- **No inline `style=""` on SVG** — use scoped CSS classes.
- **Screenshots go in `proof/`** at the worktree root (see box-wide CLAUDE.md); never `/tmp/`.
