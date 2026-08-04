# Roads Funding Gap Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `roads.html`, a data page on Marblehead's road funding gap — ~$449K/yr Chapter 90 state aid against the town's own ~$3M/yr figure, with local capital dollars only starting in 2022.

**Architecture:** A bespoke Jekyll HTML page (`layout: page`, frontmatter title/og), following the pattern of `legal-fees.html`. Numbers come from small source-cited data files in `data/roads/` (mirroring `data/legal/`), referenced via `<sup class="cite" data-href data-source>` markers that `citations.js` turns into a runtime Sources section. Charts are hand-authored inline `<svg class="chart">` using STYLE_GUIDE series classes. The one genuinely new dataset is a Chapter 90 per-year time series; everything else already exists in prose or existing budget files.

**Tech Stack:** Jekyll 3.10 (matches GH Pages prod), inline SVG, `citations.js`, Playwright smoke test (`tests/smoke-test.mjs`), `scripts/render-og-images.mjs` for the social card.

**Cardinal rule for this plan (project citation discipline):** every number placed on the page or in a data file MUST be read from its primary source at build time and cited. Do NOT copy figures from this plan or from memory — the town Roads guide is advocacy, not a primary source. Where this plan shows a number (e.g. "~$449K"), treat it as the *target to verify*, not the value to paste.

---

## File Structure

- **Create** `roads.html` — the page (root, served at `/roads.html`)
- **Create** `data/roads/chapter90_apportionment_MHD.csv` — Chapter 90 per-year time series (new dataset)
- **Create** `data/roads/road_ownership_2024.csv` — MassDOT Road Inventory jurisdiction miles for Marblehead
- **Modify** `index.html` — add a question card linking to the page
- **Modify** `where-has-the-money-gone.html` — add an internal link where roads/DPW is mentioned
- **Modify** `data/index.html` — add the page to the data listing (same place `legal-fees.html` appears)
- **Modify** `tests/smoke-test.mjs` — add a `testRoadsPage(page)` load+shape check and wire it into the run
- **Create** `proof/roads-funding-gap.png` — Playwright proof screenshot

---

## Task 1: Build the Chapter 90 time-series dataset

**Files:**
- Create: `data/roads/chapter90_apportionment_MHD.csv`

- [ ] **Step 1: Extract Chapter 90 per-year figures from primary sources**

Gather Marblehead's Chapter 90 apportionment for as many years as are cleanly
sourceable (target FY00–FY27; a shorter well-sourced range is acceptable — do
not pad with guesses). Two independent source families, use both to
cross-check:

```bash
cd /home/claude/marblehead/.dev/worktree/roads-funding-gap
# Annual reports: Highway/Chapter 90 sections, one file per year
grep -rin "chapter 90\|chapter ninety\|ch. 90\|ch 90" data/town_docs/annual_reports/ | head -60
# Checkbook actuals categorized as CHAPTER 90
grep -in "chapter 90\|chapter_90\|CHAPTER 90" data/checkbook_labels.json
grep -in "chapter 90" data/checkbook_*.csv | head
```

Then confirm against the state apportionment tables (primary):
https://www.mass.gov/info-details/chapter-90-apportionment (current) and
https://www.mass.gov/info-details/chapter-90-past-apportionment (historical).
Use WebFetch on those pages. If a given year cannot be reconciled to a source,
omit that year rather than record an unsourced value.

- [ ] **Step 2: Write the CSV with an explicit per-row source**

Format (one row per fiscal year; `source` names the exact document the value
came from so every number traces):

```csv
fiscal_year,chapter90_apportionment,source
FY18,455615,"MassDOT Chapter 90 apportionment table FY2018, Marblehead row"
...
```

- [ ] **Step 3: Verify the file reconciles**

Run: `column -s, -t data/roads/chapter90_apportionment_MHD.csv | head -40`
Expected: every row has a non-empty `source`; the mean of the
`chapter90_apportionment` column is in the ballpark of the town guide's stated
~$449K/yr average. If it is wildly off, re-check the extraction before
proceeding.

```bash
awk -F, 'NR>1 && $2 ~ /^[0-9]+$/ {s+=$2; n++} END {printf "mean=%.0f over %d yrs\n", s/n, n}' data/roads/chapter90_apportionment_MHD.csv
```

- [ ] **Step 4: Commit**

```bash
git add data/roads/chapter90_apportionment_MHD.csv
git commit -m "data: Chapter 90 apportionment time series for Marblehead"
```

---

## Task 2: Build the road-ownership dataset

**Files:**
- Create: `data/roads/road_ownership_2024.csv`

- [ ] **Step 1: Pull Marblehead's row from the 2024 Road Inventory**

Source: 2024 Road Inventory Year-End Report (MassDOT), Table 5 "City/Town By
Jurisdiction", Marblehead (#168). Fetch and confirm the numbers:
https://gis.massdot.state.ma.us/reports/RoadInventory2024.pdf
Target values to verify (do not paste blindly): MassDOT 0.00, town-accepted
68.99, unaccepted 11.24, total 80.22 centerline miles.

- [ ] **Step 2: Write the CSV**

```csv
jurisdiction,centerline_miles,source
"MassDOT (state-owned)",0.00,"2024 Road Inventory Year-End Report, Table 5, Marblehead (#168)"
"Town-accepted",68.99,"2024 Road Inventory Year-End Report, Table 5, Marblehead (#168)"
"Unaccepted (private/not formally accepted)",11.24,"2024 Road Inventory Year-End Report, Table 5, Marblehead (#168)"
```

- [ ] **Step 3: Verify total**

Run: `awk -F, 'NR>1 {s+=$2} END {print "total="s}' data/roads/road_ownership_2024.csv`
Expected: `total=80.22` (matches the report's total row).

- [ ] **Step 4: Commit**

```bash
git add data/roads/road_ownership_2024.csv
git commit -m "data: MassDOT 2024 road ownership miles for Marblehead"
```

---

## Task 3: Page scaffold — frontmatter, lede, stat band, TOC

**Files:**
- Create: `roads.html`

- [ ] **Step 1: Read the reference page and the source guide**

```bash
sed -n '1,60p' legal-fees.html          # frontmatter + key-stats + page-toc pattern
cat data/town_docs/Marblehead-Roads-Information-Guide.txt   # headline figures to verify/cite
grep -n "89 Miles\|71 Miles\|449\|3 million\|3M\|15" data/town_docs/Marblehead-Roads-Information-Guide.txt
```

- [ ] **Step 2: Write the frontmatter, h1, lede, key-stats, and TOC**

Create `roads.html`. Follow `legal-fees.html` exactly for structure. The lede is
plain-voice, states the funding gap, no meta-narration. Each stat's value is
verified against a primary source and carries a `<sup class="cite">`. The
mileage stat MUST footnote the 89 (town guide) vs 80.22 (state inventory)
discrepancy in its `data-source`.

```html
---
title: "How does Marblehead pay for its roads?"
scripts: [citations]
og_title: "Marblehead's road funding gap"
og_description: "For 25 years the town funded roads almost entirely from state Chapter 90 aid, averaging about $449,000 a year against the roughly $3 million a year the town says it needs. Local dollars only started in 2022."
og_url: https://marbleheaddata.org/roads.html
---
<h1>How does Marblehead pay for its roads?</h1>

<p class="page-lead">For about 25 years, Marblehead funded its roads almost entirely from Chapter 90 state aid, which averaged roughly $449,000 a year against the roughly $3 million a year the town says it can effectively spend. The town budget did not put its own money into road capital until 2022.</p>

<div class="key-stats">
  <div class="key-stat">
    <div class="key-stat-value">~$449K</div>
    <div class="key-stat-label">Avg. Chapter 90 state aid per year<sup class="cite" data-href="data/roads/chapter90_apportionment_MHD.csv" data-source="[VERIFY: MassDOT Chapter 90 apportionment tables; mean of data/roads/chapter90_apportionment_MHD.csv]"></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">~$3M</div>
    <div class="key-stat-label">Annual spend the town says it needs<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="[VERIFY: Marblehead Roads Information Guide (town voter's guide); town's own estimate, not independent]"></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">0 mi</div>
    <div class="key-stat-label">Roads maintained by the state<sup class="cite" data-href="data/roads/road_ownership_2024.csv" data-source="[VERIFY: 2024 Road Inventory Year-End Report, Table 5, Marblehead #168]"></sup></div>
  </div>
  <div class="key-stat">
    <div class="key-stat-value">2022</div>
    <div class="key-stat-label">First year of local road capital (Article 11)<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="[VERIFY: Marblehead Roads Information Guide; Article 11, 2022 Town Meeting]"></sup></div>
  </div>
</div>

<nav class="page-toc" aria-label="On this page">
  <span class="page-toc-label">On this page</span>
  <a href="#ownership">No state to blame</a>
  <a href="#gap">The funding gap</a>
  <a href="#local">When local dollars entered</a>
  <a href="#slow">Why it moves slowly</a>
  <a href="#override">Roads and the override</a>
  <a href="#unknown">What we can't see yet</a>
</nav>
```

Replace every `[VERIFY: ...]` with the real, exact source string once confirmed
in Tasks 1–2 and by reading the guide. No `[VERIFY:` token may remain in the
shipped file (Task 9 greps for it).

- [ ] **Step 3: Verify it builds**

```bash
bundle exec jekyll build 2>&1 | tail -5
test -f _site/roads.html && echo "BUILT ok"
```
Expected: build succeeds, `BUILT ok`.

- [ ] **Step 4: Commit**

```bash
git add roads.html
git commit -m "feat: roads page scaffold (lede, stats, TOC)"
```

---

## Task 4: Section — "No state to blame" (ownership) + segmented bar

**Files:**
- Modify: `roads.html`

- [ ] **Step 1: Add the ownership section and SVG bar**

Append after the TOC. One tight paragraph (attributed, neutral) plus a
horizontal segmented bar built from `data/roads/road_ownership_2024.csv`
values. Use STYLE_GUIDE chart conventions: `class="chart"`, a real `role="img"`
and descriptive `aria-label`, series classes (no inline `style=""` on SVG
elements). Segment widths are proportional to the three mileage values
(0 / 68.99 / 11.24 of 80.22 total). Direct-label the segments.

```html
<h2 id="ownership">There is no state road to blame</h2>
<p>Marblehead maintains every one of its public roads. The 2024 state Road Inventory records zero state-maintained centerline miles in town: about 69 miles are town-accepted and another 11 are unaccepted ways.<sup class="cite" data-href="data/roads/road_ownership_2024.csv" data-source="2024 Road Inventory Year-End Report, MassDOT, Table 5, Marblehead (#168)."></sup> Unlike a town with a state highway running through it, Marblehead cannot attribute road condition to the state. Road funding here is a local choice.</p>

<div class="chart-wrapper">
  <svg class="chart" viewBox="0 0 800 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Segmented bar of Marblehead road ownership by centerline miles: 0 state-maintained, about 69 town-accepted, about 11 unaccepted, out of 80.22 total.">
    <!-- segment x/width computed from miles / 80.22 * chart-width; town-accepted uses --series-marblehead, unaccepted uses --series-neutral. Direct labels above each segment. -->
  </svg>
</div>
```

- [ ] **Step 2: Verify build + no inline SVG styles**

```bash
bundle exec jekyll build 2>&1 | tail -3
grep -n 'style="' roads.html && echo "FOUND inline style (fix)" || echo "no inline styles ok"
```
Expected: build succeeds; `no inline styles ok`.

- [ ] **Step 3: Commit**

```bash
git add roads.html && git commit -m "feat: roads ownership section + segmented bar"
```

---

## Task 5: Section — the funding gap (Chart A: Chapter 90 vs stated need)

**Files:**
- Modify: `roads.html`

- [ ] **Step 1: Add the funding-gap section and time-series chart**

Line or bar chart of `chapter90_apportionment` per fiscal year from
`data/roads/chapter90_apportionment_MHD.csv`, with a horizontal reference line
at the town's ~$3M figure. Compute SVG coordinates from the actual CSV values
(document the x/y formula in an SVG comment, as `legal-fees.html` does). Caption
must state the reference line is the **town's own** estimate, not an independent
needs assessment. Use `--series-marblehead` for the Chapter 90 series and
`--series-neutral` (dashed) for the reference line.

```html
<h2 id="gap">The funding gap</h2>
<p>For most of 25 years, Chapter 90 was effectively the whole road budget. It averaged about $449,000 a year.<sup class="cite" data-href="data/roads/chapter90_apportionment_MHD.csv" data-source="MassDOT Chapter 90 apportionment tables, Marblehead; compiled in data/roads/chapter90_apportionment_MHD.csv."></sup> The town's own guide puts the level it can effectively spend at about $3 million a year.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide (town voter's guide). This $3M figure is the town's own estimate, not an independent needs assessment."></sup></p>
<div class="chart-wrapper">
  <svg class="chart" viewBox="0 0 800 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="[VERIFY: describe the actual trend from the CSV once built]">
    <!-- x = left + (FY - FY_min) * step ; y scaled to max($3M, max apportionment). Reference line at 3,000,000. -->
  </svg>
</div>
<p class="chart-note">The dashed line is the town's stated ~$3M annual figure, not an independent estimate of need.</p>
```

- [ ] **Step 2: Verify build + no `[VERIFY` left in this section's shipped output**

```bash
bundle exec jekyll build 2>&1 | tail -3
```
Expected: build succeeds. (Global `[VERIFY` check is Task 9.)

- [ ] **Step 3: Commit**

```bash
git add roads.html && git commit -m "feat: roads funding-gap chart (Chapter 90 vs stated need)"
```

---

## Task 6: Section — when local dollars entered (Chart B + timeline)

**Files:**
- Modify: `roads.html`

- [ ] **Step 1: Verify the Article 11 / authorized-but-unissued figures**

```bash
grep -n "Roads and sidewalks\|authorized\|unissued\|6.98\|Article 11" data/SOURCE_LOOKUP.md
grep -n "Article 11\|2022\|Pavement Management\|Washington\|Pleasant\|Atlantic\|Humphrey\|Village\|West Shore" data/town_docs/Marblehead-Roads-Information-Guide.txt
```

- [ ] **Step 2: Add the local-capital section**

An annotated timeline/bar: Article 11 (2022) first local capital; FY25 ACFR
$6.98M authorized-but-unissued for roads/sidewalks; the six corridors of the
3-year Capital Improvement Road Program. Each figure cited to its primary
source (ACFR via SOURCE_LOOKUP for the $6.98M; the guide for the program
corridors). Keep the town's framing attributed.

```html
<h2 id="local">When local dollars entered</h2>
<p>In 2022, Town Meeting approved Article 11, the town's first local capital appropriation for roads and sidewalks.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide; Article 11, 2022 Annual Town Meeting."></sup> As of the FY25 audit, $6.98 million remained authorized but unissued for roads and sidewalks.<sup class="cite" data-href="data/SOURCE_LOOKUP.md" data-source="[VERIFY exact ACFR citation from data/SOURCE_LOOKUP.md — FY25 ACFR authorized-but-unissued, Roads and sidewalks $6.98M]"></sup> The three-year Capital Improvement Road Program covers Washington, Pleasant, Atlantic, Humphrey, Village, and West Shore Drive.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide; three-year Capital Improvement Road Program corridors."></sup></p>
```

- [ ] **Step 3: Verify build + commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
git add roads.html && git commit -m "feat: roads local-capital section (Article 11, program corridors)"
```

---

## Task 7: Sections — why it's slow, the override, what we can't see

**Files:**
- Modify: `roads.html`

- [ ] **Step 1: Add the three closing sections**

Prose only (no new charts). Verify each claim against the guide first:

```bash
grep -n "sequence\|National Grid\|ADA\|contractor\|construction season\|winter\|override\|five or more years\|five years\|does not include\|Pavement Management" data/town_docs/Marblehead-Roads-Information-Guide.txt
```

`#slow`: the utility-sequencing order and the three real-world constraints
(traffic, contractor availability, paving season), attributed to the town as
its explanation for the ~$3M ceiling.

`#override`: the precise distinction — the override does **not** fund the
Article 11 road *capital program* (already funded), but **does** fund repair of
sections not scheduled within the next 5+ years. Link the override explainer
page inline (first mention). This corrects the "roads were left out" shorthand.

`#unknown`: honest gaps — town runs a Pavement Management System (0–100) but
publishes no average PCI; no public per-street condition data; the $3M "need"
is the town's figure, not independently verified.

```html
<h2 id="slow">Why it moves slowly</h2>
<p>The town says pavement is the last step. Each road follows a sequence: gas-line upgrades, then water and sewer, then complete-streets and ADA ramp review, then tree, parking, and drainage work, then sidewalks, and only then final paving.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide; road reconstruction sequence."></sup> The town cites three limits on pace: traffic management across simultaneous closures, a limited pool of qualified contractors bidding across many towns, and the New England paving season.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide; three real-world constraints."></sup></p>

<h2 id="override">Roads and the override</h2>
<p>[Write the precise distinction here; link the override explainer inline on first mention. Verify the exact override wording against the guide before writing.]</p>

<h2 id="unknown">What we can't see yet</h2>
<p>The town rates every road on a 0-to-100 scale through a Pavement Management System, but it does not publish the resulting scores.<sup class="cite" data-href="data/town_docs/Marblehead-Roads-Information-Guide.txt" data-source="Marblehead Roads Information Guide; Pavement Management System, 0 to 100 scale."></sup> There is no public per-street condition data, and the roughly $3 million annual figure is the town's own estimate rather than an independently verified needs assessment.</p>
```

Find the override explainer's real path before linking:
```bash
ls override*.html the-debate.html 2>/dev/null; grep -rln "override" index.html | head
```

- [ ] **Step 2: Verify build + commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
git add roads.html && git commit -m "feat: roads slow/override/unknowns sections"
```

---

## Task 8: Link the page in + generate OG card

**Files:**
- Modify: `index.html`, `where-has-the-money-gone.html`, `data/index.html`
- Create: `assets/og/roads.png` (or wherever `render-og-images.mjs` outputs)

- [ ] **Step 1: See how legal-fees is surfaced, then mirror it**

```bash
grep -n "legal-fees.html" index.html where-has-the-money-gone.html data/index.html
```

- [ ] **Step 2: Add a homepage question card**

Mirror the structure of the legal-fees card in `index.html` (same
`.question`/card markup). Headline = the reader's question ("How does Marblehead
pay for its roads?"). No `Chart`/`Calculator` tag (it's a reading page). Place
it in a topically sensible section (near town spending / DPW).

- [ ] **Step 3: Add internal links**

In `where-has-the-money-gone.html`, link `roads.html` where DPW/roads is
mentioned. In `data/index.html`, add the page to the listing next to
`legal-fees.html`.

- [ ] **Step 4: Generate the OG card**

```bash
node scripts/render-og-images.mjs 2>&1 | tail -10 || node scripts/og-build.mjs 2>&1 | tail -10
```
Expected: an OG image is produced for `roads`. Confirm the file exists; if the
script needs the page registered somewhere, follow the pattern the other pages
use (grep the script for how it enumerates pages).

- [ ] **Step 5: Verify build + commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
git add index.html where-has-the-money-gone.html data/index.html assets/og/ 2>/dev/null
git commit -m "feat: link roads page from home, WHTMG, data index; add OG card"
```

---

## Task 9: Smoke test, self-review, and Playwright proof

**Files:**
- Modify: `tests/smoke-test.mjs`
- Create: `proof/roads-funding-gap.png`

- [ ] **Step 1: Add a smoke test for the page**

Mirror `testTermsPageLoads` in `tests/smoke-test.mjs`: assert 200, assert the
h1 text, and assert the funding-gap chart renders.

```js
async function testRoadsPage(page) {
  console.log('\n── /roads.html ──');
  const resp = await page.goto(`${SITE}/roads.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) { fail('roads.html load', `HTTP ${resp.status()}`); return; }
  ok('roads.html returns 200');
  const h1 = await page.$('h1');
  const h1Text = h1 ? (await h1.textContent()).trim() : '';
  /roads/i.test(h1Text) ? ok(`roads h1: "${h1Text}"`) : fail('roads h1', `got "${h1Text}"`);
  const charts = await page.$$('svg.chart');
  charts.length >= 2 ? ok(`${charts.length} charts render`) : fail('roads charts', `expected >=2, got ${charts.length}`);
  const cites = await page.$$('sup.cite');
  cites.length > 0 ? ok(`${cites.length} citation markers`) : fail('roads citations', 'none');
}
```

Wire it into the run loop next to the other page tests (find where
`testTermsPageLoads(page)` is called and add `await testRoadsPage(page);`).

- [ ] **Step 2: Run the full smoke test**

Run: `npm run test:local`
Expected: all pass, **0 fail** (count is higher than before by the new
assertions). 0 fail is the invariant.

- [ ] **Step 3: Self-review the shipped page**

```bash
grep -n "\[VERIFY" roads.html && echo "FAIL: unresolved VERIFY tokens" || echo "no VERIFY tokens ok"
grep -n 'style="' roads.html && echo "FAIL: inline styles" || echo "no inline styles ok"
grep -niE "shocking|crisis|skyrocket|crumbling|outrageous|neglect|—" roads.html && echo "CHECK: editorial/em-dash" || echo "tone ok"
```
Expected: `no VERIFY tokens ok`, `no inline styles ok`, `tone ok`. Fix anything
flagged before proceeding. (Em-dash check: the `—` grep catching a hit means a
banned em-dash slipped in; replace it.)

- [ ] **Step 4: Capture Playwright proof**

```bash
npm run dev &   # or: bundle exec jekyll serve --port 4000
sleep 6
mkdir -p proof
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 "http://localhost:4000/roads.html" "proof/roads-funding-gap.png"
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 --full-page "http://localhost:4000/roads.html" "proof/roads-funding-gap-full.png"
file proof/roads-funding-gap.png   # expect ~2880 px wide
```

- [ ] **Step 5: Commit and open the PR**

```bash
git add tests/smoke-test.mjs proof/roads-funding-gap.png proof/roads-funding-gap-full.png
git commit -m "test: smoke test for roads page + proof screenshots"
git push -u origin roads-funding-gap
```
Then open a PR (per repo rule: always open a PR after pushing) with the Proof of
Work section — reference `proof/roads-funding-gap.png`, list the sections to
review, and paste the smoke-test 0-fail output. Wait for the Cloudflare preview
sticky comment and include the Branch URL in the review ask.

---

## Notes for the executor

- **Verify before you write.** Every `[VERIFY: ...]` placeholder in this plan is
  a deliberate instruction to read the primary source and substitute the real
  value + exact citation string. None may survive into the shipped page (Task 9
  greps for them).
- **The town guide is advocacy.** Attribute its framing ("the town says…"),
  never adopt it. The $3M is the town's estimate, always labeled as such.
- **No green/red on charts, no em-dashes, no meta-narration, plain voice** —
  STYLE_GUIDE and CLAUDE.md rules. Re-read STYLE_GUIDE.md before writing chart
  markup or copy.
- **Trace every number to a source file + citation.** If a figure can't be
  sourced, cut it rather than shipping it uncited.
