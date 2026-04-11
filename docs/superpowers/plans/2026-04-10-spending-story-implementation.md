# Spending Story and Homepage UX: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new long-form page `where-has-the-money-gone.html` that gives a skeptical Marblehead voter an honest, sourced narrative of how the town has spent money over the last ten years, plus three small edits to `index.html` that make the new page and the existing Data & Sources section easier to find.

**Architecture:** Static HTML page added at repo root, reusing the existing `assets/site.css` stylesheet unchanged. One new inline SVG chart (hand-drawn in the same style as existing charts under `charts/`). Homepage edits are additive: one inline link, one anchor attribute, one new section containing one card. No new CSS, no build step, no JavaScript beyond the optional `<details>` disclosure that HTML already supports.

**Tech Stack:** Plain HTML, CSS custom properties (already defined in `assets/site.css`), inline SVG for the chart. No framework, no JS tooling, no package manager.

**Reference spec:** `docs/superpowers/specs/2026-04-10-spending-story-ux-design.md`

---

## Ground rules (apply to every task)

These constraints are enforced throughout the plan. Re-read before each task.

- **No em-dashes anywhere.** Use commas, periods, or restructure. Applies to code comments, HTML content, commit messages, and any notes written during the work.
- **Minimize acronyms in user-facing copy.** Expansions: ACFR to "independent annual audit," PERAC to "state pension regulator," OPEB to "retiree benefits trust," DOR to "state Department of Revenue," GIC to "state insurance pool" (with the term in parentheses on first use where the reader may already know it), FTE to "staffing" or "full-time positions," free cash to "leftover surplus from prior years." FY is acceptable because the rest of the site uses it.
- **Every numerical claim must be verified against a primary source.** Primary sources live in `data/`. News articles are not sufficient. If a number cannot be verified, do not put it in the page; instead, state that the reason is not publicly documented.
- **No traffic-light color coding.** Do not imply good/bad judgment on data.
- **Neutral framing.** Do not write "bad news for the town" or "vindicates the override." State facts and numbers; let the reader decide.
- **Every commit is a working state.** The site should render correctly at every commit boundary.

## File Structure

Three files in play. No other files are created or modified.

- **Create:** `where-has-the-money-gone.html` (new long-form page, repo root).
- **Modify:** `index.html` (homepage; add anchor id, add inline hero link, add new section with one card).
- **Create (ephemeral, not committed):** nothing. All research output goes into this plan document's task notes or directly into the final HTML.

Reference patterns to study before starting:

- `what-is-the-override.html`: shell, nav, `.back` link, `.card` usage, `.notes` footer.
- `what-fails.html`: `.cut-item` list for line-item comparisons.
- `charts/real_cost_comparison.html`: reference pattern for hand-drawn inline SVG charts with `class="chart"` and coordinate-math comments.
- `charts/annual_gap.html`: reference pattern for filled areas (`<polygon>` with a gradient `fill`) if the stacked area chart needs similar treatment.

---

## Task 1: Extract and verify the six-category spending breakdown for Act 1

**Goal:** Produce a verified table of Marblehead spending from 2015 to 2026, broken into health insurance, pensions, debt payments, schools, public safety, and everything else. The numbers go into the chart in Task 6 and the prose underneath it.

**Files:**
- Read: `data/group_insurance_FY14-27.csv`
- Read: `data/pension_expenditure_FY15-24.csv`
- Read: `data/education_expenditure_FY15-24.csv`
- Read: `data/FY26_budget_summary.json`
- Read: `data/acfr/FY15_ACFR.pdf` through `data/acfr/FY24_ACFR.pdf` (for debt service, public safety, and totals)
- Read: `data/2026_FinCom_Report.pdf` and `data/FY2026_FinCom_Annual_Report.pdf` (FY25 and FY26 numbers where ACFRs are not yet available)
- Read: the FY27 proposed budget PDF linked from `what-fails.html` (for FY27 projections)
- Output: a verified 12-row, 7-column table (year, six categories, total) recorded in the notes section of this task below, before any HTML is written.

- [ ] **Step 1: Extract health insurance series (2015 to 2026)**

Read `data/group_insurance_FY14-27.csv`. Record the "Group_Insurance_Budget" value for each fiscal year 2015 through 2026. These are already sourced to FinCom reports and the FY27 proposed budget; no further verification required for this series.

- [ ] **Step 2: Extract pension series (2015 to 2024)**

Read `data/pension_expenditure_FY15-24.csv`. Record values for 2015 through 2024. For 2025 and 2026, pull from the FinCom FY2026 annual report and the FY27 proposed budget respectively. Cite the exact page number for any value taken from a PDF.

- [ ] **Step 3: Extract schools series (2015 to 2024)**

Read `data/education_expenditure_FY15-24.csv`. Record values. For 2025 and 2026, pull from the FinCom reports or the FY26 budget summary JSON (`data/FY26_budget_summary.json` has `School_Grand_Total`). Cite the source for each year.

- [ ] **Step 4: Extract debt payments series (2015 to 2026)**

Debt service is not in a clean CSV. Pull from the ACFRs (look in the "governmental funds expenditures" or "debt service" sections). Cross-check against `data/FY26_budget_summary.json` (`Debt_Service: 9314141` for FY26). Cite the page for each year.

- [ ] **Step 5: Extract public safety series (2015 to 2026)**

Public safety is not in a clean CSV for the time window. Aggregate Fire + Police from the ACFRs "general government expenditures" breakdown. Cross-check FY26 against `data/FY26_budget_summary.json` (`Fire: 5561260 + Police: 4987087`). Cite pages.

- [ ] **Step 6: Compute "everything else" as a residual**

For each year, compute the general fund total expenditures (from the ACFR statement of revenues, expenditures, and changes in fund balance, or from the FY26 budget summary `Combined_Total`), then subtract the five known categories. The residual is "everything else." This category is honest because it includes public works, the library, council on aging, and every other line item not individually broken out.

- [ ] **Step 7: Sanity-check totals**

For any year where total spending from the ACFR disagrees with the sum of the six categories by more than 2 percent, re-check the math and sources. If a discrepancy cannot be resolved, document it in the page footnotes so readers can see the same uncertainty.

- [ ] **Step 8: Fallback if debt or public safety cannot be cleanly extracted**

If extracting a clean debt or public safety series from the ACFRs takes longer than one hour, fall back to a simpler four-category chart: health insurance, pensions, schools, everything else (which then implicitly includes debt and public safety). Document the simplification in the page footnotes. Do not ship unverified numbers.

- [ ] **Step 9: Record the verified table**

Write the final table directly into this task as a comment before moving on. Each row must include the year and the six category values, each with the document and page cited as its source. This table is the source of truth for Task 6 (chart) and Task 7 (prose below the chart).

- [ ] **Step 10: Commit the research as a scratch note in this plan file**

Append the verified table and its sources to the end of this plan document under a new heading `## Task 1 research output` so it is preserved with the plan. Then commit:

```bash
git add docs/superpowers/plans/2026-04-10-spending-story-implementation.md
git commit -m "Record verified six-category spending table for the new page"
```

---

## Task 2: Build the department-by-department delta table (2015 vs 2026)

**Goal:** Produce a verified table of every general-fund department line item, comparing 2015 to 2026, with dollar and percent deltas. This goes into the HTML table in Task 7 of the page build.

**Files:**
- Read: `data/acfr/FY15_ACFR.pdf` (for the 2015 baseline)
- Read: `data/FY26_budget_summary.json` (for 2026 values, already clean)
- Read: `data/2026_FinCom_Report.pdf` to cross-check 2026 numbers against a second source

- [ ] **Step 1: Extract the 2026 department line items**

From `data/FY26_budget_summary.json`, take the `Town_Key_Items` object. Each key is a department, each value is the FY26 budget in dollars. Note that some "departments" in that file are actually cost categories (Health_Insurance_Transfer, Debt_Service, Pension_Contribution). Those belong in the chart in Task 6, not this department table. Exclude them here.

- [ ] **Step 2: Identify the matching 2015 department line items from the FY15 ACFR**

Open `data/acfr/FY15_ACFR.pdf`. Find the statement of expenditures by department (usually in the "general fund" section). For each department still present in the FY26 budget, record the FY15 value. For departments that existed in FY15 but were consolidated or renamed by FY26, note the mapping in the task output.

- [ ] **Step 3: Compute deltas**

For each department, compute `FY26 - FY15` in dollars and `(FY26 - FY15) / FY15` as a percent. Round dollars to the nearest thousand. Round percents to the nearest whole number.

- [ ] **Step 4: Sort by absolute dollar delta, largest first**

The table is ordered so the departments driving the most change surface first. Departments that stayed flat or shrank still appear, just lower in the list.

- [ ] **Step 5: Record the verified table in the plan file**

Append the result to the plan file under `## Task 2 research output`, same format as Task 1. Cite the FY15 ACFR page for each FY15 value.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-04-10-spending-story-implementation.md
git commit -m "Record verified department delta table (FY15 vs FY26)"
```

---

## Task 3: Verify the four "what grew faster" claims

**Goal:** Each of the four bullets in Act 3 must be verified against a primary source before going into the HTML. This task produces the verified version of each claim, including any context that must accompany it.

**Files:**
- Read: `data/fte_employees_FY15-24.csv`
- Read: `data/dese_peer_teachers_enrollment.csv` (or other enrollment source in `data/`)
- Read: `data/FY26_budget_summary.json`
- Read: FY27 proposed no-override budget PDF (already linked from `what-fails.html`)
- Read: `data/2026_FinCom_Report.pdf`, `data/2025_FinCom_Report.pdf`, `data/2022_FinCom_Report.pdf` (for "leftover surplus from prior years" warnings)
- Read: the town meeting minutes or a budget document explaining the town counsel line item, if one exists in `data/`

- [ ] **Step 1: Verify the school staffing claim**

From `data/fte_employees_FY15-24.csv`, compute the education FTE change from 2015 to 2024. The claim in the spec is "up 9.6%." Recompute it. If it differs, use the corrected number. Then pull the enrollment numbers for the same years from `data/MASTER_DATA.csv` or the DESE file. Compute the enrollment change. The spec claim is "fell 19%." Recompute.

Also verify the special education context: find a FinCom report, school committee document, or DESE document that describes how much of the education FTE growth was special-education-driven. If no such source exists in `data/`, the page must say so plainly ("special education is a known partial explanation, but the exact breakdown is not publicly documented").

- [ ] **Step 2: Verify the town counsel claim**

From `data/FY26_budget_summary.json`, the FY26 town counsel value is 228000. From the FY27 proposed budget PDF, pull the FY27 town counsel value. Compute the percent change. The spec says +142%. Recompute.

Then search `data/2026_FinCom_Report.pdf`, the FY27 budget document, and any town meeting minutes in `data/` for an explanation of the increase. If none exists, state in the page that the reason is not publicly documented.

- [ ] **Step 3: Verify the retiree benefits trust claim**

From `data/FY26_budget_summary.json`, confirm the FY26 value is `OPEB_Trust_Transfer: 250000`. From the FY27 proposed no-override budget, confirm the FY27 value is 0. This zeroing-out is the claim. No percent is needed because zero is zero.

- [ ] **Step 4: Verify the leftover surplus claim**

The spec says "several years running" and "flagged by the Finance Committee repeatedly." Find the specific language. Open `data/2025_FinCom_Report.pdf` and `data/2026_FinCom_Report.pdf` and search for "free cash" or "surplus." Pull one short direct quote per report (within fair use) or a paraphrase with the report name and page as the citation. Also find the specific dollar amounts of free cash used to balance the budget in recent years. The spec mentions "$7 to $9 million annually" (from `what-is-the-override.html` key terms); re-verify that range.

- [ ] **Step 5: Record the four verified claims in the plan file**

Append to the plan file under `## Task 3 research output`. Each claim should be stated in its final form, with the primary source cited.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-04-10-spending-story-implementation.md
git commit -m "Verify the four Act 3 claims against primary sources"
```

---

## Task 4: Scaffold `where-has-the-money-gone.html`

**Goal:** Create the new page file with the shell, nav, and all six section placeholders. Each section has a heading, a one-line placeholder, and a comment indicating which task fills it. The page renders in a browser as an empty but complete skeleton.

**Note on the optional longer-context disclosure:** The spec allows an optional `<details>` disclosure labeled "Show the full 2005 to 2026 view" in the hero section. That disclosure is deferred out of this plan and is not implemented in any task. If the page reads cleanly without it, no follow-up work is needed. If a later reviewer decides the longer context is worth adding, it can be added as a small follow-up task.

**Files:**
- Create: `where-has-the-money-gone.html`

- [ ] **Step 1: Create the file with doctype, head, nav, back link, and empty main**

Copy the head block (including the Google Tag Manager and gtag.js scripts) from `what-is-the-override.html` verbatim. This matches every other page on the site, which is required so analytics keeps working.

Then write the body shell:

```html
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5PQG62BJ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

<div class="page">
  <a class="back" href="./">&larr; marbleheaddata.org</a>

  <h1>Where Has Marblehead's Money Gone?</h1>
  <p>The property tax levy doubled from $39M in 2005 to $82M in 2024. Here is where every additional dollar went, who has been checking the books, and what grew faster than it probably should have.</p>

  <!-- Act 1: Where it went. Filled by Tasks 5 and 6. -->
  <h2>Where it went</h2>
  <p>(placeholder)</p>

  <!-- Act 2: Who has been checking the books. Filled by Task 7. -->
  <h2>Who has been checking the books</h2>
  <p>(placeholder)</p>

  <!-- Act 3: What grew faster. Filled by Task 8. -->
  <h2>What grew faster</h2>
  <p>(placeholder)</p>

  <!-- Close. Filled by Task 9. -->
  <h2>What this means for the override</h2>
  <p>(placeholder)</p>

  <div class="notes">
    <p>(sources filled by Task 10)</p>
  </div>
</div>

</body>
</html>
```

The `<title>` in the head should be `Where Has Marblehead's Money Gone? - Marblehead Budget Data`.

- [ ] **Step 2: Open the file in a browser and confirm it renders**

Open `where-has-the-money-gone.html` directly (no server needed; this is a static site). Confirm:
- The coastal-palette styling is applied (page background, navy headings).
- The back link goes to `./` (the homepage).
- The Google Tag Manager tag fires (check the browser network tab for `gtm.js`).
- Light and dark mode both look correct (toggle your OS dark mode).

- [ ] **Step 3: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Scaffold where-has-the-money-gone page"
```

---

## Task 5: Write Act 1 prose and the department table

**Goal:** Fill in the Act 1 section with the narrative prose and the department-by-department delta table. This task uses the research output from Tasks 1 and 2. The chart itself is built separately in Task 6.

**Files:**
- Modify: `where-has-the-money-gone.html` (replace the Act 1 placeholder)

- [ ] **Step 1: Write the prose under the Act 1 heading**

Replace the Act 1 placeholder with:

```html
<h2>Where it went</h2>

<p>From 2015 to 2026, Marblehead's total general fund spending grew from $X to $Y, an increase of roughly $Z per year. The six categories below account for most of that growth.</p>

<p>Of the additional annual spending since 2015, roughly $A went to health insurance, $B to pensions, $C to debt payments, $D to schools, and $E to contractual salary increases and everything else. The chart below shows how the mix has shifted year by year.</p>

<!-- Chart placeholder. Filled by Task 6. -->
<p><em>(chart goes here)</em></p>
```

Replace X, Y, Z, A, B, C, D, E with the verified numbers from Task 1. Write out actual dollar values to the nearest $100K (for example, "$59.0 million" or "$106.2 million"). If the six-category breakdown was simplified to four in Task 1 Step 8, update the prose to reflect that and note the simplification in the footnotes section.

- [ ] **Step 2: Write the department table**

Still under the Act 1 heading, below the chart placeholder, add the department-by-department table using the site's existing `.table-wrap` + `table.data` classes:

```html
<h3>Department by department, 2015 vs 2026</h3>
<p>Every line item in the town's general fund, ranked by dollar change. Rows at the top drove the most change in either direction.</p>

<div class="table-wrap">
  <table class="data">
    <thead>
      <tr>
        <th>Department</th>
        <th>FY2015</th>
        <th>FY2026</th>
        <th>Change ($)</th>
        <th>Change (%)</th>
      </tr>
    </thead>
    <tbody>
      <!-- Rows filled from Task 2 output, sorted by absolute dollar delta. -->
    </tbody>
  </table>
</div>
```

Fill the tbody with one row per department, using the Task 2 output. Example row format:

```html
<tr>
  <td>Fire Department</td>
  <td>$4,530,000</td>
  <td>$5,561,260</td>
  <td>+$1,031,000</td>
  <td>+23%</td>
</tr>
```

Negative deltas are written with a minus sign, not parentheses, and not colored.

- [ ] **Step 3: Open the page in a browser and confirm rendering**

The table should use the existing `table.data` styling: right-aligned numeric columns, left-aligned first column, tabular numerals, alternating row borders. The table should scroll horizontally on mobile (viewport < 600px) thanks to `.table-wrap` already handling overflow.

- [ ] **Step 4: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Fill Act 1 prose and department delta table"
```

---

## Task 6: Build the stacked spending chart for Act 1

**Goal:** Replace the chart placeholder from Task 5 with a hand-drawn inline SVG stacked area chart showing the six categories over time. Matches the style of existing charts under `charts/`.

**Files:**
- Modify: `where-has-the-money-gone.html` (replace the chart placeholder inside Act 1)

- [ ] **Step 1: Decide the chart dimensions and coordinate math**

Use a `viewBox="0 0 760 320"` SVG to match `charts/real_cost_comparison.html`. Plot 12 years (2015 to 2026) across x from 60 to 720, with each year at `x = 60 + (FY - 2015) * (660 / 11)`. Plot dollars on y from 280 down to 40, with the top value set to the next round number above the largest total (for example, $120M if the maximum total is around $110M), and the bottom set to $0.

Write the coordinate math as a comment at the top of the SVG, following the pattern in `charts/real_cost_comparison.html`:

```html
<svg class="chart" viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stacked area chart of Marblehead spending by category from FY2015 to FY2026, showing health insurance, pensions, debt payments, schools, public safety, and all other spending.">
  <!--
    Coordinate math:
      x per year = (720 - 60) / (2026 - 2015) = 60 pixels per year
      x(FY) = 60 + (FY - 2015) * 60
      y per dollar = (280 - 40) / <max total> = ... pixels per million
      y(dollars) = 280 - dollars / <max> * 240
  -->
```

Re-compute the per-pixel y scale once you know the true maximum total from Task 1.

- [ ] **Step 2: Draw the grid and axes**

Use `class="axis-base"` for the baseline (at y=280), and `class="grid-minor"` for horizontal gridlines at round-number y values. Add tick labels using `class="tick-label"` with `text-anchor="end"`. Year labels along the bottom go at y=300 with `text-anchor="middle"` using `class="tick-label tick-label--major"` for every third year, `class="tick-label tick-label--minor"` for the rest.

- [ ] **Step 3: Draw the six stacked areas**

Each category is a `<polygon>` that starts at the top of the previous stack, follows the upper edge of its own contribution across all years, then returns along the upper edge of the stack below. The order from bottom to top is: health insurance, pensions, debt payments, public safety, schools, everything else. Put schools near the top so the largest block anchors the visual.

Each polygon uses an existing series class for color: `class="data-fill s-..."`. The site already defines enough series classes (`s-revenue`, `s-cost`, `s-neutral`, `s-tier-1`, `s-tier-2`, `s-tier-3`) for six distinct colors. Pick six distinct classes and use them consistently between the chart and the legend.

Reference pattern from `charts/annual_gap.html` shows the polygon format:

```html
<g class="s-cost">
  <polygon fill="url(#gapFill)"
           points="..." />
</g>
```

For a stacked area you don't need the gradient; use a solid `fill="currentColor" fill-opacity="0.85"` (or similar) so the fill tracks the series color via `color: var(--series-...)` on the wrapping `<g>`.

- [ ] **Step 4: Add the legend above the chart**

Use the existing `.legend` + `.legend-item` + `.legend-swatch` pattern. One entry per category, in the same color as the stacked area:

```html
<div class="legend">
  <div class="legend-item s-tier-1"><span class="legend-swatch"></span><span class="legend-text">Health insurance</span></div>
  <div class="legend-item s-tier-2"><span class="legend-swatch"></span><span class="legend-text">Pensions</span></div>
  <!-- etc. -->
</div>
```

- [ ] **Step 5: Verify in light and dark mode**

Open the page in a browser. Toggle OS dark mode. Every polygon should re-color via the CSS custom properties already in the site stylesheet (the `.s-...` classes define `color: var(--series-...)` which has dark-mode overrides). If any color is hardcoded, remove it.

- [ ] **Step 6: Verify on mobile**

Resize the browser window to 400 pixels wide. The chart should scale via `width: 100%; height: auto;` already set on `svg.chart`. Add `class="annotation--hide-sm"` to every second tick label along the x axis so minor labels hide on mobile, matching the pattern in `charts/real_cost_comparison.html`.

- [ ] **Step 7: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Add stacked spending chart to Act 1"
```

---

## Task 7: Write Act 2 (who has been checking the books)

**Goal:** Fill in the Act 2 section listing the independent reviewers and what they check, with one piece of prose about what has been flagged.

**Files:**
- Modify: `where-has-the-money-gone.html` (replace the Act 2 placeholder)

- [ ] **Step 1: Write the reviewer list**

Replace the Act 2 placeholder with:

```html
<h2>Who has been checking the books</h2>

<p>Marblehead's finances have been independently reviewed every year since 2001. Here are the outside reviewers who sign off on the town's books, what each review actually checks, and where to read their findings.</p>

<div class="card">
  <h3>Independent annual audit</h3>
  <p>An outside accounting firm audits the town's books every year. Their opinion is published in the Annual Comprehensive Financial Report (ACFR). Marblehead has had a clean opinion for the full period shown above.</p>
  <p class="source">Source: <a href="data/acfr/FY24_ACFR.pdf">FY2024 independent annual audit</a>; prior years linked from the town website.</p>
</div>

<div class="card">
  <h3>State Department of Revenue tax rate certification</h3>
  <p>Before Marblehead can set a tax rate each year, the state Department of Revenue reviews the town's books and certifies that the levy complies with state law (including Proposition 2.5). This happens every year.</p>
  <p class="source">Source: annual tax rate certifications on file with the Town Clerk; summarized in each year's ACFR.</p>
</div>

<div class="card">
  <h3>State pension regulator actuarial review</h3>
  <p>The state's public employee retirement regulator commissions an independent actuarial valuation of Marblehead's pension fund every two years. The valuation sets the required annual contribution the town must pay.</p>
  <p class="source">Source: <a href="data/PERAC_Marblehead_Valuation_2024.pdf">2024 Marblehead pension valuation</a>; prior valuations from 2018, 2020, and 2022 also on file.</p>
</div>

<div class="card">
  <h3>Finance Committee reports</h3>
  <p>The Marblehead Finance Committee publishes an annual report reviewing the budget before Town Meeting votes on it. The Committee has repeatedly warned that the town's reliance on leftover surplus from prior years ("free cash") to balance the operating budget is not sustainable.</p>
  <p class="source">Source: <a href="data/2026_FinCom_Report.pdf">2026 Finance Committee Report</a>; earlier reports from 2016, 2019, 2021, 2022, and 2025 also available.</p>
</div>

<div class="card">
  <h3>Auditor management letters</h3>
  <p>In addition to the annual audit, the outside auditor writes a separate letter to town management flagging any control or process issues. These letters are published and are a place to look for early warning signs.</p>
  <p class="source">Source: <a href="data/FY22_Management_Letter.pdf">FY2022 Management Letter</a> and <a href="data/FY23_Management_Letter.pdf">FY2023 Management Letter</a>.</p>
</div>

<div class="card">
  <h3>Town Meeting</h3>
  <p>Every line of the operating budget is voted on at Town Meeting. Residents can attend, debate, and amend the budget before it passes. Town Meeting is itself an oversight mechanism: nothing gets spent without this vote.</p>
</div>

<p>These reviewers do not all agree the town is doing everything right. The Finance Committee has flagged the use of leftover surplus from prior years to balance the budget as a pattern that "cannot continue indefinitely." The next section lists the specific lines that have grown faster than enrollment, inflation, or headcount would explain, including that pattern.</p>
```

Verify every source link works. Wiring up a broken `data/` link (some of the referenced files are gitignored; replace with the on-site published location if needed).

- [ ] **Step 2: Open the page and spot-check**

Confirm the six cards render cleanly, the source links resolve to real PDFs, and the handoff paragraph at the bottom transitions into Act 3 without editorializing.

- [ ] **Step 3: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Add Act 2 oversight section to spending story page"
```

---

## Task 8: Write Act 3 (what grew faster)

**Goal:** Fill in the Act 3 section with the four verified claims from Task 3, presented as neutral bullet points with primary-source links.

**Files:**
- Modify: `where-has-the-money-gone.html` (replace the Act 3 placeholder)

- [ ] **Step 1: Write the section heading and intro**

Replace the Act 3 placeholder with:

```html
<h2>What grew faster</h2>

<p>Four lines in the budget grew faster than enrollment, inflation, or headcount would explain. Each is listed with its primary source. No commentary beyond what the source says.</p>
```

- [ ] **Step 2: Write each of the four bullets as a `.card`**

Use the verified claim wording from Task 3. The Task 3 research output (appended to this plan document) lists the exact values and primary source for each claim; copy them directly into the cards below. Example format:

```html
<div class="card">
  <h3>School staffing up <VERIFIED>% while enrollment fell <VERIFIED>%</h3>
  <p>Between 2015 and 2024, education full-time positions went from <VERIFIED> to <VERIFIED>. Over the same period, student enrollment fell from <VERIFIED> to <VERIFIED>.</p>
  <p>Part of this increase reflects special education staffing and state-mandated services, which grow in ways that are not tied to overall enrollment. The exact breakdown of special-education versus general-education staffing is not publicly documented in the town's budget; readers who want that detail will need to ask the School Committee.</p>
  <p class="source">Source: <a href="data/fte_employees_FY15-24.csv">FTE employees by department, FY2015 to FY2024</a>; enrollment from <a href="data/MASTER_DATA.csv">MASTER_DATA.csv</a>.</p>
</div>

<div class="card">
  <h3>Town counsel up <VERIFIED>% in one year</h3>
  <p>The town counsel line went from $<VERIFIED> in the FY2026 budget to $<VERIFIED> in the FY2027 proposed budget. The reason for the increase is <VERIFIED: either "documented in [source]" or "not publicly documented in the budget materials available at press time">.</p>
  <p class="source">Source: <a href="data/FY26_budget_summary.json">FY2026 budget summary</a> and the FY2027 proposed budget (linked from <a href="what-fails.html">what's in the no-override budget</a>).</p>
</div>

<div class="card">
  <h3>Retiree benefits trust contribution zeroed out</h3>
  <p>The town has been setting aside $250,000 per year in a separate trust to pre-fund retiree health benefits. The FY2027 no-override budget eliminates that contribution. The long-term liability does not go away; the town would simply be deferring payment.</p>
  <p class="source">Source: <a href="data/FY26_budget_summary.json">FY2026 budget summary</a> (`OPEB_Trust_Transfer: $250,000`) and the FY2027 proposed no-override budget (linked from <a href="what-fails.html">what's in the no-override budget</a>).</p>
</div>

<div class="card">
  <h3>Leftover surplus from prior years used to balance the budget</h3>
  <p>For several years running, the town has balanced its annual operating budget by drawing down $<VERIFIED> to $<VERIFIED> from leftover surplus ("free cash") from prior years. The Finance Committee has flagged this pattern repeatedly, most recently in its <a href="data/2026_FinCom_Report.pdf">2026 annual report</a>.</p>
  <p class="source">Source: <a href="data/2026_FinCom_Report.pdf">2026 Finance Committee Report</a>; prior warnings in the 2025 and 2022 reports also on file.</p>
</div>
```

Every `<VERIFIED>` placeholder must be replaced with the exact value from Task 3 before the task is considered complete. If any value could not be verified in Task 3, state that plainly in the corresponding card rather than leaving a placeholder.

- [ ] **Step 3: Open the page and read the section out loud**

Read each card out loud. If any sentence reads as a pro-override or anti-override argument rather than a statement of fact, rewrite it. Flag anywhere the tone slips into advocacy.

- [ ] **Step 4: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Add Act 3 verified claims to spending story page"
```

---

## Task 9: Write the closing section and notes

**Goal:** Fill in the short closing section and the `.notes` footnote block at the bottom of the page.

**Files:**
- Modify: `where-has-the-money-gone.html` (replace the Close placeholder and the notes placeholder)

- [ ] **Step 1: Write the close**

Replace the `What this means for the override` placeholder with:

```html
<h2>What this means for the override</h2>

<p>The record shows that most of Marblehead's spending growth went to health insurance, pensions, debt payments, and schools, and that independent reviewers have signed off on the books every year while also flagging the town's reliance on leftover surplus to balance the budget. The record also shows four specific lines that grew faster than enrollment, inflation, or headcount would explain.</p>

<p>Whether that record justifies voting for or against the FY2027 override is a judgment only voters can make. For the override's structure, cost, and what fails if it does not pass:</p>

<ul>
  <li><a href="what-is-the-override.html">What is the override?</a></li>
  <li><a href="charts/override_calculator.html">What does it cost me?</a></li>
  <li><a href="what-fails.html">What's in the no-override budget?</a></li>
  <li><a href="charts/sustainability.html">Will they ask again?</a></li>
</ul>
```

- [ ] **Step 2: Write the notes block**

Replace the notes placeholder with the full source list, drawing from Tasks 1, 2, and 3:

```html
<div class="notes">
  <p>Spending categories for the chart above come from the town's independent annual audits (FY2015 to FY2024), the Finance Committee's FY2025 and FY2026 annual reports, and the FY2027 proposed budget. Category boundaries are: health insurance (the "group insurance" line), pensions (contributory retirement), debt payments (debt service), schools (the school department appropriation), public safety (fire plus police), and everything else (the residual).</p>
  <p>The department-by-department table compares FY2015 (from the FY2015 independent annual audit) with FY2026 (from the town's budget summary). Some departments were consolidated or renamed between those years; those mappings are listed at [TASK 2 OUTPUT LINK] in the plan document.</p>
  <p>Full-time positions and enrollment data from the town's official staffing and school enrollment records, as aggregated in <a href="data/MASTER_DATA.csv">MASTER_DATA.csv</a>. The master dataset has per-field source attribution.</p>
  <p>Town counsel figures from the FY2026 budget summary and the FY2027 proposed budget. Retiree benefits trust contribution from the same sources.</p>
  <p>Leftover surplus warnings from the <a href="data/2026_FinCom_Report.pdf">2026</a>, <a href="data/2025_FinCom_Report.pdf">2025</a>, and <a href="data/2022_FinCom_Report.pdf">2022</a> Finance Committee annual reports.</p>
</div>
```

Replace `[TASK 2 OUTPUT LINK]` with the actual file and section once Task 2 is committed.

- [ ] **Step 3: Open the page top to bottom and read it end to end**

One continuous read. The page should feel like a single document, not a collage. If any section feels out of place, note it but do not restructure without pausing to discuss with the user.

- [ ] **Step 4: Commit**

```bash
git add where-has-the-money-gone.html
git commit -m "Add closing section and sources to spending story page"
```

---

## Task 10: Edit the homepage

**Goal:** Make the three small edits to `index.html` described in the spec.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the `id="data-sources"` anchor**

Find the line:

```html
<div class="data-section">
```

Change to:

```html
<div class="data-section" id="data-sources">
```

- [ ] **Step 2: Add the inline "See all sources" link to the hero**

Find the hero paragraph:

```html
<p>An open resource for residents evaluating the FY2027 budget override. Every number is traceable to a primary source.</p>
```

Change to:

```html
<p>An open resource for residents evaluating the FY2027 budget override. Every number is traceable to a primary source. <a href="#data-sources">See all sources.</a></p>
```

- [ ] **Step 3: Add the new "The record" section**

Find the closing tag of the `The override` question list:

```html
    </a>
  </div>

  <p class="section-label">Cost drivers</p>
```

Between `</div>` and `<p class="section-label">Cost drivers</p>`, insert:

```html

  <p class="section-label">The record</p>
  <div class="question-list">
    <a class="question" href="where-has-the-money-gone.html">
      <h2>Where has Marblehead's money gone?</h2>
      <p>A ten-year walkthrough of how the town has actually spent the tax levy, who has been checking the books, and what grew faster than enrollment or inflation would explain.</p>
      <span class="tag tag-text">Analysis</span>
    </a>
  </div>

```

Note: one card in the new section is intentional per the spec. A companion card could be added later.

- [ ] **Step 4: Open the homepage in a browser and verify**

Confirm:
- The new `The record` section appears between `The override` and `Cost drivers`.
- Clicking the new card navigates to `where-has-the-money-gone.html`.
- Clicking `See all sources` in the hero paragraph jumps to the Data & Sources section at the bottom of the page.
- No other section has shifted; nothing else has changed.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Add the record section and sources link to homepage"
```

---

## Task 11: End-to-end verification and polish

**Goal:** Final manual verification across browsers, modes, and viewports, plus a pass to catch any remaining em-dashes, acronyms, or editorial framing.

**Files:**
- Read: `where-has-the-money-gone.html`
- Read: `index.html`

- [ ] **Step 1: Em-dash scan**

Run:

```bash
grep -n "—" where-has-the-money-gone.html index.html
```

Expected: no matches. If there are any, replace with commas, periods, or colons.

- [ ] **Step 2: Acronym scan**

Run:

```bash
grep -nE "\b(ACFR|PERAC|OPEB|FTE|GIC|PEC|FinCom|COA|DOR|CPA)\b" where-has-the-money-gone.html
```

Expected: no matches in user-visible text. Hits inside HTML comments or the footnotes are acceptable only if the acronym appears in a file name or a linked document title. If any acronym shows up in body copy, replace with the plain-language expansion from the ground rules.

- [ ] **Step 3: Open `where-has-the-money-gone.html` in a browser**

Manually verify:
- Every section heading is present and in the correct order.
- The stacked chart renders in light mode with distinct colors for each category.
- Toggle the OS to dark mode; the chart re-colors via CSS custom properties and remains readable.
- Resize the viewport to 400 pixels wide; the chart scales, the table scrolls horizontally, and the prose reflows.
- Click every source link in the body and notes. Each should resolve to a real document (PDF, CSV, or another page).
- Click the back link. It should return to the homepage.

- [ ] **Step 4: Open `index.html` in a browser**

Manually verify:
- The new `The record` section appears between `The override` and `Cost drivers`.
- The new card links to `where-has-the-money-gone.html`.
- The `See all sources` link in the hero paragraph jumps to the Data & Sources section at the bottom.
- Toggle dark mode; everything still renders correctly.
- Resize to 400 pixels wide; the card is still tappable.

- [ ] **Step 5: Final read-through of both pages**

Read the new page end to end out loud once more. Read the homepage top to bottom. Flag any sentence that reads as advocacy for or against the override and rewrite it as a neutral statement of fact.

- [ ] **Step 6: Commit any final fixes**

```bash
git add where-has-the-money-gone.html index.html
git commit -m "Final polish: verify sources, scan acronyms, neutral framing"
```

If Step 6 has no changes to commit, skip the commit (do not create an empty commit).

- [ ] **Step 7: Update the site footer's `Last updated` date**

Open `index.html`, find:

```html
<p>Last updated April 10, 2026.</p>
```

Update to the current date in the same format. Commit:

```bash
git add index.html
git commit -m "Update last-updated date"
```

---

## Done criteria

All of the following must be true before the plan is considered complete:

- `where-has-the-money-gone.html` exists at the repo root and renders in a browser without errors.
- The new page contains a hero, Act 1 (prose, chart, department table), Act 2 (six oversight cards), Act 3 (four verified claims), a close, and a notes block with sources.
- Every number in the page has a primary source cited in the notes block or inline.
- `index.html` contains the `id="data-sources"` anchor, the `See all sources` hero link, and the new `The record` section with one card.
- No em-dashes anywhere in either file.
- No unexpanded acronyms in user-visible text.
- Every commit in the plan is a working state; `git log --oneline` shows a clean history of the implementation.

---

## Task 1 research output

### Scope and method

This section records the verified six-category spending table that feeds Task 5 (Act 1 prose) and Task 6 (Act 1 stacked area chart). Coverage: fiscal year 2015 through fiscal year 2026, twelve rows. All figures are actual expenditures on a budgetary (cash) basis for the Town of Marblehead General Fund.

> **Important for Tasks 5 and 6 (do not skip):** The two CSVs named in the original Task 1 plan, `data/pension_expenditure_FY15-24.csv` and `data/education_expenditure_FY15-24.csv`, report on a GAAP all-governmental-funds basis. They are **not** the source of any value in this table and must **not** be cited in the page's notes footer as sources for the Pensions column or the Schools column. Citing them alongside this table would produce a basis mismatch that a careful reader can catch (for example, the education CSV reports FY24 at roughly 51.35 million, while this table's Schools column shows 46,168,131 on a General Fund budgetary basis). For the chart and the department-level numbers in Act 1, cite the ACFR "Schedule of Revenues, Expenditures and Changes in Fund Balance - Budget and Actual - General Fund" (FY15 through FY24) and the FY27 Proposed Budget PDF (FY25 and FY26). The `data/group_insurance_FY14-27.csv` file is safe to reference as supporting context for the Health insurance column because it tracks the same Group Insurance line, but be aware that it reports appropriations rather than actual expenditures and is missing FY2020.

Why budgetary-basis General Fund and not GAAP "Changes in Fund Balances":

1. The General Fund is the money the Finance Committee builds the annual budget around and Town Meeting votes on. It is what readers think of when they hear "where has the town's money gone."
2. The broader "Changes in Fund Balances, Governmental Funds" table (ACFR statistical section) adds special revenue funds (school food service, athletics, federal and state grants, capital projects) and state on-behalf pension payments. Those are real money but they muddy a "what did the town choose to spend" story.
3. Budget-basis data from the ACFR "Schedule of Revenues, Expenditures and Changes in Fund Balance - Budget and Actual - General Fund" can be directly joined to the FY27 Proposed Budget (which publishes FY25 expended, FY26 budget, and FY27 proposed on the same basis). This gives one consistent twelve-year series instead of two accounting worldviews stitched together.

Category definitions (applied identically every year):

- **Health insurance** = Group Insurance (budget line 221) plus Medicare (the ACFR "Medicare" line under Fringe or Employee Benefits, which the town uses to reimburse retiree Medicare Part B premiums; the FY26 budget summary JSON labels this `Medicare_Reimbursement`). Does not include the Medicare payroll-tax line 218 in the FY27 Proposed Budget, which is a different, smaller item that the town pays on active payroll. That line 218 is 272,000 (FY25 budget), 248,379 (FY25 actual expended), and 280,000 (FY26 budget); it is left in Everything Else for every year. For FY25 and FY26, Medicare Reimbursement has been consolidated inside the Group Insurance line 221 in the FY27 Proposed Budget, so the Group Insurance value alone is used for those two years (no separate ACFR Medicare sub-line is added).
- **Pensions** = Total Pension Benefits = Contributory Retirement Fund plus Noncontributory Retirement (pre-1988 hire liability paid directly by the town). For FY25-FY26 the Noncontributory line is zero in the FY27 Proposed Budget, so only Contributory Retirement is used.
- **Debt payments** = Total Debt Service = Maturing Debt (principal) plus Interest. Does not include bond issuance premiums or refunding transfers, which show up in the Changes in Fund Balances table but not in the budget-basis schedule.
- **Schools** = Total Education in the ACFR budget-and-actual schedule (the Schools line plus any school capital articles voted under the schools vote). For FY25-FY27, the School Department vote total from the FY27 Proposed Budget.
- **Public safety** = Total Public Safety in the ACFR budget-and-actual schedule (Police, Fire, Building Inspection, Sealer of Weights and Measures, Animal Inspector). This is a wider bucket than just Fire plus Police; the FY26 budget summary JSON (Fire $5,561,260 plus Police $4,987,087 equals $10,548,347) excludes Building Inspection and the minor inspectors.
- **Everything else** = Total Expenditures minus the five named categories above. Residually includes General Government, Public Works, Human Services, Culture and Recreation, Energy and Utility Reserve, Property and Liability Insurance, State and County charges, and the small employee benefits items (Salary Reserve, Workers Comp, Training, OPEB transfer, stabilization). This is honest: it groups together every department and transfer that is not individually broken out in the chart.

### Primary sources

- ACFR "Schedule of Revenues, Expenditures and Changes in Fund Balance - Budget and Actual - General Fund" for each fiscal year. Page citations below are to the logical page numbers printed on the ACFR pages.
  - `data/acfr/FY15_ACFR.pdf` pages 76 to 78
  - `data/acfr/FY16_ACFR.pdf` pages 78 to 80
  - `data/acfr/FY17_ACFR.pdf` pages 83 to 85
  - `data/acfr/FY18_ACFR.pdf` pages 89 to 91
  - `data/acfr/FY19_ACFR.pdf` pages 88 to 90
  - `data/acfr/FY20_ACFR.pdf` pages 92 to 94
  - `data/acfr/FY21_ACFR.pdf` pages 92 to 94
  - `data/acfr/FY22_ACFR.pdf` pages 89 to 91
  - `data/acfr/FY23_ACFR.pdf` pages 87 to 89
  - `data/acfr/FY24_ACFR.pdf` pages 95 to 97
- FY25 expended actuals, FY26 budget, FY27 proposed: `data/budgets/FY27_Proposed_Budget_No_Override.pdf` pages 1 to 4 (the "Table of Estimate Appropriations" covers every department and transfer through Total General Fund Accounts on page 4).
- Cross-checks for FY26 only: `data/FY26_budget_summary.json`.

### Verified table (dollars, not thousands)

The `Basis` column marks how each row was sourced. `actual` rows are actual budgetary expenditures pulled from each year's ACFR "Budget and Actual - General Fund" schedule. The FY25 row is FY25 actual expended as reported in the FY27 Proposed Budget (published April 2026); the town's FY25 ACFR has not been released yet. The FY26 row is the Town Meeting approved budget, not actuals, because FY26 is still in progress as of April 2026. Task 6 should render FY25 and FY26 visually distinct from FY15-FY24 (for example, dashed or hatched segments) so readers can see which bars are based on closed-book actuals. Total column matches the ACFR or the FY27 Proposed Budget line exactly, so "Everything else" is a clean residual.

| FY   | Basis    | Health insurance | Pensions  | Debt payments | Schools    | Public safety | Everything else | Total       |
|------|----------|------------------|-----------|---------------|------------|---------------|-----------------|-------------|
| 2015 | actual   | 10,388,908       | 2,278,613 | 5,475,855     | 32,066,336 | 7,316,544     | 12,971,821      | 70,498,077  |
| 2016 | actual   | 10,973,609       | 2,451,137 | 5,972,324     | 33,252,150 | 7,508,198     | 13,038,234      | 73,195,652  |
| 2017 | actual   | 11,212,339       | 2,630,329 | 6,823,406     | 35,026,294 | 7,623,507     | 13,548,121      | 76,863,996  |
| 2018 | actual   | 11,740,760       | 2,875,231 | 7,156,767     | 37,446,929 | 8,145,159     | 14,399,294      | 81,764,140  |
| 2019 | actual   | 11,836,691       | 3,100,539 | 6,734,428     | 38,673,888 | 8,456,948     | 14,463,143      | 83,265,637  |
| 2020 | actual   | 11,976,422       | 3,311,646 | 6,946,380     | 40,262,455 | 8,505,510     | 14,206,442      | 85,208,855  |
| 2021 | actual   | 12,322,287       | 3,571,499 | 7,507,960     | 40,464,964 | 8,845,161     | 13,086,552      | 85,798,423  |
| 2022 | actual   | 12,767,343       | 3,825,926 | 9,438,701     | 42,621,754 | 9,779,169     | 15,147,299      | 93,580,192  |
| 2023 | actual   | 13,040,356       | 4,151,398 | 10,106,619    | 43,754,615 | 10,211,783    | 15,564,637      | 96,829,408  |
| 2024 | actual   | 12,885,677       | 4,512,303 | 11,006,139    | 46,168,131 | 11,300,995    | 16,375,863      | 102,249,108 |
| 2025 | expended | 12,994,934       | 4,879,451 | 11,085,298    | 46,294,268 | 10,863,267    | 14,326,986      | 100,444,204 |
| 2026 | budget   | 15,100,893       | 5,380,625 | 9,314,141     | 49,120,287 | 11,237,760    | 16,052,674      | 106,206,380 |

Every row sums to the Total column exactly (no rounding gap, so the sanity-check tolerance of 2 percent in Step 7 is satisfied with room to spare).

### Per-row source notes

Each cell below cites the source used. ACFR citations use the logical page number printed on the page.

**FY2015** (source: `data/acfr/FY15_ACFR.pdf` pages 76 to 78, Actual Budgetary Amounts column):
- Health insurance: Medicare 542,558 plus Group Insurance 9,826,265 plus Group Insurance FY13 carry-forward 20,085 equals 10,388,908.
- Pensions: Contributory Retirement 2,189,381 plus Noncontributory Retirement 89,232 equals 2,278,613 (Total Pension Benefits line).
- Debt: Maturing Debt 3,219,000 plus Interest 2,256,855 equals 5,475,855 (Total Debt Services line).
- Schools: Schools 31,675,819 plus Essex North Shore art. 21 233,858 plus improvement art. 11 100,000 plus Art. 10 equipment 56,659 equals 32,066,336 (Total School line).
- Public safety: 7,316,544 (Total Public Safety line; includes Police, Fire, Building Commissioner, Sealer, Animal Inspector).
- Everything else: Total Expenditures 70,498,077 minus the five above equals 12,971,821. Composition: Total General Government 2,291,853, Total Public Works 4,841,505, Total Human Services 635,344, Total Culture and Recreation 1,808,809, Energy Reserve 309,146, Property and Liability Insurance 318,315, Salary Reserve 60,985, Intergovernmental State 2,705,864 (sum equals 12,971,821, matches).

**FY2016** (source: `data/acfr/FY16_ACFR.pdf` pages 78 to 80):
- Health: Medicare 575,214 plus Group Insurance 10,378,199 plus Group Insurance FY13 20,196 equals 10,973,609.
- Pensions: 2,451,137 (Total Pension Benefits).
- Debt: 5,972,324 (Total Debt Services; 3,718,000 principal plus 2,254,324 interest).
- Schools: 33,252,150 (Total School).
- Public safety: 7,508,198 (Total Public Safety).
- Everything else: 73,195,652 minus 60,157,418 equals 13,038,234.

**FY2017** (source: `data/acfr/FY17_ACFR.pdf` pages 83 to 85):
- Health: Medicare 611,840 plus Group Insurance 10,580,051 plus Group Insurance FY13 20,448 equals 11,212,339.
- Pensions: 2,630,329.
- Debt: 6,823,406 (4,085,000 principal plus 2,738,406 interest).
- Schools: 35,026,294.
- Public safety: 7,623,507.
- Everything else: 76,863,996 minus 63,315,875 equals 13,548,121.

**FY2018** (source: `data/acfr/FY18_ACFR.pdf` pages 89 to 91):
- Health: Medicare 633,529 plus Group Insurance 11,080,919 plus Group Insurance FY13 26,312 equals 11,740,760.
- Pensions: 2,875,231.
- Debt: 7,156,767 (4,507,000 principal plus 2,649,767 interest).
- Schools: 37,446,929.
- Public safety: 8,145,159.
- Everything else: 81,764,140 minus 67,364,846 equals 14,399,294.

**FY2019** (source: `data/acfr/FY19_ACFR.pdf` pages 88 to 90):
- Health: Medicare 653,319 plus Group Insurance 11,157,717 plus Group Insurance FY13 25,655 equals 11,836,691.
- Pensions: 3,100,539.
- Debt: 6,734,428 (4,150,000 principal plus 2,584,428 interest).
- Schools: 38,673,888.
- Public safety: 8,456,948.
- Everything else: 83,265,637 minus 68,802,494 equals 14,463,143.

**FY2020** (source: `data/acfr/FY20_ACFR.pdf` pages 92 to 94):
- Health: Medicare 652,175 plus Group Insurance 11,303,115 plus Group Insurance FY13 21,132 equals 11,976,422.
- Pensions: 3,311,646.
- Debt: 6,946,380 (4,425,000 principal plus 2,521,380 interest).
- Schools: 40,262,455.
- Public safety: 8,505,510.
- Everything else: 85,208,855 minus 71,002,413 equals 14,206,442.
- Note: the `data/group_insurance_FY14-27.csv` row for FY2020 is missing. This ACFR extract fills that gap for the page-level chart.

**FY2021** (source: `data/acfr/FY21_ACFR.pdf` pages 92 to 94):
- Health: Medicare 682,833 plus Group Insurance 11,639,454 equals 12,322,287. (No Group Insurance FY13 carry-forward this year or later.)
- Pensions: 3,571,499.
- Debt: 7,507,960 (4,640,012 principal plus 2,867,948 interest).
- Schools: 40,464,964.
- Public safety: 8,845,161.
- Everything else: 85,798,423 minus 72,711,871 equals 13,086,552.

**FY2022** (source: `data/acfr/FY22_ACFR.pdf` pages 89 to 91):
- Health: Medicare 669,038 plus Group Insurance 12,098,305 equals 12,767,343.
- Pensions: 3,825,926.
- Debt: 9,438,701 (5,375,000 principal plus 4,063,701 interest). Large year-on-year jump is the full-year debt service on the new high school bonds.
- Schools: 42,621,754.
- Public safety: 9,779,169.
- Everything else: 93,580,192 minus 78,432,893 equals 15,147,299.

**FY2023** (source: `data/acfr/FY23_ACFR.pdf` pages 87 to 89):
- Health: Medicare 709,885 plus Group Insurance 12,330,471 equals 13,040,356.
- Pensions: 4,151,398 (Contributory Retirement only; Noncontributory zero).
- Debt: 10,106,619 (6,465,000 principal plus 3,641,619 interest).
- Schools: 43,754,615.
- Public safety: 10,211,783.
- Everything else: 96,829,408 minus 81,264,771 equals 15,564,637.

**FY2024** (source: `data/acfr/FY24_ACFR.pdf` pages 95 to 97):
- Health: Medicare 733,655 plus Group Insurance 12,152,022 equals 12,885,677. (ACFR format change: Medicare and Group Insurance are now sub-lines of "Total Employee Benefits" at 12,944,603, which also includes Salary Reserve 58,926. The 58,926 is left in Everything Else.)
- Pensions: 4,512,303.
- Debt: 11,006,139 (6,980,000 principal plus 4,026,139 interest).
- Schools: 46,168,131 (includes 468,762 Essex North Shore article).
- Public safety: 11,300,995.
- Everything else: 102,249,108 minus 85,873,245 equals 16,375,863.

**FY2025** (source: `data/budgets/FY27_Proposed_Budget_No_Override.pdf` pages 1 to 4, "FY2025 EXPENDED" column):
- Health: Group Insurance 12,994,934 (includes Medicare Reimbursement, which the FY27 Proposed Budget has rolled into Group Insurance line 221). The separate "Medicare" payroll-tax line 218 is 272,000 budget / 248,379 actual expended for FY25; consistent with the Category Definitions block above, that line is left in Everything Else.
- Pensions: Contributory Retirement 4,879,451 (Noncontributory Retirement line is zero in FY27 Proposed Budget).
- Debt: Total Debt Service 11,085,298 (Maturing Debt 7,540,000 plus Interest 3,545,298).
- Schools: 46,294,268 (School Department vote total).
- Public safety: 10,863,267 (Total Public Safety vote).
- Everything else: Total General Fund Accounts 100,444,204 minus 86,117,218 equals 14,326,986.
- Cross-check: FY27 Proposed Budget lists FY25 Budget of 14,465,018 for Group Insurance. Actual came in at 12,994,934, which is 10.2 percent under budget. This matches the data catalog note that FY24-FY25 actuals were below budget due to favorable claims.

**FY2026** (source: `data/budgets/FY27_Proposed_Budget_No_Override.pdf` pages 1 to 4, "FY2026 BUDGET" column; FY26 is still in progress as of April 2026 so no actuals are available):
- Health: Group Insurance 15,100,893.
- Pensions: Contributory Retirement 5,380,625.
- Debt: Total Debt Service 9,314,141 (Maturing Debt 5,955,000 plus Interest 3,359,141). Drop from FY25 is a scheduled principal paydown on refunded bonds, not a debt-level reduction.
- Schools: 49,120,287 (School Department vote).
- Public safety: 11,237,760 (Total Public Safety vote).
- Everything else: Total General Fund Accounts 106,206,380 minus 90,153,706 equals 16,052,674.
- Cross-checks against `data/FY26_budget_summary.json`:
  - Debt: JSON 9,314,141, table 9,314,141, matches exactly.
  - Pension: JSON Pension_Contribution 5,380,625, table 5,380,625, matches exactly.
  - Health: JSON Health_Insurance_Transfer 11,828,487 plus Medex_Insurance_Transfer 2,534,769 plus Medicare_Reimbursement 730,651 equals 15,093,907. Table shows 15,100,893. Gap of 6,986 (0.05 percent), within rounding or minor line-item reallocation.
  - Public safety: JSON Fire 5,561,260 plus Police 4,987,087 equals 10,548,347. Table 11,237,760 includes Building Inspection 687,313, Sealer 2,100, Animal Inspector 2,400, total 10,548,347 plus 691,813 equals 11,240,160. Gap of 2,400 (0.02 percent) reconciles to a Police line adjustment (JSON 4,987,087 vs FY27 PDF 4,984,687).

### Sanity checks performed

1. Every twelve rows sum exactly to the published Total Expenditures / Total General Fund Accounts. No row has a residual rounding gap.
2. Every FY26 line cross-checked against `data/FY26_budget_summary.json`. All gaps are under 0.1 percent and are traceable to line-item reallocations between documents.
3. FY24 cross-check against the ACFR Statistical Section "Changes in Fund Balances - Governmental Funds - Last Ten Fiscal Years" (`data/acfr/FY24_ACFR.pdf` page 118). That table uses a broader all-funds basis, so its total of 128,830,811 is higher than the General Fund 102,249,108. The education line there (51,350,385) is higher than the General Fund Schools line (46,168,131) because it folds in school food service, athletics, and grant-funded programs. The pension benefits line there (12,491,338) is much higher than the General Fund pension (4,512,303) because it adds the state's on-behalf MTRS payment (approximately 7,979,035 per the budgetary-to-GAAP reconciliation on FY24 ACFR page 100). None of this contradicts the budget-basis table; it simply confirms that the two views measure different things.
4. Health insurance row cross-check against `data/group_insurance_FY14-27.csv`. The CSV reports total Group Insurance appropriations (the budgeted amount) for each year; the budgetary table above reports actual expenditures (typically 5 to 15 percent lower than the appropriation because favorable claims left unspent balances). The shape and trend are the same.

### Known deviations and uncertainties

- The `data/group_insurance_FY14-27.csv` file is missing FY2020. This research uses the FY20 ACFR Budget-and-Actual schedule to fill that gap; the value (11,976,422) is actual expended.
- FY26 is a budget number, not an actual. The page should say "FY26 budget" in any prose that uses the FY26 figures. Favorable or adverse claims during the remainder of FY26 will move the actual total.
- FY27 projected values (not in the twelve-row table but useful for prose context) come from the same document: Group Insurance 16,754,748, Pension 5,843,360, Debt Service 11,098,398, Schools 47,620,287, Public Safety 11,861,711, Total General Fund 109,777,938. Everything else residual would be 16,599,434.
- The "Medicare" line in the ACFR's Fringe Benefits or Employee Benefits section is interpreted as Medicare Reimbursement (retiree Part B reimbursement) based on its size (roughly 500,000 to 750,000 across FY15 to FY24) and its consolidation into Group Insurance line 221 in the FY25-FY27 budget documents. A separate Medicare payroll-tax line 218 appears in the FY27 Proposed Budget at 272,000 (FY25 budget) / 248,379 (FY25 actual expended) / 280,000 (FY26 budget). These are two different items: the small payroll-tax line is left in Everything Else every year, and the larger retiree reimbursement line is combined into Health insurance for FY15 through FY24 and is already inside Group Insurance line 221 for FY25 and FY26.
- `data/pension_expenditure_FY15-24.csv` reconciliation. The CSV reports on a GAAP all-governmental-funds basis (the "Pension Benefits" line from the ACFR Changes in Fund Balances statistical section) and includes the state's on-behalf Massachusetts Teachers' Retirement System contribution, which is roughly 6 million to 8 million per year. Example: for FY2024 the CSV reports 12,491,338, while this table's Pensions column shows 4,512,303 (Contributory Retirement plus Noncontributory Retirement on a General Fund budgetary basis). The difference is the state on-behalf payment of approximately 7,979,035 for FY24 (see the budgetary-to-GAAP reconciliation on `data/acfr/FY24_ACFR.pdf` page 100). The CSV is **not** the source for the Pensions column in this table and should not be cited alongside it in the page's notes footer. If a prose section of the page needs to talk about the town's full pension exposure (including state on-behalf payments), it can cite the CSV separately, but it must not conflate the two views.
- `data/education_expenditure_FY15-24.csv` reconciliation. Same issue, different category. The CSV reports on a GAAP all-governmental-funds basis (the "Education" line from the Changes in Fund Balances statistical section) and includes school special revenue funds such as food service, athletics fees, federal and state grants, and prior-year adjustments. Example: for FY2024 the CSV reports 51,350,385, while this table's Schools column shows 46,168,131 (Total Education on a General Fund budgetary basis, which is the Schools department vote plus Essex North Shore and any school capital articles voted under the schools vote). The roughly 5.2 million difference is the grant-funded and fee-funded school activity that the CSV includes but the General Fund vote does not. The CSV is **not** the source for the Schools column in this table and should not be cited alongside it in the page's notes footer. The data catalog already flags the CSV's FY22 and FY23 anomalies as likely GASB adjustments, which are another reason not to mix the two bases in one chart.
- Budgetary-basis General Fund excludes state on-behalf pension contributions (roughly 6 million to 8 million per year in recent years for the Massachusetts Teachers' Retirement System). Any prose that talks about the town's pension exposure should either note this explicitly or explain that the table uses the town's direct appropriation and leaves state payments out.
- The six-category breakdown was completed in full (no fallback to the four-category simplification in Step 8 was necessary). Debt and public safety extracted cleanly from the ACFR Budget and Actual schedules.

### Schools deep dive (for Task 5 prose)

The six-category table shows that schools drove roughly $17 million of the $35.7 million in Marblehead general fund spending growth between FY2015 and FY2026, about 48 percent of total growth. This section breaks down what is inside that number so Task 5 can write honest Act 1 prose. All figures below are verified against primary sources in `data/`.

**Nominal growth and inflation adjustment.**

Total Schools line, FY2015 budgetary basis: 32,066,336. Total Schools line, FY2024 budgetary basis (most recent closed-book actual): 46,168,131. Nominal growth: +44.0 percent.

BLS CPI-U (`data/cpi_us.csv`): 2014 annual average 236.7, 2015 annual average 237.0, 2023 annual average 304.7, 2024 annual average 313.7. Using the fiscal-year midpoint method (FY15 = average of 2014 and 2015 = 236.85, FY24 = average of 2023 and 2024 = 309.2), the inflation factor is 309.2 / 236.85 = 1.306, or +30.6 percent. After inflation, the Schools line grew about 10 percent in real terms between FY2015 and FY2024.

**Per-pupil spending (the standard Massachusetts comparison metric).**

From `data/marblehead_per_pupil.csv`, sourced from the state Department of Elementary and Secondary Education (DESE):

- FY2015 in-district per-pupil: $13,504
- FY2024 in-district per-pupil: $20,743
- Nominal growth: +53.6 percent
- Real growth after inflation: about +17.6 percent

Per-pupil spending grew faster than the total Schools line because enrollment fell at the same time. The in-district per-pupil metric excludes out-of-district special education tuition and is the number DESE uses for cross-town comparisons.

**The teacher headcount story is not what the original plan assumed.**

The original Task 3 claim in the plan says "school staffing up 9.6 percent while enrollment fell 19 percent." That comes from `data/fte_employees_FY15-24.csv`, which rolls up all education staff (classroom teachers plus paraprofessionals plus aides plus administrators plus specialists plus support staff). From `data/dese_peer_teachers_enrollment.csv`, the state DESE breaks out classroom teachers specifically:

| Year | Teacher FTE (DESE) | Enrollment | Students per teacher |
|------|--------------------|------------|----------------------|
| 2015 | 256.8              | 3,245      | 12.64                |
| 2024 | 245.8              | 2,617      | 10.65                |

Classroom teacher headcount fell by 11.0 positions between FY2015 and FY2024, a decline of 4.3 percent. Enrollment fell by 628 students, or 19.4 percent. Teachers declined, but more slowly than enrollment, so the student-to-teacher ratio improved from 12.6 to 10.7.

Non-teaching education staff (total education FTE minus DESE teacher FTE): roughly 233 in FY2015 (489.8 minus 256.8), roughly 291 in FY2024 (537.0 minus 245.8). That is an increase of about 58 positions, or about 25 percent. Most of the "staffing up while enrollment down" narrative sits in this non-teaching group: paraprofessionals, aides, and support staff.

Task 5 and Task 3 must handle this carefully. The honest statement is: "Classroom teacher headcount actually fell slightly (eleven positions) between 2015 and 2024. Non-teaching staff (paraprofessionals, aides, and specialists) grew by roughly 25 percent over the same period, which is what drives the rolled-up 9.6 percent staffing increase in the town's own records."

**Peer-town context (DESE, same source).**

Students per classroom teacher, FY2024:

- Marblehead: 10.65
- Stoneham: 10.79
- Swampscott: 11.05
- Melrose: 13.72

Marblehead has the lowest (richest) student-to-teacher ratio of the four peer towns in the existing comparisons on the site. Melrose has nearly 30 percent more students per teacher. This is a real choice: Marblehead has maintained a smaller class size as enrollment declined, rather than reducing teacher headcount proportionally.

**Where the school budget actually goes, FY2026.**

From `data/FY26_budget_summary.json` (`School_Key_Items`):

| Line item                          | FY26 budget   |
|------------------------------------|---------------|
| District-wide                      | $14,556,594   |
| High School                        | $10,766,310   |
| Village Elementary                 | $7,679,662    |
| Middle School                      | $5,857,003    |
| Brown Elementary                   | $5,476,279    |
| Glover Elementary                  | $4,374,821    |
| Athletics                          | $391,718      |
| Out-of-district SpEd (see below)   | $4,558,573    |

The "District-wide" bucket is 30 percent of the school appropriation and includes central administration, district-level special education services, curriculum, assessment, and technology. Out-of-district special education tuitions and transportation sit as their own line items at approximately 9.3 percent of the total school budget:

- SpEd tuition, private day: $1,933,523
- SpEd tuition, residential: $1,026,993
- SpEd tuition, collaborative: $601,647
- Out-of-district transportation: $996,410
- Total out-of-district SpEd and transportation: $4,558,573

These are payments for Marblehead students whose needs cannot be met in-district. They are mandated by the federal Individuals with Disabilities Education Act and by state special education law; the town does not have discretion to reduce them.

**The override directly restores out-of-district special education funding.**

From `data/override_school_items.csv` (Tier 1 of the override, FY2028 and FY2029):

- "Restore Special Education Out of District Tuition" at $1,500,000 per year

This line is the single largest school item in Tier 1. Its presence on the override ballot means that out-of-district special education funding has been explicitly reduced in the FY27 no-override budget by approximately $1.5 million, a reduction the town will have to absorb elsewhere (presumably by delaying other services or drawing more reserves) if the override fails.

**Honest statement for Task 5 Act 1 prose.**

Drawing on the above, Task 5 can write something like (verify wording against these exact numbers):

> Schools drove nearly half the dollar growth in Marblehead's general fund between 2015 and 2026. After adjusting for inflation, the total schools line grew about 10 percent over the nine-year window where actuals are available. Per-pupil spending, which is the Department of Education's standard comparison metric, grew about 18 percent in real terms as enrollment fell. Classroom teacher headcount declined slightly, from 257 to 246, while non-teaching school staff (paraprofessionals, aides, and specialists) grew by about 25 percent. Marblehead kept a smaller student-to-teacher ratio than Swampscott, Stoneham, or Melrose as enrollment declined. About 9 percent of the FY2026 school budget, roughly $4.6 million, pays for Marblehead students to attend special education programs outside the district. That line is mandated by federal and state law.

**Sources for the deep dive.**

- `data/MASTER_DATA.csv` for tax levy and pension totals cross-checks
- `data/dese_peer_teachers_enrollment.csv` for teacher FTE and enrollment by town, 2015 through 2024
- `data/marblehead_per_pupil.csv` for DESE in-district per-pupil spending, 2008 through 2024
- `data/fte_employees_FY15-24.csv` for total education FTE rollup
- `data/cpi_us.csv` for BLS CPI-U annual averages
- `data/FY26_budget_summary.json` for the FY26 school line-item breakdown
- `data/override_school_items.csv` for the Tier 1 special education out-of-district tuition restoration

