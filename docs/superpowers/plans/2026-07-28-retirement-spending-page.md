# Retirement Spending Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `retirement.html`, a plain-language explainer of Marblehead's pension and OPEB (retiree health) spending, with a Massachusetts peer comparison sourced to PERAC and DLS.

**Architecture:** A static Jekyll page (`layout: page` default) following the existing content-page pattern (frontmatter + page-scoped `<style>` + hand-authored SVG charts + `citations`/`deep-dive` scripts). Two new peer CSV datasets feed the comparison charts. No JS framework; charts are inline SVG using STYLE_GUIDE chart classes. "Tests" for this project are the Playwright smoke suite (`npm run test:local`, 0-fail invariant), the `lint.yml` content guardrails, and a committed Playwright proof screenshot.

**Tech Stack:** Jekyll 3.10, hand-authored inline SVG, `assets/citations.js` (`<sup class="cite">` markers), `deep-dive` expander script, Playwright (Chromium) for smoke + proof.

**Spec:** `docs/superpowers/specs/2026-07-28-retirement-spending-page-design.md`

---

## File Structure

- **Create:** `retirement.html` — the page (frontmatter, scoped style, 3 spine sections + comparison + notes).
- **Create:** `data/perac_funded_ratios_peers.csv` — pension funded ratios, Marblehead + peers + statewide.
- **Create:** `data/dls_opeb_funded_ratios_peers.csv` — OPEB funded ratios, Marblehead + peers + statewide.
- **Modify:** `data/SOURCE_LOOKUP.md` — add provenance for the two new CSVs.
- **Modify:** `_data/marblehead_101.yml` and/or the topics data + a cross-link in `where-has-the-money-gone.html` / `what-is-actually-flexible.html` — discoverability.
- **Create:** `proof/retirement-spending-page.png` (+ `-full.png`) — proof of work.

Peer set (match existing pages): Arlington, Brookline, Cohasset, Duxbury, Easton, Framingham, Hingham, Lexington, Marblehead, Melrose.

---

## Task 1: Confirm the on-page primary numbers at write time

No page copy is authored from memory. Pull every headline number into context first (per `feedback_citation_discipline`).

**Files:** none (research task; findings go into task commits' copy).

- [ ] **Step 1: Re-read the pension appropriation source**

Run: `grep -n "5,380,625\|Contributory Retirement" data/SOURCE_LOOKUP.md` and open the FY27 Proposed Budget p.4 line 217 in `data/`.
Expected: confirm FY26 appropriation **$5,380,625** (general fund), plus water/sewer enterprise pieces from the checkbook (`grep "FY26 Pension Appropriation" data/checkbook_FY26_2026-06-17.csv`).

- [ ] **Step 2: Re-read the liability + funded-ratio sources**

Read FY25 ACFR p.31 and pp.86–94 (RSI). Confirm: Net Pension Liability **$40.1M**; Net OPEB Liability **$142.0M**, funded ratio **3.37%**; MMLD OPEB plan separate ($3.34M net, 45.5% funded).
Expected: values match `data/SOURCE_LOOKUP.md` lines 92–103.

- [ ] **Step 3: Confirm the payoff schedule**

Open PERAC Marblehead Valuation Report 2024 (`data/SOURCE_LOOKUP.md` line 114). Confirm the appropriation growth rate and the **FY2036** final-payment year. Record the exact per-year rate the report states (spec says ~8.6%/yr through FY2035 — verify verbatim).
Expected: a citable sentence with page number for the sustainability section.

- [ ] **Step 4: Confirm the GASB-68 "expense" figure for the trap expander**

Read `data/pension_expenditure_FY01-24.csv` and `data/SOURCE_LOOKUP.md` line 61–64 (FY25 "Pension benefits" row = $11,402,956).
Expected: the ~$11M expense figure and its ACFR page, to contrast against the ~$5.4M appropriation.

- [ ] **Step 5: Record findings**

Write the confirmed numbers + citations into a scratch note in the worktree (`docs/superpowers/plans/retirement-numbers-scratch.md`, git-ignored or deleted before final commit). No page code yet.

---

## Task 2: Pull PERAC pension funded ratios (peer comparison dataset)

**Files:**
- Create: `data/perac_funded_ratios_peers.csv`
- Modify: `data/SOURCE_LOOKUP.md`

- [ ] **Step 1: Identify each peer's retirement system**

Peers belong to different systems (some are in county/regional systems, some standalone). For each of the 10 peers, determine the PERAC system that covers it. Source: PERAC's list of retirement systems + each system's valuation report.
Expected: a system name per peer (e.g. Marblehead = Marblehead Contributory Retirement System; some peers = Essex Regional, Middlesex, Norfolk County, etc.).

- [ ] **Step 2: Fetch the funded ratio per system + statewide**

For each system pull the most recent PERAC actuarial valuation funded ratio (assets / actuarial accrued liability), plus the PERAC statewide aggregate funded ratio. Use the same valuation vintage where possible; record the vintage per row.
Expected: a funded-ratio percentage and a valuation year per system.

- [ ] **Step 3: Write the CSV**

Schema:
```
municipality,retirement_system,valuation_year,funded_ratio_pct,source_url,source_page
Marblehead,Marblehead Contributory Retirement System,2024,<pct>,<perac url>,<page>
...
STATEWIDE,PERAC aggregate,<yr>,<pct>,<url>,<page>
```
Every row carries its own source. No row without a primary citation.

- [ ] **Step 4: Add SOURCE_LOOKUP entry**

Append a `## PERAC Pension Funded Ratios (peer comparison)` section to `data/SOURCE_LOOKUP.md` describing the file, the PERAC source, and the valuation-vintage caveat (systems are valued in different years; note it).

- [ ] **Step 5: Commit**

```bash
git add data/perac_funded_ratios_peers.csv data/SOURCE_LOOKUP.md
git commit -m "Add PERAC pension funded ratios for peer comparison"
```

**If the pull is blocked** (a system's report isn't reachable from this box): do NOT fabricate a value. Record the gap in the CSV with an empty `funded_ratio_pct` and a `source_url` note, flag it to the user in chat (per `feedback_retrieval_gaps_in_chat_not_on_page`), and let the comparison chart drop that peer rather than guess.

---

## Task 3: Pull DLS OPEB funded ratios (peer comparison dataset)

**Files:**
- Create: `data/dls_opeb_funded_ratios_peers.csv`
- Modify: `data/SOURCE_LOOKUP.md`

- [ ] **Step 1: Locate the DLS OPEB dataset**

Source: MA DLS "Other Post-Employment Benefits" data (DLS Databank / Municipal Databank). Find the per-municipality OPEB total liability, net position, and funded ratio.
Expected: a downloadable table or query covering the 10 peers + a statewide distribution.

- [ ] **Step 2: Extract peer rows + statewide context**

Pull each peer's OPEB funded ratio and the statewide distribution (median / share of towns under ~10% funded) for the "everyone deferred" calibration.
Expected: funded-ratio percentage per peer + a statewide summary stat.

- [ ] **Step 3: Write the CSV**

Schema:
```
municipality,fiscal_year,opeb_total_liability,opeb_net_position,funded_ratio_pct,source_url
Marblehead,2025,146998774,4954123,3.37,<acfr/dls url>
...
STATEWIDE_MEDIAN,<yr>,,,<pct>,<dls url>
```
Marblehead's own row uses the ACFR figures already confirmed in Task 1 (cross-check DLS matches; note any discrepancy in SOURCE_LOOKUP rather than silently picking one).

- [ ] **Step 4: Add SOURCE_LOOKUP entry**

Append `## DLS OPEB Funded Ratios (peer comparison)` describing the DLS source and the Marblehead ACFR cross-check.

- [ ] **Step 5: Commit**

```bash
git add data/dls_opeb_funded_ratios_peers.csv data/SOURCE_LOOKUP.md
git commit -m "Add DLS OPEB funded ratios for peer comparison"
```

Same no-fabrication / flag-the-gap rule as Task 2.

---

## Task 4: Page skeleton + opening

**Files:**
- Create: `retirement.html`

- [ ] **Step 1: Write frontmatter + scoped style shell + opening**

```html
---
title: "What Marblehead spends on retirement"
scripts: [citations, deep-dive]
og_title: "What Marblehead spends on retirement: one promise on track, one deferred"
og_description: "The town makes two retirement promises to employees: a pension, and help with health insurance after they retire. The pension is on a fixed schedule to be fully funded by 2036. Retiree health is a 142 million dollar promise that is 3 percent funded. Plain-language breakdown, with a Massachusetts peer comparison."
og_url: https://marbleheaddata.org/retirement.html
---
<style>
/* page-scoped styles — reuse .tldr / .deep-dive patterns from library.html */
</style>

<p class="page-lead">The town makes two retirement promises to the people who work for it. One is a pension. The other is help paying for health insurance after they retire. One of those promises is on track. The other is not. Here is the difference, in plain terms.</p>
```
No em-dashes. No meta-narration ("this page explains").

- [ ] **Step 2: Build locally**

Run: `bundle exec jekyll build` (from worktree root, after `bundle install` if needed).
Expected: build succeeds, `_site/retirement.html` exists.

- [ ] **Step 3: Commit**

```bash
git add retirement.html
git commit -m "Add retirement page skeleton and opening"
```

---

## Task 5: Section 1 — How did we get here (+ divergence chart)

**Files:**
- Modify: `retirement.html`

- [ ] **Step 1: Write the plain narrative**

Prose: the town runs its own pension system; every year it pays into a pension fund and that payment has grown; OPEB is the mirror image (never pre-funded, so a large promise accumulated off-budget). Cite the FY26 appropriation ($5,380,625) with a `<sup class="cite" data-href=... data-source=...>` marker.

- [ ] **Step 2: Build the divergence SVG chart**

Inline `<svg class="chart">` with two `.data-line`s on one axis: pension funded position vs OPEB funded position (or funded ratio over time from the ACFR RSI schedules). Use `.s-marblehead` / a second series class, `.axis-base`, `.tick-label`, `.end-label`. NO inline `style=""` on SVG elements (STYLE_GUIDE). Include an `aria-label` describing the trend.

- [ ] **Step 3: Add the two expanders**

```html
<details class="deep-dive">
  <summary><span class="deep-dive-title">Why the pension bill jumped after 2008</span>
  <p class="deep-dive-teaser">Market losses in 2008 left the fund short, and state rules put it on a catch-up payment schedule.</p></summary>
  <div class="deep-dive-body"> ... </div>
</details>
```
Second expander: "Wait, teachers aren't in this?" — teacher pensions state-paid via MTRS, $0 to town general fund, but funded from taxes residents also pay (don't imply teachers are free).

- [ ] **Step 4: Build + eyeball**

Run: `bundle exec jekyll build`. Expected: success, chart renders (spot-check `_site/retirement.html`).

- [ ] **Step 5: Commit**

```bash
git add retirement.html
git commit -m "Add retirement page section 1: how we got here + divergence chart"
```

---

## Task 6: Section 2 — Is it sustainable? (+ the "huge number trap" expander)

**Files:**
- Modify: `retirement.html`

- [ ] **Step 1: Write the plain answer**

Pension ≈ 5 cents of every general-fund dollar; on a fixed schedule to be fully funded in **2036** (cite PERAC 2024 valuation page from Task 1). "That part is fine." Then: the real problem is retiree health — a **$142M** promise, **3.4% funded**, with **$0** put toward catch-up in the FY27 budget (cite ACFR + FY27 budget).

- [ ] **Step 2: Add the "huge number trap" expander**

Show the ~$11M GASB-68 ACFR "Pension benefits" expense row next to the ~$5.4M actually appropriated; explain the expense figure swings with market returns and is not cash out the door. Surface the GASB-volatility caveat right here (STYLE_GUIDE volatile-data rule). This is the ONLY place the $11M figure appears, and never as "spending."

- [ ] **Step 3: Add "what unfunded actually means" expander**

Plain: unfunded = the town has promised the benefit but not set aside the money, so future budgets pay it from that year's taxes.

- [ ] **Step 4: Build + commit**

```bash
bundle exec jekyll build
git add retirement.html
git commit -m "Add retirement page section 2: sustainability + huge-number-trap expander"
```

---

## Task 7: Section 3 — Can we change it? Should we?

**Files:**
- Modify: `retirement.html`

- [ ] **Step 1: Write the plain choice**

Pension benefit levels are locked by state Chapter 32 + collective bargaining; the town cannot cut them. The one real local lever: pre-fund OPEB now vs pay as the bills come and leave a bigger tab. Present both sides, no recommendation, neutral semantic colors, no green/red (STYLE_GUIDE + editorial stance).

- [ ] **Step 2: Add two expanders**

"What other towns do about OPEB" (trust funds, partial pre-funding) and "Who decides this" (retirement board, PERAC, Town Meeting).

- [ ] **Step 3: Build + commit**

```bash
bundle exec jekyll build
git add retirement.html
git commit -m "Add retirement page section 3: can and should we change it"
```

---

## Task 8: Comparison section (Marblehead vs Massachusetts peers)

**Files:**
- Modify: `retirement.html`
- Depends on: Task 2 + Task 3 CSVs.

- [ ] **Step 1: Pension funded-ratio comparison chart**

Bar chart (SVG, chart classes) of funded ratio per peer + statewide, from `data/perac_funded_ratios_peers.csv`. Bars sorted ascending (per `feedback_chart_direction`). Marblehead highlighted with `.s-marblehead`. Note the valuation-vintage caveat in the caption (systems valued in different years). Neutral framing: MA law forces every system toward full funding by ~2036–2040; Marblehead is normal-to-healthy.

- [ ] **Step 2: OPEB funded-ratio comparison chart**

Bar chart from `data/dls_opeb_funded_ratios_peers.csv`, sorted ascending. Caption calibrates honestly: most MA towns are near-zero funded; Marblehead's 3.4% is typical, not an outlier. Do not spin "everyone does it" as "it's fine."

- [ ] **Step 3: One-line MMLD mention + no-state-comparison note**

Brief: the light department's separate OPEB plan is small and ~45% funded. State the deliberate omission of state-vs-state (Chapter 32 is MA-specific) so a reader does not expect it.

- [ ] **Step 4: If any peer data is missing (from Task 2/3 gaps)**

Drop that peer from the chart and add a caption note naming who was dropped and why (`log`-style honesty; no silent truncation).

- [ ] **Step 5: Build + commit**

```bash
bundle exec jekyll build
git add retirement.html
git commit -m "Add retirement page comparison section: PERAC + DLS peer charts"
```

---

## Task 9: Sources footer + discoverability

**Files:**
- Modify: `retirement.html`, `_data/marblehead_101.yml` (and/or topics data), one cross-link in `where-has-the-money-gone.html`.

- [ ] **Step 1: Add the notes/sources expander**

```html
<details class="notes"><summary>Notes and sources</summary> ... </details>
```
List each dataset with its primary citation. Remember `citations.js` injects its own `<h2>Sources</h2>` at runtime from the `<sup class="cite">` markers (`project_citations_h2_injection`) — do not hand-add a duplicate Sources h2.

- [ ] **Step 2: Cross-link**

Add a `read-next` / inline link from `where-has-the-money-gone.html` (its pensions paragraph) to `retirement.html`, and register the page in the topics/`marblehead_101` data so it is discoverable. Follow the exact `href` pattern already used (no Liquid in new hrefs — `lint.yml` guardrail).

- [ ] **Step 3: Build + commit**

```bash
bundle exec jekyll build
git add retirement.html _data/marblehead_101.yml where-has-the-money-gone.html
git commit -m "Add retirement page sources footer and cross-links"
```

---

## Task 10: Verify — smoke, lint, proof

**Files:**
- Create: `proof/retirement-spending-page.png`, `proof/retirement-spending-page-full.png`

- [ ] **Step 1: Run the smoke suite**

Run: `npm run test:local`
Expected: builds, serves, Playwright smoke passes with **0 fail** (pass count grows vs the documented 118 as pages are added; 0 fail is the invariant).

- [ ] **Step 2: Run the content lint guardrails locally**

Check the page against `lint.yml` rules: no `marbleheadma.gov/wp-content` URLs, per-line acronym wraps (OPEB/PERAC/MTRS/ACFR wrapped with `<abbr class="g" title=...>` on first use), no Liquid in new hrefs, no em-dashes.
Expected: clean.

- [ ] **Step 3: Capture proof screenshots**

```bash
mkdir -p proof
bundle exec jekyll serve --port 4000 &   # or npm run dev
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 "http://localhost:4000/retirement.html" "proof/retirement-spending-page.png"
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 --full-page "http://localhost:4000/retirement.html" "proof/retirement-spending-page-full.png"
file proof/retirement-spending-page.png   # expect ~2880 px wide
```

- [ ] **Step 4: Commit proof**

```bash
git add proof/retirement-spending-page.png proof/retirement-spending-page-full.png
git commit -m "Add proof screenshots for retirement page"
```

---

## Task 11: Push + PR

- [ ] **Step 1: Push**

```bash
git push -u origin retirement-spending-page
```

- [ ] **Step 2: Open the PR** (per repo rule: always open a PR after pushing)

Use `mcp__github__create_pull_request`. Body must include the Cloudflare preview URL (from the sticky `preview-url` comment once green), specific paths to visit (`/retirement.html`), expected behavior, edge cases, and a Proof of Work section referencing `proof/retirement-spending-page.png`.

- [ ] **Step 3: Post the preview URL back to the user** for live review (pull `**Branch URL:**` from the `### Preview` sticky comment).

---

## Self-Review (completed by plan author)

**Spec coverage:** Opening ✓ (T4); Section 1 + divergence chart + 2 expanders ✓ (T5); Section 2 + huge-number-trap + unfunded expander ✓ (T6); Section 3 + 2 expanders ✓ (T7); comparison (PERAC + DLS, no state comparison, MMLD line) ✓ (T8, data in T2/T3); sources footer + citations h2 caveat ✓ (T9); data-integrity rules (two pension numbers, GASB caveat, cite-at-write-time, teacher $0 framing) ✓ (T1, T5, T6); plain voice + expanders ✓ (throughout); neutrality ✓ (T7, T8); discoverability ✓ (T9); build/lint/proof gates ✓ (T10); PR ✓ (T11).

**Placeholder scan:** The comparison CSV *values* are intentionally not hard-coded — they don't exist until the T2/T3 pulls run, and the plan specifies method + schema + no-fabrication rule instead of fake numbers. Every code/copy step otherwise shows concrete content. The PERAC per-year rate and exact payoff wording are deferred to T1 verification against the source (citation discipline), not invented here.

**Type/name consistency:** CSV filenames (`perac_funded_ratios_peers.csv`, `dls_opeb_funded_ratios_peers.csv`) referenced identically in T2/T3 (create) and T8 (consume). Page filename `retirement.html` consistent T4–T11. Expander class `deep-dive` and notes class `notes` match library.html. Series class `.s-marblehead` matches STYLE_GUIDE.
