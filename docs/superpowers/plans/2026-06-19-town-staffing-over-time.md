# Town Staffing Over Time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `town-staffing-over-time.html`, the "over time" companion to the org-chart snapshot, charting Marblehead's municipal workforce FY08–FY26 and the structural changes (functions added, retired, grown, shrank).

**Architecture:** A root-level narrative page (like `org-chart.html`), driven by a curated `_data/town_staffing.yml` so editorial choices are auditable. Three movements: (1) a multi-line total/town/schools trend, (2) a town-only "then vs now" dumbbell/slope chart grouped by function, (3) a quarantined block for volatile lines (elections, revolving funds, Light enterprise). Hand-authored SVG using existing chart classes; new dumbbell CSS added to `assets/site.css`.

**Tech Stack:** Jekyll 3.10 (GitHub Pages), Liquid templating, YAML data, hand-authored SVG, `assets/site.css`. No JS beyond the existing `citations.js`. No local build available (bundler mismatch) — verify via offline checks + Cloudflare PR preview.

**Note on test format:** This is hand-authored content/data-viz, not code with a unit-test runner. "Tests" here are concrete verification commands: data-correctness `awk` checks against the source CSV, structural `grep` assertions, the em-dash/inline-style guardrail scans, and visual review on the PR preview. There is no `pytest`/`npm test` for page markup.

---

## Source data (reference for all tasks)

From `data/town_employee_headcount_summary_FY08-26.csv` (FY: 2008→2026):

```
Total:   999,1097,1167,1151,1088,1119,1169,1163,1167,1162,1163,1212,1143,1069,1157,1183,1122,1145,1020
Town:    393, 429, 438, 447, 420, 432, 444, 423, 429, 449, 459, 473, 434, 392, 452, 484, 458, 470, 394
Schools: 606, 668, 729, 704, 668, 687, 725, 740, 738, 713, 704, 739, 709, 677, 705, 699, 664, 675, 626
```

Standing caveat (must appear at the numbers): **headcount, not FTE**; a 0.1 FTE substitute counts as 1. Year-over-year deltas reliable; absolute levels not FTE-weighted.

Per-department FY08→FY26 (from `data/town_employee_headcount_FY08-26.csv`, verified via `awk`):

| Department | FY08 | FY26 | Status | Band (proposed) |
|---|---|---|---|---|
| Selectmen | 9 | 6 | stable | General Government |
| Finance Department | 6 | 9 | stable | General Government |
| Assessors | 3 | 3 | stable | General Government |
| Town Clerk | 2 | 3 | stable | General Government |
| Human Resources | – | 3 | new (FY22) | General Government |
| Community Dev & Planning | – | 5 | new (FY18) | General Government |
| Town Counsel | – | – | retired (FY09–FY13) | General Government |
| Police | 76 | 68 | stable | Public Safety |
| Fire | 43 | 40 | stable | Public Safety |
| Harbormaster | 11 | 17 | stable | Public Safety |
| Building Commissioner | 8 | 10 | stable | Public Safety |
| Animal Inspector | 1 | – | retired (last FY16) | Public Safety |
| Highway | 16 | 22 | stable | Public Works |
| Water | 12 | 17 | stable | Public Works |
| Sewer | 12 | 10 | stable | Public Works |
| Waste Coll/Disposal | 7 | 9 | stable | Public Works |
| Cemetery | 9 | 9 | stable | Public Works |
| Public Buildings | 5 | 6 | stable | Public Works |
| Engineering | 1 | – | retired (last FY25) | Public Works |
| Drains | 2 | – | retired (last FY21) | Public Works |
| Tree | 2 | – | retired (last FY18) | Public Works |
| Health | 4 | 3 | stable | Health & Human Services |
| Council on Aging | 5 | 12 | stable | Health & Human Services |
| Veterans Agent | 1 | 1 | stable | Health & Human Services |
| Health Anti-Smoking | 5 | – | retired (last FY12) | Health & Human Services |
| Library | 29 | 27 | stable | Culture & Recreation |
| Park | 19 | 26 | stable | Culture & Recreation |

**Quarantine (shown separately, never in the slope chart):**
- Election & Registration 62→25 (poll workers, election-cycle).
- Park Revolving Fund 4→41, COA Revolving Fund (gone FY20), COA Donation Fund (gone FY22) — seasonal/program staff.
- Light Department (MMLD) enterprise: Light Department 2→5, plus `554 Maint of Misc Pwr Gen`, `586 Meter-Union`, `593 Overhead Lines (Mgmt/Union)`, `594 Underground Lines`, `Meter-Mgmt`, `Meter Reader`, `Distribution-Mgmt`, `Supervision-Mgmt`, and **(verify)** `Admin & General` 3→3 and `Cust Records` 6→2.

**Excluded as parsing artifacts (documented in the YAML):** `Total` pseudo-row (FY16–17), `Coffin School` (FY16 only), `Snow Removal` (FY17 only), `Tree Group` (FY15 only).

**Schools (Movement 1 line only, detail deferred via links):** five buildings + Admin & Systemwide + Sch Cust/Maint & Transp + School Revolving Fund + School Grants. Do NOT re-tell the FY23 mystery — link `inside-school-staffing.html` and `enrollment_vs_staffing.html`.

---

### Task 1: Classify ambiguous departments against primary sources

**Files:** none yet (research task; findings feed Task 2).

- [ ] **Step 1: Confirm the Light/MMLD account set.** The electric utility is the independent municipal enterprise (already an aside on `org-chart.html`). Verify which `5xx`/meter/distribution/admin accounts are MMLD vs town.

Run:
```bash
grep -ri "municipal light\|MMLD\|electric\|customer records\|administration and general" \
  data/town_docs/annual_reports/ STYLE_GUIDE.md 2>/dev/null | head
grep -n "Admin & General\|ADMIN & GENERAL\|CUST RECORDS\|Customer" _data/org_chart.yml data/SOURCE_LOOKUP.md 2>/dev/null
```
Expected: evidence that `Admin & General`, `Cust Records`, and the `5xx`/meter/distribution accounts are MMLD (utility uniform system of accounts), confirming they belong in the Light enterprise quarantine, not General Government.

- [ ] **Step 2: Decide each consolidation's wording.** For each retired line (Engineering, Drains, Tree, Animal Inspector, Health Anti-Smoking, Town Counsel), record whether a primary source states where the function went. If yes, cite it. If no, the page states only "no longer appears as a separate line after FYxx" — no asserted destination.

Run:
```bash
grep -ri "engineering\|animal inspector\|drains\|tree warden\|anti-smoking\|town counsel" \
  data/town_docs/annual_reports/Annual-Report-2024.txt 2>/dev/null | head
```
Expected: a yes/no per line. Default to line-ended-only when unconfirmed.

- [ ] **Step 3: Write the classification decisions into the plan margin / commit note.** No code; this locks Task 2's band assignments. Commit nothing yet.

---

### Task 2: Curated data file `_data/town_staffing.yml`

**Files:**
- Create: `_data/town_staffing.yml`

- [ ] **Step 1: Write the data file** mirroring the `_data/org_chart.yml` header/sourcing style.

```yaml
# Marblehead municipal workforce over time, FY2008–FY2026.
#
# Source: data/town_employee_headcount_FY08-26.csv and
#   data/town_employee_headcount_summary_FY08-26.csv, derived from
#   data/employee_count_FY2008-2026.xls (town payroll Employee Earnings
#   History reports), released via public records request, RAO Kyle A.
#   Wiley, April 28, 2026 response to request dated April 10, 2026.
#
# HEADCOUNT, not FTE: counts every paid employee regardless of pay
# frequency (annual, weekly, on-call, seasonal). A 0.1 FTE substitute
# counts as 1. Year-over-year deltas are reliable (consistent method);
# absolute levels are not FTE-weighted.
#
# Excluded as parsing artifacts (subtotal/relabel residue in the raw extract):
#   Total (FY16–17), Coffin School (FY16), Snow Removal (FY17), Tree Group (FY15).
#
# Classification of Light Department (MMLD) accounts verified in Task 1
# against <SOURCE FROM TASK 1>.

meta:
  source_url: "data/employee_count_FY2008-2026.xls"
  source_label: >-
    Town of Marblehead payroll Employee Earnings History reports FY2008–FY2026,
    released by Records Access Officer Kyle A. Wiley, April 28, 2026.
  caveat: "Headcount, not FTE. Year-over-year deltas reliable; absolute levels not FTE-weighted."
  fy_first: 2008
  fy_last: 2026

# Movement 1: three lines.
series:
  fys:     [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]
  total:   [999,1097,1167,1151,1088,1119,1169,1163,1167,1162,1163,1212,1143,1069,1157,1183,1122,1145,1020]
  town:    [393,429,438,447,420,432,444,423,429,449,459,473,434,392,452,484,458,470,394]
  schools: [606,668,729,704,668,687,725,740,738,713,704,739,709,677,705,699,664,675,626]

# Movement 2: town-only "then vs now". status: stable | new | retired.
bands:
  - name: "General Government"
    departments:
      - { name: "Selectmen",                fy08: 9, fy26: 6, status: stable }
      - { name: "Finance Department",       fy08: 6, fy26: 9, status: stable }
      - { name: "Assessors",                fy08: 3, fy26: 3, status: stable }
      - { name: "Town Clerk",               fy08: 2, fy26: 3, status: stable }
      - { name: "Human Resources",          fy26: 3, status: new,     since: 2022 }
      - { name: "Community Dev & Planning", fy26: 5, status: new,     since: 2018 }
      - { name: "Town Counsel",             status: retired, span: "FY09–FY13" }
  - name: "Public Safety"
    departments:
      - { name: "Police",                fy08: 76, fy26: 68, status: stable }
      - { name: "Fire",                  fy08: 43, fy26: 40, status: stable }
      - { name: "Harbormaster",          fy08: 11, fy26: 17, status: stable }
      - { name: "Building Commissioner", fy08: 8,  fy26: 10, status: stable }
      - { name: "Animal Inspector",      status: retired, last: 2016 }
  - name: "Public Works"
    departments:
      - { name: "Highway",            fy08: 16, fy26: 22, status: stable }
      - { name: "Water",              fy08: 12, fy26: 17, status: stable }
      - { name: "Sewer",              fy08: 12, fy26: 10, status: stable }
      - { name: "Waste Coll/Disposal",fy08: 7,  fy26: 9,  status: stable }
      - { name: "Cemetery",           fy08: 9,  fy26: 9,  status: stable }
      - { name: "Public Buildings",   fy08: 5,  fy26: 6,  status: stable }
      - { name: "Engineering",        status: retired, last: 2025 }
      - { name: "Drains",             status: retired, last: 2021 }
      - { name: "Tree",               status: retired, last: 2018 }
  - name: "Health & Human Services"
    departments:
      - { name: "Health",              fy08: 4, fy26: 3,  status: stable }
      - { name: "Council on Aging",    fy08: 5, fy26: 12, status: stable }
      - { name: "Veterans Agent",      fy08: 1, fy26: 1,  status: stable }
      - { name: "Health Anti-Smoking", status: retired, last: 2012 }
  - name: "Culture & Recreation"
    departments:
      - { name: "Library", fy08: 29, fy26: 27, status: stable }
      - { name: "Park",    fy08: 19, fy26: 26, status: stable }

# Movement 3: quarantine. Each gets its own caveat on the page.
quarantine:
  - { name: "Election & Registration", fy08: 62, fy26: 25,
      caveat: "Poll workers; swings by election cycle, not a staffing trend." }
  - { name: "Park Revolving Fund", fy08: 4, fy26: 41,
      caveat: "Seasonal and program staff funded by program fees." }
  - { name: "Light Department (MMLD) and sub-accounts", fy08: 27, fy26: 25,
      caveat: "Independent municipal electric enterprise; internal account restructuring, not a town-admin change. Sum across all MMLD accounts." }

excluded_artifacts:
  - { name: "Total",        reason: "Captured subtotal row, FY16–17." }
  - { name: "Coffin School",reason: "Single-year FY16 relabel artifact." }
  - { name: "Snow Removal", reason: "Single-year FY17, peak 1." }
  - { name: "Tree Group",   reason: "Single-year FY15, peak 1." }
```

- [ ] **Step 2: Verify YAML parses and values match the CSV.**

Run:
```bash
ruby -ryaml -e 'YAML.load_file("_data/town_staffing.yml"); puts "YAML OK"'
# Spot-check three values against source:
awk -F, '$1==2008 && $2=="POLICE"{print "Police FY08="$3}
         $1==2026 && $2=="COUNCIL ON AGING"{print "COA FY26="$3}' \
  data/town_employee_headcount_FY08-26.csv
```
Expected: `YAML OK`, `Police FY08=76`, `COA FY26=12` — matching the YAML.

- [ ] **Step 3: Commit.**
```bash
git add _data/town_staffing.yml
git commit -m "data: curated town_staffing.yml for staffing-over-time page"
```

---

### Task 3: Page skeleton + Movement 1 (trend lines)

**Files:**
- Create: `town-staffing-over-time.html`
- Reference pattern: `charts/enrollment_vs_staffing.html` (lines 102–127 = line-chart SVG), `org-chart.html` (frontmatter, page-lead, TOC, cross-link conventions).

- [ ] **Step 1: Write frontmatter + intro + cross-link to org-chart.**

```html
---
title: "How Marblehead's workforce has changed"
scripts: [citations]
og_title: "How Marblehead's workforce has changed"
og_description: "Marblehead's municipal workforce over 19 years: which functions the town added, retired, grew, and shrank between FY2008 and FY2026."
og_url: https://marbleheaddata.org/town-staffing-over-time.html
---
<h1>How Marblehead's workforce has changed</h1>

<p class="page-lead">The <a href="/org-chart.html">org chart</a> shows who runs Marblehead today. This is how that workforce got here: 19 years of town payroll, by department.</p>
```

- [ ] **Step 2: Add the Movement 1 multi-line SVG**, looping over `site.data.town_staffing.series` to build polyline `points`. Geometry: `viewBox="0 0 740 220"`, x-axis FY08→FY26 maps `x = 70 + (fy - 2008) * 30` (FY08=70 … FY26=610); y maps headcount with `y = 180 - (v - 350) * 150 / 900` (so 350→180, 1250→30). Three series: Total (`s-neutral data-line--bold`), Town (`s-marblehead`), Schools (`s-stoneham`). Use the existing `axis-base`, `tick`, `tick-label`, `tick-label--major/minor`, `end-label`, `annotation`, `annotation--hide-sm` classes. Build each polyline with a Liquid capture loop:

```liquid
{% assign s = site.data.town_staffing.series %}
{% capture total_pts %}{% for fy in s.fys %}{% assign i = forloop.index0 %}{% assign v = s.total[i] %}{{ 70 | plus: fy | minus: 2008 | times: 30 | minus: 0 }}{% comment %}x{% endcomment %} {% endfor %}{% endcapture %}
```
(The executor computes x as `70 + (fy-2008)*30` and y as `180 - (v-350)*150/900` per point; assemble `"x,y x,y ..."`. Round to integers. Anchor checks: Total FY19=1212→`x=400,y=36`; Town FY08=393→`x=70,y=173`; Schools FY26=626→`x=610,y=134`.)

Caption below the chart (neutral, with caveat and COVID note):
```html
<p class="chart-label">Town and school payroll headcount, FY2008–FY2026.<sup class="cite" data-href="data/town_employee_headcount_summary_FY08-26.csv" data-source="Town of Marblehead payroll Employee Earnings History reports; released by RAO Kyle A. Wiley, April 28, 2026."></sup> Headcount, not <abbr class="g" title="Full-Time Equivalent">FTE</abbr>. The FY2021 dip tracks the pandemic year.</p>
```

- [ ] **Step 3: Verify line values render and no markup guardrail is violated.**

Run:
```bash
grep -n 'viewBox="0 0 740 220"' town-staffing-over-time.html        # chart present
grep -n 'style="' town-staffing-over-time.html | grep -i 'svg\|line\|circle\|text'  # expect: no inline SVG styles
grep -nP '\xe2\x80\x94|&mdash;|&ndash;.*&ndash;' town-staffing-over-time.html  # expect: no em-dash; no en-dash-as-separator
```
Expected: chart line found; no inline SVG `style=`; no em-dash.

- [ ] **Step 4: Commit.**
```bash
git add town-staffing-over-time.html
git commit -m "feat: town-staffing-over-time page skeleton + workforce trend lines"
```

---

### Task 4: Dumbbell CSS in `assets/site.css`

**Files:**
- Modify: `assets/site.css` (append a scoped block; find the existing chart-class block first with `grep -n "\.data-line" assets/site.css`).

- [ ] **Step 1: Add dumbbell classes** (no inline styles allowed on the SVG, so every visual goes here). Use existing color tokens.

```css
/* Town staffing "then vs now" dumbbell rows */
.dumbbell-track { stroke: var(--c-line); stroke-width: 1; }
.dumbbell-connector { stroke: var(--c-navy); stroke-width: 2; }
.dumbbell-dot--then { fill: var(--c-fog); stroke: var(--c-navy); stroke-width: 1.5; }
.dumbbell-dot--now { fill: var(--c-navy); }
.dumbbell-dot--new { fill: var(--c-sage); }
.dumbbell-dot--retired { fill: none; stroke: var(--c-buoy); stroke-width: 1.5; stroke-dasharray: 2 2; }
.dumbbell-label { font-size: 11px; fill: var(--c-text); }
.dumbbell-value { font-size: 10px; fill: var(--c-muted); }
.dumbbell-band-title { font-size: 13px; font-weight: 600; fill: var(--c-text); }
```
(Confirm token names against the `:root` block — `grep -n "\-\-c-line\|--c-muted\|--c-text" assets/site.css`; substitute the actual token if a name differs.)

- [ ] **Step 2: Verify the tokens resolve.**
```bash
grep -n "\-\-c-navy\|--c-sage\|--c-buoy\|--c-fog" assets/site.css | head
```
Expected: each token is defined in `:root` (light) and the dark-mode block.

- [ ] **Step 3: Commit.**
```bash
git add assets/site.css
git commit -m "style: dumbbell chart classes for town-staffing page"
```

---

### Task 5: Movement 2 — grouped "then vs now" dumbbell chart

**Files:**
- Modify: `town-staffing-over-time.html`

- [ ] **Step 1: Render one SVG per band**, looping `site.data.town_staffing.bands`. Shared horizontal scale 0→80 for honest cross-department comparison: `x(v) = 60 + v * 600 / 80` (left pad 60 for labels, track width 600, so v=0→60, v=80→660; viewBox width 740). Each department is a row at `y = 20 + deptIndex * 22`. For `stable`: draw a `dumbbell-connector` from `x(fy08)` to `x(fy26)`, a `dumbbell-dot--then` at fy08 and `dumbbell-dot--now` at fy26, a `dumbbell-label` (name) at x=4, and `dumbbell-value` labels `{{fy08}}` / `{{fy26}}` at the dots. For `new`: a single `dumbbell-dot--new` at `x(fy26)` with label "new FY{{since|slice:2,2}}". For `retired`: a single `dumbbell-dot--retired` at the left with label "ended {{last|...}}" / "{{span}}".

Liquid skeleton (executor fills coordinates with the formula above):
```liquid
{% for band in site.data.town_staffing.bands %}
<figure class="dumbbell-band">
  <figcaption class="chart-label">{{ band.name }}</figcaption>
  <svg class="chart" viewBox="0 0 740 {{ band.departments.size | times: 22 | plus: 30 }}" role="img"
       aria-label="{{ band.name }}: town department headcount FY2008 versus FY2026.">
    {% for d in band.departments %}
      {% assign y = forloop.index0 | times: 22 | plus: 20 %}
      <text class="dumbbell-label" x="4" y="{{ y | plus: 4 }}">{{ d.name }}</text>
      {% if d.status == "stable" %}
        {% assign x0 = d.fy08 | times: 600 | divided_by: 80 | plus: 60 %}
        {% assign x1 = d.fy26 | times: 600 | divided_by: 80 | plus: 60 %}
        <line class="dumbbell-connector" x1="{{x0}}" y1="{{y}}" x2="{{x1}}" y2="{{y}}"/>
        <circle class="dumbbell-dot--then" cx="{{x0}}" cy="{{y}}" r="4"/>
        <circle class="dumbbell-dot--now"  cx="{{x1}}" cy="{{y}}" r="4"/>
        <text class="dumbbell-value" x="{{ x1 | plus: 8 }}" y="{{ y | plus: 3 }}">{{ d.fy08 }}&#8594;{{ d.fy26 }}</text>
      {% elsif d.status == "new" %}
        {% assign x1 = d.fy26 | times: 600 | divided_by: 80 | plus: 60 %}
        <circle class="dumbbell-dot--new" cx="{{x1}}" cy="{{y}}" r="4"/>
        <text class="dumbbell-value" x="{{ x1 | plus: 8 }}" y="{{ y | plus: 3 }}">new FY{{ d.since | modulo: 100 }}, {{ d.fy26 }}</text>
      {% else %}
        <circle class="dumbbell-dot--retired" cx="64" cy="{{y}}" r="4"/>
        <text class="dumbbell-value" x="76" y="{{ y | plus: 3 }}">{% if d.span %}{{ d.span }}{% else %}ended FY{{ d.last | modulo: 100 }}{% endif %}</text>
      {% endif %}
    {% endfor %}
  </svg>
</figure>
{% endfor %}
```

- [ ] **Step 2: Add the section's prose** above the chart — the structural narrative. State each retired line as fact ("no longer appears as a separate line after FYxx"); assert a destination only if Task 1 found a primary source. Name HR and Community Dev & Planning as the two functions that did not exist in FY08. No value words.

- [ ] **Step 3: Verify each rendered value matches the YAML/CSV.**
```bash
# After a value spot-check by eye on preview, confirm source agreement:
awk -F, '$1==2026 && $2=="HIGHWAY"{print "Highway FY26="$3}
         $1==2008 && $2=="LIBRARY"{print "Library FY08="$3}' data/town_employee_headcount_FY08-26.csv
grep -c "dumbbell-band" town-staffing-over-time.html   # expect: 5 bands
```
Expected: `Highway FY26=22`, `Library FY08=29`; 5 band figures.

- [ ] **Step 4: Commit.**
```bash
git add town-staffing-over-time.html
git commit -m "feat: then-vs-now dumbbell chart by function"
```

---

### Task 6: Movement 3 — quarantine block + school links

**Files:**
- Modify: `town-staffing-over-time.html`

- [ ] **Step 1: Render the quarantine** as a clearly-labeled section (heading like "Lines that move for other reasons"), looping `site.data.town_staffing.quarantine`. Each item shows its FY08→FY26 delta and its `caveat` inline. Make explicit these are excluded from the trend above.

```liquid
<section class="staffing-quarantine">
  <h2 id="other-lines">Lines that move for other reasons</h2>
  <p>These payroll lines change for reasons other than town staffing decisions, so they sit apart from the chart above.</p>
  {% for q in site.data.town_staffing.quarantine %}
  <div class="org-card">
    <span class="org-card-dept">{{ q.name }}</span>
    <span class="org-card-fte">{{ q.fy08 }}&#8594;{{ q.fy26 }}</span>
    <p class="org-card-note">{{ q.caveat }}</p>
  </div>
  {% endfor %}
</section>
```

- [ ] **Step 2: Add the schools deferral.** A short paragraph: schools are the larger half of the workforce (the schools line in Movement 1); the school-staffing story (the FY23 reporting change, enrollment vs staffing) is told in depth elsewhere. Link `inside-school-staffing.html` and `charts/enrollment_vs_staffing.html`. Do not restate the numbers analysis.

- [ ] **Step 3: Verify links resolve and artifacts are disclosed.**
```bash
grep -o 'href="/inside-school-staffing.html"\|href="charts/enrollment_vs_staffing.html"\|href="/charts/enrollment_vs_staffing.html"' town-staffing-over-time.html
grep -c "org-card-dept" town-staffing-over-time.html   # expect: 3 quarantine cards
```
Expected: both school links present; 3 quarantine cards.

- [ ] **Step 4: Commit.**
```bash
git add town-staffing-over-time.html
git commit -m "feat: quarantine block + school-staffing cross-links"
```

---

### Task 7: Cross-links and discoverability

**Files:**
- Modify: `org-chart.html` (add a link to the new page near the snapshot note at line ~40 or line ~249).
- Modify: `index.html` (add a question-card linking the page, following the existing card pattern — `grep -n "question" index.html` to find the grid).

- [ ] **Step 1: Link org-chart → this page.** In `org-chart.html`, where the FY26 snapshot is described, add: `<a href="/town-staffing-over-time.html">How this workforce has changed over 19 years</a>`.

- [ ] **Step 2: Add an index card** matching the existing markup exactly (copy a neighboring `.question` card, no `tag` unless it warrants the Chart pill — it has charts, so use `<span class="tag tag-charts">Chart</span>` per STYLE_GUIDE).

- [ ] **Step 3: Verify both references exist.**
```bash
grep -c 'town-staffing-over-time.html' org-chart.html index.html
```
Expected: at least 1 in each file.

- [ ] **Step 4: Commit.**
```bash
git add org-chart.html index.html
git commit -m "feat: link town-staffing-over-time from org-chart and home"
```

---

### Task 8: Final guardrail sweep, push, PR

**Files:** none (verification + delivery).

- [ ] **Step 1: Run the full guardrail sweep.**
```bash
# No em-dash / en-dash-as-separator anywhere in new/changed copy:
grep -nP '\xe2\x80\x94|&mdash;' town-staffing-over-time.html _data/town_staffing.yml
# No inline styles on SVG elements:
grep -nE '<(svg|line|circle|polyline|path|text|rect)[^>]*style=' town-staffing-over-time.html
# First-use acronyms wrapped in abbr.g (FTE etc.):
grep -n 'FTE' town-staffing-over-time.html | head
```
Expected: first two commands print nothing; FTE wrapped in `<abbr class="g">` on first use.

- [ ] **Step 2: Push and open the PR.**
```bash
git push -u origin worktree-town-staffing-over-time
```
Then open a PR with the GitHub MCP (`mcp__github__create_pull_request`), per CLAUDE.md "Always open a PR after pushing."

- [ ] **Step 3: Visual review on the Cloudflare preview.** Pull the `preview-url` sticky comment's Branch URL, load `/town-staffing-over-time.html`, and confirm: line chart not clipped by viewBox, dumbbell rows readable on mobile width, labels not colliding, dark mode renders (tokens, not hard-coded colors). Report the preview URL to Andrew for eyeball before merge.

- [ ] **Step 4: Update CLAUDE/catalog if needed.** Add a one-line pointer in `data/DATA_CATALOG.md` to the new page under the headcount dataset entry (optional; source is already cataloged).

---

## Self-Review

**Spec coverage:**
- Three movements (arc / slope / quarantine) → Tasks 3, 5, 6. ✓
- Curated `_data/town_staffing.yml` → Task 2. ✓
- Data-artifact exclusion with reasons → Task 2 YAML `excluded_artifacts`. ✓
- Headcount-not-FTE caveat at the numbers → Task 3 caption, Task 2 meta. ✓
- Vanished-line = fact, destination = verify-or-omit → Task 1 + Task 5 Step 2. ✓
- School detail deferred via links, not duplicated → Task 6 Step 2. ✓
- Quarantine shown but fenced → Task 6. ✓
- Cross-link to/from org-chart → Task 7. ✓
- STYLE_GUIDE / em-dash / inline-style guardrails → Tasks 3, 4, 8. ✓
- Refinement vs spec: schools moved from the slope chart into the Movement 1 line (shared-axis scale problem); intent (schools totals shown, detail deferred) preserved. Flagged to user at handoff.

**Placeholder scan:** Coordinate values are given as formulas with worked anchor checks rather than 57 hand-placed points; acceptable because the Liquid loop computes them deterministically and the anchors verify correctness. `<SOURCE FROM TASK 1>` in the YAML header is intentionally filled by Task 1 before Task 2 commits.

**Type consistency:** YAML keys (`status` values `stable`/`new`/`retired`; `fy08`/`fy26`/`since`/`last`/`span`) are used identically in Task 2 (definition) and Task 5 (consumption). Class names (`dumbbell-*`) defined in Task 4 match those used in Task 5.
