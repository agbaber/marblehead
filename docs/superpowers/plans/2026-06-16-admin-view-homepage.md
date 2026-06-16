# Admin-view Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `index.html` as an admin-view dashboard of Marblehead's finances, with data as the spine and "why?" links to existing explainer pages.

**Architecture:** Five vertical zones in a single Jekyll page. Two new YAML data files (`_data/dashboard.yml`, `_data/in_play.yml`) hold all content. Layout uses the existing `.home-stop` section pattern and palette tokens; bars are inline SVG sized proportionally. The current Playwright smoke test (`tests/smoke-test.mjs`) is the regression gate: each zone task updates the test first, watches it fail, implements, watches it pass.

**Tech Stack:** Jekyll 3.10, kramdown-gfm, vanilla CSS with palette tokens in `assets/site.css`, Playwright (Chromium) for smoke tests, no JS framework.

**Spec:** `docs/superpowers/specs/2026-06-16-admin-view-homepage-design.md`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `_data/dashboard.yml` | Create | Top-fold KPIs + spending and revenue rollups with citations |
| `_data/in_play.yml` | Create | 3-5 curated open questions of town government |
| `index.html` | Rewrite | Five-zone dashboard layout, drawing from data files |
| `tests/smoke-test.mjs` | Modify | Update `testHomepageLoads` to assert the new selectors |
| `proof/wise-mountain.png` | Create | Above-fold Playwright screenshot per Hetzner CLAUDE.md |
| `proof/wise-mountain-full.png` | Create | Full-page Playwright screenshot |

Inline `<style>` block in `index.html` is the home for zone-specific CSS. If it grows past ~200 lines, lift to `assets/site.css` under a `body.home-dashboard ...` scope. Implementation's call.

---

## Task 1: Create `_data/dashboard.yml` with verified FY26 numbers

**Files:**
- Create: `_data/dashboard.yml`
- Read: `data/FY26_budget_summary.json` (primary source, town + school FY26 budget rollup)
- Read: `data/budget_FY26_by_fund.json` (cross-check; this is where the $127.3M figure should reconcile against)
- Read: `data/checkbook_FY26_summary.json` (spent-so-far snapshot)
- Read: `data/cherry_sheet_FY26.csv` (state aid for revenue zone)
- Read: most recent ACFR in `data/town_docs/` for reserves

- [ ] **Step 1.1: Read primary sources and build the rollup**

```bash
# Inspect the FY26 budget summary
python3 -c "import json; print(json.dumps(json.load(open('data/FY26_budget_summary.json')), indent=2))" | head -80

# Inspect the by-fund breakdown to find the operating-budget figure
python3 -c "import json; d=json.load(open('data/budget_FY26_by_fund.json')); print(json.dumps(d, indent=2)[:2000])"

# Inspect checkbook summary for "spent so far" + as-of date
python3 -c "import json; print(json.dumps(json.load(open('data/checkbook_FY26_summary.json')), indent=2))" | head -40

# Find the FY24 ACFR (most recent) for reserves
ls data/town_docs/ | grep -iE "acfr|cafr|annual" | head -5
```

Expected: `FY26_budget_summary.json` has `Town_Grand_Total $57.1M`, `School_Grand_Total $49.1M`, `Combined_Total $106.2M`. Compare to the existing `index.html` claim of $127.3M operating budget — the difference is likely enterprise funds (water/sewer/trash). Verify which figure to lead with by reading `budget_FY26_by_fund.json`; pick whichever is the operating-budget definition the rest of the site already uses (grep `index.html` and `checkbook.html` for the canonical number).

- [ ] **Step 1.2: Decide the six spending buckets**

The dashboard wants six top-level spending categories. Suggested rollup from `FY26_budget_summary.json`:

| Bucket | Components | Approx amount |
|---|---|---|
| Schools | `School_Grand_Total` | $49.1M |
| Health & insurance | `Health_Insurance_Transfer` + `Medex_Insurance_Transfer` + `Medicare_Reimbursement` + `Insurance_Premiums` | ~$15.9M |
| Public safety | `Fire` + `Police` + `Inspections` | ~$11.2M |
| Debt service | `Debt_Service` | $9.3M |
| Pensions | `Pension_Contribution` + `OPEB_Trust_Transfer` | ~$5.6M |
| Everything else | Town total minus the above | ~$15M |

If the implementer prefers different boundaries (e.g. break Pensions out from OPEB, or surface Public Works), document the choice as a comment at the top of `dashboard.yml`.

- [ ] **Step 1.3: Decide the four revenue buckets**

| Bucket | Source | Notes |
|---|---|---|
| Property taxes | FY26 budget revenue side / FY26 levy | Largest source; "override impact" why-link |
| State aid | `cherry_sheet_FY26.csv` totals | "what's Ch.70?" why-link |
| Local receipts | FY26 budget revenue side | Excise, fees, etc.; no why-link |
| Free cash + transfers | DLS Free Cash certification | "what is it?" why-link |

- [ ] **Step 1.4: Write the YAML**

```yaml
# _data/dashboard.yml
#
# Top-fold KPIs and spending/revenue rollups for the homepage dashboard.
# Every numeric value carries a `cite` pointing to the primary source.
# Buckets are rolled up from the line-item budget; see `notes` for the
# rollup mapping when a bucket combines multiple line items.

fiscal_year: FY26
as_of_date: "YYYY-MM-DD"          # <-- pull from checkbook_FY26_summary.json

operating_budget_millions: XXX.X  # <-- the canonical figure used elsewhere on site
operating_budget_cite: "FY26 budget, ..."

spent_so_far_millions: XX.X
spent_so_far_cite: "Open Finance vendor payments, as of <date>"

reserves_millions: X.X
reserves_cite: "FY24 ACFR p.XX, Unassigned Fund Balance"

spending:
  - label: Schools
    amount_millions: 49.1
    cite: "FY26 Budget Summary, School_Grand_Total"
    why_link: /topics/school-budget/
    why_text: why so much?
  - label: Health & insurance
    amount_millions: 15.9
    cite: "FY26 Budget Summary, Health_Insurance + Medex + Medicare + Insurance_Premiums"
    why_link: /topics/health-insurance/
    why_text: why up 12%?
    notes: "Rolls up four line items; see FY26 budget for breakdown."
  - label: Public safety
    amount_millions: 11.2
    cite: "FY26 Budget Summary, Fire + Police + Inspections"
    why_link: null
    notes: "No dedicated explainer; consider linking to /topics/labor-personnel/ or /meetings/?topic=public-safety in phase 2."
  - label: Debt service
    amount_millions: 9.3
    cite: "FY26 Budget Summary, Debt_Service"
    why_link: /town-debt.html
    why_text: which projects?
  - label: Pensions & OPEB
    amount_millions: 5.6
    cite: "FY26 Budget Summary, Pension_Contribution + OPEB_Trust_Transfer"
    why_link: null
  - label: Everything else
    amount_millions: 15.0
    cite: "FY26 Budget Summary, town total minus above"
    why_link: /checkbook/
    why_text: drill in

revenue:
  - label: Property taxes
    amount_millions: XX.X
    cite: "FY26 budget, Property tax levy"
    why_link: /2026-override/
    why_text: override impact
  - label: State aid
    amount_millions: XX.X
    cite: "Cherry Sheet FY26"
    why_link: null
  - label: Local receipts
    amount_millions: XX.X
    cite: "FY26 budget, Local receipts schedule"
    why_link: null
  - label: Free cash & transfers
    amount_millions: X.X
    cite: "DLS Free Cash certification, <date>"
    why_link: null
```

- [ ] **Step 1.5: Validate the YAML by building the site**

Run: `bundle exec jekyll build 2>&1 | tail -20`

Expected: build completes with no YAML parse errors. No new pages generated yet (data files alone don't create routes), but Jekyll picks up `_data/dashboard.yml` and exposes it as `site.data.dashboard`.

- [ ] **Step 1.6: Commit**

```bash
git add _data/dashboard.yml
git commit -m "$(cat <<'EOF'
Add _data/dashboard.yml with FY26 KPI and rollup data

Six spending buckets and four revenue buckets, each with a primary-source
cite. Rollups documented inline. Numbers pulled from FY26_budget_summary.json,
budget_FY26_by_fund.json, checkbook_FY26_summary.json, cherry_sheet_FY26.csv,
and FY24 ACFR (reserves).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 2: Create `_data/in_play.yml` with curated open questions

**Files:**
- Create: `_data/in_play.yml`

- [ ] **Step 2.1: Verify the three candidate link targets exist**

```bash
# Expected: each path is a real page or directory with an index.html
ls -d 2026-override/ 2>&1
test -f 2026-override/index.html && echo "OK: 2026-override" || echo "MISSING"
ls topics/40b-mbta.html 2>&1
ls topics/school-budget.html 2>&1
# Plus any others the implementer wants to surface
```

Expected: each path resolves to a real Jekyll source file or directory with an index.

- [ ] **Step 2.2: Write the YAML**

```yaml
# _data/in_play.yml
#
# 3-5 editorially curated open questions. Every entry must link to an
# explainer page that exists on the site. Update when an item moves
# (decided, dropped, scope changes).

- title: FY27 budget
  summary: "Being built. The $15M Tier 1 override passed June 9, covering the FY27 deficit. FY27 budget adoption pending Town Meeting."
  link: /2026-override/
  link_text: see the override outcome
  updated: "2026-06-16"

- title: MBTA Article 4
  summary: "Marblehead's 3A compliance package went to Town Meeting May 4."
  link: /topics/40b-mbta/
  link_text: what happened
  updated: "2026-05-05"

- title: School budget process
  summary: "FY27 school budget cuts and the 18.25 FTE reduction; School Committee discussions continuing."
  link: /topics/school-budget/
  link_text: latest School Committee discussion
  updated: "2026-06-10"
```

The implementer should sanity-check these summaries against current state before publishing. If any is stale, replace with a different live question rather than ship inaccurate copy.

- [ ] **Step 2.3: Validate YAML by building**

Run: `bundle exec jekyll build 2>&1 | tail -10`

Expected: no parse errors.

- [ ] **Step 2.4: Commit**

```bash
git add _data/in_play.yml
git commit -m "$(cat <<'EOF'
Add _data/in_play.yml with three curated open questions

FY27 budget, MBTA Article 4, school budget process. Each item links
to an explainer page that exists. Updated dates recorded.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 3: Implement Zone 1 (Top fold) with TDD

**Files:**
- Modify: `tests/smoke-test.mjs` — `testHomepageLoads` function
- Modify: `index.html` — replace the existing `.home-hero` section

- [ ] **Step 3.1: Update the smoke test to assert the new top-fold structure**

Edit `tests/smoke-test.mjs`. Replace the body of `testHomepageLoads` with:

```javascript
async function testHomepageLoads(page) {
  console.log('\n── Homepage ──');
  const hero = await page.$('.home-hero');
  hero ? ok('Homepage renders .home-hero') : fail('Homepage', '.home-hero missing');

  // Zone 1: top fold has 3 KPIs
  const kpis = await page.$$('.dashboard-kpi');
  kpis.length === 3
    ? ok(`Top fold shows 3 KPIs`)
    : fail('Top fold KPIs', `expected 3 .dashboard-kpi, got ${kpis.length}`);

  // KPI labels are present and non-empty
  for (const kpi of kpis) {
    const label = await kpi.$('.dashboard-kpi-label');
    const value = await kpi.$('.dashboard-kpi-value');
    if (label && value) {
      const labelText = (await label.textContent()).trim();
      const valueText = (await value.textContent()).trim();
      labelText.length > 0 && valueText.length > 0
        ? ok(`KPI rendered: ${labelText} = ${valueText}`)
        : fail('KPI text', 'label or value empty');
    } else {
      fail('KPI structure', '.dashboard-kpi-label or .dashboard-kpi-value missing');
    }
  }

  const deeper = await page.$('.home-deeper');
  deeper ? ok('Homepage has Checkbook CTA') : fail('Homepage CTA', '.home-deeper missing');
}
```

- [ ] **Step 3.2: Run the smoke test against a local Jekyll build to see Zone 1 assertions fail**

```bash
# In one terminal: bundle exec jekyll serve --port 4000 --no-watch &
# In another: run the smoke test pointed at localhost
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | head -30
```

Expected: `Top fold KPIs` fails with `expected 3 .dashboard-kpi, got 0` (since the homepage still has the old single-big-number hero). This confirms the new selectors aren't present yet.

- [ ] **Step 3.3: Rewrite Zone 1 in `index.html`**

Replace the current `<section class="home-hero">` block with:

```html
<section class="home-hero">
  <p class="home-eye">
    Town of Marblehead
    <span class="dot">·</span>
    {{ site.data.dashboard.fiscal_year }} in progress
    <span class="dot">·</span>
    as of {{ site.data.dashboard.as_of_date | date: "%B %-d" }}
  </p>

  <div class="dashboard-kpis">
    <div class="dashboard-kpi">
      <p class="dashboard-kpi-value">${{ site.data.dashboard.operating_budget_millions }}M</p>
      <p class="dashboard-kpi-label">operating budget</p>
    </div>
    <div class="dashboard-kpi">
      <p class="dashboard-kpi-value">
        ${{ site.data.dashboard.spent_so_far_millions }}M
        <span class="dashboard-kpi-pct">
          ({{ site.data.dashboard.spent_so_far_millions | times: 100 | divided_by: site.data.dashboard.operating_budget_millions }}%)
        </span>
      </p>
      <p class="dashboard-kpi-label">spent so far</p>
    </div>
    <div class="dashboard-kpi">
      <p class="dashboard-kpi-value">${{ site.data.dashboard.reserves_millions }}M</p>
      <p class="dashboard-kpi-label">reserves</p>
    </div>
  </div>

  <a class="home-deeper" href="/checkbook/">Open the Checkbook</a>
</section>
```

Add corresponding CSS inside the existing `<style>` block at the top of `index.html`:

```css
.dashboard-kpis {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin: 0 0 32px;
}
@media (min-width: 600px) {
  .dashboard-kpis { grid-template-columns: repeat(3, 1fr); }
}

.dashboard-kpi {
  display: flex;
  flex-direction: column;
}
.dashboard-kpi-value {
  font-size: clamp(40px, 7vw, 64px);
  line-height: 1.0;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0 0 6px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.dashboard-kpi-pct {
  font-size: 0.55em;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0;
}
.dashboard-kpi-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: lowercase;
  letter-spacing: 0.3px;
  margin: 0;
}
```

Remove the now-unused `.home-big` and `.home-cap` CSS rules and the `<p class="home-big">`/`<p class="home-cap">` markup (they're replaced by `.dashboard-kpi-value` / `.dashboard-kpi-label`).

- [ ] **Step 3.4: Rebuild Jekyll and re-run the smoke test**

```bash
# Stop the old Jekyll server, rebuild
bundle exec jekyll build 2>&1 | tail -5
bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(Homepage|KPI|FAIL)" | head -20
```

Expected: all Zone 1 assertions pass. Three KPIs are visible, each with a non-empty label and value.

- [ ] **Step 3.5: Capture above-fold screenshot**

```bash
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000" \
  "proof/wise-mountain-zone-1.png"
file proof/wise-mountain-zone-1.png   # expect ~2880 px wide
```

Verify visually that the three KPIs render correctly.

- [ ] **Step 3.6: Commit**

```bash
git add index.html tests/smoke-test.mjs proof/wise-mountain-zone-1.png
git commit -m "$(cat <<'EOF'
Rewrite homepage Zone 1 as three-KPI top fold

Replaces the single big-number hero with a three-card KPI strip
(operating budget, spent so far, reserves) pulling from
_data/dashboard.yml. Eyebrow line carries the orientation copy.
Smoke test updated to assert .dashboard-kpi selectors.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 4: Implement Zone 2 (Where it's going) with TDD

**Files:**
- Modify: `tests/smoke-test.mjs` — add `testDashboardSpending` function called from main
- Modify: `index.html` — add new section after `.home-hero`

- [ ] **Step 4.1: Add spending-zone assertions to the smoke test**

Add a new function in `tests/smoke-test.mjs`:

```javascript
async function testDashboardSpending(page) {
  console.log('\n── Dashboard: Where it\'s going ──');
  const section = await page.$('.dashboard-spending');
  section ? ok('Spending section present') : fail('Spending section', '.dashboard-spending missing');

  const rows = await page.$$('.dashboard-spending .dashboard-row');
  rows.length >= 4 && rows.length <= 8
    ? ok(`${rows.length} spending rows rendered`)
    : fail('Spending rows', `expected 4-8 .dashboard-row, got ${rows.length}`);

  // Each row has a label, amount, and bar
  for (const row of rows) {
    const label = await row.$('.dashboard-row-label');
    const amount = await row.$('.dashboard-row-amount');
    const bar = await row.$('.dashboard-row-bar');
    label && amount && bar
      ? ok(`Spending row complete: ${(await label.textContent()).trim()}`)
      : fail('Spending row', 'missing .dashboard-row-label, -amount, or -bar');
  }
}
```

And call it from the main `(async () => { ... })` block, right after `testHomepageLoads(page)`:

```javascript
await testDashboardSpending(page);
```

- [ ] **Step 4.2: Run the smoke test to see the new assertions fail**

```bash
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(Spending|Where)" | head -10
```

Expected: `Spending section .dashboard-spending missing`.

- [ ] **Step 4.3: Add Zone 2 to `index.html`**

After the existing `.home-hero` section, before the existing `.home-stop--tinted`, add:

```html
<section class="home-stop dashboard-spending">
  <div class="dashboard-section-head">
    <h2>Where it's going</h2>
    <p class="dashboard-section-sub">{{ site.data.dashboard.fiscal_year }} budget</p>
  </div>

  {% assign max_spend = 0 %}
  {% for row in site.data.dashboard.spending %}
    {% if row.amount_millions > max_spend %}{% assign max_spend = row.amount_millions %}{% endif %}
  {% endfor %}

  <div class="dashboard-rows">
    {% for row in site.data.dashboard.spending %}
      <div class="dashboard-row">
        <p class="dashboard-row-label">{{ row.label }}</p>
        <p class="dashboard-row-amount">${{ row.amount_millions }}M</p>
        <div class="dashboard-row-bar" aria-hidden="true">
          <span class="dashboard-row-bar-fill" style="width: {{ row.amount_millions | times: 100.0 | divided_by: max_spend }}%"></span>
        </div>
        {% if row.why_link %}
          <a class="dashboard-row-why" href="{{ row.why_link }}">{{ row.why_text | default: "why?" }} <span class="arrow">→</span></a>
        {% else %}
          <span class="dashboard-row-why dashboard-row-why--blank"></span>
        {% endif %}
      </div>
    {% endfor %}
  </div>
</section>
```

Add CSS to the inline `<style>` block:

```css
.dashboard-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 22px;
}
.dashboard-section-head h2 {
  font-family: 'Libre Franklin', system-ui, sans-serif;
  font-weight: 800;
  font-size: clamp(20px, 3vw, 26px);
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--text);
}
.dashboard-section-sub {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin: 0;
}

.dashboard-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dashboard-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
@media (min-width: 700px) {
  .dashboard-row {
    grid-template-columns: 180px 110px 1fr 140px;
    align-items: center;
    gap: 18px;
  }
}
.dashboard-row-label {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}
.dashboard-row-amount {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.dashboard-row-bar {
  position: relative;
  height: 10px;
  background: color-mix(in srgb, var(--c-navy) 6%, transparent);
  border-radius: 5px;
  overflow: hidden;
}
.dashboard-row-bar-fill {
  display: block;
  height: 100%;
  background: color-mix(in srgb, var(--c-navy) 40%, transparent);
  border-radius: 5px;
}
.dashboard-row-why {
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
}
.dashboard-row-why:hover { color: var(--c-teal); }
.dashboard-row-why .arrow { transition: transform 0.15s; display: inline-block; }
.dashboard-row-why:hover .arrow { transform: translateX(2px); }
.dashboard-row-why--blank { visibility: hidden; }
```

The `--c-navy` color at 40% alpha gives a muted blue bar that contrasts with `--c-teal` (the CTA color). Per the spec, no green/red.

- [ ] **Step 4.4: Rebuild and re-run smoke test**

```bash
bundle exec jekyll build 2>&1 | tail -3
# Jekyll server is already running with --no-watch; restart if needed:
pkill -f "jekyll serve" 2>/dev/null; bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(Spending|Where)" | head -15
```

Expected: all Spending assertions pass.

- [ ] **Step 4.5: Screenshot and commit**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000" \
  "proof/wise-mountain-zone-2.png"

git add index.html tests/smoke-test.mjs proof/wise-mountain-zone-2.png
git commit -m "$(cat <<'EOF'
Add homepage Zone 2: Where it's going

Six-row spending breakdown from _data/dashboard.yml. Each row shows
label, dollar amount, proportional bar, and an optional why-link to
the relevant explainer. Bars are muted navy at 40% alpha, no
judgment colors per STYLE_GUIDE.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 5: Implement Zone 3 (Where it comes from) with TDD

**Files:**
- Modify: `tests/smoke-test.mjs` — add `testDashboardRevenue`
- Modify: `index.html` — add revenue section after spending

- [ ] **Step 5.1: Add revenue-zone assertions**

```javascript
async function testDashboardRevenue(page) {
  console.log('\n── Dashboard: Where it comes from ──');
  const section = await page.$('.dashboard-revenue');
  section ? ok('Revenue section present') : fail('Revenue section', '.dashboard-revenue missing');

  const rows = await page.$$('.dashboard-revenue .dashboard-row');
  rows.length >= 3 && rows.length <= 6
    ? ok(`${rows.length} revenue rows rendered`)
    : fail('Revenue rows', `expected 3-6 .dashboard-row, got ${rows.length}`);
}
```

Call it from main right after `testDashboardSpending(page)`.

- [ ] **Step 5.2: Run smoke test to see fail**

```bash
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(Revenue|comes from)" | head -5
```

Expected: `.dashboard-revenue missing`.

- [ ] **Step 5.3: Add Zone 3 to `index.html`**

After the `.dashboard-spending` section, add a near-mirror:

```html
<section class="home-stop dashboard-revenue">
  <div class="dashboard-section-head">
    <h2>Where it comes from</h2>
    <p class="dashboard-section-sub">{{ site.data.dashboard.fiscal_year }} budget</p>
  </div>

  {% assign max_rev = 0 %}
  {% for row in site.data.dashboard.revenue %}
    {% if row.amount_millions > max_rev %}{% assign max_rev = row.amount_millions %}{% endif %}
  {% endfor %}

  <div class="dashboard-rows">
    {% for row in site.data.dashboard.revenue %}
      <div class="dashboard-row">
        <p class="dashboard-row-label">{{ row.label }}</p>
        <p class="dashboard-row-amount">${{ row.amount_millions }}M</p>
        <div class="dashboard-row-bar" aria-hidden="true">
          <span class="dashboard-row-bar-fill" style="width: {{ row.amount_millions | times: 100.0 | divided_by: max_rev }}%"></span>
        </div>
        {% if row.why_link %}
          <a class="dashboard-row-why" href="{{ row.why_link }}">{{ row.why_text | default: "why?" }} <span class="arrow">→</span></a>
        {% else %}
          <span class="dashboard-row-why dashboard-row-why--blank"></span>
        {% endif %}
      </div>
    {% endfor %}
  </div>
</section>
```

No new CSS needed; revenue rows reuse the `.dashboard-row*` classes from Zone 2.

- [ ] **Step 5.4: Rebuild, test, screenshot, commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
pkill -f "jekyll serve" 2>/dev/null; bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(Revenue|comes from)" | head -5
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4000" "proof/wise-mountain-zone-3.png"

git add index.html tests/smoke-test.mjs proof/wise-mountain-zone-3.png
git commit -m "$(cat <<'EOF'
Add homepage Zone 3: Where it comes from

Revenue mirror to the spending section. Four rows, same row template,
why-links to override-impact and free-cash explainers where they exist.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 6: Implement Zone 4 (What's in play) with TDD

**Files:**
- Modify: `tests/smoke-test.mjs` — add `testDashboardInPlay`
- Modify: `index.html` — add in-play section after revenue

- [ ] **Step 6.1: Add in-play-zone assertions**

```javascript
async function testDashboardInPlay(page) {
  console.log('\n── Dashboard: What\'s in play ──');
  const section = await page.$('.dashboard-in-play');
  section ? ok('In-play section present') : fail('In-play section', '.dashboard-in-play missing');

  const cards = await page.$$('.dashboard-in-play .in-play-card');
  cards.length >= 3 && cards.length <= 5
    ? ok(`${cards.length} in-play cards rendered`)
    : fail('In-play cards', `expected 3-5 .in-play-card, got ${cards.length}`);

  // Every card must link somewhere
  for (const card of cards) {
    const link = await card.$('a[href]');
    link
      ? ok(`In-play card has link: ${await link.getAttribute('href')}`)
      : fail('In-play card', 'no link found');
  }
}
```

Call from main after `testDashboardRevenue(page)`.

- [ ] **Step 6.2: Run smoke test to see fail**

```bash
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(in.play|In-play|What's in)" | head -5
```

Expected: `.dashboard-in-play missing`.

- [ ] **Step 6.3: Add Zone 4 to `index.html`**

After the `.dashboard-revenue` section, add:

```html
<section class="home-stop home-stop--tinted dashboard-in-play">
  <div class="dashboard-section-head">
    <h2>What's in play</h2>
  </div>

  <div class="in-play-cards">
    {% for item in site.data.in_play %}
      <a class="in-play-card" href="{{ item.link }}">
        <p class="in-play-title">
          <span class="in-play-marker" aria-hidden="true">◆</span>
          {{ item.title }}
        </p>
        <p class="in-play-summary">{{ item.summary }}</p>
        <p class="in-play-cta">{{ item.link_text | default: "read more" }} <span class="arrow">→</span></p>
      </a>
    {% endfor %}
  </div>
</section>
```

Add CSS to the inline `<style>` block:

```css
.in-play-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 800px) {
  .in-play-cards { grid-template-columns: repeat(3, 1fr); }
}

.in-play-card {
  display: flex;
  flex-direction: column;
  padding: 22px 24px 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.in-play-card:hover {
  border-color: var(--c-teal);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.in-play-title {
  font-family: 'Libre Franklin', system-ui, sans-serif;
  font-weight: 700;
  font-size: 18px;
  margin: 0 0 8px;
  color: var(--text);
}
.in-play-marker {
  color: var(--c-buoy);
  margin-right: 6px;
}
.in-play-summary {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 12px;
  flex: 1;
}
.in-play-cta {
  font-size: 13px;
  color: var(--c-teal);
  font-weight: 600;
  margin: 0;
}
.in-play-cta .arrow { transition: transform 0.15s; display: inline-block; }
.in-play-card:hover .in-play-cta .arrow { transform: translateX(3px); }
```

- [ ] **Step 6.4: Rebuild, test, screenshot, commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
pkill -f "jekyll serve" 2>/dev/null; bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(in.play|In-play)" | head -10
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4000" "proof/wise-mountain-zone-4.png"

git add index.html tests/smoke-test.mjs proof/wise-mountain-zone-4.png
git commit -m "$(cat <<'EOF'
Add homepage Zone 4: What's in play

Three editorially curated cards from _data/in_play.yml, each linking
to an existing explainer page. Tinted-background section to break the
visual rhythm between data zones and the navigation tiles below.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 7: Rewrite Zone 5 (Go deeper) to four tiles

**Files:**
- Modify: `tests/smoke-test.mjs` — update the tile-count assertion
- Modify: `index.html` — remove three of the six existing tiles

- [ ] **Step 7.1: Update the smoke test**

In `tests/smoke-test.mjs`, find the existing tile assertion:

```javascript
  const tiles = await page.$$('.home-tile');
  tiles.length === 6
    ? ok(`6 pillar tiles on homepage (incl. 2026 override archive)`)
    : fail('Homepage tiles', `expected 6 .home-tile, got ${tiles.length}`);
```

Change to:

```javascript
  const tiles = await page.$$('.home-tile');
  tiles.length === 4
    ? ok(`4 go-deeper tiles on homepage`)
    : fail('Homepage tiles', `expected 4 .home-tile, got ${tiles.length}`);

  // Verify the specific four tiles are present, in order
  const expectedTiles = ['/marblehead-101/', '/meetings/', '/explore.html', '/data/'];
  for (const href of expectedTiles) {
    const t = await page.$(`a.home-tile[href="${href}"]`);
    t ? ok(`Tile present: ${href}`) : fail(`Tile ${href}`, 'missing');
  }
```

Note the four expected hrefs: Primer, Meetings, Town Explorer (`/explore.html` per the existing nav; verify when implementing — could also be `/charts/town_explorer.html`), Data catalog (`/data/`).

- [ ] **Step 7.2: Run smoke test to see fail**

```bash
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(tile|Tile)" | head -10
```

Expected: tile-count assertion fails (still 6).

- [ ] **Step 7.3: Update the tiles section in `index.html`**

Find the `<section class="home-stop home-stop--tinted">` near the bottom of `index.html`. The existing block has six `.home-tile` anchors. Remove three:

- Remove the Checkbook tile (`href="/checkbook/"`) — it's now the top-fold CTA.
- Remove the 2026 Override tile (`href="/2026-override/"`) — it's now surfaced in `_data/in_play.yml` and as a why-link in the revenue zone.
- Remove the "What can we do" tile (`href="/what-can-we-do.html"`) — it was a placeholder for an action layer; out of scope per spec.

Keep the other three (Primer, Data catalog, Meetings) and add a Town Explorer tile if not already present. Final four:

```html
<section class="home-stop home-stop--tinted">
  <div class="dashboard-section-head">
    <h2>Go deeper</h2>
  </div>
  <div class="home-tiles">
    <a class="home-tile" href="/marblehead-101/">
      <div class="tile-eye">PRIMER</div>
      <h3>How Marblehead's budget works</h3>
      <p>Eight short chapters: how the town is run, where money comes from, where it goes, how the gap keeps reappearing.</p>
    </a>
    <a class="home-tile" href="/meetings/">
      <div class="tile-eye">MEETINGS</div>
      <h3>What the boards are actually talking about</h3>
      <p>AI-generated summaries of every Select Board, School Committee, and Finance Committee meeting.</p>
    </a>
    <a class="home-tile" href="/explore.html">
      <div class="tile-eye">EXPLORER</div>
      <h3>Compare to other Massachusetts towns</h3>
      <p>Spending, taxes, demographics for all 351 cities and towns. Filter, group, and benchmark.</p>
    </a>
    <a class="home-tile" href="/data/">
      <div class="tile-eye">DATA</div>
      <h3>Charts, tables, and source documents</h3>
      <p>The full catalog: debt, taxes, peer towns, school staffing, voting history.</p>
    </a>
  </div>
</section>
```

Update the grid so 4 tiles fit cleanly on desktop:

```css
@media (min-width: 1000px) {
  .home-tiles { grid-template-columns: repeat(4, 1fr); }
}
```

(Replace the existing `repeat(3, 1fr)` at the same breakpoint.)

Verify the four hrefs (`/marblehead-101/`, `/meetings/`, `/explore.html`, `/data/`) all resolve to real pages:

```bash
for path in marblehead-101/ meetings.html explore.html data/; do
  test -e $path && echo "OK: $path" || echo "MISSING: $path"
done
```

If `/explore.html` doesn't resolve in the built site (Jekyll may strip the `.html`), swap the tile href to whichever does (`/explore/`, `/charts/town_explorer.html`, etc.). The smoke test's tile-href list must match.

- [ ] **Step 7.4: Rebuild, test, screenshot, commit**

```bash
bundle exec jekyll build 2>&1 | tail -3
pkill -f "jekyll serve" 2>/dev/null; bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | grep -E "(tile|Tile)" | head -10
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4000" "proof/wise-mountain-zone-5.png"

git add index.html tests/smoke-test.mjs proof/wise-mountain-zone-5.png
git commit -m "$(cat <<'EOF'
Trim homepage Zone 5 to four go-deeper tiles

Removes Checkbook tile (now top-fold CTA), 2026 Override tile (now in
_data/in_play.yml and revenue why-link), and What-can-we-do placeholder.
Adds an explicit Town Explorer tile. Grid moves to 4 columns on desktop.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 8: Full-page proof and final smoke test sweep

**Files:**
- Create: `proof/wise-mountain.png` (above-fold)
- Create: `proof/wise-mountain-full.png` (full page for review)

- [ ] **Step 8.1: Run the entire smoke test suite end-to-end**

```bash
bundle exec jekyll build 2>&1 | tail -5
pkill -f "jekyll serve" 2>/dev/null; bundle exec jekyll serve --port 4000 --no-watch &
sleep 3
SITE=http://localhost:4000 node tests/smoke-test.mjs 2>&1 | tail -30
```

Expected: 0 failures, all previously-passing tests still pass, all new dashboard assertions pass.

If any pre-existing test now fails, do NOT proceed. Diagnose: did Zone 5 changes break a nav-link assertion? Did `.home-big` removal break a test that still expected it? Fix the regression, recommit, re-run.

- [ ] **Step 8.2: Capture above-fold and full-page screenshots**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000" \
  "proof/wise-mountain.png"

npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000" \
  "proof/wise-mountain-full.png"

file proof/wise-mountain.png proof/wise-mountain-full.png
# Expect both ~2880 px wide. Full-page is taller.
```

Open both in a viewer and verify the dashboard renders correctly: Zone 1 KPIs visible above the fold, Zones 2-4 in the scroll, Zone 5 tiles at the bottom.

- [ ] **Step 8.3: Run the full local test target**

```bash
npm run test:local 2>&1 | tail -20
```

Expected: 52+ pass, 0 fail (per the project CLAUDE.md baseline). The smoke test now covers the new dashboard sections, so the count will be higher.

- [ ] **Step 8.4: Commit the proof and final state**

```bash
git add proof/wise-mountain.png proof/wise-mountain-full.png

# Clean up the intermediate per-zone screenshots if desired; they served their purpose
git rm proof/wise-mountain-zone-1.png proof/wise-mountain-zone-2.png proof/wise-mountain-zone-3.png proof/wise-mountain-zone-4.png proof/wise-mountain-zone-5.png

git commit -m "$(cat <<'EOF'
Add full-page proof for admin-view homepage

Above-fold and full-page screenshots from local Jekyll build, with
all 5 zones rendering correctly and smoke tests green.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

- [ ] **Step 8.5: Stop the local Jekyll server**

```bash
pkill -f "jekyll serve" 2>/dev/null
```

---

## Definition of done

- All 8 tasks committed on the `wise-mountain` branch.
- `npm run test:local` is green (0 failures).
- `proof/wise-mountain.png` (above-fold) and `proof/wise-mountain-full.png` (full page) committed and ~2880 px wide.
- Every spending and revenue row carries a primary-source citation in `_data/dashboard.yml`.
- Every `_data/in_play.yml` item links to a page that exists.
- Branch ready to push and open a PR per the project CLAUDE.md.

## Out of scope reminders

Per the spec, the following are NOT part of this plan:

- Creating new explainer pages for Town Services, Pensions, Free Cash, etc. (phase 2).
- Action layer / coordination tools.
- Auto-pull from meeting digests into "What's in play".
- URL changes to existing pages.
- Animations beyond the existing hover transitions.
