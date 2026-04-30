# Marblehead Corp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `marblehead-corp.html`, an unlinked single-page parody of a corporate annual report that demonstrates why Massachusetts municipal law makes "the town should run like a business" a non-literal claim. Every fact traces to a primary source.

**Architecture:** A single Jekyll page using the existing `default` layout, with a body class (`corp-page`) that scopes a block of new CSS in `assets/site.css`. The page is excluded from the sitemap and the Pagefind search index, but reachable by direct URL. No new layouts, no new includes, no new JS.

**Tech Stack:** Jekyll 3.10 (per repo Gemfile), HTML, CSS, Playwright (smoke test + proof screenshot). No JS framework.

**Spec:** `docs/superpowers/specs/2026-04-30-marblehead-corp-design.md`. Read it first if you have not.

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `marblehead-corp.html` | Create | The page itself: front matter, cover, eight content sections, notes, forward-looking statement. Inline `<style>` block for one-off rules that don't belong in the global stylesheet. |
| `assets/site.css` | Modify | Add a scoped block of `body.corp-page` rules for typography conventions used across the page (small-caps section labels, tabular numerals, footnote superscripts, justified body, KPI strip layout, business segments table). |
| `sitemap.xml` | Modify | Honor a new `sitemap: false` front-matter flag so the page is omitted from the sitemap. |
| `tests/smoke-test.mjs` | Modify | Add a test that loads `/marblehead-corp.html`, checks for HTTP 200, and asserts a few section headers render. |
| `proof/<branch>.png` | Create | Above-fold screenshot of the rendered page committed to the branch as proof. |
| `docs/superpowers/notes/marblehead-corp-source-lookups.md` | Create (Task 0) | Working reference doc with the consolidated source data — KPI values, page numbers, MGL citations, salary figures — so later tasks reference values instead of doing per-section research. |

The implementation does **not** add the page to nav, the homepage, or any sibling page's link list. Discovery is by direct URL only.

---

## Task 0: Source data lookup and consolidation

Goal: produce a single short reference doc with every number, name, and citation the page needs, so each later task can drop values in without doing fresh research.

**Files:**
- Create: `docs/superpowers/notes/marblehead-corp-source-lookups.md`

**Inputs available in the repo:**
- `data/SOURCE_LOOKUP.md` — page numbers for ACFR figures (FTE, levy, etc.).
- `data/FY26_budget_summary.json` — FY26 spend by category.
- `data/general_fund_spending_FY15-26.csv` — FY26 general fund spending breakdown.
- `data/dor_all_351_FY26.csv` — Marblehead's FY26 levy ceiling and utilization (filter to Marblehead row).
- `data/fte_employees_FY15-24.csv` — total FTE FY24.
- `data/employee_benefits_FY15-24.csv` — health insurance share context (memory: 83% premium share).
- `data/free_cash_operating_history.csv` — stabilization or free cash balance.

If a value is not findable in the repo, use the FY24 ACFR (`https://github.com/agbaber/marblehead/releases/download/source-archive-v1/FY24_ACFR.pdf`) and cite the page number. The PDF is large — page-targeted reads only.

- [ ] **Step 1: Create the lookup doc skeleton**

```bash
mkdir -p docs/superpowers/notes
```

Write `docs/superpowers/notes/marblehead-corp-source-lookups.md` with this scaffold (fill in values during steps 2–6):

```markdown
# Marblehead Corp — source lookups

Working reference for `marblehead-corp.html`. Every value appears with its source so the page's Notes section can cite directly.

## Cover and Letter from Management

- **Town founded / first recorded Town Meeting:** [VALUE] — [SOURCE]
- **Current Town Administrator:** [NAME], [TITLE], appointed [DATE] — [SOURCE]
- **Select Board (FY26):** five members, 3-year staggered terms, $0 stipend — M.G.L. c. 41, §108

## Company at a Glance (KPI strip)

| Cell | Value | Source |
|---|---|---|
| Customers (population) | [VALUE] | [SOURCE] |
| Employees (FTE, FY24) | [VALUE] | FY24 ACFR p.[N], "Full-time Equivalent Town Employees by Function" |
| FY24 Revenue (general fund total) | [VALUE] | FY24 ACFR p.[N] |
| Bond Rating | Aa1 (Moody's) | FY24 ACFR — Bond Rating disclosure |
| Levy Ceiling Utilization (FY26) | [VALUE]% | DOR `dor_all_351_FY26.csv` (Marblehead row) |
| Stabilization Fund (most recent) | [VALUE] | [SOURCE] |

## Item 1. Business Segments (FY26 budgeted spend)

| Segment | $ | % |
|---|---|---|
| Education (K-12) | [VALUE] | [VALUE]% |
| Public Safety (Police + Fire) | [VALUE] | [VALUE]% |
| Public Works | [VALUE] | [VALUE]% |
| General Government | [VALUE] | [VALUE]% |
| Employee Benefits | [VALUE] | [VALUE]% |
| Debt Service | [VALUE] | [VALUE]% |
| Other | [VALUE] | [VALUE]% |

Source: `data/FY26_budget_summary.json` and FY26 budget book p.[N].

## Risk Factors — confirmed citations

- 1A.1: M.G.L. c. 59, §21C (Prop 2½) — verified.
- 1A.2: M.G.L. c. 71, §1, §5; 20 U.S.C. §1400 (IDEA) — verified.
- 1A.3: M.G.L. c. 71, §42 (teacher dismissal); M.G.L. c. 31 (civil service) — verified.
- 1A.4: M.G.L. c. 150E (public employee collective bargaining) — verified.
- 1A.5: M.G.L. c. 30A, §§18–25 (OML); c. 66, §10 (Public Records) — verified.
- 1A.6: M.G.L. c. 30B (sealed bid >$50K, three quotes $10K–$50K); c. 30 §39M; c. 149 §44A — verified.
- 1A.7: M.G.L. c. 32B, §§19, 22 (PEC, 70% supermajority) — verified.
- 1A.8: M.G.L. c. 39, §10 (open Town Meeting); c. 59, §21C(k) (debt exclusion) — verified.
- 1A.9: 11 U.S.C. §109(c)(2) — MA has not enacted enabling legislation. Verified.
- 1A.10: M.G.L. c. 41, §108 (Board may receive stipend); local practice $0.

## Executive Compensation

- **Town Administrator FY26 base salary:** [VALUE] — FY26 budget book, General Government, p.[N]
- **Industry comparable A:** Eastern Bankshares CEO — [NAME], [YEAR] total comp [VALUE] — [PROXY URL]
- **Industry comparable B:** L.L. Bean CEO — [NAME], most-recent reported total comp [VALUE] — [SOURCE], or DROP if no clean public figure available.
```

- [ ] **Step 2: Fill in Cover/Letter values**

Read `data/SOURCE_LOOKUP.md` and the FY24 ACFR landing page on GitHub if needed. For "first recorded Town Meeting" — Marblehead was incorporated in 1649; first Town Meeting predates that as a settlement practice. If a precise date is not findable in the repo or in 5 minutes of web search, write "since the seventeenth century" and footnote that to a generic Marblehead history reference.

For Town Administrator name, check `data/open_finance_vendor_payments_FY26_snapshot_2026-04-17.csv`, the FY27 budget proposal `data/FY27_Proposed_Budget_No_Override.txt`, or the town website (best primary source). Note name + title + start date.

- [ ] **Step 3: Fill in KPI strip values**

Read each source CSV/JSON and pull the value. For FY24 revenue, FTE, and stabilization, use `data/SOURCE_LOOKUP.md` to identify the right ACFR page; if SOURCE_LOOKUP doesn't list the metric, open the FY24 ACFR PDF on a small page range. For FY26 levy ceiling utilization, filter `dor_all_351_FY26.csv` to the Marblehead row and compute `(actual levy) / (levy ceiling) × 100` if not pre-computed.

If any one cell can't be sourced cleanly, drop it from the strip rather than estimate. The page reads fine with five cells.

- [ ] **Step 4: Fill in Business Segments table**

Open `data/FY26_budget_summary.json`, identify the spend categories that map to Education / Public Safety / Public Works / General Government / Employee Benefits / Debt Service / Other. Copy the dollar values verbatim. Compute percentages.

- [ ] **Step 5: Fill in Executive Compensation values**

Town Administrator FY26 salary: read `data/FY27_Proposed_Budget_No_Override.txt` (Town Administrator line item) or the FY26 budget book if that exists in the repo's data archive. Name + title + start date already set in Step 2.

For comparables: search Eastern Bankshares' most recent DEF 14A proxy (publicly filed on SEC EDGAR) for CEO Total Compensation. For L.L. Bean: try business press (Bangor Daily News, WSJ, Forbes private-company lists). If only one clean comparable is findable, drop the second and present a one-line aside; if neither is findable in 10 minutes, drop the comparables paragraph entirely and note that decision in the lookup doc.

- [ ] **Step 6: Commit the lookup doc**

```bash
git add docs/superpowers/notes/marblehead-corp-source-lookups.md
git commit -m "Add source lookup doc for Marblehead Corp page"
```

Verification: open the doc and confirm there are no remaining `[VALUE]` or `[SOURCE]` placeholders in any row used by the page (dropped cells/sections should be marked DROPPED, not left bracketed).

---

## Task 1: Page skeleton and scoped CSS

Goal: create the page file with front matter and an empty body, plus the CSS block that scopes typography. Verify the page builds and renders blank.

**Files:**
- Create: `marblehead-corp.html`
- Modify: `assets/site.css`

- [ ] **Step 1: Write the page skeleton**

Create `marblehead-corp.html`:

```html
---
layout: default
title: "Marblehead Corp — FY 2025 Annual Report"
body_class: corp-page
sitemap: false
og_title: "Marblehead Corp — FY 2025 Annual Report"
og_description: "A parody annual report illustrating why Massachusetts municipal law makes the corporate framing a category mistake. All figures cite primary sources."
og_url: https://marbleheaddata.org/marblehead-corp.html
---
<div data-pagefind-ignore>
  <article class="corp-doc">
    <!-- Sections inserted in subsequent tasks -->
  </article>
</div>
```

Notes on choices:
- `layout: default` so site nav and `<head>` (analytics, fonts, OG tags) still work.
- `body_class: corp-page` is the existing site convention (see `_layouts/default.html`); CSS keys off this.
- `sitemap: false` is honored by Task 8's edit to `sitemap.xml`.
- `data-pagefind-ignore` wrapping the article excludes the page from search-index scrape per Pagefind docs.
- No `scripts: [citations]` because we want footnotes in a hand-built **Notes to Financial Statements** section, not citations.js's auto-injected "Sources" `<h2>` (see project memory on citations.js behavior).

- [ ] **Step 2: Add scoped CSS to `assets/site.css`**

Append a clearly-marked block to the end of `assets/site.css`:

```css
/* ==========================================================================
   Marblehead Corp page — scoped to body.corp-page only.
   Berkshire-Hathaway-spartan financial-document register.
   ========================================================================== */

body.corp-page .corp-doc {
  max-width: 720px;
  margin: 32px auto 80px;
  padding: 0 var(--gutter);
  font-family: Georgia, "Times New Roman", "Liberation Serif", serif;
  color: var(--text);
  font-size: 1.0625rem;
  line-height: 1.55;
}

body.corp-page .corp-doc p {
  margin: 0 0 1em;
  text-align: justify;
  hyphens: auto;
  font-variant-numeric: tabular-nums;
}

body.corp-page .corp-doc h2.item-header {
  font-family: var(--font-heading);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding: 32px 0 8px;
  margin: 24px 0 18px;
}

body.corp-page .corp-doc .item-header em {
  font-style: italic;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: none;
}

body.corp-page .corp-doc .corp-cover {
  text-align: center;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 40px 0;
  margin: 40px 0 56px;
}

body.corp-page .corp-doc .corp-cover .corp-name {
  font-size: 1.6rem;
  letter-spacing: 0.12em;
  font-weight: 700;
  margin: 0 0 8px;
}

body.corp-page .corp-doc .corp-cover .corp-doc-type {
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 18px;
}

body.corp-page .corp-doc .corp-cover .corp-meta {
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 4px 0;
}

body.corp-page .corp-doc .kpi-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  margin: 24px 0;
}

body.corp-page .corp-doc .kpi-strip .kpi {
  background: var(--surface);
  padding: 16px 12px;
  text-align: center;
}

body.corp-page .corp-doc .kpi-strip .kpi-value {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  display: block;
}

body.corp-page .corp-doc .kpi-strip .kpi-label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 4px;
  display: block;
}

body.corp-page .corp-doc table.corp-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px;
  font-size: 0.94rem;
  font-variant-numeric: tabular-nums;
}

body.corp-page .corp-doc table.corp-table th,
body.corp-page .corp-doc table.corp-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--divider);
  text-align: left;
}

body.corp-page .corp-doc table.corp-table th {
  font-weight: 700;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

body.corp-page .corp-doc table.corp-table td.num,
body.corp-page .corp-doc table.corp-table th.num {
  text-align: right;
  font-feature-settings: "tnum";
}

body.corp-page .corp-doc .risk-factor {
  margin: 0 0 1em;
  text-align: justify;
}

body.corp-page .corp-doc sup.fn {
  font-size: 0.7em;
  vertical-align: super;
  line-height: 0;
  margin-left: 1px;
}

body.corp-page .corp-doc .corp-notes {
  font-size: 0.84rem;
  color: var(--text-muted);
  line-height: 1.45;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

body.corp-page .corp-doc .corp-notes ol {
  padding-left: 1.5em;
  margin: 0;
}

body.corp-page .corp-doc .corp-notes ol li {
  margin: 0 0 0.5em;
  text-align: left;
}

body.corp-page .corp-doc .forward-looking {
  font-size: 0.85rem;
  font-style: italic;
  color: var(--text-muted);
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}

body.corp-page .corp-doc .signature {
  margin-top: 24px;
  font-size: 0.95rem;
  font-style: italic;
  color: var(--text-muted);
}

@media (max-width: 600px) {
  body.corp-page .corp-doc .kpi-strip {
    grid-template-columns: repeat(2, 1fr);
  }
  body.corp-page .corp-doc {
    font-size: 1rem;
  }
  body.corp-page .corp-doc p {
    text-align: left;
    hyphens: none;
  }
}
```

Notes:
- Uses existing palette tokens (`--text`, `--surface`, `--border`, `--divider`, `--text-muted`).
- Justification disabled on mobile (it reads worse at narrow widths).
- KPI strip collapses to 2 columns on mobile.
- Heading family is the site's `--font-heading` so the page nav still feels site-native; body is serif which is the typographic departure.

- [ ] **Step 3: Verify body class is applied by the default layout**

Inspect `_layouts/default.html`. Confirm the `<body>` tag uses `class="{{ page.body_class }}"` or equivalent. If it does not, this is the layout convention used elsewhere in the site (e.g. `body.doc-page` for `data/case_studies.md`); search the layout to find it. If absent, add `class="{{ page.body_class }}"` to the `<body>` tag in `_layouts/default.html`.

```bash
grep -n "body_class\|<body" _layouts/default.html
```

Expected: at least one `<body>` line that emits `{{ page.body_class }}` or similar. If yes, no edit needed.

- [ ] **Step 4: Build and serve**

```bash
bundle exec jekyll build
bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
curl -sI http://localhost:4000/marblehead-corp.html | head -5
```

Expected: HTTP/1.1 200 OK on the curl.

- [ ] **Step 5: Visual sanity check**

Open the page in a browser (or Playwright headless). It should render with site nav at the top and an empty article below — no errors in console. CSS should have loaded (view source: `<link rel="stylesheet" ... assets/site.css`).

- [ ] **Step 6: Commit**

```bash
git add marblehead-corp.html assets/site.css
git commit -m "Scaffold /marblehead-corp.html (skeleton + scoped CSS)"
```

---

## Task 2: Cover block and Letter from Management

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert cover and letter inside `.corp-doc`**

Replace the placeholder comment in `marblehead-corp.html` with:

```html
<header class="corp-cover">
  <div class="corp-name">MARBLEHEAD CORP</div>
  <div class="corp-doc-type">FY 2025 Annual Report</div>
  <div class="corp-meta">Established 1649</div>
  <div class="corp-meta">Listed on: Annual Town Meeting (Marblehead, Massachusetts)</div>
  <div class="corp-meta">Symbol: MHD &middot; CUSIP: N/A</div>
</header>

<section class="letter">
  <h2 class="item-header">Letter from Management</h2>
  <p>We do not have a Chief Executive Officer.</p>

  <p>The Company is governed by its customers, who assemble in person at the Annual Town Meeting<sup class="fn">1</sup> and possess the legal authority to adopt the Company's annual operating budget, approve capital expenditures, and amend the Company's bylaws. The customers elect, by majority vote at the annual Town Election, a five-member Board of Directors known as the Select Board, which serves three-year staggered terms without compensation.<sup class="fn">2</sup> The Board appoints, and may remove, a Town Administrator who is responsible for day-to-day operations of the Company.<sup class="fn">3</sup></p>

  <p>The Annual Shareholder Meeting requires physical attendance. There is no proxy voting. The first recorded meeting of the Company's predecessor body occurred in the seventeenth century, and the practice has continued, with adaptations, to the present day.<sup class="fn">4</sup></p>

  <p>This structure is unusual by industry standards. Investors are directed to <strong>Item 1A. Risk Factors</strong> for a description of the material legal, regulatory, and customary constraints on the Company's operations.</p>

  <p class="signature">The Office of the Town Administrator<br>Marblehead, Massachusetts</p>
</section>
```

Footnote numbers 1–4 are placeholders for now; the Notes section in Task 7 will define them. Do not yet add the Notes section.

Source values to confirm against the lookup doc from Task 0:
- Footnote 1: first recorded Town Meeting reference (or "since the seventeenth century" if precise date not findable).
- Footnote 2: M.G.L. c. 41, §108 — Select Board may receive stipend; locally $0.
- Footnote 3: Town Administrator name, title, appointment date.
- Footnote 4: same source as footnote 1, or generic Marblehead history reference.

- [ ] **Step 2: Build and visually inspect**

```bash
bundle exec jekyll build
```

Open `_site/marblehead-corp.html` (or hit the dev server) and confirm: cover renders centered, letter is justified serif, drop-cap visible (note: drop-cap was deferred — if not implemented yet, the open paragraph still reads fine; add a `::first-letter` rule in a later step if desired).

- [ ] **Step 3: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add cover and Letter from Management"
```

---

## Task 3: Company at a Glance KPI strip

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert KPI strip after the letter**

Use the values from the lookup doc (Task 0, Step 3). Append after the `</section>` closing tag of the letter:

```html
<section class="kpis">
  <h2 class="item-header">Item 1. Company at a Glance</h2>
  <div class="kpi-strip">
    <div class="kpi">
      <span class="kpi-value">[POPULATION]</span>
      <span class="kpi-label">Customers<sup class="fn">5</sup></span>
    </div>
    <div class="kpi">
      <span class="kpi-value">[FTE_FY24]</span>
      <span class="kpi-label">Employees (FTE, FY24)<sup class="fn">6</sup></span>
    </div>
    <div class="kpi">
      <span class="kpi-value">[REVENUE_FY24]</span>
      <span class="kpi-label">FY24 Revenue<sup class="fn">7</sup></span>
    </div>
    <div class="kpi">
      <span class="kpi-value">Aa1</span>
      <span class="kpi-label">Bond Rating (Moody's)<sup class="fn">8</sup></span>
    </div>
    <div class="kpi">
      <span class="kpi-value">[LEVY_UTIL]%</span>
      <span class="kpi-label">Levy Ceiling Utilization (FY26)<sup class="fn">9</sup></span>
    </div>
    <div class="kpi">
      <span class="kpi-value">[STABILIZATION]</span>
      <span class="kpi-label">Stabilization Fund<sup class="fn">10</sup></span>
    </div>
  </div>
</section>
```

Replace the bracketed tokens with the values from `docs/superpowers/notes/marblehead-corp-source-lookups.md`. If a cell was marked DROPPED in Step 3 of Task 0, omit that `<div class="kpi">` block entirely.

Format conventions:
- Population: `5-digit count` (no commas if four digits, comma at thousands).
- FTE: one decimal place, e.g. `706.0`.
- Revenue: `$NNN.NM` style (`$94.2M`) so the cell isn't crowded.
- Levy utilization: integer percent, e.g. `87%`.
- Stabilization: `$N.NM` style.

- [ ] **Step 2: Build and visually inspect**

Build and check: KPI strip renders as 3-column on desktop, 2-column on mobile. Numbers right-sized and tabular-aligned.

- [ ] **Step 3: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add Company at a Glance KPI strip"
```

---

## Task 4: Item 1. Business + Business Segments table

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert Item 1. Business**

Append after the KPI strip section:

```html
<section class="business">
  <h2 class="item-header">Item 1. Business</h2>
  <p>The Company is a Massachusetts municipal corporation incorporated in 1649. Its principal office is located at Abbot Hall, 188 Washington Street, Marblehead, Massachusetts. The Company's primary lines of business are the provision of K-12 educational services, public safety, public works, and ancillary municipal services to residents and properties within an approximately 4.5-square-mile service area on the north shore of Massachusetts Bay.</p>

  <p>The Company's operations are organized into the following business segments, each of which is funded principally by property tax revenue and supplemented by state aid and local receipts:</p>

  <table class="corp-table">
    <thead>
      <tr>
        <th>Segment</th>
        <th class="num">FY26 Budgeted Spend</th>
        <th class="num">% of Total</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Education (K-12)</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>Public Safety (Police + Fire)</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>Public Works</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>General Government</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>Employee Benefits</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>Debt Service</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
      <tr><td>Other</td><td class="num">[$X.XM]</td><td class="num">[XX]%</td></tr>
    </tbody>
  </table>

  <p style="font-size: 0.86rem; color: var(--text-muted); margin-top: 4px;">Sourced from FY26 budget summary.<sup class="fn">11</sup></p>
</section>
```

Replace each bracketed token with values from the lookup doc. If "Other" is not a meaningful FY26 line item (e.g. spend reconciles cleanly), drop that row.

- [ ] **Step 2: Build and visually inspect**

Build, check: table renders, numerals are right-aligned, segment names left-aligned. Confirm percentages sum to 100 (±1 for rounding).

- [ ] **Step 3: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add Item 1. Business and Business Segments table"
```

---

## Task 5: Item 1A. Risk Factors

The heart of the page. Ten Risk Factors, each two sentences (corporate convention + MGL constraint).

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert Risk Factors section**

Append after the Business section. The text below is final — copy it verbatim (footnote numbers will line up with the Notes section in Task 7):

```html
<section class="risk-factors">
  <h2 class="item-header">Item 1A. Risk Factors</h2>

  <p>The following constraints, imposed by federal law, the Massachusetts General Laws, and the Company's organizational documents, are material to investors and should be considered in conjunction with the financial statements and management's discussion presented elsewhere in this Annual Report.</p>

  <p class="risk-factor"><strong>1A.1.</strong> <em>Revenue growth.</em> The Company's pricing power is statutorily limited. The aggregate annual increase in property tax revenue is capped at 2.5% over the prior year's levy limit, plus new growth from net new construction, except by majority vote of the Company's customers (M.G.L. c. 59, §21C, "Proposition 2½").<sup class="fn">12</sup> The Company has no ability to expand into new geographic markets, as service area boundaries are fixed by colonial charter and adjacent municipal incorporation.</p>

  <p class="risk-factor"><strong>1A.2.</strong> <em>Customer selection.</em> The Company is statutorily prohibited from selecting its customer base. K-12 educational services must be provided to all residents under age 22, regardless of ability to pay or service cost (M.G.L. c. 71, §1, §5; IDEA, 20 U.S.C. §1400 et seq., for special education).<sup class="fn">13</sup> Emergency public safety services must be provided to all persons within the service area without regard to residency or payment.</p>

  <p class="risk-factor"><strong>1A.3.</strong> <em>Workforce reductions.</em> The Company's ability to terminate employees is materially constrained. Teachers with three or more years of continuous service in the same school district may not be dismissed except for cause, after a hearing (M.G.L. c. 71, §42).<sup class="fn">14</sup> Public safety employees in civil-service positions are subject to additional removal protections (M.G.L. c. 31).</p>

  <p class="risk-factor"><strong>1A.4.</strong> <em>Collective bargaining.</em> A substantial portion of the Company's workforce is covered by collective bargaining agreements pursuant to M.G.L. c. 150E, including but not limited to teacher, paraprofessional, police, fire, public works, library, and clerical bargaining units.<sup class="fn">15</sup> Unilateral modifications to wages, hours, or terms and conditions of employment are not permitted during the term of an agreement.</p>

  <p class="risk-factor"><strong>1A.5.</strong> <em>Communications and information security.</em> All material non-public deliberations of the Company's Board of Directors must be noticed at least 48 hours in advance and conducted in public (M.G.L. c. 30A, §§18–25, "Open Meeting Law").<sup class="fn">16</sup> Internal communications, including correspondence among officers, are subject to disclosure on request (M.G.L. c. 66, §10, "Public Records Law"). Strategic plans cannot be developed in private session except in narrowly enumerated circumstances.</p>

  <p class="risk-factor"><strong>1A.6.</strong> <em>Procurement.</em> The Company cannot select preferred vendors based on relationship, brand preference, or convenience. Purchases of supplies and services in excess of $50,000 require sealed competitive bidding; purchases between $10,000 and $50,000 require written quotations from at least three vendors (M.G.L. c. 30B).<sup class="fn">17</sup> Contracts for public construction projects exceeding $50,000 are subject to additional bidding and prevailing-wage requirements (M.G.L. c. 30, §39M; c. 149, §44A et seq.).</p>

  <p class="risk-factor"><strong>1A.7.</strong> <em>Employee benefits.</em> The Company's authority to modify employee health insurance plan design and contribution share is limited. Such changes may be made only through collective bargaining or, in lieu of bargaining, by a 70% supermajority vote of a Public Employee Committee composed of representatives of each affected bargaining unit (M.G.L. c. 32B, §19, §22).<sup class="fn">18</sup> The Company's current premium contribution share is 83%.</p>

  <p class="risk-factor"><strong>1A.8.</strong> <em>Capital structure.</em> Major capital expenditures and the issuance of new debt require approval at the in-person Annual or Special Town Meeting. There is no proxy voting; each shareholder appears in person (M.G.L. c. 39, §10).<sup class="fn">19</sup> Borrowing in excess of statutory debt limits is permitted only by separate ballot of the customers (M.G.L. c. 59, §21C(k), "debt exclusion").</p>

  <p class="risk-factor"><strong>1A.9.</strong> <em>Insolvency.</em> The Company is not eligible to file for protection under Chapter 9 of the United States Bankruptcy Code. Massachusetts has not enacted general legislation authorizing its municipalities to file (11 U.S.C. §109(c)(2) requires specific state authorization, which Massachusetts has not provided).<sup class="fn">20</sup></p>

  <p class="risk-factor"><strong>1A.10.</strong> <em>Governance.</em> The Board of Directors consists of five members elected by customers to staggered three-year terms. Board members are uncompensated; M.G.L. c. 41, §108 permits the Company to set a stipend, and the Board has historically declined.<sup class="fn">21</sup> The Board may be replaced in whole or in part by majority vote of customers at each annual election.</p>
</section>
```

This is the most important section of the page. Do not edit the prose without explicit user approval; the wording was set in the spec.

- [ ] **Step 2: Build and visually inspect**

Build, scroll to Item 1A. Each Risk Factor is a single justified paragraph with bold number, italic title, and one MGL citation. Footnote superscripts visible.

- [ ] **Step 3: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add Item 1A. Risk Factors (1A.1–1A.10)"
```

---

## Task 6: Item 7 MD&A + Item 11 Executive Compensation

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert Item 7. MD&A**

Append after Risk Factors:

```html
<section class="mda">
  <h2 class="item-header">Item 7. Management's Discussion and Analysis</h2>
  <p>The Company's most recent audited financial statements are for the fiscal year ended June 30, 2024, and are presented in the Annual Comprehensive Financial Report (ACFR) for FY24, available in the Company's primary-source archive.<sup class="fn">22</sup> Investors and customers seeking detailed financial analysis, including revenue and expenditure trends, fund balance composition, debt service schedules, and pension and OPEB liability disclosures, are referred to that document.</p>
</section>
```

- [ ] **Step 2: Insert Item 11. Executive Compensation**

Append:

```html
<section class="exec-comp">
  <h2 class="item-header">Item 11. Executive Compensation</h2>

  <table class="corp-table">
    <thead>
      <tr>
        <th>Position</th>
        <th>Holder</th>
        <th class="num">FY26 Cash Compensation</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Chair, Board of Directors</td><td>Select Board Chair</td><td class="num">$0<sup class="fn">23</sup></td></tr>
      <tr><td>Director (×4)</td><td>Select Board (4 members)</td><td class="num">$0 each</td></tr>
      <tr><td>Town Administrator</td><td>[NAME]</td><td class="num">[$XXX,XXX]<sup class="fn">24</sup></td></tr>
    </tbody>
  </table>

  <p style="font-size: 0.92rem; color: var(--text-muted);"><strong>Industry Comparables.</strong> [COMPARABLES PARAGRAPH or DROP per Task 0 Step 5]</p>
</section>
```

For the Industry Comparables paragraph, write one to two sentences in this register, no commentary on whether the gap is large or small:

> "By comparison, [Eastern Bankshares Inc., a publicly traded financial-services company headquartered in Boston,] disclosed total compensation of [$X.XX million] for its Chief Executive Officer in [YEAR] (DEF 14A proxy statement filed [DATE]).[<sup class="fn">25</sup>] [Optional second comparable in same register.]"

If both comparables are unavailable per Task 0, replace the paragraph with a single sentence: "Comparable executive-compensation data for area private employers is not consistently disclosed in public filings." Drop the footnote.

Replace bracketed tokens with values from the lookup doc.

- [ ] **Step 3: Build and visually inspect**

Build, scroll to Item 11. Table renders three rows; comparables paragraph reads neutrally.

- [ ] **Step 4: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add Item 7 MD&A and Item 11 Executive Compensation"
```

---

## Task 7: Notes to Financial Statements + Forward-Looking Statements

**Files:**
- Modify: `marblehead-corp.html`

- [ ] **Step 1: Insert the Notes section**

Append a Notes section listing every footnote referenced on the page (1 through 25 if all sections are present, fewer if KPI cells or comparables were dropped). Each footnote is one sentence: source citation, then optional one-line gloss.

```html
<section class="corp-notes">
  <h2 class="item-header">Notes to Financial Statements</h2>
  <ol>
    <li id="fn-1"><strong>1.</strong> The first recorded Town Meeting in Marblehead is documented in the seventeenth century; the practice predates incorporation. [SOURCE — local history reference or town clerk records].</li>
    <li id="fn-2"><strong>2.</strong> M.G.L. c. 41, §108 (compensation of municipal officers); local practice has been to decline a stipend. Current Select Board members serve without cash compensation per the FY26 budget book.</li>
    <li id="fn-3"><strong>3.</strong> Town Administrator: [NAME], appointed [DATE]. Source: [town website / FY27 budget proposal].</li>
    <li id="fn-4"><strong>4.</strong> Same as note 1.</li>
    <li id="fn-5"><strong>5.</strong> Population: [VALUE], from [American Community Survey 5-year estimates table B01003 / DOR FY27 income/equalized-pop dataset].</li>
    <li id="fn-6"><strong>6.</strong> FY24 total full-time equivalent employees: [VALUE]. FY24 ACFR p.[N], "Full-time Equivalent Town Employees by Function."</li>
    <li id="fn-7"><strong>7.</strong> FY24 general fund total revenue: [VALUE]. FY24 ACFR p.[N], "Statement of Revenues, Expenditures, and Changes in Fund Balances — General Fund."</li>
    <li id="fn-8"><strong>8.</strong> Moody's Investors Service general-obligation rating, most recent: Aa1. FY24 ACFR — Bond Rating disclosure section.</li>
    <li id="fn-9"><strong>9.</strong> FY26 levy as a percentage of FY26 levy ceiling: [VALUE]%. Source: MA DOR Division of Local Services, FY26 Tax Recap (data/dor_all_351_FY26.csv, Marblehead row).</li>
    <li id="fn-10"><strong>10.</strong> Stabilization fund balance, most recent: [VALUE]. Source: [FY24 ACFR p.N or DLS Free Cash certification].</li>
    <li id="fn-11"><strong>11.</strong> FY26 budgeted spend by category: data/FY26_budget_summary.json; original document is the FY26 budget book, available in the Company's primary-source archive.</li>
    <li id="fn-12"><strong>12.</strong> M.G.L. c. 59, §21C, "Proposition 2½," enacted by initiative petition in 1980; the levy ceiling and levy limit are computed annually by the Department of Revenue.</li>
    <li id="fn-13"><strong>13.</strong> M.G.L. c. 71, §1 (school committees and superintendents) and §5 (right to attend public schools); Individuals with Disabilities Education Act, 20 U.S.C. §1400 et seq.</li>
    <li id="fn-14"><strong>14.</strong> M.G.L. c. 71, §42 ("dismissal of teachers"); the term used in statute is "professional teacher status," achieved after three years of continuous service.</li>
    <li id="fn-15"><strong>15.</strong> M.G.L. c. 150E, the public-employee collective bargaining statute, applies to municipal employees other than elected officials and certain managerial staff.</li>
    <li id="fn-16"><strong>16.</strong> M.G.L. c. 30A, §§18–25, the Open Meeting Law; M.G.L. c. 66, §10, the Public Records Law. Both administered by the Office of the Attorney General and the Supervisor of Records, respectively.</li>
    <li id="fn-17"><strong>17.</strong> M.G.L. c. 30B, the Uniform Procurement Act; thresholds last updated in 2016. M.G.L. c. 30, §39M and c. 149, §44A et seq. govern public works construction.</li>
    <li id="fn-18"><strong>18.</strong> M.G.L. c. 32B, §19 (joining the Group Insurance Commission) and §22 (PEC negotiations); the 70% supermajority threshold is calculated on weighted votes.</li>
    <li id="fn-19"><strong>19.</strong> M.G.L. c. 39, §10, the open Town Meeting statute. M.G.L. c. 59, §21C(k) governs debt exclusion ballot questions.</li>
    <li id="fn-20"><strong>20.</strong> 11 U.S.C. §109(c)(2) requires that a municipality be "specifically authorized" by state law to be a debtor; Massachusetts has not enacted such enabling legislation.</li>
    <li id="fn-21"><strong>21.</strong> M.G.L. c. 41, §108. The Marblehead Select Board has historically served without cash compensation; see also note 2.</li>
    <li id="fn-22"><strong>22.</strong> Annual Comprehensive Financial Report, fiscal year ended June 30, 2024, available at the primary-source archive: <a href="https://github.com/agbaber/marblehead/releases/download/source-archive-v1/FY24_ACFR.pdf">FY24 ACFR</a>.</li>
    <li id="fn-23"><strong>23.</strong> See note 2.</li>
    <li id="fn-24"><strong>24.</strong> Town Administrator base salary, FY26: [VALUE]. Source: FY26 budget book, General Government section, p.[N].</li>
    <li id="fn-25"><strong>25.</strong> [Eastern Bankshares Inc. DEF 14A proxy statement, filed [DATE]; cited Total Compensation figure for [NAME], Chief Executive Officer.]<br><em>or</em> "Comparable executive-compensation data for area private employers is not consistently disclosed in public filings." [Drop this note if comparables paragraph was dropped.]</li>
  </ol>
</section>
```

Replace every bracketed token using the Task 0 lookup doc. Drop `<li>` entries that correspond to dropped sections (e.g. if KPI strip dropped a cell, drop the matching note and renumber inline `<sup class="fn">N</sup>` references on the page).

- [ ] **Step 2: Insert Forward-Looking Statements**

Append after the Notes section, inside the same `.corp-doc` article:

```html
<section class="forward-looking">
  <p><em>Statements in this Annual Report regarding future operations, including but not limited to projections of the FY27 operating deficit, planned modifications to the FY27 levy, and changes to executive compensation, constitute forward-looking statements within the meaning of Section 27A of the Securities Act of 1933 and Section 21E of the Securities Exchange Act of 1934. Such statements are subject to material uncertainties, including but not limited to: the outcome of the FY27 Proposition 2½ override and Question 2 ballot questions; appropriations made at the May 4, 2026 Annual Town Meeting; pending legislation in the 194th General Court of the Commonwealth, including H.4225 (senior tax exemptions); and the funding policies of the Group Insurance Commission. Actual results may differ materially.</em></p>
</section>
```

- [ ] **Step 3: Build and visually inspect**

Build. Confirm:
- All `<sup class="fn">N</sup>` references on the page have a matching `<li id="fn-N">` in the Notes section.
- No `[VALUE]` or `[SOURCE]` placeholders remain.
- Notes section is small-type, justified, with a top border separating it from Forward-Looking.
- Forward-Looking is italic, smaller, justified.

- [ ] **Step 4: Commit**

```bash
git add marblehead-corp.html
git commit -m "marblehead-corp: add Notes and Forward-Looking Statements"
```

---

## Task 8: Sitemap exclusion

**Files:**
- Modify: `sitemap.xml`

- [ ] **Step 1: Add the `sitemap: false` skip to the Liquid loop**

Open `sitemap.xml`. The current loop is:

```liquid
{%- for page in site.pages -%}
  {%- if page.url contains '/assets/' or page.url contains '/data/' -%}{%- continue -%}{%- endif -%}
  {%- if page.url == '/sitemap.xml' or page.url == '/robots.txt' -%}{%- continue -%}{%- endif -%}
  {%- unless page.url contains '.html' or page.url == '/' -%}{%- continue -%}{%- endunless -%}
<url>
  <loc>{{ page.url | absolute_url }}</loc>
</url>
{%- endfor -%}
```

Add one line after the existing `continue` rules:

```liquid
  {%- if page.sitemap == false -%}{%- continue -%}{%- endif -%}
```

The full updated loop:

```liquid
{%- for page in site.pages -%}
  {%- if page.url contains '/assets/' or page.url contains '/data/' -%}{%- continue -%}{%- endif -%}
  {%- if page.url == '/sitemap.xml' or page.url == '/robots.txt' -%}{%- continue -%}{%- endif -%}
  {%- if page.sitemap == false -%}{%- continue -%}{%- endif -%}
  {%- unless page.url contains '.html' or page.url == '/' -%}{%- continue -%}{%- endunless -%}
<url>
  <loc>{{ page.url | absolute_url }}</loc>
</url>
{%- endfor -%}
```

- [ ] **Step 2: Verify**

```bash
bundle exec jekyll build
grep -c "marblehead-corp" _site/sitemap.xml
```

Expected: `0` (the page is excluded). Compare with another newly-added page like `general-government-over-time` to confirm regular pages still appear:

```bash
grep -c "general_government_over_time\|fiscal-goals" _site/sitemap.xml
```

Expected: ≥1.

- [ ] **Step 3: Verify Pagefind exclusion**

Pagefind fragments are gzipped, so plain grep does not match content. Verify two ways:

1. Inspect the rendered HTML to confirm `data-pagefind-ignore` is on the wrapping `<div>`:

```bash
bundle exec jekyll build
grep -c 'data-pagefind-ignore' _site/marblehead-corp.html
```

Expected: at least `1`.

2. Run the full build (which produces the Pagefind index) and search for a phrase unique to the page using Pagefind's own CLI search:

```bash
npm run build
# Hit the running site and use the search UI. Or, inspect the index meta:
ls _site/pagefind/index/ | wc -l
```

Then in a browser at `http://localhost:4000`, open the cmd-K search modal and search for `Risk Factors` and `MARBLEHEAD CORP`. Expected: zero results from the new page.

If Pagefind does index the page despite the `data-pagefind-ignore` wrap, escalate by adding the attribute to the `<body>` itself. Edit `_layouts/default.html` to emit `data-pagefind-ignore` on the body when `page.pagefind_ignore` is true, and add `pagefind_ignore: true` to the page front matter. Only do this if the wrap in Task 1 was insufficient.

- [ ] **Step 4: Commit**

```bash
git add sitemap.xml
git commit -m "sitemap: honor 'sitemap: false' front-matter flag"
```

---

## Task 9: Smoke test addition + screenshot proof

**Files:**
- Modify: `tests/smoke-test.mjs`
- Create: `proof/<branch>.png`

- [ ] **Step 1: Add a smoke test for the new page**

Open `tests/smoke-test.mjs`. Add a new test function and call it from the main runner. Find a similar test in the file (a page that asserts headers render) and copy the pattern.

```javascript
async function testMarbleheadCorpLoads(page) {
  console.log('\n── Marblehead Corp ──');
  const response = await page.goto(`${SITE}/marblehead-corp.html`, { waitUntil: 'domcontentloaded' });
  if (!response.ok()) {
    fail('Marblehead Corp', `HTTP ${response.status()}`);
    return;
  }
  ok('Marblehead Corp returns 200');

  const cover = await page.$('.corp-cover .corp-name');
  cover ? ok('Cover renders MARBLEHEAD CORP') : fail('Marblehead Corp cover', '.corp-name missing');

  const riskFactors = await page.$$('.risk-factor');
  riskFactors.length === 10
    ? ok('Item 1A renders 10 risk factors')
    : fail('Marblehead Corp risk factors', `expected 10, got ${riskFactors.length}`);

  const notes = await page.$('.corp-notes ol li');
  notes ? ok('Notes section renders') : fail('Marblehead Corp notes', '.corp-notes ol li missing');
}
```

Wire it into the existing `main()` or runner block; follow whatever pattern the file uses to invoke other test functions. Do not skip this step — an unlinked page especially needs CI coverage so accidental layout breakage does not go unnoticed.

- [ ] **Step 2: Run the local smoke suite**

```bash
npm run test:local
```

Expected: previous pass count + 3 new asserts (cover, 10 risk factors, notes). All pass.

- [ ] **Step 3: Capture proof screenshots**

```bash
mkdir -p proof
BRANCH=$(git branch --show-current)
bundle exec jekyll serve --port 4000 --no-watch &
SERVER_PID=$!
sleep 3

npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/marblehead-corp.html" \
  "proof/${BRANCH}.png"

npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/marblehead-corp.html" \
  "proof/${BRANCH}-full.png"

kill $SERVER_PID
file proof/${BRANCH}.png
```

Expected: `file` reports image dimensions ~2880×1800 for the above-fold shot. The full-page shot will be taller.

- [ ] **Step 4: Commit smoke test and proof**

```bash
git add tests/smoke-test.mjs proof/*.png
git commit -m "marblehead-corp: smoke test + proof screenshots"
```

---

## Task 10: Push and open PR

**Files:**
- (Remote) GitHub PR

- [ ] **Step 1: Push the branch**

The repo's PAT is in `~/marblehead/.env` as `GITHUB_TOKEN` per project memory; use the inline HTTPS form on first push:

```bash
BRANCH=$(git branch --show-current)
GH_PAT=$(grep -E '^GITHUB_TOKEN=' ~/marblehead/.env | cut -d= -f2-)
git push "https://agbaber:${GH_PAT}@github.com/agbaber/marblehead.git" "${BRANCH}:${BRANCH}"
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Add Marblehead Corp annual-report parody page (unlinked)" --body "$(cat <<'EOF'
## Summary

- Adds `/marblehead-corp.html`, a deadpan parody of a corporate annual report that demonstrates why Massachusetts municipal law makes the "run it like a business" framing a non-literal claim. Steelmans the framing, then lets MGL citations do the work.
- The page is **unlinked** from the site nav, footer, homepage, and sibling pages, **excluded from `sitemap.xml`** (via a new `sitemap: false` front-matter flag honored by the sitemap template), and **excluded from the Pagefind search index** (via `data-pagefind-ignore` wrapping the article). Discovery is by direct URL only.
- Every figure on the page resolves to a primary source in the Notes section (FY24 ACFR, FY26 budget book, DOR DLS, MGL citations, etc.) — same rule as the rest of the site.
- Spec: `docs/superpowers/specs/2026-04-30-marblehead-corp-design.md`. Plan: `docs/superpowers/plans/2026-04-30-marblehead-corp-implementation.md`.

## Editorial guardrails

- No "vote yes / vote no" anywhere.
- No real person quoted as a proponent of the framing — the page punches at the framing, not at people.
- Reader can finish the page with either reaction (the framing is bad reasoning / those constraints are dumb) and the page accommodates both.

## Preview URL

Cloudflare Pages preview will appear in the sticky `preview-url` comment once the deploy completes (~5 min). Direct the preview at `/marblehead-corp.html`.

## Test plan

- [ ] Visit `/marblehead-corp.html` on the preview deploy.
- [ ] Cover block renders centered with "MARBLEHEAD CORP" / "FY 2025 Annual Report" / "Established 1649".
- [ ] Letter from Management opens with "We do not have a Chief Executive Officer."
- [ ] Item 1. Company at a Glance KPI strip renders with all cells populated and tabular numerals.
- [ ] Item 1. Business segments table renders with FY26 spend.
- [ ] Item 1A. Risk Factors renders 10 numbered risks (1A.1 through 1A.10), each citing at least one MGL section.
- [ ] Item 7. MD&A renders with link to FY24 ACFR.
- [ ] Item 11. Executive Compensation table renders.
- [ ] Notes to Financial Statements section renders 25 (or fewer if items dropped) numbered footnotes; every `<sup>` on the page resolves to a Note.
- [ ] Forward-Looking Statements renders italic at the bottom.
- [ ] `sitemap.xml` does **not** contain `marblehead-corp.html`.
- [ ] cmd-K site search does **not** surface the page.
- [ ] Page is not linked from the homepage, footer, or any sibling page.
- [ ] Mobile (≤600px): KPI strip collapses to 2 columns, body text not justified, page reads cleanly.
- [ ] Dark mode renders without color failures (palette tokens carry through).

## Proof of Work

Above-fold screenshot:
![marblehead-corp](proof/<BRANCH>.png)

Full-page screenshot: `proof/<BRANCH>-full.png` (committed to branch).

## Files changed

- `marblehead-corp.html` (new)
- `assets/site.css` (scoped block for `body.corp-page`)
- `sitemap.xml` (honor `sitemap: false`)
- `tests/smoke-test.mjs` (load + asserts)
- `proof/<BRANCH>.png`, `proof/<BRANCH>-full.png` (proof)
- `docs/superpowers/specs/2026-04-30-marblehead-corp-design.md` (spec, already committed)
- `docs/superpowers/plans/2026-04-30-marblehead-corp-implementation.md` (plan, already committed)
- `docs/superpowers/notes/marblehead-corp-source-lookups.md` (working source notes, already committed)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `<BRANCH>` in the body with the actual branch name returned by `git branch --show-current` before running, or use `gh pr edit` after creation to fix the substitution.

- [ ] **Step 3: After preview URL appears, edit the PR body to insert the preview URL**

Once the `preview-url` sticky comment appears on the PR (post-deploy), fetch its Branch URL and add it to the PR body using `gh pr edit <num> --body-file <(cat updated-body.md)`.

---

## Self-review checklist (run by the implementer at the end)

- [ ] No `[VALUE]`, `[SOURCE]`, `[NAME]`, or other bracketed placeholders anywhere in `marblehead-corp.html`.
- [ ] Every `<sup class="fn">N</sup>` on the page has a matching `<li id="fn-N">` in the Notes section, and vice versa.
- [ ] Page does not contain the word "shocking," "absurd," "ridiculous," "outrageous," or similar editorializing in narrator voice.
- [ ] No em-dashes anywhere in the page body (em-dashes in the spec/plan are fine, but page copy must use commas, periods, or parentheticals instead).
- [ ] No vote-related CTA. No "yes / no on Q2 / on the override."
- [ ] No mention of any actual resident, FB commenter, or named person except: current Town Administrator (factual), comparables CEO names (factual, public), and "Marblehead" as the place.
- [ ] Page is **not** linked from `index.html`, `_includes/nav.html`, `_includes/footer.html`, `the-debate.html`, `info-guides.html`, or any other page. Confirm with `grep -l "marblehead-corp" *.html _includes/*.html _layouts/*.html`.
- [ ] `sitemap.xml` post-build does not contain the page (Task 8 Step 2).
- [ ] Pagefind index post-build does not contain the page content (Task 8 Step 3).
- [ ] Smoke test passes locally and includes the new page.
- [ ] Proof screenshot exists at `proof/<branch>.png` and is ~2880×1800.
