# What's Actually Flexible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/what-is-actually-flexible.html` — a new page that frames FY27's $109.78M general fund as locked-vs-flexible (three tiers), shows total-cost-to-employ for two archetypes (teacher and town employee), and includes a small translator from dollar cuts to position equivalents.

**Architecture:** Pure Jekyll static page rendered from two new `_data/*.yml` files. Inline SVG for both visualizations (no chart library). One small inline `<script>` for the translator (no framework). Citations via the standard `<sup class="cite">` markers that `assets/citations.js` collects at runtime.

**Tech Stack:** Jekyll 3.10 (pinned via Gemfile), Liquid templating, vanilla JS, inline SVG. Playwright (Chromium) for smoke testing. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-22-what-is-actually-flexible-design.md`

---

## File Structure

**New files:**
- `_data/fixed_costs.yml` — locked-tier line items with FY27 dollars and sources.
- `_data/fte_cost.yml` — per-archetype cost-stack components.
- `what-is-actually-flexible.html` — the page itself (Jekyll + Liquid + inline SVG + inline JS).
- `proof/<branch>.png` — Playwright screenshot for PR proof of work.

**Modified files:**
- `tests/smoke-test.mjs` — add `testWhatIsActuallyFlexiblePageLoads` plus a registration call in `main()`.
- `the-debate.html` — add inbound link from the fiscal-conservative steelman section.
- `where-has-the-money-gone.html` — add inbound link from the "What grew faster" section.
- `no-override-budget.html` — add inbound link from the cuts list.
- `town-budget.html` — add a one-line teaser near the top of the lead.

**NOT modified:** `assets/citations.js` (existing pipeline already handles `<sup class="cite">` markers; no changes needed).

---

## Task 1: Source the four still-unknown dollar values

Before writing any data file, resolve the four figures the spec flagged as TBD. These are research tasks against documents already in the repo.

**Files:** read-only research; no writes.

- [ ] **Step 1: Find FY27 SPED out-of-district tuition + transportation**

Run:

```bash
grep -i -B1 -A4 "out of district\|out-of-district\|OOD tuition\|SPED transp" data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt | head -60
```

If the packet does not provide a clean FY27 number, fall back to:

```bash
grep -i "out of district\|sped tuition\|sped transport" data/schools/sc-meetings-fy26/*.txt | head -30
```

Record the FY27 figure and its source location (file path + nearby line) in a working scratch note for use in Task 2.

Expected: a single dollar figure (likely $3-6M range) with a citable source line.

- [ ] **Step 2: Find FY27 OPEB contribution**

Run:

```bash
grep -i "opeb\|other post.*employ\|gasb 75" data/2026-04-15_Override_Presentation_FINAL.txt | head -20
```

The spec flags an existing line in the override-tier matrix: "Restore Town Portion of OPEB Transfer" at $96,771 (already present in `data/town_budget_FY27.json` under `meta.override_tiers`). Decide whether the page uses this $96,771 (the operating restoration), or whether to use the larger ACFR-actuarial annual required contribution (ARC).

Run to find an ACFR-level number:

```bash
grep -i "opeb" data/FY24_ACFR.txt 2>/dev/null | head -20 || ls data/*ACFR* | head -3
```

Record both numbers if found; we will document the choice in `fixed_costs.yml` with a `source_note`. Default: use the $96,771 operating transfer as the in-budget number, with a note that the ACFR ARC is larger.

- [ ] **Step 3: Find FY27 state assessments (cherry sheet)**

Run:

```bash
ls data/cherry_sheet_FY*.csv 2>/dev/null
```

If only `cherry_sheet_FY26.csv` exists, use the FY26 Marblehead figure already extracted ($2,530,068 = MBTA $519,178 + charter send $1,827,544 + school choice send $99,126 + MAPC $12,309 + mosquito $46,126). The spec already names the caveat: the FY27 cherry sheet has not yet been published by DLS.

Record the FY26 number and the caveat text for use in Task 2.

- [ ] **Step 4: Derive the FY27 average town employee salary**

Run:

```bash
python3 << 'PY'
import json
d = json.load(open('data/town_budget_FY27.json'))
total_salaries = 0
for r in d['rows']:
    if r['level'] == 'line' and r.get('spend_type') == 'salaries':
        # Exclude school salaries (school side has its own archetype)
        if r.get('function') == 'schools':
            continue
        total_salaries += r.get('fy27_proposed', 0) or 0
print(f"Total non-school FY27 salaries: ${total_salaries:,}")
PY
```

For FTE count, use the `data/_enrichment/fy27_personnel.yml` source documents. Open and read:

```bash
head -200 data/_enrichment/fy27_personnel.yml
```

Look for a roll-up FTE figure for town (non-school, non-enterprise) employees. If no roll-up exists in the enrichment file, count distinct salary-line positions in the MUNIS Excel reference (the enrichment file documents the path).

Record both the total non-school salary $ and the FTE count. Average town salary = total ÷ FTE.

- [ ] **Step 5: Commit research notes**

```bash
cd /home/claude/marblehead/.dev/worktree/gentle-garden
mkdir -p docs/superpowers/research
cat > docs/superpowers/research/2026-06-22-fixed-costs-figures.md <<'EOF'
# Sourced figures for what-is-actually-flexible page

[paste the four figures with citations]
EOF
git add docs/superpowers/research/2026-06-22-fixed-costs-figures.md
git commit -m "Research: sourced figures for fixed-costs page

Resolves the four TBD figures from the design spec:
- SPED OOD tuition + transport
- OPEB FY27 figure
- State assessments (FY27 cherry sheet status)
- Average town employee salary derivation
"
```

---

## Task 2: Build `_data/fixed_costs.yml`

**Files:**
- Create: `_data/fixed_costs.yml`

- [ ] **Step 1: Write the data file**

Use this exact structure. Replace `<TIER1_SPED_DOLLARS>`, `<TIER3_OPEB_DOLLARS>` with the numbers found in Task 1. Other numbers are confirmed from `data/town_budget_FY27.json` and `data/cherry_sheet_FY26.csv`.

```yaml
# Fixed Costs data for /what-is-actually-flexible.html
#
# All FY27 dollar values reconcile against data/town_budget_FY27.json
# (Total General Fund: $109,777,938).
#
# Tiers reflect the legal/contractual horizon over which the line is
# locked:
#   1 — hard-locked this year (legal or contractual; no FY27 lever)
#   2 — contract-locked (current CBA; reducible at next bargain)
#   3 — schedule-locked (multi-decade actuarial schedule)

meta:
  fy: 27
  total_general_fund: 109777938
  source_doc: "FY27 Proposed Budget — No Override"
  source_url: "https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"

tiers:
  - id: hard
    label: "Hard-locked this year"
    description: "Legal or contractual obligations the town cannot reduce in FY27."
    items:
      - category: "Bonded debt service"
        fy27_amount: 11098398
        source_id: town_budget_fy27
        source_note: "Maturing Bonds + Interest, Other General Government function"
      - category: "State assessments (MBTA, charter school, county, MAPC, mosquito)"
        fy27_amount: 2530068
        source_id: cherry_sheet_fy26
        source_note: "FY26 Mass. DLS cherry sheet for Marblehead (DOR code 168). FY27 cherry sheet not yet published."
        caveat: "Using FY26 figure — FY27 cherry sheet not yet published by DLS"
      - category: "SPED out-of-district tuition + transportation (net of Circuit Breaker + IDEA offsets)"
        fy27_amount: 4291145
        source_id: fy27_school_packet
        source_note: "FY27 school budget packet, Outside Placements + SPED Transportation, net of Circuit Breaker reimbursement and IDEA offset. Gross is $6,627,626."

  - id: contract
    label: "Contract-locked"
    description: "Set by current collective bargaining agreements; reducible only by contract renegotiation."
    items:
      - category: "Healthcare (employer share, ~83%)"
        fy27_amount: 16754748
        source_id: town_budget_fy27
        source_note: "Group Insurance line, Other General Government function"
      - category: "Workers compensation insurance"
        fy27_amount: 978309
        source_id: town_budget_fy27
        source_note: "Other Insurance line, Other General Government function"
      - category: "Unemployment insurance"
        fy27_amount: 597208
        source_id: town_budget_fy27
        source_note: "Unemployment line, Other General Government function"

  - id: schedule
    label: "Schedule-locked"
    description: "Long-term funding obligations governed by actuarial schedules."
    items:
      - category: "Pension assessment (Marblehead Contributory Retirement)"
        fy27_amount: 5843360
        source_id: town_budget_fy27
        source_note: "Contributory Retirement Fund line, Other General Government function"
      - category: "Medicare (federal employer match, 1.45%)"
        fy27_amount: 277629
        source_id: town_budget_fy27
        source_note: "Medicare line, Other General Government function"
      # OPEB intentionally omitted: FY27 No-Override appropriation is $0 (cut
      # from FY26's $250K). The override would restore only $96,771, still
      # well below the $10.6M FY24 actuarial ARC. The deferral is called out
      # in the Caveats section instead — including it as a $0 locked-tier
      # row would misrepresent the page's frame.

sources:
  town_budget_fy27:
    href: "https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"
    label: "FY27 Proposed Budget — No Override"
  cherry_sheet_fy26:
    href: "/data/cherry_sheet_FY26.csv"
    label: "Mass. DLS FY26 Cherry Sheet (Marblehead)"
  fy27_school_packet:
    href: "https://www.marbleheadschools.org/school-committee/files/fy27-proposed-budget-packet"
    label: "FY27 School Committee Budget Packet"
```

- [ ] **Step 2: Verify the YAML parses and totals reconcile**

```bash
python3 << 'PY'
import yaml
d = yaml.safe_load(open('_data/fixed_costs.yml'))
total = sum(item['fy27_amount'] for tier in d['tiers'] for item in tier['items'])
gf = d['meta']['total_general_fund']
flexible = gf - total
print(f"Locked total: ${total:,}")
print(f"General Fund:  ${gf:,}")
print(f"Flexible:     ${flexible:,}  ({100*flexible/gf:.1f}%)")
assert total > 0 and total < gf, f"Locked total ${total:,} must be > 0 and < ${gf:,}"
print("OK — totals reconcile")
PY
```

Expected output: locked total roughly $40-50M; flexible residual roughly $60-70M (~55-65%); script exits 0.

If the verifier prints a flexible residual under $10M or over $90M, the data file has a wrong figure — stop and re-verify against the source documents.

- [ ] **Step 3: Commit**

```bash
git add _data/fixed_costs.yml
git commit -m "Add fixed-costs data file for what-is-actually-flexible page

Three-tier categorization of FY27 locked obligations:
- Tier 1 hard-locked: debt service, state assessments, SPED OOD
- Tier 2 contract-locked: healthcare, workers comp, unemployment
- Tier 3 schedule-locked: pension, OPEB, Medicare

All dollar figures sourced to FY27 Proposed Budget,
FY26 cherry sheet, or FY27 school packet.
"
```

---

## Task 3: Build `_data/fte_cost.yml`

**Files:**
- Create: `_data/fte_cost.yml`

- [ ] **Step 1: Write the data file**

Use this structure. Numbers marked `<...>` get filled from Task 1 research.

```yaml
# FTE cost-to-employ data for /what-is-actually-flexible.html
#
# Each archetype is a stacked column on the page. Components must sum
# to `total_cost_to_employ` (the Jekyll template asserts this).
#
# These are AVERAGES across the archetype's full range; the page
# itself carries a caveat about spread (a first-year teacher and a
# senior firefighter both count as one FTE but cost very different
# amounts).

archetypes:
  - id: teacher
    label: "Teacher (schools)"
    components:
      - name: "Salary (FY27 estimate)"
        amount: <TEACHER_SALARY_FY27>
        source_id: dese_teacher_salary
        source_note: "DESE Marblehead avg teacher salary (FY24 $90,696), adjusted forward using Robidoux contract COLA"
      - name: "Healthcare (employer share)"
        amount: <TEACHER_HEALTHCARE_SHARE>
        source_id: gic_premiums
        source_note: "GIC family-plan premium × 83% employer share (typical CBA structure)"
      - name: "Pension (MTRS — state pays)"
        amount: 0
        source_id: mtrs
        source_note: "Massachusetts Teachers Retirement System is funded by the state, not the town"
        flag: "state-paid"
      - name: "Medicare (1.45%)"
        amount: <TEACHER_MEDICARE>
        source_id: derived
        source_note: "1.45% federal employer Medicare match on salary"
      - name: "OPEB allocation (per FTE)"
        amount: <TEACHER_OPEB_PER_FTE>
        source_id: town_budget_fy27
        source_note: "FY27 OPEB transfer ÷ benefited FTE count"
    total_cost_to_employ: <TEACHER_TOTAL>

  - id: town_employee
    label: "Town employee (non-school)"
    components:
      - name: "Salary (FY27 average)"
        amount: <TOWN_SALARY_FY27>
        source_id: town_budget_fy27
        source_note: "FY27 non-school personnel ÷ town FTE count (derived from MUNIS Excel)"
      - name: "Healthcare (employer share)"
        amount: <TOWN_HEALTHCARE_SHARE>
        source_id: gic_premiums
        source_note: "GIC family-plan premium × ~83% employer share"
      - name: "Pension (MCRS — town pays)"
        amount: <TOWN_PENSION>
        source_id: town_budget_fy27
        source_note: "Town's share of $5,843,360 Marblehead Contributory Retirement assessment ÷ town FTE"
      - name: "Medicare (1.45%)"
        amount: <TOWN_MEDICARE>
        source_id: derived
        source_note: "1.45% federal employer Medicare match on salary"
      - name: "OPEB allocation (per FTE)"
        amount: <TOWN_OPEB_PER_FTE>
        source_id: town_budget_fy27
        source_note: "FY27 OPEB transfer ÷ benefited FTE count"
    total_cost_to_employ: <TOWN_TOTAL>

sources:
  dese_teacher_salary:
    href: "/data/dese_marblehead_avg_teacher_salary.csv"
    label: "DESE Marblehead average teacher salary"
  gic_premiums:
    href: "/data/health_premiums.csv"
    label: "GIC family-plan premium history"
  mtrs:
    href: "https://www.mass.gov/orgs/massachusetts-teachers-retirement-system"
    label: "Massachusetts Teachers Retirement System"
  town_budget_fy27:
    href: "https://www.marbleheadma.gov/finance-department/files/fy27-proposed-budget-no-override"
    label: "FY27 Proposed Budget — No Override"
  derived:
    href: "/what-is-actually-flexible.html#methodology"
    label: "Derived calculation (shown in methodology)"
```

- [ ] **Step 2: Verify the YAML parses and totals reconcile per archetype**

```bash
python3 << 'PY'
import yaml
d = yaml.safe_load(open('_data/fte_cost.yml'))
for arch in d['archetypes']:
    component_sum = sum(c['amount'] for c in arch['components'])
    stated = arch['total_cost_to_employ']
    diff = abs(component_sum - stated)
    status = "OK" if diff <= 5 else "MISMATCH"
    print(f"{arch['label']:35s}  components=${component_sum:>8,}  stated=${stated:>8,}  [{status}]")
    assert diff <= 5, f"{arch['label']} components must sum to total within $5"
print("OK — both archetypes reconcile")
PY
```

Expected: both archetypes within $5 of stated total; script exits 0.

- [ ] **Step 3: Commit**

```bash
git add _data/fte_cost.yml
git commit -m "Add FTE cost-to-employ data for archetypes

Two archetypes: teacher and town employee. Each is a stacked
column on the page showing salary + healthcare + pension +
Medicare + OPEB rolling up to total cost-to-employ.

Teacher pension is $0 (state-funded via MTRS); town employee
pension comes from the local Contributory Retirement System.
"
```

---

## Task 4: Page scaffolding + lead

**Files:**
- Create: `what-is-actually-flexible.html`

- [ ] **Step 1: Write the page frontmatter, lead, and first-section skeleton**

```html
---
layout: page
title: "What's actually flexible in Marblehead's budget?"
description: "Of FY27's $109.78M general fund, how much is locked by law, contract, or schedule — and how small is the truly discretionary pool?"
permalink: /what-is-actually-flexible.html
---

{% assign meta = site.data.fixed_costs.meta %}
{% assign locked_total = 0 %}
{% for tier in site.data.fixed_costs.tiers %}
  {% for item in tier.items %}
    {% assign locked_total = locked_total | plus: item.fy27_amount %}
  {% endfor %}
{% endfor %}
{% assign flexible_total = meta.total_general_fund | minus: locked_total %}

<style>
  .waf-lead { font-size: 18px; line-height: 1.55; max-width: 720px; }
  .waf-claim-stat { font-weight: 700; font-variant-numeric: tabular-nums; }
  .waf-section { margin: 48px 0; }
  .waf-section h2 { font-size: 24px; margin-bottom: 16px; }
  /* visualization styles added in Tasks 5 + 6 */
</style>

<h1>What's actually flexible in Marblehead's budget?</h1>

<p class="waf-lead">
  Of the FY27
  <span class="waf-claim-stat">${{ meta.total_general_fund | divided_by: 1000000.0 | round: 2 }}M</span>
  general fund, roughly
  <span class="waf-claim-stat">${{ locked_total | divided_by: 1000000.0 | round: 1 }}M</span>
  is locked by law, contract, or funding schedule. That leaves about
  <span class="waf-claim-stat">${{ flexible_total | divided_by: 1000000.0 | round: 1 }}M</span>
  as discretionary, and most of that is salaries, so "cut spending" almost
  always means "cut positions."
</p>

<section class="waf-section" id="whats-locked">
  <h2>What's locked</h2>
  <!-- Stacked bar + tier cards added in Task 5 -->
</section>

<section class="waf-section" id="cost-of-employee">
  <h2>What it actually costs to employ someone</h2>
  <!-- Side-by-side archetype columns added in Task 6 -->
</section>

<section class="waf-section" id="translator">
  <h2>What a cut would mean</h2>
  <!-- Translator input added in Task 7 -->
</section>

<section class="waf-section" id="caveats">
  <h2>Caveats</h2>
  <!-- Caveat bullets added in Task 8 -->
</section>
```

- [ ] **Step 2: Verify the build renders the lead**

In one terminal:

```bash
bundle exec jekyll serve --port 4000 --watch
```

In another:

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -A2 "waf-claim-stat"
```

Expected: three `<span class="waf-claim-stat">$X.XXM</span>` values rendered with actual numbers (no `{{ ... }}` Liquid markers). The three values should be:
- General fund: $109.78M
- Locked: some figure $30-60M (depends on what was sourced in Task 1)
- Flexible: residual that sums with locked to $109.78M

- [ ] **Step 3: Commit**

```bash
git add what-is-actually-flexible.html
git commit -m "Add what-is-actually-flexible.html scaffold + lead

Page renders the lead claim by summing locked tiers from
_data/fixed_costs.yml. Section skeletons added; visualizations
follow in later commits.
"
```

---

## Task 5: Section 1 — locked tiers stacked bar + cards

**Files:**
- Modify: `what-is-actually-flexible.html` (extend the `#whats-locked` section)

- [ ] **Step 1: Add the stacked bar SVG and tier cards inside `#whats-locked`**

Replace the `<!-- Stacked bar + tier cards added in Task 5 -->` comment with:

```html
{% assign tier_palette = "var(--chart-neutral-1),var(--chart-neutral-2),var(--chart-neutral-3),var(--chart-accent-soft)" | split: "," %}

<style>
  .waf-bar { width: 100%; height: 56px; display: block; margin: 8px 0 4px; }
  .waf-bar text { font-size: 11px; font-variant-numeric: tabular-nums; }
  .waf-bar-legend { display: flex; flex-wrap: wrap; gap: 12px 20px; font-size: 13px; margin-bottom: 24px; }
  .waf-bar-legend-swatch { display: inline-block; width: 12px; height: 12px; vertical-align: middle; margin-right: 4px; border: 1px solid rgba(0,0,0,0.15); }
  .waf-tier-card { border: 1px solid var(--border-subtle); padding: 16px 18px; margin: 12px 0; border-radius: 4px; }
  .waf-tier-card h3 { font-size: 17px; margin: 0 0 4px; }
  .waf-tier-card .waf-tier-card-desc { font-size: 13px; color: var(--text-muted); margin: 0 0 10px; }
  .waf-tier-card table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .waf-tier-card td { padding: 4px 0; vertical-align: top; }
  .waf-tier-card td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .waf-tier-card .waf-caveat { font-size: 12px; color: var(--text-muted); font-style: italic; }
  @media (max-width: 600px) {
    .waf-bar { height: 80px; }
    .waf-bar text { font-size: 10px; }
  }
</style>

<svg class="waf-bar" viewBox="0 0 1000 56" preserveAspectRatio="none" role="img" aria-labelledby="waf-bar-title waf-bar-desc">
  <title id="waf-bar-title">FY27 general fund: locked vs flexible</title>
  <desc id="waf-bar-desc">
    Bar showing the FY27 $109.78M general fund divided into three locked
    tiers and the flexible residual. Each segment's width is proportional
    to its dollar amount.
  </desc>
  {% assign x_cursor = 0 %}
  {% assign denom = meta.total_general_fund | times: 1.0 %}
  {% for tier in site.data.fixed_costs.tiers %}
    {% assign tier_sum = 0 %}
    {% for item in tier.items %}{% assign tier_sum = tier_sum | plus: item.fy27_amount %}{% endfor %}
    {% assign tier_pct = tier_sum | times: 1000.0 | divided_by: denom %}
    {% assign tier_color = tier_palette[forloop.index0] %}
    <rect x="{{ x_cursor }}" y="0" width="{{ tier_pct }}" height="56" fill="{{ tier_color }}"></rect>
    {% assign x_cursor = x_cursor | plus: tier_pct %}
  {% endfor %}
  {% assign flex_pct = flexible_total | times: 1000.0 | divided_by: denom %}
  <rect x="{{ x_cursor }}" y="0" width="{{ flex_pct }}" height="56" fill="{{ tier_palette[3] }}"></rect>
</svg>

<div class="waf-bar-legend">
  {% for tier in site.data.fixed_costs.tiers %}
    {% assign tier_sum = 0 %}
    {% for item in tier.items %}{% assign tier_sum = tier_sum | plus: item.fy27_amount %}{% endfor %}
    <span><span class="waf-bar-legend-swatch" style="background:{{ tier_palette[forloop.index0] }}"></span>{{ tier.label }} — ${{ tier_sum | divided_by: 1000000.0 | round: 1 }}M</span>
  {% endfor %}
  <span><span class="waf-bar-legend-swatch" style="background:{{ tier_palette[3] }}"></span>Flexible — ${{ flexible_total | divided_by: 1000000.0 | round: 1 }}M</span>
</div>

{% for tier in site.data.fixed_costs.tiers %}
  <div class="waf-tier-card">
    <h3>{{ tier.label }}</h3>
    <p class="waf-tier-card-desc">{{ tier.description }}</p>
    <table>
      {% for item in tier.items %}
        <tr>
          <td>
            {{ item.category }}
            {% if item.caveat %}
              <div class="waf-caveat">{{ item.caveat }}</div>
            {% endif %}
            {% assign source = site.data.fixed_costs.sources[item.source_id] %}
            <sup class="cite" data-href="{{ source.href }}" data-source="{{ source.label }} — {{ item.source_note }}"></sup>
          </td>
          <td>${{ item.fy27_amount | divided_by: 1000.0 | round: 0 }}K</td>
        </tr>
      {% endfor %}
    </table>
  </div>
{% endfor %}
```

The use of `var(--chart-neutral-1/2/3)` and `var(--chart-accent-soft)` assumes those CSS custom properties exist in `assets/site.css`. If they don't, fall through to literal hex values matching the site's existing neutral chart palette (read `assets/site.css` to find what's already in use; do NOT invent new colors).

- [ ] **Step 2: Verify the bar renders proportionally**

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -oE '<rect[^/]+/>' | head -4
```

Expected: four `<rect>` elements with `x` and `width` attributes that sum (width-wise) to 1000.

Visually verify in browser at http://localhost:4000/what-is-actually-flexible.html — the bar should show four segments. Three locked tiers visible on the left, flexible residual on the right.

- [ ] **Step 3: Verify the three tier cards render with all line items**

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -c "waf-tier-card\""
```

Expected: 3 (one per tier).

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -oE '\$[0-9,]+K' | sort -u | head -20
```

Expected: dollar values matching the data file (`$11098K`, `$2530K`, etc., expressed in $K).

- [ ] **Step 4: Commit**

```bash
git add what-is-actually-flexible.html
git commit -m "Add locked-tier stacked bar and tier cards

Section 1 of /what-is-actually-flexible.html. Inline SVG
horizontal stacked bar shows the three locked tiers + flexible
residual, sized proportionally to FY27 dollars. Each tier card
lists its underlying line items with sources via <sup class=cite>.
"
```

---

## Task 6: Section 2 — FTE archetype columns

**Files:**
- Modify: `what-is-actually-flexible.html` (extend the `#cost-of-employee` section)

- [ ] **Step 1: Add the two stacked-column SVGs side by side**

Replace the `<!-- Side-by-side archetype columns added in Task 6 -->` comment with:

```html
<style>
  .waf-fte-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 16px 0 28px; }
  .waf-fte-archetype { text-align: center; }
  .waf-fte-archetype h3 { font-size: 16px; margin: 0 0 6px; }
  .waf-fte-archetype .waf-fte-total { font-size: 14px; color: var(--text-muted); margin-top: 6px; font-variant-numeric: tabular-nums; }
  .waf-fte-col { width: 100%; height: 320px; display: block; }
  .waf-fte-col text { font-size: 11px; font-variant-numeric: tabular-nums; }
  .waf-fte-caveat { font-size: 12px; color: var(--text-muted); margin: 0 0 16px; }
  @media (max-width: 600px) {
    .waf-fte-grid { grid-template-columns: 1fr; }
    .waf-fte-col { height: 240px; }
  }
</style>

{% assign fte_palette = "var(--chart-fte-1),var(--chart-fte-2),var(--chart-fte-3),var(--chart-fte-4),var(--chart-fte-5)" | split: "," %}

<div class="waf-fte-grid">
  {% for arch in site.data.fte_cost.archetypes %}
    <div class="waf-fte-archetype">
      <h3>{{ arch.label }}</h3>
      <svg class="waf-fte-col" viewBox="0 0 200 320" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="waf-fte-{{ arch.id }}-title">
        <title id="waf-fte-{{ arch.id }}-title">
          {{ arch.label }} total cost to employ: ${{ arch.total_cost_to_employ | divided_by: 1000.0 | round: 1 }}K
        </title>
        {% assign denom = arch.total_cost_to_employ | times: 1.0 %}
        {% assign y_cursor = 320 %}
        {% for c in arch.components %}
          {% if c.amount > 0 %}
            {% assign h = c.amount | times: 320.0 | divided_by: denom %}
            {% assign y_cursor = y_cursor | minus: h %}
            <rect x="40" y="{{ y_cursor }}" width="120" height="{{ h }}" fill="{{ fte_palette[forloop.index0] }}"></rect>
            {% if h > 18 %}
              {% assign label_y = y_cursor | plus: h | minus: 6 %}
              <text x="100" y="{{ label_y }}" text-anchor="middle" fill="var(--text-strong)">{{ c.name }} ${{ c.amount | divided_by: 1000.0 | round: 0 }}K</text>
            {% endif %}
          {% endif %}
        {% endfor %}
      </svg>
      <div class="waf-fte-total">
        Total cost-to-employ: <strong>${{ arch.total_cost_to_employ | divided_by: 1000.0 | round: 1 }}K</strong>
      </div>
    </div>
  {% endfor %}
</div>

<p class="waf-fte-caveat">
  Averages hide spread. A first-year teacher and a senior firefighter both count as one FTE
  but cost very different amounts. The translator below uses the average for each archetype.
</p>

<details>
  <summary style="font-size:14px;color:var(--text-muted);cursor:pointer;">How these were calculated</summary>
  <div style="font-size:13px;margin-top:8px;">
    {% for arch in site.data.fte_cost.archetypes %}
      <p><strong>{{ arch.label }}:</strong></p>
      <ul>
        {% for c in arch.components %}
          {% assign source = site.data.fte_cost.sources[c.source_id] %}
          <li>
            {{ c.name }}: ${{ c.amount | divided_by: 1.0 | round: 0 }}
            <sup class="cite" data-href="{{ source.href }}" data-source="{{ source.label }} — {{ c.source_note }}"></sup>
          </li>
        {% endfor %}
      </ul>
    {% endfor %}
  </div>
</details>
```

The use of `var(--chart-fte-1...5)` again assumes the palette exists. If it doesn't, replace with literal neutral hex tones from the existing stylesheet (read `assets/site.css` to find what's there). Do NOT invent.

- [ ] **Step 2: Verify both columns render with stacked segments**

Reload http://localhost:4000/what-is-actually-flexible.html in the browser.

Expected: two side-by-side columns. Each shows stacked rectangles (one per component with `amount > 0`). The teacher column should omit the pension segment (since `amount: 0`). Both columns show the total under the chart.

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -c "waf-fte-col"
```

Expected: 2 SVG columns.

- [ ] **Step 3: Commit**

```bash
git add what-is-actually-flexible.html
git commit -m "Add FTE archetype side-by-side cost stacks

Section 2 of /what-is-actually-flexible.html. Two inline SVG
stacked columns — teacher and town employee — each broken into
salary, healthcare, pension, Medicare, OPEB. Teacher pension
shows as zero (state-paid MTRS) with the methodology note.
"
```

---

## Task 7: Section 3 — the dollar-to-positions translator

**Files:**
- Modify: `what-is-actually-flexible.html` (extend the `#translator` section)

- [ ] **Step 1: Add the translator UI and JS**

Replace the `<!-- Translator input added in Task 7 -->` comment with:

```html
<style>
  .waf-translator { background: var(--surface-muted); padding: 16px 20px; border-radius: 4px; max-width: 520px; }
  .waf-translator label { display: block; margin: 8px 0 4px; font-size: 13px; }
  .waf-translator input[type=number] { font-size: 18px; padding: 6px 8px; width: 200px; font-variant-numeric: tabular-nums; }
  .waf-translator .waf-radio-row { display: flex; gap: 16px; align-items: center; font-size: 14px; margin: 8px 0; }
  .waf-translator .waf-result { font-size: 22px; margin-top: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .waf-translator .waf-result-detail { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
</style>

<div class="waf-translator">
  <label for="waf-cut-amount">Cut amount</label>
  <input type="number" id="waf-cut-amount" min="0" step="10000" placeholder="e.g. 500000" inputmode="numeric"
    aria-describedby="waf-translator-result">

  <div class="waf-radio-row" role="radiogroup" aria-label="Archetype">
    {% for arch in site.data.fte_cost.archetypes %}
      <label>
        <input type="radio" name="waf-archetype" value="{{ arch.id }}"
          data-cost="{{ arch.total_cost_to_employ }}"
          {% if forloop.first %}checked{% endif %}>
        {{ arch.label }}
      </label>
    {% endfor %}
  </div>

  <div class="waf-result" id="waf-translator-result" aria-live="polite">≈ 0 positions</div>
  <div class="waf-result-detail" id="waf-translator-detail"></div>
</div>

<script>
(function () {
  'use strict';
  var amtInput = document.getElementById('waf-cut-amount');
  var resultEl = document.getElementById('waf-translator-result');
  var detailEl = document.getElementById('waf-translator-detail');

  function getSelectedCost() {
    var radios = document.querySelectorAll('input[name="waf-archetype"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return Number(radios[i].dataset.cost);
    }
    return 0;
  }

  function getSelectedLabel() {
    var radios = document.querySelectorAll('input[name="waf-archetype"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].parentElement.textContent.trim();
    }
    return '';
  }

  function fmt(n) { return n.toLocaleString('en-US'); }

  function recompute() {
    var amount = Number(amtInput.value || 0);
    var cost = getSelectedCost();
    if (!amount || !cost) {
      resultEl.textContent = '≈ 0 positions';
      detailEl.textContent = '';
      return;
    }
    var positions = Math.floor(amount / cost);
    resultEl.textContent = '≈ ' + fmt(positions) + ' position' + (positions === 1 ? '' : 's');
    detailEl.textContent = '$' + fmt(amount) + ' ÷ $' + fmt(cost) + ' per ' + getSelectedLabel().toLowerCase() + ' ≈ ' + fmt(positions);
  }

  amtInput.addEventListener('input', recompute);
  document.querySelectorAll('input[name="waf-archetype"]').forEach(function (r) {
    r.addEventListener('change', recompute);
  });
})();
</script>
```

- [ ] **Step 2: Test the translator manually**

Reload http://localhost:4000/what-is-actually-flexible.html and:

1. Type `500000` in the cut amount input.
2. With teacher selected, the result should read approximately "≈ 4 positions" (depends on teacher total cost ~$110K).
3. With town employee selected, expect a different number.
4. Type `0` or clear — result resets to "≈ 0 positions".

If positions count differs from `floor(amount / cost)`, the math is wrong; check the JS.

- [ ] **Step 3: Commit**

```bash
git add what-is-actually-flexible.html
git commit -m "Add dollar-to-positions translator

Section 3 of /what-is-actually-flexible.html. Single dollar input
plus archetype radio toggle. Live-updates the position estimate
and shows the literal division so the math is visible.

Vanilla JS, no framework, no localStorage.
"
```

---

## Task 8: Sections 4 + 5 — caveats and sources

**Files:**
- Modify: `what-is-actually-flexible.html` (extend the `#caveats` section)

- [ ] **Step 1: Add caveats list**

Replace the `<!-- Caveat bullets added in Task 8 -->` comment with:

```html
<ul>
  <li><strong>"Locked this year" ≠ "locked forever."</strong> CBAs expire and re-bargain (the union pool sets next year's number), debt is paid off and refinanced, pension and OPEB schedules can be re-amortized with PERAC approval.</li>
  <li><strong>Teacher pension is state-paid via MTRS</strong>, so the town avoids a direct contribution for teachers — but the state's bill is funded from taxes Marblehead residents also pay. The $0 entry above is "what the town's general fund pays," not "what teachers cost the public."</li>
  <li><strong>Averages hide spread.</strong> A senior firefighter and a first-year teacher both count as one FTE but cost very different amounts. The archetype values above are midpoints, not forecasts.</li>
  <li><strong>FY27 Proposed — No Override.</strong> Figures use the pre-vote no-override proposal. The adopted FY27 budget (with override revenue included) will be updated here when the town publishes it.</li>
  <li><strong>State assessments use FY26.</strong> The FY27 cherry sheet has not yet been published by the Department of Revenue. This page will update when DLS releases it (typically July–August).</li>
  <li><strong>OPEB is not in the FY27 No-Override budget at all.</strong> The $250,000 FY26 OPEB transfer was cut to $0. The FY24 actuarially-required contribution was $10.6M; actual was $6.5M; the net OPEB liability has grown to $147M.<sup class="cite" data-href="/data/town_docs/FY24_Town_of_Marblehead_ACFR.pdf" data-source="FY24 Town of Marblehead ACFR, p.92 (Schedule of Town Contributions to OPEB Plan)"></sup> The override would restore only $96,771. This page's locked tiers do not include OPEB because nothing is being paid; the deferral is itself a fiscal choice that compounds over time.</li>
</ul>
```

- [ ] **Step 2: Verify the page renders end-to-end without Liquid errors**

```bash
curl -sw "%{http_code}\n" -o /dev/null http://localhost:4000/what-is-actually-flexible.html
```

Expected: `200`.

```bash
curl -s http://localhost:4000/what-is-actually-flexible.html | grep -c "{{ \|{% "
```

Expected: `0` (no unrendered Liquid markers).

- [ ] **Step 3: Commit**

```bash
git add what-is-actually-flexible.html
git commit -m "Add caveats section to what-is-actually-flexible page

Sources auto-collected by citations.js into a Sources <h2> via
the <sup class=cite> markers throughout the page.
"
```

---

## Task 9: Inbound links from four pages

**Files:**
- Modify: `the-debate.html`
- Modify: `where-has-the-money-gone.html`
- Modify: `no-override-budget.html`
- Modify: `town-budget.html`

- [ ] **Step 1: Find the fiscal-conservative steelman section in `the-debate.html`**

```bash
grep -n "fiscal conserv\|cuts\|flexible\|locked" the-debate.html | head -10
```

Pick the section that mentions cuts or "where the money is" and add this sentence at the end of an appropriate paragraph:

```html
For what share of the budget is actually adjustable, see
<a href="/what-is-actually-flexible.html">what's actually flexible</a>.
```

If no obvious place exists, add the link as a "Related" item at the bottom of the page following the existing site convention (grep for `Related` in other pages to see the pattern).

- [ ] **Step 2: Find the "What grew faster" section in `where-has-the-money-gone.html`**

```bash
grep -n "what-grew-faster\|What grew" where-has-the-money-gone.html | head -5
```

Add a sentence at the end of that section:

```html
But how much of that growth was even cuttable?
<a href="/what-is-actually-flexible.html">See what's locked vs flexible.</a>
```

- [ ] **Step 3: Add a link in `no-override-budget.html`**

```bash
grep -n "cut\|reduc" no-override-budget.html | head -10
```

After the cuts list, add:

```html
<p style="font-size:14px;color:var(--text-muted);margin-top:16px;">
  Every dollar of these cuts has a position attached.
  <a href="/what-is-actually-flexible.html">See the dollar-to-FTE translator.</a>
</p>
```

- [ ] **Step 4: Add a teaser at the top of `town-budget.html` lead**

```bash
grep -n "tb-lead" town-budget.html | head -3
```

After the `<p class="tb-lead">` block (currently lines 266–272), insert:

```html
<p style="font-size:14px;color:var(--text-muted);margin: 4px 0 16px;">
  Want the fixed-vs-flexible lens before the line items? See
  <a href="/what-is-actually-flexible.html">what's actually flexible</a>.
</p>
```

- [ ] **Step 5: Verify all four links resolve**

```bash
for page in the-debate.html where-has-the-money-gone.html no-override-budget.html town-budget.html; do
  echo "=== $page ==="
  curl -s "http://localhost:4000/$page" | grep -o 'href="/what-is-actually-flexible[^"]*"' | head -2
done
```

Expected: each page outputs `href="/what-is-actually-flexible.html"` at least once.

- [ ] **Step 6: Commit**

```bash
git add the-debate.html where-has-the-money-gone.html no-override-budget.html town-budget.html
git commit -m "Link to what-is-actually-flexible from four budget pages

Adds inbound links from the-debate, where-has-the-money-gone,
no-override-budget, and town-budget so readers approaching
the budget from any angle find the locked-vs-flexible lens.
"
```

---

## Task 10: Smoke test

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Add a smoke-test function**

Find an existing `async function testXxxPageLoads(page)` block (e.g., `testTownBudgetPageLoads`) and add a sibling function below it:

```javascript
async function testWhatIsActuallyFlexiblePageLoads(page) {
  console.log('\n── What is Actually Flexible page ──');
  const resp = await page.goto(`${SITE}/what-is-actually-flexible.html`, { waitUntil: 'domcontentloaded' });
  resp && resp.status() === 200
    ? ok('Page returns 200')
    : fail('what-is-actually-flexible', `status ${resp ? resp.status() : 'no response'}`);

  const h1 = await page.$('h1');
  h1 ? ok('Page has an h1') : fail('h1', 'missing');

  // Lead claim renders with all three Liquid-computed dollar values
  const claimStats = await page.$$('.waf-claim-stat');
  claimStats.length === 3
    ? ok('Lead claim renders three computed dollar values')
    : fail('Lead claim stats', `expected 3 .waf-claim-stat spans, got ${claimStats.length}`);

  // Three tier cards
  const tierCards = await page.$$('.waf-tier-card');
  tierCards.length === 3
    ? ok('Three tier cards present')
    : fail('Tier cards', `expected 3 .waf-tier-card, got ${tierCards.length}`);

  // Two FTE archetype columns
  const fteCols = await page.$$('.waf-fte-col');
  fteCols.length === 2
    ? ok('Two FTE archetype columns present')
    : fail('FTE columns', `expected 2 .waf-fte-col, got ${fteCols.length}`);

  // Translator math
  await page.fill('#waf-cut-amount', '1000000');
  // Default selection is the first archetype (teacher)
  const resultText = await page.$eval('#waf-translator-result', el => el.textContent);
  const positions = parseInt(resultText.match(/\d+/)?.[0] || '0', 10);
  (positions >= 5 && positions <= 15)
    ? ok(`Translator reports ≈ ${positions} positions for $1M teacher cut`)
    : fail('Translator math', `expected 5-15 positions for $1M, got "${resultText}"`);
}
```

- [ ] **Step 2: Register the test in `main()`**

```bash
grep -n "testTownBudgetPageLoads\|await test" tests/smoke-test.mjs | grep -v "async function" | head -10
```

Find the line where `testTownBudgetPageLoads(page)` is called inside `main()` and add directly below it:

```javascript
  await testWhatIsActuallyFlexiblePageLoads(page);
```

- [ ] **Step 3: Run the smoke test**

```bash
npm run test:local
```

Expected: previous total (52) plus 5 new checks = 57 pass / 0 fail.

If any new check fails, fix in the page before continuing (do not adjust the test to accommodate a broken page).

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "Add Playwright smoke test for what-is-actually-flexible

Covers: page returns 200, h1 present, lead claim renders three
computed dollar values, three tier cards, two FTE archetype
columns, translator math returns a sane position estimate.
"
```

---

## Task 11: Proof of work + open PR

**Files:**
- Create: `proof/<branch-name>.png`

- [ ] **Step 1: Capture above-the-fold screenshot**

```bash
mkdir -p proof
BRANCH=$(git branch --show-current)
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/what-is-actually-flexible.html" \
  "proof/${BRANCH}.png"

file "proof/${BRANCH}.png"
```

Expected: image roughly 2880×1800 (1440 × DPR 2). Confirm with `file` — width should be ~2880.

- [ ] **Step 2: Capture full-page screenshot for context**

```bash
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/what-is-actually-flexible.html" \
  "proof/${BRANCH}-full.png"
```

- [ ] **Step 3: Commit screenshots**

```bash
git add proof/
git commit -m "Add proof-of-work screenshots for what-is-actually-flexible page"
```

- [ ] **Step 4: Push the branch**

```bash
git push -u origin gentle-garden
```

- [ ] **Step 5: Open PR**

```bash
BRANCH=$(git branch --show-current)
gh pr create --title "Add /what-is-actually-flexible: locked-vs-flexible budget lens + FTE translator" --body "$(cat <<'EOF'
## Summary

New page at /what-is-actually-flexible.html that frames the FY27 $109.78M
general fund as locked vs flexible across three tiers, shows total cost-to-employ
for two archetypes (teacher and town employee), and includes a small
dollar-to-FTE translator.

Inspired by Laurenti's Beverly Budget Challenge but without the balancing-game
interactivity. Educational, not gamified.

Spec: `docs/superpowers/specs/2026-06-22-what-is-actually-flexible-design.md`
Plan: `docs/superpowers/plans/2026-06-22-what-is-actually-flexible.md`

Inbound links added from the-debate, where-has-the-money-gone,
no-override-budget, and town-budget.

## Preview

- Preview URL: Cloudflare PR preview will appear shortly; will edit this body
  once green.
- Specific paths to review:
  - `/what-is-actually-flexible.html` — the new page itself
  - `/the-debate.html`, `/where-has-the-money-gone.html`,
    `/no-override-budget.html`, `/town-budget.html` — each gains a one-line
    link to the new page
- What you should see:
  - Lead claim renders three dollar values pulled from `_data/fixed_costs.yml`
  - Horizontal stacked bar with three locked tiers + flexible residual
  - Three tier cards listing line items with sources
  - Two side-by-side FTE archetype columns with totals
  - Translator: type a dollar amount, see ≈ N positions
- Edge cases worth poking:
  - Mobile rendering (the FTE columns should stack)
  - Translator with $0 input (should show "≈ 0 positions")
  - Translator with the town-employee archetype selected (should yield a
    different position estimate than teacher)

## Proof of Work

- Smoke test: `npm run test:local` → 57 pass / 0 fail
  (previous baseline 52 + 5 new checks for this page)
- Above-fold screenshot: see `proof/<branch>.png` in this PR
- Full-page screenshot: see `proof/<branch>-full.png`

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)
EOF
)"
```

- [ ] **Step 6: Wait for the preview URL and update PR body**

After the Cloudflare preview workflow finishes, find the sticky comment, copy the **Branch URL**, and:

```bash
PR_NUM=<the PR number>
gh pr comment $PR_NUM --body "Preview live at: <branch URL>"
```

(Optional: re-edit the PR body with the preview URL inserted. The sticky comment is the authoritative source — editing the body is for convenience.)

Report the PR URL back to the user.

---

## Self-Review Checklist (run after writing the plan)

1. **Spec coverage** — every section of the spec maps to a task:
   - Lead + page goal → Task 4
   - Section 1 (locked tiers) → Task 5 (bar + cards), backed by Task 2 (data)
   - Section 2 (FTE archetypes) → Task 6, backed by Task 3 (data)
   - Section 3 (translator) → Task 7
   - Section 4 (caveats) → Task 8
   - Section 5 (sources) → handled automatically by `assets/citations.js` reading the `<sup class="cite">` markers added in Tasks 5, 6
   - Linking strategy → Task 9
   - Smoke test → Task 10
   - Proof + PR → Task 11

2. **Placeholder scan** — Tasks 2 and 3 contain `<TIER1_SPED_DOLLARS>`-style placeholders, but these are intentional: Task 1 produces the numbers and the executor fills them in before committing the data files. No "TBD" markers ship into committed code.

3. **Type consistency** — `total_cost_to_employ` is the property name in both the data file (Task 3) and the SVG renderer (Task 6) and the translator (Task 7). `fy27_amount` is consistent across all tier items.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-what-is-actually-flexible.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best when the plan has 10+ tasks (this one has 11) and the data-sourcing in Task 1 may surface decisions worth surfacing before later tasks lock them in.

**2. Inline Execution** — I execute tasks in this session using `executing-plans`, with checkpoints for review. Faster end-to-end but I hold full context the whole time.

Which approach?
