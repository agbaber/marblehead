# School building maintenance — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new bespoke HTML page at `school-building-maintenance.html` that surfaces the tracking gap, the 2021 EBI baseline limited to currently operating schools, the closed-buildings disposition story, the funding picture (including the override-funded $500K/yr capital fund), and what's actively moving. Two inline-SVG charts, citations linking to primary sources in the repo.

**Architecture:** Static HTML page using the project's existing `page` Jekyll layout, the `citations` and `deep-dive` scripts, and the established `.page-lead` / `.key-stats` / `.peer-table` patterns. Inline `<style>` block scoped with `body.page-school-buildings` or section-class prefixes to avoid bleed. Inline `<svg>` for both charts. Inline JS data structure for the backlog chart, derived from `data/schools/capital-facilities/capital-facilities-plan.txt`. No new build dependencies, no D3, no Observable Plot.

**Tech Stack:** Jekyll 3.10.0 (matches Gemfile), Playwright (Chromium) for smoke tests, existing SVG chart conventions from `inside-school-staffing.html` and `town-budget.html`. Local dev via `npm run dev` (bundle exec jekyll serve). Test via `npm run test:local`.

**Prerequisites before starting:**
- This plan must be executed in a **fresh worktree off `origin/main`**. The brave-desert worktree where the spec was written is ~91 commits behind main and is missing `_transcripts/`. The spec file lives on brave-desert; Task 0 copies it into the new worktree.
- Read the spec at `docs/superpowers/specs/2026-06-12-school-building-maintenance-design.md` before starting. Tasks below reference its sections by number.

---

## Files

**Created:**
- `school-building-maintenance.html` — the new page (~25-40 KB)
- `tests/school-building-maintenance.test.mjs` — Playwright smoke test file for this page
- `proof/<branch-name>.png` — required proof-of-work screenshot per CLAUDE.md

**Modified:**
- `_includes/nav.html` — add nav entry next to "Inside school staffing"

**Read-only references (data sources cited in the page):**
- `data/schools/capital-facilities/capital-facilities-plan.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt`
- `data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-2-13-2026.txt`
- `_transcripts/school-committee-2024-04-25.md`
- `_transcripts/school-committee-2026-04-09.md`
- `_transcripts/school-committee-2026-05-21.md`
- `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt`
- `2026-override/index.html`

---

## Task 0: Set up the worktree and spec

**Files:**
- Create: new worktree directory under `/home/claude/marblehead/.dev/worktree/<auto-name>/`
- Copy: `docs/superpowers/specs/2026-06-12-school-building-maintenance-design.md` (from brave-desert)
- Copy: `docs/superpowers/plans/2026-06-12-school-building-maintenance.md` (this file, from brave-desert)

- [ ] **Step 1: From the parent repo, create the fresh worktree off main**

Run from `/home/claude/marblehead/`:
```bash
cd /home/claude/marblehead/marblehead
git fetch origin main
git worktree add .dev/worktree/school-maintenance-page -b school-maintenance-page origin/main
cd .dev/worktree/school-maintenance-page
```

Expected: new directory with a checkout of main.

- [ ] **Step 2: Bring the spec and this plan into the new worktree**

```bash
git checkout brave-desert -- docs/superpowers/specs/2026-06-12-school-building-maintenance-design.md
git checkout brave-desert -- docs/superpowers/plans/2026-06-12-school-building-maintenance.md
git status
```

Expected: spec and plan files staged.

- [ ] **Step 3: Verify _transcripts/ contains the cited files**

```bash
ls _transcripts/school-committee-2024-04-25.md _transcripts/school-committee-2026-04-09.md _transcripts/school-committee-2026-05-21.md
```

Expected: all three files exist.

- [ ] **Step 4: Install deps and confirm dev server boots**

```bash
bundle install
npm install
npm run dev &
sleep 6
curl -sS http://localhost:4000/ | head -5
kill %1
```

Expected: HTML returned from local Jekyll, no errors.

- [ ] **Step 5: Commit the spec and plan into the new worktree**

```bash
git add docs/superpowers/specs/2026-06-12-school-building-maintenance-design.md docs/superpowers/plans/2026-06-12-school-building-maintenance.md
git commit -m "docs: bring spec and plan into school-maintenance-page worktree"
```

---

## Task 1: Create the page skeleton and nav entry

**Files:**
- Create: `school-building-maintenance.html`
- Modify: `_includes/nav.html` (one line added after the "Inside school staffing" link)

- [ ] **Step 1: Write the failing smoke test**

Create `tests/school-building-maintenance.test.mjs`:

```javascript
/**
 * Smoke test for school-building-maintenance.html
 *
 * Run with:
 *   node tests/school-building-maintenance.test.mjs
 *
 * Convention matches tests/smoke-test.mjs: bare Playwright, no test
 * framework, pass/fail counters.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://localhost:4000';
const URL = SITE + '/school-building-maintenance.html';

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Skeleton
  const h1 = await page.textContent('h1');
  h1 && h1.includes('School building maintenance')
    ? ok('h1 reads "School building maintenance"')
    : fail('h1', `expected "School building maintenance", got "${h1}"`);

  const pageLead = await page.$('.page-lead');
  pageLead ? ok('.page-lead present') : fail('.page-lead', 'missing');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm run dev &
sleep 6
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: FAIL on h1 / .page-lead (404 page returns instead).

- [ ] **Step 3: Create the page skeleton**

Create `school-building-maintenance.html`:

```html
---
title: "School building maintenance"
scripts: [citations, deep-dive]
og_title: "School building maintenance"
og_description: "The only comprehensive condition assessment of Marblehead's school buildings was done in 2021. The district has no central record of what's been fixed since."
og_url: https://marbleheaddata.org/school-building-maintenance.html
---
<style>
  /* Page-scoped styles. Mirror inside-school-staffing.html conventions. */
  .sbm-caveat-banner {
    background: color-mix(in srgb, var(--c-brass) 12%, transparent);
    border-left: 3px solid var(--c-brass);
    padding: 10px 14px;
    margin: 12px 0 16px;
    font-size: 14px;
    line-height: 1.45;
  }
  .sbm-brown-gap {
    background: color-mix(in srgb, var(--c-buoy) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-buoy) 25%, transparent);
    padding: 12px 14px;
    margin: 12px 0;
    border-radius: 4px;
  }
  .sbm-bar-chart { width: 100%; max-width: 720px; margin: 12px 0; }
  .sbm-bar-row { stroke: none; }
  .sbm-bar-label { font: 13px sans-serif; fill: var(--text); }
  .sbm-bar-value { font: 12px sans-serif; fill: var(--text-muted, var(--text)); }
  .sbm-timeline { width: 100%; max-width: 820px; margin: 16px 0; }
  .sbm-table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 12px 0 16px; }
  .sbm-table th { text-align: left; padding: 8px 10px; border-bottom: 2px solid var(--text); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sbm-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); }
  .sbm-table td:nth-child(3) { text-align: right; white-space: nowrap; }
  @media (max-width: 600px) {
    .sbm-table { font-size: 13px; }
    .sbm-table td, .sbm-table th { padding: 6px 6px; }
  }
</style>

<h1>School building maintenance</h1>
<p class="page-lead">
  Marblehead schools have no real preventative maintenance program. Repairs happen when things break, not on a schedule. The only comprehensive condition assessment on record was done in 2021 (the district calls it "the EBI report," named after the firm that did it, though the minutes never spell the acronym out). It flagged roughly $5M+ in problems. The district has no central record of which items have been addressed since. FY27 is the year the Facilities Subcommittee is trying to buy maintenance-tracking software for the first time, so they can finally schedule things like filter changes and belt swaps before parts fail.
</p>

<!-- Sections will be filled in by subsequent tasks. -->
```

- [ ] **Step 4: Add the nav entry**

In `_includes/nav.html`, find the line:
```
        <a href="{{ '/' | relative_url }}inside-school-staffing.html"{% if page.url == '/inside-school-staffing.html' %} aria-current="page"{% endif %}>Inside school staffing</a>
```

Add immediately after it:
```
        <a href="{{ '/' | relative_url }}school-building-maintenance.html"{% if page.url == '/school-building-maintenance.html' %} aria-current="page"{% endif %}>School building maintenance</a>
```

- [ ] **Step 5: Run test, expect pass**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: 2 PASS, 0 FAIL.

- [ ] **Step 6: Commit**

```bash
git add school-building-maintenance.html _includes/nav.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): scaffold page + nav entry + smoke test"
```

---

## Task 2: Above-the-fold key stats

Implements the .key-stats row from spec section "Above-the-fold key stats."

**Files:**
- Modify: `school-building-maintenance.html` (add `.key-stats` block after `.page-lead`)

- [ ] **Step 1: Add key-stats test**

Add to `tests/school-building-maintenance.test.mjs` before the final `await browser.close();`:

```javascript
  // Key stats
  const keyStatLabels = await page.$$eval('.key-stats .key-stat-label', els => els.map(e => e.textContent.trim()));
  keyStatLabels.length === 4
    ? ok('4 key stats present')
    : fail('key stats count', `expected 4, got ${keyStatLabels.length}`);

  const keyStatValues = await page.$$eval('.key-stats .key-stat-value', els => els.map(e => e.textContent.trim()));
  keyStatValues.includes('$42M')
    ? ok('$42M key stat present')
    : fail('$42M key stat', 'missing');
  keyStatValues.includes('FY27')
    ? ok('FY27 key stat present')
    : fail('FY27 key stat', 'missing');
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: 3 fails on the new assertions.

- [ ] **Step 3: Implement the key-stats block**

After the `<p class="page-lead">` closing tag in `school-building-maintenance.html`, insert:

```html
<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">$42M</div>
    <div class="key-stat-label">2019 debt exclusion that built the Lucretia and Joseph Brown Elementary School<sup class="cite" data-href="2026-override/index.html" data-source="2026-override/index.html (Marblehead 28 of 29 debt exclusion ballots approved since 1982). $42M BCG debt exclusion approved 2019."></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">2021</div>
    <div class="key-stat-label">year of the only comprehensive building-condition assessment<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan, derived from 2021 EBI building-condition assessments."></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">1 of 5</div>
    <div class="key-stat-label">currently operating school buildings not included in the 2021 assessment (Brown)<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Capital Facilities Plan covers HS, Veterans, Village, Glover, plus four former school buildings (Coffin, Gerry, Upper Bell, Lower Bell). Brown opened October 2021 and is not in the inventory."></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">FY27</div>
    <div class="key-stat-label">first year a computerized maintenance system is budgeted<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 7/24/2025: 'Moving to a modern CMMS to barcode assets, schedule PM (filters, belts), and improve ticket data; procurement likely requires an RFP and startup plus annual subscription funds (target FY27).'"></sup></div>
  </div>
</div>
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: 5 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): add above-the-fold key stats"
```

---

## Task 3: Section 1 — The tracking gap (the lead)

Implements spec section 1: "The district can't tell you what's been fixed since 2021."

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add a test for the tracking-gap section**

Add to `tests/school-building-maintenance.test.mjs` before the final `await browser.close();`:

```javascript
  // Section 1: tracking gap
  const h2s = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
  h2s.some(t => t.toLowerCase().includes("can't tell you"))
    ? ok('Section 1 h2 leads with claim about tracking gap')
    : fail('Section 1 h2', `not found in ${JSON.stringify(h2s)}`);

  const body = await page.textContent('body');
  body.includes('Aug')
    ? ok('Aug 31 2025 deliverable referenced')
    : fail('Aug 31 deliverable', 'not found in body');
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: 2 new fails.

- [ ] **Step 3: Write the section**

Append to `school-building-maintenance.html` after the `.key-stats` block:

```html
<h2 id="tracking-gap">The district can't tell you what's been fixed since 2021</h2>

<p>The Facilities Subcommittee minutes from July 24 2025 capture the gap directly. The Director of Facilities, Todd Bloodgood, agreed to provide a written status by school (critical, non-critical, capital) by August 31 2025, and to circulate the 2021 EBI reports and a consolidated spreadsheet to the subcommittee.<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 7/24/2025."></sup> No reference to that deliverable appears in any of the three subsequent facilities subcommittee meetings on record (September 5 2025, November 5 2025, February 13 2026).<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-9-5-2025.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 9/5/2025, 11/5/2025, and 2/13/2026. None reference the August 31 2025 written-status deliverable."></sup></p>

<p>The fix is supposed to be a computerized maintenance management system. The same July 24 minutes record the plan: "Moving to a modern CMMS to barcode assets, schedule PM (filters, belts), and improve ticket data; procurement likely requires an RFP and startup plus annual subscription funds (target FY27)."<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-7-24-2025.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 7/24/2025."></sup> CMMS stands for computerized maintenance management system. As of summer 2025 there was no formal way to track which 2021 EBI items had been fixed and which were still open.</p>
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: 7 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 1 — the tracking gap"
```

---

## Task 4: Section 2 — The town did make a major investment (BCG / Brown)

Implements spec section 2.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

Add before the final `await browser.close();`:

```javascript
  // Section 2: BCG investment
  h2s.some(t => t.toLowerCase().includes('major investment')) ||
  h2s.some(t => t.toLowerCase().includes('brown opened'))
    ? ok('Section 2 h2 about the BCG investment')
    : fail('Section 2 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('Lucretia and Joseph Brown')
    ? ok('Full Brown School name referenced')
    : fail('Brown School name', 'missing');

  body.includes('Gilbane')
    ? ok('Contractor (Gilbane) referenced')
    : fail('Gilbane', 'missing');

  body.includes('October 13, 2021') || body.includes('October 13 2021')
    ? ok('Brown opening date referenced')
    : fail('Brown opening date', 'missing');
```

- [ ] **Step 2: Run, expect failure**

Same dev-server-and-test pattern as prior tasks. Expected: 4 new fails.

- [ ] **Step 3: Write the section**

Append to the page:

```html
<h2 id="bcg-investment">The town did make a major investment: Brown opened in 2021</h2>

<p>This page is not "the town has done nothing about its schools." In 2019 voters approved a $42 million debt exclusion to replace three aging elementary schools with one new building.<sup class="cite" data-href="2026-override/index.html" data-source="Marblehead has approved 28 of 29 debt exclusion ballots since 1982. The BCG project's $42M debt exclusion was approved at the 2019 town election."></sup> The result was the Lucretia and Joseph Brown Elementary School, built on the former Malcolm L. Bell site on Baldwin Road by Gilbane and finished 40 days ahead of schedule. The first day for students was October 13 2021, with a ribbon cutting on October 17.<sup class="cite" data-href="data/minutes/school_committee/2021-09-23.txt" data-source="Marblehead School Committee minutes, 9/23/2021: 'The Brown School opening - The first day for students will be October 13th with a ribbon cutting On October 17th.'"></sup></p>

<p>Brown consolidated students from three former elementary schools: Elbridge Gerry (built 1906), L.H. Coffin (1949 with a 1963 annex), and Malcolm L. Bell (Upper Bell 1970, Lower Bell 1958). Construction of the new building required demolition of both Bell School buildings on the same site in 2020.<sup class="cite" data-href="data/minutes/school_committee/2020-03-24.txt" data-source="Marblehead School Committee minutes, March 2020: 'demolition of the Upper Bell site' and the Lower Bell foundation removal scheduled for blasting; abatement preceded demolition."></sup> Coffin and Gerry went vacant when Brown opened in October 2021.</p>
```

- [ ] **Step 4: Run, expect pass**

Expected: 11 PASS, 0 FAIL.

- [ ] **Step 5: Commit**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 2 — the BCG investment"
```

---

## Task 5: Section 3 — The 2021 baseline and what it missed (Brown gap)

Implements spec section 3.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  // Section 3: 2021 baseline scope
  h2s.some(t => t.toLowerCase().includes('2021 baseline'))
    ? ok('Section 3 h2 about the 2021 baseline')
    : fail('Section 3 h2', `not found in ${JSON.stringify(h2s)}`);

  const brownGap = await page.$('.sbm-brown-gap');
  brownGap ? ok('Brown-gap callout present (.sbm-brown-gap)') : fail('Brown-gap callout', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="baseline">The 2021 baseline, and what it didn't cover</h2>

<p>The 2021 EBI assessment is the only comprehensive condition inventory on record. It covers eight buildings: the high school, Veterans Middle School, Village Elementary, and Glover Elementary (the four schools still operating today), plus the four buildings that had just closed or were about to (Coffin, Gerry, Upper Bell, Lower Bell).<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan, derived from 2021 EBI assessments. Building rows: HS, Veterans, Village, Glover, Coffin, Gerry, Upper Bell, Lower Bell."></sup></p>

<p>The plan does not include the Lucretia and Joseph Brown Elementary School, which was opening as the assessment was being compiled. The corpus does not explain why; the simplest reading is that assessors documented the legacy buildings the district was decommissioning rather than the replacement building that was about to come online. The result is that the only comprehensive condition assessment on record skips the largest operating elementary school by FY27 budget, and no replacement assessment has been produced.</p>

<div class="sbm-brown-gap">
  <strong>Brown Elementary is not in the 2021 baseline.</strong> FY27 budget: $5,554,252, the largest of the three elementary schools.<sup class="cite" data-href="data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt" data-source="FY27 Superintendent's Proposed Budget packet, Brown Elementary School Budget page (line BROWN ELEMENTARY $5,554,252 FY27)."></sup>
</div>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 3 — the 2021 baseline and the Brown gap"
```

---

## Task 6: Section 4 — The backlog at operating schools, with bar chart

Implements spec section 4 and Chart A. Builds the bar chart as inline SVG with hand-curated data.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  // Section 4: backlog chart
  const barChart = await page.$('svg.sbm-bar-chart');
  barChart ? ok('Bar chart SVG present') : fail('Bar chart SVG', 'missing .sbm-bar-chart');

  const caveatBanner = await page.$('.sbm-caveat-banner');
  caveatBanner ? ok('Bar chart caveat banner present') : fail('caveat banner', 'missing');

  // Building rows shown in chart
  const barLabels = await page.$$eval('.sbm-bar-label', els => els.map(e => e.textContent.trim()));
  ['High School', 'Veterans', 'Village', 'Glover', 'Brown'].every(b => barLabels.some(l => l.includes(b)))
    ? ok('All 5 operating schools appear as chart rows')
    : fail('chart rows', `expected 5 building labels, got ${JSON.stringify(barLabels)}`);
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section + chart**

Append:

```html
<h2 id="operating-backlog">What 2021 identified at operating schools</h2>

<p>Of the roughly $5 million in itemized work the 2021 EBI assessment flagged, about $1 million sat at buildings still operating as schools. The big-dollar items were concentrated at the older buildings the district was about to take out of school use. The chart below shows the dollar-tagged items by operating building. Brown is shown for completeness, even though it has no 2021 entry.</p>

<div class="sbm-caveat-banner">
  These are 2021 estimates from the EBI assessment. Current status of individual items is not centrally tracked, so this is the last formal picture on record, not a current backlog.
</div>

<svg class="sbm-bar-chart" viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="2021 EBI dollar-tagged backlog by currently operating school. High School around $779K, Veterans $175K, Village $50K, Glover $0, Brown not assessed.">
  <!-- 5 rows × 32px each, plus header. Bars start at x=150, max width 460 for $1M (scale: ~$2.17/px). -->
  <!-- Row 1: High School -->
  <text class="sbm-bar-label" x="0" y="30">High School</text>
  <rect class="sbm-bar-row" x="150" y="20" width="358" height="14" fill="var(--c-navy)"/>
  <text class="sbm-bar-value" x="518" y="30">$779K</text>
  <!-- Row 2: Veterans -->
  <text class="sbm-bar-label" x="0" y="62">Veterans Middle</text>
  <rect class="sbm-bar-row" x="150" y="52" width="80" height="14" fill="var(--c-buoy)"/>
  <text class="sbm-bar-value" x="240" y="62">$175K</text>
  <!-- Row 3: Village -->
  <text class="sbm-bar-label" x="0" y="94">Village Elementary</text>
  <rect class="sbm-bar-row" x="150" y="84" width="23" height="14" fill="var(--c-teal)"/>
  <text class="sbm-bar-value" x="183" y="94">$50K</text>
  <!-- Row 4: Glover -->
  <text class="sbm-bar-label" x="0" y="126">Glover Elementary</text>
  <rect class="sbm-bar-row" x="150" y="116" width="2" height="14" fill="var(--c-brass)"/>
  <text class="sbm-bar-value" x="160" y="126">$0</text>
  <!-- Row 5: Brown -->
  <text class="sbm-bar-label" x="0" y="158">Brown Elementary</text>
  <text class="sbm-bar-value" x="155" y="158" style="font-style: italic;">not assessed in 2021</text>
  <!-- Axis -->
  <line x1="150" y1="180" x2="610" y2="180" stroke="var(--border)" stroke-width="1"/>
  <text class="sbm-bar-value" x="150" y="200">$0</text>
  <text class="sbm-bar-value" x="380" y="200" text-anchor="middle">$500K</text>
  <text class="sbm-bar-value" x="610" y="200" text-anchor="end">$1M</text>
</svg>

<p class="caption">Dollar-tagged line items only. The 2021 EBI plan also lists many entries without dollar estimates; those are condition observations the assessors did not price. The high-school roof, which is the largest active project in the district, is in this category &mdash; flagged as "persistent leaks &mdash; maintenance issue" in 2021 but not priced.<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan, summed across rows for HS, Veterans, Village, Glover items with non-blank dollar estimates."></sup></p>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 4 + backlog bar chart"
```

---

## Task 7: Per-building itemized table

Implements the .sbm-table beneath Chart A. Shows the individual EBI line items for HS, Veterans, Village, Glover.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  const tableRows = await page.$$('.sbm-table tbody tr');
  tableRows.length >= 14
    ? ok(`Itemized table has ${tableRows.length} rows`)
    : fail('Itemized table', `expected >= 14 rows, got ${tableRows.length}`);

  body.includes('Tennis Courts')
    ? ok('Tennis Courts (HS item) appears in table')
    : fail('Tennis Courts', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Build the table**

Append after the chart-caption paragraph:

```html
<details class="deep-dive">
  <summary><span class="deep-dive-summary">Full 2021 item list for operating schools<span class="arrow">&#x25B8;</span></span></summary>
  <div class="deep-dive-body">
    <table class="sbm-table">
      <thead><tr><th>Building</th><th>Category</th><th>2021 estimate</th><th>Condition note (verbatim)</th></tr></thead>
      <tbody>
        <tr><td>High School</td><td>Tennis Courts</td><td>$300,000</td><td>by resurfacing</td></tr>
        <tr><td>High School</td><td>Door Hardware &amp; Locks</td><td>$150,000</td><td>Ongoing maintenance and repair issues. Building key system not consistent &mdash; re-key needed</td></tr>
        <tr><td>High School</td><td>Hot Water Tanks</td><td>$100,000</td><td>one heat bundle replaced &mdash; system near end of life span</td></tr>
        <tr><td>High School</td><td>Gym Lights</td><td>$56,000</td><td>Ballast buzz, some have been replaced and still buzz. LED replacement estimated cost</td></tr>
        <tr><td>High School</td><td>Flooring</td><td>$50,000</td><td>Library carpets heavily stained, some VCT issues</td></tr>
        <tr><td>High School</td><td>Gym Floor</td><td>$30,000</td><td>flooring has been resurfaced yearly. Wood boards are rippled from moisture and have heaved several times.</td></tr>
        <tr><td>High School</td><td>HVAC System</td><td>$30,000</td><td>System needs balancing</td></tr>
        <tr><td>High School</td><td>Gym Divider Curtains</td><td>$25,000</td><td>Curtains are torn and in poor condition. Need immediate replacement</td></tr>
        <tr><td>High School</td><td>Exterior Lighting</td><td>$20,000</td><td>security lighting for lower fields</td></tr>
        <tr><td>High School</td><td>Security</td><td>$10,000</td><td>no swipe card system or panic buttons</td></tr>
        <tr><td>High School</td><td>Gym Wall pads</td><td>$7,500</td><td>pads are damaged from balls &mdash; ripped in places &mdash; needs replacement</td></tr>
        <tr><td>Veterans Middle</td><td>Security</td><td>$100,000</td><td>no swipe card system or panic buttons &mdash; no security cameras, no single lock down key</td></tr>
        <tr><td>Veterans Middle</td><td>Flooring</td><td>$75,000</td><td>library needs to be replaced</td></tr>
        <tr><td>Village Elementary</td><td>Security</td><td>$50,000</td><td>no panic buttons &mdash; limited number of security cameras</td></tr>
      </tbody>
    </table>
    <p class="caption">Source: Marblehead Public Schools Capital Facilities Plan, derived from 2021 EBI assessments.<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan. Lines listing dollar-tagged items at HS, Veterans, Village, Glover."></sup> Glover (built 2014) has no dollar-tagged items in the plan.</p>
  </div>
</details>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): per-building itemized backlog table"
```

---

## Task 8: Section 5 — Former school buildings carry most of the dollars

Implements spec section 5.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  h2s.some(t => t.toLowerCase().includes('former school buildings'))
    ? ok('Section 5 h2 about former school buildings')
    : fail('Section 5 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('Harborlight Homes')
    ? ok('Coffin Adaptive Reuse / Harborlight reference present')
    : fail('Harborlight Homes', 'missing');

  body.includes('Eveleth')
    ? ok('Eveleth building referenced')
    : fail('Eveleth', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="former-buildings">The former school buildings carry most of the 2021 dollars</h2>

<p>The biggest line items in the 2021 plan sit at buildings the district no longer operates as schools. They are not deferred school-maintenance work; they are inputs to disposition decisions.</p>

<table class="sbm-table">
  <thead><tr><th>Former school</th><th>Built</th><th>Out of school use</th><th>2021 dollar items</th></tr></thead>
  <tbody>
    <tr><td>Coffin School</td><td>1949 (annex 1963)</td><td>October 2021 (Brown opened)</td><td>roof $750K, windows $600K, plumbing $250K, electrical $200K, HVAC $150K</td></tr>
    <tr><td>Elbridge Gerry School</td><td>1906</td><td>January 2018 (steam pipe leak)</td><td>roof $750K, exterior brick $250K, boiler $175K, HVAC $150K</td></tr>
    <tr><td>Upper Bell School</td><td>1970</td><td>2020 (demolished for Brown)</td><td>roof $1M, HVAC $200K, boiler $175K &mdash; building no longer exists</td></tr>
    <tr><td>Lower Bell School</td><td>1958</td><td>2020 (demolished for Brown)</td><td>plumbing $200K, HVAC $100K, boiler $100K &mdash; building no longer exists</td></tr>
  </tbody>
</table>
<p class="caption">Itemized in the 2021 EBI plan.<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan, Coffin/Gerry/Upper Bell/Lower Bell rows."></sup></p>

<p><strong>Coffin School</strong> custody transferred from the School Committee to the Select Board, which is now running a formal Adaptive Reuse process. The Town released an Expression of Interest on August 26 2025 (responses due September 26), then a Request for Information on October 7 2025 (responses due October 30). Five EOI proposals came in, including from the Cemetery Department (future burial space), the Municipal Light Department (battery energy storage), Recreation &amp; Parks (a dog park to replace Tioga Way), the Housing Authority, and Community Development (temporary boat storage). Three RFI responses followed, including a Harborlight Homes proposal for a 40-unit affordable housing project that preserves the historic school building and demolishes the annex, estimated at $28&ndash;32 million. A Hazardous Building Materials Investigation report was completed January 21 2026. Community Meeting #3 is scheduled May 20 2026.<sup class="cite" data-href="https://marbleheadma.gov/coffin-school-adaptive-reuse/" data-source="Town of Marblehead, Coffin School Adaptive Reuse page (marbleheadma.gov/coffin-school-adaptive-reuse), retrieved June 2026. Lists EOI/RFI timeline, all five EOI responses, three RFI responses including Harborlight Homes 40-unit affordable housing proposal."></sup></p>

<p><strong>Eveleth School</strong> is in a different state. The 1906 Gerry steam-pipe leak in January 2018 forced students out; during BCG construction in 2019&ndash;2020 Eveleth was reopened as swing space for kindergarteners while Bell was closing. When Brown opened in October 2021 Eveleth went vacant again.<sup class="cite" data-href="data/minutes/school_committee/2020-04-02.cleaned.txt" data-source="Marblehead School Committee minutes, spring 2020: 'the Bell will be closed and we will begin prepping the Village School to accept the 3rd graders and the Eveleth School for Kindergarteners.' Donna Zaeske named principal of 'Eveleth and Village 3rd Grade.'"></sup> Its boiler was condemned and shut down by November 5 2025.<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-11-05-2025.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 11/5/2025: Eveleth boiler condemned and shut down."></sup> Discussions on file with Park &amp; Recreation explore joint use as an early-education center plus after-school, weekend, vacation, and summer programming.<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-2-13-2026.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 2/13/2026: Eveleth Site Discussion with Park and Recreation; joint survey and possible joint feasibility study under consideration."></sup></p>

<p>The "Bell School Evaluation Process" referenced in the November 6 2025 School Committee minutes is harder to place. The Bell buildings were demolished in 2020; the corpus does not say which building or program the process is now evaluating. The notes describe a needs-assessment-first approach (no feasibility study without confirmed survey demand) with services for 18&ndash;22-year-old students among the considerations.<sup class="cite" data-href="data/schools/sc-meetings-fy26/minutes-11-6-2025.txt" data-source="Marblehead School Committee minutes, 11/6/2025: 'Bell School Evaluation Process' — needs assessment, business plan, services for 18-22 year old students."></sup></p>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 5 — former school buildings disposition"
```

---

## Task 9: Section 6 — What deferred maintenance looks like when it bites

Implements spec section 6: Sarah Fox HS walking tour + Veterans D-wing flood.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  body.includes('buckets and mops')
    ? ok('Sarah Fox walking-tour direct quote present')
    : fail('walking-tour quote', 'missing');

  body.includes('weep holes') || body.includes('drainage holes')
    ? ok('Veterans D-wing contractor-error detail present')
    : fail('Veterans D-wing', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="when-it-bites">What deferred maintenance looks like when it bites</h2>

<p>On April 4 2024, during a Northeaster, then-chair Sarah Fox walked the high school with Director of Facilities Todd Bloodgood, the superintendent, and the principal. Her account at the April 25 School Committee meeting:<sup class="cite" data-href="_transcripts/school-committee-2024-04-25.md" data-source="Marblehead School Committee transcript, 4/25/2024, commendations segment. Sarah Fox first-person account of an April 4 2024 walking tour of Marblehead High School with Todd Bloodgood and Theresa McGinnis during a Northeaster."></sup></p>

<blockquote>"As we walked, I was shown classrooms that had leaks and how they were being mitigated. As our walk continued, if teachers noticed us, they would pop out of their classrooms to report new leaks or leaks that were stopped, but it started up again. The custodians were everywhere with buckets and mops trying to keep up with the leaks &hellip; what is clear to me is that the continued priority must be made to move forward with a new replacement roof."</blockquote>

<p>In February 2026, a different mode of failure hit Veterans Middle School. A subcontractor working on the upper roof section wrapped new roofing material over the drainage holes; the next rain ran under the membrane and flooded classrooms below. The facilities subcommittee minutes describe the damage: smoke detectors, sprinklers, pull stations, horn strobes, outlets, lighting, and ceiling tiles all required replacement. The district declined payment to the contractor until repairs were complete. One or two classrooms were relocated, and MHTV (which records its programming from the D-wing) has not returned to the building.<sup class="cite" data-href="data/schools/sc-meetings-fy26/facilities-subcommittee-minutes-2-13-2026.txt" data-source="Marblehead Public Schools Facilities Subcommittee minutes, 2/13/2026: Veterans D-wing contractor-caused flood; insurance scope; MHTV displaced."></sup></p>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 6 — Sarah Fox HS walk + Veterans D-wing"
```

---

## Task 10: Section 7 — How it gets paid for

Implements spec section 7. Includes the override correction (Tier 3 includes a $500K/yr building capital fund).

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  h2s.some(t => t.toLowerCase().includes('paid for') || t.toLowerCase().includes('how it gets paid'))
    ? ok('Section 7 h2 about funding')
    : fail('Section 7 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('$500K') || body.includes('$500,000')
    ? ok('$500K/yr building capital fund (Tier 3) referenced')
    : fail('building capital fund', 'missing');

  body.includes('1.0 maintenance') || body.includes('maintenance position')
    ? ok('FY27 maintenance-position cut referenced')
    : fail('maintenance cut', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="how-paid">How it gets paid for</h2>

<p>Two layers: the capital plan, which funds rare large projects like the high school roof and HVAC scheduled for summer 2026 construction, and the operating budget, which absorbs all the reactive repairs. The reactive layer is volatile. The March 2026 monthly budget update showed surprise HVAC repairs at Brown and Glover, bus repairs, and elevator repairs together pulling about $614,000 out of the unencumbered balance in a single month.<sup class="cite" data-href="_transcripts/school-committee-2026-04-09.md" data-source="Marblehead School Committee transcript, 4/9/2026, FY27 budget hearing. Asst Supt of Finance Mike reported FY26 unencumbered balance just under $2.1M, down about $614K month-over-month due to deliberate end-of-FY26 spending including HVAC repairs at Brown and Glover, bus repairs, and elevator repairs."></sup></p>

<p>The FY27 base budget cut a maintenance position (1.0) and shifted 50% of a Facilities Assistant off the levy onto the rental revolving fund, as part of the $3.2 million reduction package.<sup class="cite" data-href="_transcripts/school-committee-2026-04-09.md" data-source="Marblehead School Committee transcript, 4/9/2026, FY27 budget hearing. District reductions list: '50% Facilities Asst shifted to rental revolving fund' and '1.0 maintenance cut' among the $3.2M reduction items."></sup></p>

<p>The June 9 2026 town election approved Tier 3 of the override at $15 million ($8.5 million on the school side). The school side of Tier 3 includes a recurring <strong>school-building capital fund of $500,000 per year</strong>.<sup class="cite" data-href="2026-override/index.html" data-source="2026-override/index.html: 'All four ballot questions passed. The $15M Invest tier governs FY27.' Tier 3 school-side composition includes the school-building capital fund (recurring $500K/yr)."></sup> So FY27 carries both: the base budget trimmed maintenance staff, and the override created a new recurring building-capital line. The two changes do different things. The capital fund handles planned replacements; staffing handles the day-to-day work, including the kind of preventative maintenance the CMMS is supposed to schedule.</p>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 7 — how it gets paid for"
```

---

## Task 11: Section 8 — What's actually moving

Implements spec section 8.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  h2s.some(t => t.toLowerCase().includes("actually moving") || t.toLowerCase().includes("what's moving") || t.toLowerCase().includes("what is moving"))
    ? ok('Section 8 h2 about what is moving')
    : fail('Section 8 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('summer 2026')
    ? ok('Summer 2026 HS roof construction referenced')
    : fail('summer 2026 roof', 'missing');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="moving">What's actually moving</h2>

<ul>
  <li><strong>High school roof and HVAC replacement.</strong> Pre-qualification bidding October 2025; contract anticipated November 2025; contractor pre-inspection during February 2026 vacation; three small sections done during April 2026 vacation (the section above the meeting room, one by the concession stand, one on the far side); full summer 2026 construction; HVAC equipment delivery July 2026.<sup class="cite" data-href="_transcripts/school-committee-2026-04-09.md" data-source="Marblehead School Committee transcript, 4/9/2026, subcommittee updates. Roof project at Veterans Middle School starting up in two weeks; Marblehead High School roof done in three small sections during April vacation. Long-lead HVAC and steel-fabrication items being tracked closely; delivery on schedule."></sup></li>
  <li><strong>Tier 3 override approved.</strong> The May 21 2026 School Committee voted 4&ndash;0 to issue a proclamation officially supporting Tier 3 of the override, which adds the recurring school-building capital fund.<sup class="cite" data-href="_transcripts/school-committee-2026-05-21.md" data-source="Marblehead School Committee transcript, 5/21/2026: 4-0 vote to issue a proclamation officially supporting Tier 3 of the proposed FY27-FY29 Prop 2.5 override, providing $8.5 million on the school side including a recurring school building capital fund."></sup> Voters approved Tier 3 at the June 9 2026 town election.<sup class="cite" data-href="2026-override/index.html" data-source="2026-override/index.html: 'All four ballot questions passed.'"></sup></li>
  <li><strong>CMMS procurement.</strong> Target FY27. The first formal asset-and-PM tracking system on record.</li>
  <li><strong>Coffin School Adaptive Reuse.</strong> Community Meeting #3 scheduled May 20 2026.<sup class="cite" data-href="https://marbleheadma.gov/coffin-school-adaptive-reuse/" data-source="Town of Marblehead Coffin School Adaptive Reuse page."></sup></li>
  <li><strong>Veterans D-wing.</strong> Repaired after the February 2026 contractor-caused flood. MHTV has not yet returned.</li>
</ul>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 8 — what's actually moving"
```

---

## Task 12: Section 9 — Open questions to ask

Implements spec section 9.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  h2s.some(t => t.toLowerCase().includes('open questions') || t.toLowerCase().includes('questions to ask'))
    ? ok('Section 9 h2 about open questions')
    : fail('Section 9 h2', `not found in ${JSON.stringify(h2s)}`);
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Write the section**

```html
<h2 id="open-questions">Open questions worth asking</h2>

<ol>
  <li>Has the August 31 2025 written-status-by-school deliverable been produced?</li>
  <li>What does the EBI acronym stand for? The minutes treat it as already-known and never spell it out.</li>
  <li>Has the CMMS RFP been issued, and on what timeline?</li>
  <li>When does the first allocation from the $500K/yr school-building capital fund hit the budget, and how is the district planning to deploy it?</li>
  <li>What building or program is the "Bell School Evaluation Process" actually evaluating?</li>
</ol>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): section 9 — open questions"
```

---

## Task 13: Timeline chart (Chart B)

Implements spec Chart B as a two-track inline SVG timeline. Placed visually between Section 2 (BCG investment) and Section 3 (baseline scope) to anchor the historical sequence before the analytic sections begin.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Add tests**

```javascript
  const timeline = await page.$('svg.sbm-timeline');
  timeline ? ok('Timeline SVG present') : fail('Timeline SVG', 'missing .sbm-timeline');

  body.includes('1906') && body.includes('2014') && body.includes('FY27')
    ? ok('Timeline endpoint years (1906, 2014, FY27) present')
    : fail('Timeline years', 'missing one of 1906, 2014, FY27');
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Insert the timeline immediately after Section 2's closing `</p>` (before the `<h2 id="baseline">` line)**

```html
<svg class="sbm-timeline" viewBox="0 0 820 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-track timeline. Top track: school construction dates (1906 Gerry through 2021 Brown). Bottom track: preventative-maintenance program events (2018 BCG plan, 2019 $42M override, 2020 Bell demolition, 2021 EBI assessment, 2025 written-status target, 2026 Veterans D-wing flood, FY27 CMMS RFP target).">
  <!-- Top track: construction -->
  <text x="10" y="20" font="12px sans-serif" fill="var(--text-muted, var(--text))">Construction</text>
  <line x1="100" y1="40" x2="800" y2="40" stroke="var(--border)" stroke-width="1"/>
  <!-- Year markers; x position scaled linearly 1906 (x=100) → 2026 (x=800), 120 years → 700 px (~5.83 px/year) -->
  <g font="11px sans-serif" fill="var(--text)">
    <!-- 1906 Gerry -->
    <circle cx="100" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="100" y="60" text-anchor="middle">1906 Gerry</text>
    <!-- 1949 Coffin (x=100 + (1949-1906)*5.83 = 350) -->
    <circle cx="350" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="350" y="60" text-anchor="middle">1949 Coffin</text>
    <!-- 1970 Upper Bell (x=100 + (1970-1906)*5.83 = 473) -->
    <circle cx="473" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="473" y="60" text-anchor="middle">1970 Upper Bell</text>
    <!-- 2002 HS (x=100 + (2002-1906)*5.83 = 660) -->
    <circle cx="660" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="660" y="60" text-anchor="middle">2002 HS</text>
    <!-- 2014 Glover (x=100 + (2014-1906)*5.83 = 730) -->
    <circle cx="730" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="730" y="60" text-anchor="middle">2014 Glover</text>
    <!-- 2021 Brown (x=100 + (2021-1906)*5.83 = 771) -->
    <circle cx="771" cy="40" r="4" fill="var(--c-navy)"/>
    <text x="771" y="60" text-anchor="middle">2021 Brown</text>
  </g>
  <!-- Bottom track: PM events -->
  <text x="10" y="110" font="12px sans-serif" fill="var(--text-muted, var(--text))">PM program</text>
  <line x1="100" y1="130" x2="800" y2="130" stroke="var(--border)" stroke-width="1"/>
  <g font="11px sans-serif" fill="var(--text)">
    <!-- 2018 BCG plan (x=100 + (2018-1906)*5.83 = 753) -->
    <circle cx="753" cy="130" r="4" fill="var(--c-buoy)"/>
    <text x="745" y="150" text-anchor="middle">2018 plan</text>
    <!-- 2019 override (x=100 + (2019-1906)*5.83 = 759) -->
    <circle cx="759" cy="130" r="4" fill="var(--c-buoy)"/>
    <text x="765" y="166" text-anchor="middle">2019 $42M override</text>
    <!-- 2020 Bell demolition (x=100 + (2020-1906)*5.83 = 765) -->
    <circle cx="765" cy="130" r="4" fill="var(--c-buoy)"/>
    <!-- 2021 EBI compiled (x=771, coincides with Brown opening) -->
    <circle cx="771" cy="130" r="4" fill="var(--c-buoy)"/>
    <!-- 2026 Veterans D-wing + FY27 CMMS (x=800) -->
    <circle cx="800" cy="130" r="4" fill="var(--c-brass)"/>
    <text x="795" y="120" text-anchor="end">2026 D-wing flood &middot; FY27 CMMS target</text>
  </g>
</svg>
<p class="caption">Construction dates from the 2021 Capital Facilities Plan. PM-program events from minutes and transcripts cited above.<sup class="cite" data-href="data/schools/capital-facilities/capital-facilities-plan.txt" data-source="Marblehead Public Schools Capital Facilities Plan: building-year column."></sup></p>
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit.**

```bash
git add school-building-maintenance.html tests/school-building-maintenance.test.mjs
git commit -m "feat(school-buildings): timeline chart"
```

---

## Task 14: Citations and tone audit

Sweep the page for citation gaps, em-dashes in body copy, and the editorial-tone checklist from the spec.

**Files:**
- Modify: `school-building-maintenance.html`

- [ ] **Step 1: Verify every dollar figure has a citation**

```bash
grep -nE '\$[0-9]' school-building-maintenance.html | grep -v 'sup class="cite"' | grep -v 'data-source' || echo "all dollar figures appear within citation context"
```

Manually walk results. Each `$X` mention should be inside a sentence whose nearest enclosing `<p>` or `<li>` contains at least one `<sup class="cite">`. If any are bare, add a citation pulling from the same source file already cited nearby.

- [ ] **Step 2: Em-dash check**

The page-lead and section copy must not use em-dashes (`&mdash;` or literal `—`) in body prose per the writing-preferences memory. The `.sbm-table` cells reproduce verbatim 2021 EBI condition notes which DO contain em-dashes; leave those as-is since they are quotations.

```bash
# Show em-dashes outside of table cells:
grep -nE '&mdash;|—' school-building-maintenance.html | grep -v '<td>'
```

Review each remaining hit. If it is in a `<p>` body sentence, replace with a comma, semicolon, period, or parenthetical as fits the sentence. Do not change quoted-source text or `<td>` cells.

- [ ] **Step 3: Editorial-tone scan**

```bash
grep -niE 'shocking|crisis|skyrocket|outrageous|catastroph|alarmin' school-building-maintenance.html || echo "no editorial verbs"
```

Expected: no editorial verbs.

- [ ] **Step 4: No "this page shows" meta-narration**

```bash
grep -niE 'this page (shows|covers|explains)|below you[’']ll find|the following' school-building-maintenance.html || echo "no meta-narration"
```

Expected: no meta-narration.

- [ ] **Step 5: Re-run the smoke test in full**

```bash
npm run dev &
sleep 8
node tests/school-building-maintenance.test.mjs
kill %1
```

Expected: all assertions pass.

- [ ] **Step 6: Commit any tone-fix changes**

```bash
git add school-building-maintenance.html
git commit -m "chore(school-buildings): tone and citation audit pass" || echo "no changes needed"
```

---

## Task 15: Run the project-wide smoke test, then take proof-of-work screenshots

**Files:**
- Create: `proof/school-maintenance-page.png`
- Create: `proof/school-maintenance-page-full.png`

- [ ] **Step 1: Run the existing project smoke test to confirm no regressions**

```bash
npm run test:local
```

Expected: 52 pass / 0 fail (the established baseline) plus the new file may need to be wired in, see Step 2.

- [ ] **Step 2: If the smoke baseline is exactly 52 and the new test isn't included, add a one-line invocation to make sure both run**

Inspect `package.json` `scripts.test:local`. If it only runs `tests/smoke-test.mjs`, edit `package.json` to add a new script:

```json
"test:school-buildings": "node tests/school-building-maintenance.test.mjs"
```

And re-run:

```bash
npm run dev &
sleep 8
npm run test:school-buildings
kill %1
```

Expected: all assertions pass.

- [ ] **Step 3: Capture above-the-fold proof screenshot**

```bash
npm run dev &
sleep 8
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/school-building-maintenance.html" \
  "proof/$(git branch --show-current).png"
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/school-building-maintenance.html" \
  "proof/$(git branch --show-current)-full.png"
kill %1
file proof/*.png
```

Expected: PNGs around 2880 px wide, sharp at chat/PR display sizes.

- [ ] **Step 4: Commit proof artifacts**

```bash
git add proof/*.png package.json
git commit -m "test: proof-of-work screenshots for school-building-maintenance"
```

---

## Task 16: Push and open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin school-maintenance-page
```

- [ ] **Step 2: Open the PR using the project template**

```bash
gh pr create --title "Add School building maintenance page" --body "$(cat <<'EOF'
## Summary

Builds a public-facing page at `/school-building-maintenance.html` based on the research handoff in PR #850 (`data/school_maintenance_notes.md`) and the verified primary-source pass that followed.

The page leads with the tracking gap (no central record of which 2021 EBI items have been addressed), honestly credits the 2019 $42M BCG investment that built Brown, separates the operating-school backlog from the closed-building disposition story (Coffin Adaptive Reuse, Eveleth, Bell Evaluation Process), surfaces the Sarah Fox HS walking-tour and Veterans D-wing flood as concrete examples, explains the funding picture including the override-funded $500K/yr building capital fund, and calls out five open questions worth asking.

Two inline-SVG charts: backlog by operating school (bar) and a two-track timeline (construction dates + PM-program events).

## What this PR includes

- `school-building-maintenance.html` (new page)
- `_includes/nav.html` (nav entry next to Inside school staffing)
- `tests/school-building-maintenance.test.mjs` (Playwright smoke test)
- `proof/school-maintenance-page.png` and `-full.png`

## Test plan

- [ ] Preview URL loads the page
- [ ] All 9 sections render in order with claim-leading h2s
- [ ] Backlog bar chart visible with 5 operating-school rows (Brown shown as "not assessed")
- [ ] Timeline visible with construction dates and PM-program events
- [ ] Per-building itemized backlog table renders under the chart
- [ ] Citations (`<sup class="cite">`) resolve to existing repo files or live URLs
- [ ] Sarah Fox walking-tour quote present
- [ ] Veterans D-wing detail present
- [ ] `$500K/yr` building capital fund (Tier 3 / June 9 override) referenced
- [ ] Nav entry shows on every page next to "Inside school staffing"

## Preview URL

Cloudflare PR preview will appear once the workflow runs. I will update this PR body with the URL when the deploy goes green.

## Proof of work

See `proof/school-maintenance-page.png` (above-the-fold) and `proof/school-maintenance-page-full.png` (full-page).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

- [ ] **Step 3: Capture and post the preview URL**

Once the `preview` workflow finishes, find the sticky preview comment (`gh pr view <num> --comments`), pull the **Branch URL** from the comment body, and edit the PR body to embed it under the "Preview URL" heading:

```bash
gh pr edit <PR_NUM> --body-file <(... updated body ...)
```

- [ ] **Step 4: Report PR URL back to the user**

The session is done when the PR URL has been printed and the preview URL is in the PR body.

---

## Self-review checklist (run BEFORE handing off)

- [ ] All nine spec h2 sections have a corresponding task: Tasks 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 → spec sections 1, 2, 3, 4 (+ Chart A in Task 6), former buildings, when it bites, paid for, moving, open questions.
- [ ] Chart A (backlog bar) is built in Task 6; per-building itemized table in Task 7.
- [ ] Chart B (timeline) is built in Task 13.
- [ ] Nav entry added in Task 1.
- [ ] Brown-gap callout is built in Task 5.
- [ ] Caveat banner above bar chart is built in Task 6.
- [ ] Tone, em-dash, citation audit runs in Task 14.
- [ ] Proof-of-work screenshots produced in Task 15 per CLAUDE.md requirements.
- [ ] PR opened with required sections in Task 16.
