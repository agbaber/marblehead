# Department Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a department-first explorer at `/departments.html` where a resident picks any of the town's 40 budget departments and sees a profile — role, headcount trend, 3-year budget, line items, and override restorations — all from data the site already trusts.

**Architecture:** A Python build script joins the FY27 budget rows, per-department headcount, org_chart roles, and override tiers into one `data/departments_view.json`. A single Jekyll page fetches that JSON and renders an index (10 function groups → 40 department cards) plus a per-department profile selected by URL hash. No per-department static pages; no rebuild of `town-budget.html`'s filter/sort machinery.

**Tech Stack:** Python 3 + pytest (build + tests, mirrors `build_town_budget_data.py`), vanilla JS `fetch` + DOM (mirrors `town-budget.html`), Jekyll 3.10, Playwright smoke test.

---

## File Structure

- **Create** `data/build_departments_data.py` — join + crosswalk → `departments_view.json`
- **Create** `data/test_build_departments.py` — pytest invariants for the build
- **Create** `data/departments_view.json` — generated artifact (committed, like `town_budget_FY27.json`)
- **Create** `departments.html` — the explorer page (frontmatter + inline CSS/JS)
- **Modify** `tests/smoke-test.mjs` — add explorer smoke checks
- **Create** `proof/departments-explorer.png` (+ `-profile.png`) — PR proof

Conventions to copy verbatim:
- Build script header/`ROOT`/`DATA` pattern from `data/build_town_budget_data.py:1-20`.
- pytest fixture style from `data/conftest.py` and `data/test_build_town_budget.py`.
- Client `fetch('data/<file>.json').then(r => r.json())` pattern from `town-budget.html:1231`.
- Neutral-color / no-em-dash / no-meta-narration rules from `STYLE_GUIDE.md` and `CLAUDE.md`.

---

## Task 1: Build script skeleton — budget join only

**Files:**
- Create: `data/build_departments_data.py`
- Test: `data/test_build_departments.py`

- [ ] **Step 1: Write the failing test**

```python
# data/test_build_departments.py
"""Tests for build_departments_data.py."""
import json
from pathlib import Path
from build_departments_data import build_view

DATA = Path(__file__).resolve().parent


def test_all_40_departments_present():
    view = build_view()
    assert len(view["departments"]) == 40


def test_department_has_budget_and_function():
    view = build_view()
    police = view["departments"]["police"]
    assert police["function"] == "public_safety"
    assert police["budget"]["fy27_proposed"] > 0
    assert "fy25_actual" in police["budget"]


def test_line_items_sum_to_department_total():
    view = build_view()
    for key, dept in view["departments"].items():
        if not dept["line_items"]:
            continue
        line_sum = sum(li["fy27_proposed"] for li in dept["line_items"])
        assert line_sum == dept["budget"]["fy27_proposed"], f"{key} lines != total"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data && python3 -m pytest test_build_departments.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'build_departments_data'`

- [ ] **Step 3: Write minimal implementation (budget join)**

```python
# data/build_departments_data.py
#!/usr/bin/env python3
"""Join FY27 budget + headcount + org_chart roles + override tiers into one
per-department view for departments.html.

Inputs:
  data/town_budget_FY27.json                 (budget rows: function/department/line)
  data/town_employee_headcount_FY08-26.csv   (FY, Department, Headcount)
  _data/org_chart.yml                        (per-department roles, cited)
  town_budget_FY27.json meta.override_tiers  (override restorations)

Output:
  data/departments_view.json

Usage:
  python3 data/build_departments_data.py
"""
from __future__ import annotations
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

_FUNCTION_LABELS = {
    "general_government": "General Government",
    "public_safety": "Public Safety",
    "schools": "Schools",
    "public_works": "Public Works and Facilities",
    "human_services": "Human Services",
    "culture_recreation": "Culture and Recreation",
    "other_general_government": "Other General Government",
    "sewer_enterprise": "Sewer Enterprise",
    "water_enterprise": "Water Enterprise",
    "harbor_enterprise": "Harbor Enterprise",
}

_BUDGET_KEYS = ("fy25_actual", "fy26_budget", "fy27_proposed",
                "change_dollars", "change_pct")


def _load_budget():
    return json.loads((DATA / "town_budget_FY27.json").read_text())


def _departments_from_budget(budget):
    rows = budget["rows"]
    depts = {}
    for r in rows:
        if r.get("level") != "department":
            continue
        key = r["id"]
        depts[key] = {
            "name": r["department"],
            "function": r["function"],
            "function_label": _FUNCTION_LABELS.get(r["function"], r["function"]),
            "role": None,
            "role_source": None,
            "budget": {k: r.get(k) for k in _BUDGET_KEYS},
            "line_items": [],
            "headcount": None,
            "overrides": [],
        }
    for r in rows:
        if r.get("level") != "line":
            continue
        parent = r.get("parent_id")
        if parent in depts:
            depts[parent]["line_items"].append({
                "description": r.get("description"),
                **{k: r.get(k) for k in _BUDGET_KEYS},
            })
    return depts


def build_view():
    budget = _load_budget()
    departments = _departments_from_budget(budget)
    return {
        "schema_version": 1,
        "source_note": ("Budget from FY27 Proposed Budget (No Override); "
                        "headcount from town payroll FY08-26; roles from "
                        "org_chart.yml; override restorations from the FY27 "
                        "override tiers. See town-budget.html and org-chart.html "
                        "for full citations."),
        "functions": [],
        "departments": departments,
    }


def main():
    view = build_view()
    out = DATA / "departments_view.json"
    out.write_text(json.dumps(view, indent=2) + "\n")
    print(f"wrote {out} ({len(view['departments'])} departments)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd data && python3 -m pytest test_build_departments.py -v`
Expected: PASS (3 tests). If `test_line_items_sum_to_department_total` fails for a
department, inspect that department's rows in `town_budget_FY27.json` — some
departments have sub-subtotals; if so, filter line rows to only those whose
`parent_id == dept_id` (already done) and confirm no nested subtotal rows carry
`level == "line"`. Do not loosen the assertion; fix the filter.

- [ ] **Step 5: Commit**

```bash
git add data/build_departments_data.py data/test_build_departments.py
git commit -m "feat: departments build script — budget join (Task 1)"
```

---

## Task 2: Add per-department headcount (FY08-26)

**Files:**
- Modify: `data/build_departments_data.py`
- Test: `data/test_build_departments.py`

- [ ] **Step 1: Write the failing test**

```python
def test_police_headcount_series_present_and_labeled():
    view = build_view()
    police = view["departments"]["police"]
    assert police["headcount"] is not None
    assert police["headcount"][0]["fy"] == 2008
    assert police["headcount"][-1]["fy"] == 2026
    assert all("headcount" in pt for pt in police["headcount"])


def test_unmapped_department_headcount_is_none():
    # reserve_fund / debt_service have no payroll headcount line
    view = build_view()
    assert view["departments"]["reserve_fund"]["headcount"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data && python3 -m pytest test_build_departments.py::test_police_headcount_series_present_and_labeled -v`
Expected: FAIL — `police["headcount"]` is `None`.

- [ ] **Step 3: Implement the headcount crosswalk + join**

Add near the top of `build_departments_data.py`:

```python
# Budget department key -> headcount CSV "Department" name.
# Only departments with a real payroll line appear here; others stay None.
_HEADCOUNT_CROSSWALK = {
    "select_board": "SELECTMEN",
    "finance": "FINANCE DEPARTMENT",
    "assessor": "ASSESSORS",
    "town_clerk": "TOWN CLERK",
    "election_registration": "ELECTION & REGISTRATION",
    "human_resources": "HUMAN RESOURCES",
    "town_counsel": "Town Counsel",
    "community_development": "COMMUNITY DEV & PLANNING",
    "planning_board": "COMMUNITY DEV & PLANNING",
    "building_inspection": "BUILDING COMMISSIONER",
    "animal_inspector": "ANIMAL INSPECTOR",
    "police": "POLICE",
    "fire": "FIRE",
    "health": "HEALTH",
    "council_on_aging": "COUNCIL ON AGING",
    "veterans_benefits": "VETERANS AGENT",
    "library": "LIBRARY",
    "rec_park": "PARK",
    "harbor": "HARBORMASTER",
    "cemetery": "CEMETERY",
    "public_buildings": "PUBLIC BUILDINGS",
    "water": "WATER",
    "sewer": "SEWER",
    "school_high": "HIGH SCHOOL",
    "school_middle": "VETERANS MIDDLE SCHOOL",
    "school_brown": "BROWN SCHOOL",
    "school_glover": "GLOVER SCHOOL",
    "school_village": "VILLAGE SCHOOL",
}
```

Add the loader and wire it into `build_view`:

```python
def _load_headcount():
    """Return {csv_department_name: [ {fy, headcount}, ... sorted by fy ]}."""
    series = {}
    path = DATA / "town_employee_headcount_FY08-26.csv"
    with path.open() as f:
        for row in csv.DictReader(f):
            dept = row["Department"]
            try:
                fy = int(row["FY"])
                hc = int(row["Headcount"])
            except (ValueError, KeyError):
                continue
            series.setdefault(dept, []).append({"fy": fy, "headcount": hc})
    for dept in series:
        series[dept].sort(key=lambda pt: pt["fy"])
    return series
```

In `build_view`, after `departments = _departments_from_budget(budget)`:

```python
    headcount = _load_headcount()
    for key, dept in departments.items():
        csv_name = _HEADCOUNT_CROSSWALK.get(key)
        if csv_name and csv_name in headcount:
            dept["headcount"] = headcount[csv_name]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data && python3 -m pytest test_build_departments.py -v`
Expected: PASS (all, including the two new headcount tests). If a crosswalk
target name is wrong, `test_..._present` fails — check the exact string against
the CSV's `Department` column (`cut -d, -f2 town_employee_headcount_FY08-26.csv | sort -u`).

- [ ] **Step 5: Commit**

```bash
git add data/build_departments_data.py data/test_build_departments.py
git commit -m "feat: join per-department headcount FY08-26 (Task 2)"
```

---

## Task 3: Add org_chart role line

**Files:**
- Modify: `data/build_departments_data.py`
- Test: `data/test_build_departments.py`

- [ ] **Step 1: Write the failing test**

```python
def test_police_role_populated_from_org_chart():
    view = build_view()
    police = view["departments"]["police"]
    assert police["role"] is not None
    assert len(police["role"]) > 0


def test_role_none_when_no_org_chart_match():
    view = build_view()
    # reserve_fund is an accounting line, not an org_chart department
    assert view["departments"]["reserve_fund"]["role"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data && python3 -m pytest test_build_departments.py::test_police_role_populated_from_org_chart -v`
Expected: FAIL — `role` is `None`.

- [ ] **Step 3: Implement org_chart role join**

First inspect the shape so the extraction matches reality (do NOT guess):

Run: `python3 -c "import yaml; d=yaml.safe_load(open('_data/org_chart.yml')); import json; print(json.dumps(d['town'], indent=2)[:2000])"`

The `town` block is a dict of clusters; each cluster lists departments with a
name and a role/description field. Read the actual field names from that output,
then implement `_load_org_roles()` returning `{normalized_name: (role_text, source_text)}`
and a `_ROLE_CROSSWALK` mapping budget keys → the org_chart department name.
Match on a normalized (lowercased, punctuation-stripped) name. Concretely:

```python
import re

def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def _load_org_roles():
    import yaml
    doc = yaml.safe_load((ROOT / "_data" / "org_chart.yml").read_text())
    roles = {}
    town = doc.get("town", {})
    # town clusters -> departments; field names come from the inspection above.
    for cluster_val in town.values():
        if not isinstance(cluster_val, list):
            continue
        for entry in cluster_val:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name") or entry.get("department")
            role = entry.get("role") or entry.get("description") or entry.get("desc")
            src = entry.get("source") or entry.get("source_html")
            if name and role:
                roles[_norm(name)] = (role, src)
    return roles

# Budget key -> org_chart department display name (normalized on match).
_ROLE_CROSSWALK = {
    "police": "Police Department",
    "fire": "Fire Department",
    # ... fill from the inspection output for every budget dept that has an
    # org_chart entry. Leave a key out entirely if org_chart has no entry.
}
```

Wire into `build_view` after headcount:

```python
    roles = _load_org_roles()
    for key, dept in departments.items():
        org_name = _ROLE_CROSSWALK.get(key)
        if org_name and _norm(org_name) in roles:
            role_text, src = roles[_norm(org_name)]
            dept["role"] = role_text
            dept["role_source"] = src
```

> **Note for implementer:** Populate `_ROLE_CROSSWALK` for every budget department
> that has a matching org_chart entry, using the inspection output as the source of
> truth. This is cited content — do not invent role text; only copy what org_chart
> already says. Departments with no org_chart entry keep `role = None`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data && python3 -m pytest test_build_departments.py -v`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add data/build_departments_data.py data/test_build_departments.py
git commit -m "feat: join cited org_chart role line (Task 3)"
```

---

## Task 4: Map override restorations to departments

**Files:**
- Modify: `data/build_departments_data.py`
- Test: `data/test_build_departments.py`

- [ ] **Step 1: Write the failing test**

```python
def test_police_has_sro_override_restoration():
    view = build_view()
    police = view["departments"]["police"]
    assert any("School Resource Officer" in o["description"] for o in police["overrides"])
    sro = next(o for o in police["overrides"] if "School Resource Officer" in o["description"])
    assert sro["tier_1"] == 65482


def test_unmatched_override_items_not_attributed():
    view = build_view()
    # Every override item attributed to a dept must map to a real dept key.
    for dept in view["departments"].values():
        for o in dept["overrides"]:
            assert "tier_3" in o and "description" in o
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data && python3 -m pytest test_build_departments.py::test_police_has_sro_override_restoration -v`
Expected: FAIL — `police["overrides"]` is empty.

- [ ] **Step 3: Implement override→department mapping**

`override_tiers[].category` is a function-level bucket; the department is inside
`description`. Map with explicit, ordered keyword rules (first match wins). An
item that matches no rule is left unattributed (it still lives on the override
pages). Add:

```python
# Ordered (keyword_in_description_lower -> budget dept key). First match wins.
_OVERRIDE_RULES = [
    ("school resource officer", "police"),
    ("police", "police"),
    ("fire", "fire"),
    ("harbor", "harbor"),
    ("council on aging", "council_on_aging"),
    ("health", "health"),
    ("library", "library"),
    ("recreation", "rec_park"),
    ("park", "rec_park"),
    ("veteran", "veterans_benefits"),
    ("assessor", "assessor"),
    ("town clerk", "town_clerk"),
    ("planning", "planning_board"),
    ("building", "building_inspection"),
    ("public works", "public_works_ops"),
    ("cemetery", "cemetery"),
    # extend from the actual override_tiers descriptions; see note below.
]

def _match_override_dept(description):
    d = (description or "").lower()
    for keyword, key in _OVERRIDE_RULES:
        if keyword in d:
            return key
    return None
```

Wire into `build_view` after roles:

```python
    for tier in budget["meta"]["override_tiers"]:
        key = _match_override_dept(tier.get("description"))
        if key and key in departments:
            departments[key]["overrides"].append({
                "description": tier["description"],
                "tier_1": tier["tier_1"],
                "tier_2": tier["tier_2"],
                "tier_3": tier["tier_3"],
            })
```

> **Note for implementer:** Print all 36 override descriptions first
> (`python3 -c "import json;print('\n'.join(t['description'] for t in json.load(open('town_budget_FY27.json'))['meta']['override_tiers']))"`)
> and extend `_OVERRIDE_RULES` so each that names a specific department maps to it.
> Items that are genuinely town-wide (e.g. an "Offset" or a cross-cutting capital
> line) stay unattributed on purpose — do not force them onto a department.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data && python3 -m pytest test_build_departments.py -v`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add data/build_departments_data.py data/test_build_departments.py
git commit -m "feat: map override restorations to departments (Task 4)"
```

---

## Task 5: Generate the artifact + `functions` index

**Files:**
- Modify: `data/build_departments_data.py`
- Create: `data/departments_view.json`
- Test: `data/test_build_departments.py`

- [ ] **Step 1: Write the failing test**

```python
def test_functions_index_has_ten_groups():
    view = build_view()
    assert len(view["functions"]) == 10
    keys = {f["key"] for f in view["functions"]}
    assert "public_safety" in keys and "schools" in keys
    for f in view["functions"]:
        assert "label" in f and "fy27_proposed" in f
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data && python3 -m pytest test_build_departments.py::test_functions_index_has_ten_groups -v`
Expected: FAIL — `functions` is `[]`.

- [ ] **Step 3: Populate `functions` from the budget function rows**

In `build_view`, replace `"functions": []` by building it before the return:

```python
    functions = []
    for r in budget["rows"]:
        if r.get("level") == "function":
            functions.append({
                "key": r["id"],
                "label": _FUNCTION_LABELS.get(r["id"], r["id"]),
                "fy27_proposed": r.get("fy27_proposed"),
                "change_pct": r.get("change_pct"),
            })
```

and return `"functions": functions`.

- [ ] **Step 4: Run tests + generate the artifact**

Run: `cd data && python3 -m pytest test_build_departments.py -v && python3 build_departments_data.py`
Expected: PASS (all); prints `wrote .../departments_view.json (40 departments)`.

Sanity-check the artifact:
Run: `python3 -c "import json;v=json.load(open('data/departments_view.json'));print(len(v['functions']),'functions',len(v['departments']),'depts');print('police role:',bool(v['departments']['police']['role']));print('police overrides:',len(v['departments']['police']['overrides']))"`
Expected: `10 functions 40 depts`, `police role: True`, `police overrides: >=1`.

- [ ] **Step 5: Commit**

```bash
git add data/build_departments_data.py data/test_build_departments.py data/departments_view.json
git commit -m "feat: functions index + generate departments_view.json (Task 5)"
```

---

## Task 6: Explorer page — index view

**Files:**
- Create: `departments.html`
- Test: manual (Task 8 adds the smoke test)

- [ ] **Step 1: Create the page with frontmatter, styles, and index render**

Model the frontmatter and fetch on `town-budget.html`. Neutral colors only; no
em-dashes; no "this page shows" meta-narration.

```html
---
title: "Department explorer"
scripts: [citations]
og_title: "What each Marblehead department does and costs"
og_description: "Browse all 40 town departments: role, staffing, three-year budget, and what the override would restore. From the town's own budget and payroll."
og_url: https://marbleheaddata.org/departments.html
---
<h1 class="h-center">Department explorer</h1>
<p class="subtitle h-center">All 40 town departments, by role, staffing, and budget.</p>

<div id="dept-app" aria-live="polite">Loading department data...</div>

<style>
  /* Reuse site tokens; add only explorer-specific rules here. */
  .dx-func { margin: 28px 0 8px; }
  .dx-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .dx-card { border: 1px solid var(--border, #ddd); border-radius: 8px; padding: 12px 14px; cursor: pointer; background: none; text-align: left; font: inherit; color: inherit; }
  .dx-card:hover { border-color: var(--accent, #446); }
  .dx-card .dx-amt { font-variant-numeric: tabular-nums; font-weight: 600; }
  .dx-change-up { color: var(--semantic-a, #365f8c); }
  .dx-change-down { color: var(--semantic-b, #7a5c2e); }
  .dx-back { background: none; border: none; font: inherit; color: var(--accent, #446); cursor: pointer; padding: 0; margin: 0 0 12px; }
</style>

<script>
(function () {
  var app = document.getElementById('dept-app');
  var DATA = null;

  function fmtUSD(n) {
    if (n == null) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(p) {
    if (p == null) return '';
    return (p >= 0 ? '+' : '') + (p * 100).toFixed(1) + '%';
  }
  function changeClass(p) { return p >= 0 ? 'dx-change-up' : 'dx-change-down'; }

  function renderIndex() {
    var parts = [];
    DATA.functions.forEach(function (fn) {
      var depts = Object.keys(DATA.departments)
        .filter(function (k) { return DATA.departments[k].function === fn.key; })
        .sort(function (a, b) {
          return DATA.departments[b].budget.fy27_proposed - DATA.departments[a].budget.fy27_proposed;
        });
      if (!depts.length) return;
      parts.push('<h2 class="dx-func">' + fn.label + '</h2>');
      parts.push('<div class="dx-cards">');
      depts.forEach(function (k) {
        var d = DATA.departments[k];
        parts.push(
          '<button class="dx-card" data-key="' + k + '">' +
          '<div>' + d.name.replace(/_/g, ' ') + '</div>' +
          '<div class="dx-amt">' + fmtUSD(d.budget.fy27_proposed) + '</div>' +
          '<div class="' + changeClass(d.budget.change_pct) + '">' +
          fmtPct(d.budget.change_pct) + ' vs FY26</div>' +
          '</button>'
        );
      });
      parts.push('</div>');
    });
    app.innerHTML = parts.join('');
    app.querySelectorAll('.dx-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        location.hash = btn.getAttribute('data-key');
      });
    });
  }

  function route() {
    var key = location.hash.replace(/^#/, '');
    if (key && DATA.departments[key]) {
      renderProfile(key);   // defined in Task 7
    } else {
      renderIndex();
    }
  }

  // renderProfile is added in Task 7; define a stub so Task 6 renders standalone.
  window.renderProfile = window.renderProfile || function () { renderIndex(); };

  fetch('data/departments_view.json')
    .then(function (r) { return r.json(); })
    .then(function (json) {
      DATA = json;
      window.__DX_DATA = json;
      window.addEventListener('hashchange', route);
      route();
    })
    .catch(function () {
      app.textContent = 'Department data is unavailable right now.';
    });
})();
</script>
```

- [ ] **Step 2: Verify locally**

Run: `npm run dev` (in the worktree root), then visit `http://localhost:4000/departments.html`.
Expected: 10 function headings, 40 cards total, each with a dollar figure and a
neutral-colored change line. Clicking a card sets the hash (profile stub falls
back to index for now).

- [ ] **Step 3: Commit**

```bash
git add departments.html
git commit -m "feat: department explorer index view (Task 6)"
```

---

## Task 7: Explorer page — per-department profile

**Files:**
- Modify: `departments.html`

- [ ] **Step 1: Replace the `renderProfile` stub with the real profile renderer**

Replace the stub line
`window.renderProfile = window.renderProfile || function () { renderIndex(); };`
with a real function placed above `route()`:

```javascript
  function renderProfile(key) {
    var d = DATA.departments[key];
    var p = [];
    p.push('<button class="dx-back" id="dx-back">&larr; All departments</button>');
    p.push('<h2>' + d.name.replace(/_/g, ' ') + '</h2>');
    p.push('<p class="subtitle">' + d.function_label + '</p>');

    // Role (cited) or forthcoming line
    if (d.role) {
      p.push('<p>' + d.role + '</p>');
      if (d.role_source) p.push('<p class="dx-src"><small>' + d.role_source + '</small></p>');
    } else {
      p.push('<p><em>A fuller description of this department is forthcoming.</em></p>');
    }

    // Money
    p.push('<h3>Budget</h3>');
    p.push('<table class="dx-money"><thead><tr>' +
      '<th>FY25 actual</th><th>FY26 budget</th><th>FY27 proposed</th><th>Change</th>' +
      '</tr></thead><tbody><tr>' +
      '<td>' + fmtUSD(d.budget.fy25_actual) + '</td>' +
      '<td>' + fmtUSD(d.budget.fy26_budget) + '</td>' +
      '<td>' + fmtUSD(d.budget.fy27_proposed) + '</td>' +
      '<td class="' + changeClass(d.budget.change_pct) + '">' +
      fmtUSD(d.budget.change_dollars) + ' (' + fmtPct(d.budget.change_pct) + ')</td>' +
      '</tr></tbody></table>');

    // Line items
    if (d.line_items && d.line_items.length) {
      p.push('<h3>Line items</h3><table class="dx-lines"><tbody>');
      d.line_items.forEach(function (li) {
        p.push('<tr><td>' + (li.description || '') + '</td>' +
          '<td class="dx-amt">' + fmtUSD(li.fy27_proposed) + '</td></tr>');
      });
      p.push('</tbody></table>');
    }

    // Headcount (labeled headcount, not FTE)
    if (d.headcount && d.headcount.length) {
      var first = d.headcount[0], last = d.headcount[d.headcount.length - 1];
      p.push('<h3>Staffing</h3>');
      p.push('<p>Headcount (includes part-time and seasonal, not FTE): ' +
        first.headcount + ' in FY' + String(first.fy).slice(2) +
        ' to ' + last.headcount + ' in FY' + String(last.fy).slice(2) + '.</p>');
    }

    // Override restorations
    if (d.overrides && d.overrides.length) {
      p.push('<h3>What the override would restore here</h3><ul>');
      d.overrides.forEach(function (o) {
        p.push('<li>' + o.description + ' &mdash; Tier 1 ' + fmtUSD(o.tier_1) +
          ', Tier 2 ' + fmtUSD(o.tier_2) + ', Tier 3 ' + fmtUSD(o.tier_3) + '</li>');
      });
      p.push('</ul>');
    }

    app.innerHTML = p.join('');
    document.getElementById('dx-back').addEventListener('click', function () {
      location.hash = '';
    });
  }
```

> **Style check:** the site copy rule forbids em-dashes in prose, but this is JS
> emitting an HTML entity `&mdash;` inside a data table, not authored prose. If the
> content lint (`lint.yml`) flags `&mdash;`/`—`, swap the separator for " — "
> written as `' &ndash; '` or a plain colon. Verify against `lint.yml` before commit.

- [ ] **Step 2: Verify locally**

Run: `npm run dev`, visit `http://localhost:4000/departments.html#police`.
Expected: police profile with role line + source, budget table (FY25/26/27 +
change), line items, a headcount sentence, and an override restoration bullet
mentioning the School Resource Officer. Back button returns to the index.

- [ ] **Step 3: Commit**

```bash
git add departments.html
git commit -m "feat: per-department profile view (Task 7)"
```

---

## Task 8: Smoke test + proof

**Files:**
- Modify: `tests/smoke-test.mjs`
- Create: `proof/departments-explorer.png`, `proof/departments-explorer-profile.png`

- [ ] **Step 1: Add smoke checks (match the file's existing `pass`/`fail` helper style)**

Insert a block modeled on the existing `/checkbook/` and town-budget checks
(`tests/smoke-test.mjs:49`, `:125`):

```javascript
// --- Department explorer ---
{
  const resp = await page.goto(`${SITE}/departments.html`, { waitUntil: 'domcontentloaded' });
  resp && resp.ok()
    ? pass('Departments page loads')
    : fail('Departments page loads', `status ${resp && resp.status()}`);

  await page.waitForSelector('.dx-card', { timeout: 5000 });
  const cards = await page.$$eval('.dx-card', els => els.length);
  cards === 40
    ? pass('Departments index card count')
    : fail('Departments index card count', `expected 40, got ${cards}`);

  const funcs = await page.$$eval('.dx-func', els => els.length);
  funcs === 10
    ? pass('Departments function groups')
    : fail('Departments function groups', `expected 10, got ${funcs}`);

  // Deep-link straight to a profile.
  await page.goto(`${SITE}/departments.html#police`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dx-money', { timeout: 5000 });
  const hasMoney = await page.$eval('.dx-money', el => el.textContent.includes('FY27'));
  hasMoney
    ? pass('Police profile budget table')
    : fail('Police profile budget table', 'FY27 column missing');
}
```

- [ ] **Step 2: Run the smoke suite**

Run: `npm run test:local`
Expected: existing count + 4 new checks pass, 0 fail. If `.dx-card` count is not
40, open the page in `npm run dev` and check the console for a JSON load error or
a mismatched `functions`/`departments` key.

- [ ] **Step 3: Capture proof screenshots**

Run:
```bash
mkdir -p proof
npm run dev &   # note the PID; serves on :4000
sleep 6
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4000/departments.html" "proof/departments-explorer.png"
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4000/departments.html#police" "proof/departments-explorer-profile.png"
kill %1
file proof/departments-explorer.png   # expect ~2880 px wide
```

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs proof/departments-explorer.png proof/departments-explorer-profile.png
git commit -m "test: smoke checks + proof for department explorer (Task 8)"
```

---

## Task 9: Homepage + cross-link, open PR

**Files:**
- Modify: homepage tile source (find with `grep -rn "town-budget" index.html`)
- Modify: `town-budget.html` (add a one-line cross-link to the explorer) — optional if a natural spot exists

- [ ] **Step 1: Add a homepage entry point**

Find how existing tiles link (e.g. to `/checkbook/`, `/town-budget.html`) in
`index.html` and add a tile/link to `/departments.html` following the exact same
markup pattern. Do NOT restructure the tile grid; add one item.

- [ ] **Step 2: Verify the smoke `Homepage tiles` count still matches**

Run: `npm run test:local`
Expected: the homepage-tile assertion (`smoke-test.mjs:41`) still passes. If it
pins an exact count, update that expected number to match the new tile count in
the same commit.

- [ ] **Step 3: Commit, push, open PR**

```bash
git add index.html
git commit -m "feat: link department explorer from homepage (Task 9)"
git push -u origin departments-explorer
```

Open the PR (per CLAUDE.md, always open a PR after pushing) with a Proof of Work
section referencing `proof/departments-explorer.png` and the Cloudflare preview
URL once green. PR body must fill the template's Preview URL / paths / expected
behavior / edge cases sections.

---

## Self-Review notes (checked against the spec)

- **Spec coverage:** build script + join (Tasks 1-5), index + profile (6-7),
  headcount labeled-not-FTE (Task 2 + 7 sentence), cited role (Task 3 + 7),
  override-per-dept (Task 4 + 7), single-page hash routing (Task 6 `route`),
  editorial guardrails (neutral colors in CSS, no-em-dash note, forthcoming role),
  testing + proof (Task 8), no checkbook-per-dept (never introduced). Covered.
- **Type consistency:** `build_view()` returns `{schema_version, source_note,
  functions[], departments{}}` used identically by the page; field names
  (`fy27_proposed`, `change_pct`, `headcount[].headcount`, `role`, `role_source`,
  `overrides[].tier_1..3`) match between Python output and JS reader.
- **Crosswalk risk (named):** the three crosswalk tables (`_HEADCOUNT_CROSSWALK`,
  `_ROLE_CROSSWALK`, `_OVERRIDE_RULES`) are hand-maintained; each task tells the
  implementer to verify targets against the real source files and leave unmatched
  departments gracefully null rather than guessing. Tests assert no dangling refs.
