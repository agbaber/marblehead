# School-age population vs. MPS enrollment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append a new section to `charts/enrollment_vs_staffing.html` that compares US Census ACS school-age population (5-17), MPS resident enrollment, and METCO non-residents over 2010-2024, plus a residual table for "Marblehead kids not in MPS."

**Architecture:** Two new CSVs fetched by two new Python stdlib scripts; one new `<section>` of inline SVG appended to the existing chart page; two doc updates; one smoke-test assertion. No new build steps, no new JS dependencies, no new layouts. The new chart reuses the existing `chart-tooltip` script and `s-*` color classes.

**Tech Stack:** Python 3 stdlib (`urllib.request`, `csv`, `json`) for the two fetch scripts. Inline SVG in a Jekyll page. Playwright for screenshot proof and the smoke-test assertion.

---

## File Structure

**Create:**
- `scripts/fetch_acs_school_age.py` — pulls ACS B01001 5-year estimates for Marblehead, end-years 2010-2023, writes `data/acs_school_age_marblehead.csv`.
- `scripts/fetch_dese_selected_populations.py` — pulls DESE Selected Populations / Enrollment data for Marblehead, school years 2009-10 through 2023-24, writes `data/dese_metco_nonresident.csv`.
- `data/acs_school_age_marblehead.csv` — ACS data, output of fetch script.
- `data/dese_metco_nonresident.csv` — DESE data, output of fetch script.

**Modify:**
- `charts/enrollment_vs_staffing.html` — append one new `<section>` at end of body (before closing `</div>` of `read-next` block). Section contains an `<h2>`, an `<svg.chart>`, a caption, a residual table, and a residual-disclosure paragraph.
- `data/SOURCE_LOOKUP.md` — add Census ACS B01001 and DESE Selected Populations entries.
- `data/DATA_CATALOG.md` — add the two new CSVs.
- `tests/smoke-test.mjs` — add one assertion that the new section's `<h2>` exists when loading `/charts/enrollment_vs_staffing/`.

---

## Spec reference

Working from `docs/superpowers/specs/2026-05-01-school-age-vs-enrollment-design.md`. Key invariants:

- Three series in chart: `s-neutral` = School-age (5-17); `s-marblehead` = MPS resident enrollment; `s-stoneham` = METCO non-residents.
- Same-axis raw counts, no indexing, no dual axis.
- X-axis 2010-2024 (school-age uses ACS end-year; MPS series use FY ending year).
- Residual table = School-age (latest year) − MPS resident (same year) = "Marblehead kids not in MPS"; disclosure that this lumps private + charter + out-of-district SPED + homeschool.
- Editorial: no "shocking", no green/red, ACS MOE disclosed in caption, no meta-narration.
- Cross-check: existing chart's FY24 enrollment = 2,617. Must equal `metco + other_nonresident + mps_resident_enrollment` from new CSV for SY 2023-24 within FY/SY rounding.

---

### Task 1: DESE Selected Populations discovery — RESOLVED

This task was completed inline before subagent dispatch. Findings:

**Path chosen: A (Socrata).** Two MA DESE Socrata datasets used together:

1. **`t8td-gens` — "Enrollment: Grade, Race/Ethnicity, Gender, and Selected Populations"**
   - Endpoint: `https://educationtocareer.data.mass.gov/resource/t8td-gens.json`
   - Coverage: SY 1994 through SY 2026 (latest published).
   - Fields used: `sy`, `dist_code`, `dist_name`, `org_type`, `total_cnt`.
   - Filter for district-level rows: `org_type=District`.
   - **Used for the total_enrollment cross-check only**, not directly plotted.

2. **`8xyg-59b2` — "Reasons for Student Enrollment by Town (Receiving)"**
   - Endpoint: `https://educationtocareer.data.mass.gov/resource/8xyg-59b2.json`
   - Coverage: SY 2014 through SY 2026 (13 years for Marblehead).
   - Fields used: `sy`, `dist_code`, `enr_reason`, `town_name`, `enr_cnt`.
   - This is the row-per-(reason × town) breakdown; aggregate to get district totals.

**Marblehead district code: `01680000`** (NOT `01710000` — that is Marshfield. The plan's earlier placeholder was wrong; corrected throughout).

**`sy` field semantics:** the academic-year-ending year. `sy=2024` means school year 2023-24, which is what Marblehead reports as FY24. The fetch script can treat `sy` as `fy_end_year` directly.

**Categorization logic:**

For each (Marblehead district, school year) row in `8xyg-59b2`:
- If `town_name == "Marblehead"`: count toward `mps_resident_enrollment` (regardless of enr_reason — this includes Resident/Member, parent-paid Tuitioned-In where the family lives in Marblehead, and Foreign Exchange students hosted by Marblehead families).
- Elif `enr_reason == "METCO"`: count toward `metco`.
- Else: count toward `other_nonresident` (school-choice tuitioned-in, in-state district agreements, etc., from non-Marblehead towns).

`total_enrollment = mps_resident + metco + other_nonresident` and must match `t8td-gens` `total_cnt` for the same district + sy within ±1.

**FY24 ground truth (SY 2024) for Marblehead district `01680000`:**

| Field | Count |
|---|---|
| total_enrollment | 2,617 |
| mps_resident | 2,531 |
| metco | 51 |
| other_nonresident | 35 |

This matches the existing chart's hard-coded FY24 value of 2,617 exactly.

**Chart x-axis revision:** Original spec called for 2010-2024. Given:
- ACS 5-year estimates are available for end-years 2010-2023.
- DESE resident/METCO split is available for SY 2014-2026 (FY14-FY26).
- DESE total enrollment is available for FY94+, but the resident split starts at FY14.

**Updated x-axis: 2014-2026 (13 years).** All three series have full coverage on this window with no gaps. School-age line uses ACS end-years 2014-2023 (10 points), with the line not extending to 2024-2026 (latest ACS not yet released; flag in caption). MPS resident and METCO lines use SY 2014-2026 (13 points).

The existing FY01-FY24 chart above this new section provides the longer-arc enrollment context, so cropping the new section to FY14-FY26 loses no information on the page.

---

### Task 2: ACS fetch script

**Files:**
- Create: `scripts/fetch_acs_school_age.py`
- Create: `data/acs_school_age_marblehead.csv` (generated)

- [ ] **Step 1: Write the script**

Create `scripts/fetch_acs_school_age.py` with this content:

```python
#!/usr/bin/env python3
"""Fetch ACS B01001 (Sex by Age) school-age population for Marblehead.

Pulls 5-year ACS estimates for end-years 2010-2023, sums the male and
female counts for ages 5-9, 10-14, and 15-17, and propagates the margins
of error.

Geography: state 25 (MA), county 009 (Essex), county subdivision 38400
(Marblehead town).

Output: data/acs_school_age_marblehead.csv
Source: https://api.census.gov/data/<year>/acs/acs5

ACS 5-year estimates are released in December for end-year YYYY (covering
YYYY-4 to YYYY). Re-run this script when a new vintage is published.

Variables (B01001):
  Male:   B01001_004E (5-9), B01001_005E (10-14), B01001_006E (15-17)
  Female: B01001_028E (5-9), B01001_029E (10-14), B01001_030E (15-17)
  Margins of error use the same numbers with 'M' instead of 'E'.
"""
import csv
import json
import math
import os
import sys
import urllib.parse
import urllib.request

OUT_PATH = "data/acs_school_age_marblehead.csv"
END_YEARS = list(range(2010, 2024))  # 2010..2023 inclusive
STATE = "25"
COUNTY = "009"
COUSUB = "38400"

VARS_E = [
    "B01001_004E", "B01001_005E", "B01001_006E",  # male 5-9, 10-14, 15-17
    "B01001_028E", "B01001_029E", "B01001_030E",  # female 5-9, 10-14, 15-17
]
VARS_M = [v.replace("E", "M") for v in VARS_E]
ALL_VARS = VARS_E + VARS_M

HEADERS = [
    "acs_end_year",
    "ages_5_to_9",
    "ages_10_to_14",
    "ages_15_to_17",
    "total_5_to_17",
    "moe_total",
]


def fetch_year(year: int) -> dict:
    """Return a dict with the six count vars and six MOE vars for Marblehead."""
    base = f"https://api.census.gov/data/{year}/acs/acs5"
    params = {
        "get": ",".join(["NAME"] + ALL_VARS),
        "for": f"county subdivision:{COUSUB}",
        "in": f"state:{STATE} county:{COUNTY}",
    }
    key = os.environ.get("CENSUS_API_KEY")
    if key:
        params["key"] = key
    url = f"{base}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    # data is [headers, row]
    headers, row = data[0], data[1]
    return dict(zip(headers, row))


def compute_row(year: int, raw: dict) -> list:
    """Reduce six male+female counts into 5-9, 10-14, 15-17, total + MOE."""
    a59 = int(raw["B01001_004E"]) + int(raw["B01001_028E"])
    a10 = int(raw["B01001_005E"]) + int(raw["B01001_029E"])
    a15 = int(raw["B01001_006E"]) + int(raw["B01001_030E"])
    total = a59 + a10 + a15

    # MOE for a sum: sqrt(sum of squared component MOEs).
    # ACS-suppressed values may be negative (-555555555 etc.); coerce to 0.
    def safe_moe(v):
        try:
            x = int(v)
            return x if x >= 0 else 0
        except (TypeError, ValueError):
            return 0

    moes = [safe_moe(raw[v]) for v in VARS_M]
    moe_total = round(math.sqrt(sum(m * m for m in moes)))
    return [year, a59, a10, a15, total, moe_total]


def main():
    rows = []
    for year in END_YEARS:
        try:
            raw = fetch_year(year)
            row = compute_row(year, raw)
            print(f"  {year}: 5-17 = {row[4]} (MOE +/- {row[5]})", flush=True)
            rows.append(row)
        except Exception as e:
            print(f"  {year}: FAILED ({e})", file=sys.stderr)

    if not rows:
        print("No rows fetched, refusing to write empty CSV.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for r in rows:
            w.writerow(r)
    print(f"\nWrote {OUT_PATH} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x scripts/fetch_acs_school_age.py
python3 scripts/fetch_acs_school_age.py
```

Expected output: 14 lines like `  2010: 5-17 = 3168 (MOE +/- 184)` followed by `Wrote data/acs_school_age_marblehead.csv (14 rows)`. If a year fails (e.g., 2010 is sometimes geometry-borked), the script logs the error and skips it; that's acceptable — a missing year shows as a gap in the chart line.

- [ ] **Step 3: Spot-check the latest year against data.census.gov**

Open https://data.census.gov/table/ACSDT5Y2023.B01001?g=060XX00US2500938400 and confirm:
- Total male 5-9 + female 5-9 ≈ row's `ages_5_to_9` for 2023.
- Total male 10-14 + female 10-14 ≈ row's `ages_10_to_14` for 2023.
- Total male 15-17 + female 15-17 ≈ row's `ages_15_to_17` for 2023.

If any disagree by more than 1, debug before continuing. (Off-by-one is fine and expected from rounding.)

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch_acs_school_age.py data/acs_school_age_marblehead.csv
git commit -m "Add ACS B01001 school-age population fetch for Marblehead

Pulls 14 years of 5-year ACS estimates (end-years 2010-2023) for
ages 5-9, 10-14, and 15-17, with propagated margins of error."
```

---

### Task 3: DESE Selected Populations fetch script

**Files:**
- Create: `scripts/fetch_dese_selected_populations.py`
- Create: `data/dese_metco_nonresident.csv` (generated)

The script's exact body depends on the path chosen in Task 1. The structure below is for **Path A (Socrata)**. If Task 1 settled on Path B (HTML scrape) or Path C (hand-compiled), adapt the steps accordingly — the output CSV columns and the spot-check are the same.

- [ ] **Step 1: Write the script (Socrata path)**

Replace `<RESOURCE_ID>` with the dataset ID found in Task 1.

```python
#!/usr/bin/env python3
"""Fetch DESE Selected Populations / Enrollment for Marblehead.

Pulls per-school-year total enrollment, METCO non-resident, and other
non-resident counts for the Marblehead district. Computes MPS resident
enrollment as total - METCO - other.

Output: data/dese_metco_nonresident.csv
Source: <fill in URL pattern from Task 1>

DESE district code for Marblehead: 01710000.
Years targeted: SY 2009-10 through SY 2023-24.
"""
import csv
import json
import os
import sys
import urllib.parse
import urllib.request

OUT_PATH = "data/dese_metco_nonresident.csv"
DISTRICT_CODE = "01710000"
SCHOOL_YEARS = [
    "2009-10", "2010-11", "2011-12", "2012-13", "2013-14",
    "2014-15", "2015-16", "2016-17", "2017-18", "2018-19",
    "2019-20", "2020-21", "2021-22", "2022-23", "2023-24",
]

# Replace with the resource ID found in Task 1, e.g. "abcd-1234"
SOCRATA_RESOURCE = "<RESOURCE_ID>"
SOCRATA_BASE = (
    f"https://educationtocareer.data.mass.gov/resource/"
    f"{SOCRATA_RESOURCE}.json"
)

HEADERS = [
    "school_year",
    "district",
    "total_enrollment",
    "metco",
    "other_nonresident",
    "total_nonresident",
    "mps_resident_enrollment",
]


def fetch_district_year(school_year: str) -> dict | None:
    """Return one row from Socrata for Marblehead, given school year, or None."""
    # Field names depend on the dataset; common patterns include
    # `district_code`, `school_year`, `total`, `metco`, `non_resident`, etc.
    # Inspect with: curl 'https://.../<RESOURCE>.json?$limit=1' | jq .
    params = {
        "$where": (
            f"district_code='{DISTRICT_CODE}' AND school_year='{school_year}'"
        ),
        "$limit": "5",
    }
    url = f"{SOCRATA_BASE}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        rows = json.loads(resp.read().decode())
    return rows[0] if rows else None


def parse_row(school_year: str, raw: dict) -> list:
    """Map the Socrata row to our CSV columns. Fill in field names from Task 1."""
    total = int(raw.get("total_enrollment") or raw.get("total") or 0)
    metco = int(raw.get("metco") or raw.get("metco_students") or 0)
    other = int(
        raw.get("other_non_resident")
        or raw.get("school_choice")
        or 0
    )
    nonresident = metco + other
    resident = total - nonresident
    return [
        school_year,
        "Marblehead",
        total,
        metco,
        other,
        nonresident,
        resident,
    ]


def main():
    if SOCRATA_RESOURCE == "<RESOURCE_ID>":
        print(
            "ERROR: SOCRATA_RESOURCE is still a placeholder. "
            "Fill in the resource ID from Task 1.",
            file=sys.stderr,
        )
        sys.exit(1)

    rows = []
    for sy in SCHOOL_YEARS:
        try:
            raw = fetch_district_year(sy)
            if raw is None:
                print(f"  {sy}: no row found", file=sys.stderr)
                continue
            row = parse_row(sy, raw)
            print(
                f"  {sy}: total={row[2]} metco={row[3]} "
                f"other={row[4]} resident={row[6]}",
                flush=True,
            )
            rows.append(row)
        except Exception as e:
            print(f"  {sy}: FAILED ({e})", file=sys.stderr)

    if not rows:
        print("No rows fetched, refusing to write empty CSV.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for r in rows:
            w.writerow(r)
    print(f"\nWrote {OUT_PATH} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Inspect one row of the Socrata dataset before running the full script**

```bash
curl -s "https://educationtocareer.data.mass.gov/resource/<RESOURCE_ID>.json?\$limit=1" | python3 -m json.tool
```

Look at the actual field names returned. Update `parse_row` if they differ from `total_enrollment`, `metco`, etc.

- [ ] **Step 3: Run the script**

```bash
chmod +x scripts/fetch_dese_selected_populations.py
python3 scripts/fetch_dese_selected_populations.py
```

Expected: 15 lines like `  2023-24: total=2617 metco=23 other=2 resident=2592` and a final `Wrote data/dese_metco_nonresident.csv (15 rows)`. Some early years may legitimately be missing — that's fine.

- [ ] **Step 4: Verify the FY24 cross-check against the existing chart**

The existing chart hard-codes `enrollment_FY24 = 2617` (line 28 of `charts/enrollment_vs_staffing.html`, value at index 23 of the values array). Confirm:

```bash
python3 -c "
import csv
with open('data/dese_metco_nonresident.csv') as f:
    rows = list(csv.DictReader(f))
sy24 = next(r for r in rows if r['school_year'] == '2023-24')
total = int(sy24['total_enrollment'])
print(f'CSV total for SY 2023-24: {total}')
print(f'Existing chart FY24:       2617')
print(f'Match: {total == 2617}')
"
```

If not 2617 ±1, investigate. The DESE total enrollment number may differ slightly from the ACFR demographics number used in the existing chart (different snapshot date), but they should be within a handful of students. If they differ by more than 5, document the difference in the caption rather than ignoring it.

Also verify Task 1's hand-confirmed FY24 METCO ground truth against `metco` in the SY 2023-24 row.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_dese_selected_populations.py data/dese_metco_nonresident.csv
git commit -m "Add DESE Selected Populations fetch for Marblehead METCO/resident split

15 years of total enrollment, METCO non-resident, and other non-resident
counts for the Marblehead district. Resident enrollment is total minus
non-resident."
```

---

### Task 4: Compute SVG geometry from the fetched data

The chart cannot be authored until the data is in. This task produces the literal SVG point strings, end labels, and y-axis tick range used by Task 5.

**Files:**
- Temporary local Python; no files committed in this task.

- [ ] **Step 1: Print the chart values for inspection**

```bash
python3 << 'EOF'
import csv

# Load both CSVs.
acs = {}
with open('data/acs_school_age_marblehead.csv') as f:
    for r in csv.DictReader(f):
        acs[int(r['acs_end_year'])] = int(r['total_5_to_17'])

dese = {}
with open('data/dese_metco_nonresident.csv') as f:
    for r in csv.DictReader(f):
        # SY 2023-24 -> end year 2024 (FY24)
        end_year = int(r['school_year'].split('-')[0]) + 1
        dese[end_year] = {
            'total': int(r['total_enrollment']),
            'metco': int(r['metco']),
            'resident': int(r['mps_resident_enrollment']),
        }

# X-axis: 2010..2024 (15 points). For ACS, label = end-year. For DESE, label = FY (= end of SY).
years = list(range(2010, 2025))
print(f"{'year':<6}{'school_age':>12}{'mps_total':>12}{'metco':>8}{'mps_res':>10}")
for y in years:
    a = acs.get(y, '-')
    d = dese.get(y, {})
    print(f"{y:<6}{a:>12}{d.get('total','-'):>12}{d.get('metco','-'):>8}{d.get('resident','-'):>10}")
EOF
```

Inspect the output. Confirm the three series make sense (school-age in the 2,500-3,500 range, MPS resident slightly lower, METCO under ~50).

- [ ] **Step 2: Compute SVG points**

Use this template (adjust y-axis range based on actual data):

```bash
python3 << 'EOF'
import csv

# Load CSVs (same as Step 1).
acs = {}
with open('data/acs_school_age_marblehead.csv') as f:
    for r in csv.DictReader(f):
        acs[int(r['acs_end_year'])] = int(r['total_5_to_17'])
dese = {}
with open('data/dese_metco_nonresident.csv') as f:
    for r in csv.DictReader(f):
        end_year = int(r['school_year'].split('-')[0]) + 1
        dese[end_year] = {
            'total': int(r['total_enrollment']),
            'metco': int(r['metco']),
            'resident': int(r['mps_resident_enrollment']),
        }

# Chart geometry: viewBox 740x200, plot area x=70..610, y=30..170.
# Same conventions as the FY15-FY24 staffing chart on this page.
years = list(range(2010, 2025))
x_left, x_right = 70, 610
y_top, y_bot = 30, 170

# Y axis: cover school-age range (~2500..3500) and MPS range (~2400..3300).
# METCO is ~0..50, will visually flatline at the bottom of this scale.
# That's fine and is editorially accurate (METCO is small).
y_min, y_max = 0, 3500  # round numbers, headroom above max

def x_pos(year):
    n = len(years) - 1
    return round(x_left + (year - years[0]) * (x_right - x_left) / n)

def y_pos(value):
    return round(y_bot - (value - y_min) * (y_bot - y_top) / (y_max - y_min))

x_positions = [x_pos(y) for y in years]
print(f"xPositions: {x_positions}")

def points(series_values):
    # series_values is a list aligned with years; missing -> None
    out = []
    for x, v in zip(x_positions, series_values):
        if v is not None:
            out.append(f"{x},{y_pos(v)}")
    return " ".join(out)

school_age_vals = [acs.get(y) for y in years]
mps_total_vals  = [dese.get(y, {}).get('total') for y in years]
mps_res_vals    = [dese.get(y, {}).get('resident') for y in years]
metco_vals      = [dese.get(y, {}).get('metco') for y in years]

print(f"school_age points:   {points(school_age_vals)}")
print(f"mps_total points:    {points(mps_total_vals)}")
print(f"mps_resident points: {points(mps_res_vals)}")
print(f"metco points:        {points(metco_vals)}")

# End labels (last non-None value of each)
def last(values, years):
    for v, y in reversed(list(zip(values, years))):
        if v is not None:
            return v, y
    return None, None
print(f"school_age end:   {last(school_age_vals, years)}")
print(f"mps_resident end: {last(mps_res_vals, years)}")
print(f"metco end:        {last(metco_vals, years)}")
EOF
```

Save the printed point strings, x-positions, end-label values, and chosen y-axis range. They go directly into Task 5's SVG.

- [ ] **Step 3: Sanity-check the output**

- All four series have ~14-15 points (gaps OK for early ACS years).
- school_age and mps_resident are in roughly the same vertical band.
- metco values are small (sub-50 typically) — they will appear as a near-flat low line.
- y_max (3500 in the template) leaves at least 100 units of headroom above the highest series.

If anything looks off, fix the data files first, not the chart.

- [ ] **Step 4: No commit yet — output is consumed by Task 5.**

---

### Task 5: Add the new chart section to the page

**Files:**
- Modify: `charts/enrollment_vs_staffing.html`

- [ ] **Step 1: Locate the insertion point**

Open `charts/enrollment_vs_staffing.html`. Find the closing `</div>` of the existing `read-next` block at the very bottom of the page (around line 362). The new section goes **before** `<div class="read-next">` so it sits between the last existing content section and the read-next block.

- [ ] **Step 2: Insert the section**

Insert this HTML immediately before `<div class="read-next">`. Replace the four `XXX_*_POINTS` placeholders with the strings printed in Task 4 Step 2. Replace `XXX_X_POSITIONS` with the `xPositions` array from Task 4 Step 2. Replace `XXX_END_VAL_*` with the end-label values. Replace y-tick label values to match your y-axis range.

```html
  <h2 id="school-age-vs-enrollment">Are the kids leaving, or just the public schools?</h2>
  <p>Enrollment fell 21% between FY14 and FY24. The chart above does not say whether the school-age population of Marblehead also fell, or whether resident families left <abbr class="g" title="Marblehead Public Schools">MPS</abbr> for private, charter, or out-of-district schools. The two questions have different answers.</p>

  <div class="legend">
    <span class="legend-item s-neutral"><span class="legend-swatch"></span><span class="legend-text">School-age residents (ages 5&ndash;17)</span></span>
    <span class="legend-item s-marblehead"><span class="legend-swatch"></span><span class="legend-text"><abbr class="g" title="Marblehead Public Schools">MPS</abbr> resident enrollment</span></span>
    <span class="legend-item s-stoneham"><span class="legend-swatch"></span><span class="legend-text"><abbr class="g" title="Metropolitan Council for Educational Opportunity">METCO</abbr> non-residents</span></span>
  </div>

  <div class="chart-wrapper" data-chart-tooltip>
    <script type="application/json" class="chart-tooltip-data">
    {
      "xLabels": ["2010","2011","2012","2013","2014","2015","2016","2017","2018","2019","2020","2021","2022","2023","2024"],
      "xPositions": XXX_X_POSITIONS,
      "valueDecimals": 0,
      "series": [
        {
          "name": "School-age residents (5-17)",
          "className": "s-neutral",
          "values": [XXX_SCHOOL_AGE_VALUES]
        },
        {
          "name": "MPS resident enrollment",
          "className": "s-marblehead",
          "values": [XXX_MPS_RESIDENT_VALUES]
        },
        {
          "name": "METCO non-residents",
          "className": "s-stoneham",
          "values": [XXX_METCO_VALUES]
        }
      ]
    }
    </script>
    <svg class="chart" viewBox="0 0 740 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart showing Marblehead school-age population, MPS resident enrollment, and METCO non-resident enrollment from 2010 to 2024.">
      <line class="axis-base" x1="70" y1="170" x2="610" y2="170"/>

      <!-- Y gridlines (adjust to match chosen y_max) -->
      <line class="grid-minor" x1="70" y1="130" x2="610" y2="130"/>
      <line class="grid-minor" x1="70" y1="90" x2="610" y2="90"/>
      <line class="grid-minor" x1="70" y1="50" x2="610" y2="50"/>

      <!-- Y tick labels (adjust to match chosen y_max) -->
      <text class="tick-label" x="63" y="174" text-anchor="end">0</text>
      <text class="tick-label" x="63" y="134" text-anchor="end">1,000</text>
      <text class="tick-label" x="63" y="94" text-anchor="end">2,000</text>
      <text class="tick-label" x="63" y="54" text-anchor="end">3,000</text>

      <!-- School-age residents -->
      <polyline class="data-line s-neutral"
                points="XXX_SCHOOL_AGE_POINTS"/>
      <text class="end-label s-neutral" x="616" y="XXX_SCHOOL_AGE_END_Y">XXX_SCHOOL_AGE_END_VAL</text>

      <!-- MPS resident enrollment -->
      <polyline class="data-line s-marblehead"
                points="XXX_MPS_RESIDENT_POINTS"/>
      <text class="end-label s-marblehead" x="616" y="XXX_MPS_RESIDENT_END_Y">XXX_MPS_RESIDENT_END_VAL</text>

      <!-- METCO non-residents -->
      <polyline class="data-line s-stoneham"
                points="XXX_METCO_POINTS"/>
      <text class="end-label s-stoneham" x="616" y="XXX_METCO_END_Y">XXX_METCO_END_VAL</text>

      <!-- X labels -->
      <text class="tick-label tick-label--major" x="70"  y="190" text-anchor="middle">2010</text>
      <text class="tick-label tick-label--minor" x="225" y="190" text-anchor="middle">2014</text>
      <text class="tick-label tick-label--minor" x="380" y="190" text-anchor="middle">2018</text>
      <text class="tick-label tick-label--minor" x="535" y="190" text-anchor="middle">2022</text>
      <text class="tick-label tick-label--major" x="610" y="190" text-anchor="middle">2024</text>
    </svg>
  </div>

  <p class="caption">
    School-age residents (ages 5&ndash;17) from <abbr class="g" title="American Community Survey">ACS</abbr> 5-year estimates<sup class="cite" data-href="https://data.census.gov/table/ACSDT5Y2023.B01001?g=060XX00US2500938400" data-source="US Census ACS Table B01001 (Sex by Age), 5-year estimates, Marblehead town, Essex County, Massachusetts. Sum of male and female counts for ages 5-9, 10-14, 15-17."></sup>; <abbr class="g" title="Marblehead Public Schools">MPS</abbr> resident enrollment and <abbr class="g" title="Metropolitan Council for Educational Opportunity">METCO</abbr> from <abbr class="g" title="Department of Elementary and Secondary Education">DESE</abbr> Selected Populations<sup class="cite" data-href="https://profiles.doe.mass.edu/profiles/general.aspx?orgcode=01710000&amp;orgtypecode=5" data-source="MA DESE district profile and Selected Populations report for Marblehead (org code 01710000). Total enrollment minus non-resident equals MPS resident enrollment."></sup>. <abbr class="g" title="American Community Survey">ACS</abbr> 5-year estimates carry margins of error of roughly &plusmn;150&ndash;200 for small-area age bands; read the school-age line as a trend, not an exact count. Raw data in <code>data/acs_school_age_marblehead.csv</code> and <code>data/dese_metco_nonresident.csv</code>.
  </p>
```

- [ ] **Step 3: Pick the actual section title**

Working title: *"Are the kids leaving, or just the public schools?"* That's a question, not a claim, and avoids editorializing. Per `STYLE_GUIDE.md`, do not change to "kids are fleeing public schools" or similar. Acceptable alternatives if you prefer to lead with a finding: *"School-age population vs. public school enrollment"*, *"Where are Marblehead's school-age kids?"*. Pick one and lock it in.

- [ ] **Step 4: Build and view locally**

```bash
bundle exec jekyll build && \
  ls _site/charts/enrollment_vs_staffing/index.html
```

Then start the dev server in the background:

```bash
bundle exec jekyll serve --port 4000 &
sleep 3
curl -s http://localhost:4000/charts/enrollment_vs_staffing/ | grep -c 'school-age-vs-enrollment'
```

Expected: `1` (the new `<h2>` ID appears once).

- [ ] **Step 5: Commit**

```bash
git add charts/enrollment_vs_staffing.html
git commit -m "Add school-age vs MPS enrollment chart section

New section on charts/enrollment_vs_staffing.html with three lines:
ACS school-age residents, MPS resident enrollment, and METCO
non-residents over 2010-2024. Single y-axis, raw counts."
```

---

### Task 6: Add the residual table

**Files:**
- Modify: `charts/enrollment_vs_staffing.html`

- [ ] **Step 1: Compute the residual**

```bash
python3 << 'EOF'
import csv

# Most recent overlapping year between ACS and DESE.
acs = {}
with open('data/acs_school_age_marblehead.csv') as f:
    for r in csv.DictReader(f):
        acs[int(r['acs_end_year'])] = int(r['total_5_to_17'])

dese = {}
with open('data/dese_metco_nonresident.csv') as f:
    for r in csv.DictReader(f):
        end_year = int(r['school_year'].split('-')[0]) + 1
        dese[end_year] = int(r['mps_resident_enrollment'])

overlap = sorted(set(acs) & set(dese))
y = overlap[-1]
school_age = acs[y]
mps_resident = dese[y]
residual = school_age - mps_resident
print(f"Most recent overlapping year: {y}")
print(f"School-age residents (5-17): {school_age:,}")
print(f"MPS resident enrollment:     {mps_resident:,}")
print(f"Residual (kids not in MPS):  {residual:,}")
EOF
```

Record the year and three values.

- [ ] **Step 2: Insert the residual block**

Insert immediately after the `<p class="caption">` paragraph created in Task 5, replacing `YYY_*` with the values from Step 1.

```html
  <h3>Where do the rest of the kids go?</h3>
  <p>The chart above answers two questions but leaves a third hanging. The school-age population fell, but not by as much as <abbr class="g" title="Marblehead Public Schools">MPS</abbr> enrollment did. The remaining gap is the kids who live in town and do not attend the public schools.</p>

  <table class="data-table data-table--compact">
    <thead>
      <tr>
        <th scope="col">YYY_YEAR</th>
        <th scope="col" style="text-align:right">Count</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">School-age residents (ages 5&ndash;17)</th>
        <td style="text-align:right">YYY_SCHOOL_AGE</td>
      </tr>
      <tr>
        <th scope="row"><abbr class="g" title="Marblehead Public Schools">MPS</abbr> resident enrollment</th>
        <td style="text-align:right">&minus;YYY_MPS_RESIDENT</td>
      </tr>
      <tr>
        <th scope="row">Marblehead kids not in <abbr class="g" title="Marblehead Public Schools">MPS</abbr></th>
        <td style="text-align:right"><strong>YYY_RESIDUAL</strong></td>
      </tr>
    </tbody>
  </table>

  <p class="caption">
    Those YYY_RESIDUAL children are a mix of private school, charter school, out-of-district special education placements, and homeschool. <abbr class="g" title="American Community Survey">ACS</abbr> does not break that down, and we do not have a clean per-resident-town count from any single source. We name the residual rather than guess at its composition. The residual is also bounded by <abbr class="g" title="American Community Survey">ACS</abbr> margin of error (roughly &plusmn;150&ndash;200 on the school-age figure), so a residual of YYY_RESIDUAL should be read as "a few hundred," not as an exact count.
  </p>
```

> **Style check:** the inline `style="text-align:right"` is acceptable here because `STYLE_GUIDE.md` only forbids inline styles **on SVG elements**. Tables are fine. (Verify by reading `STYLE_GUIDE.md` if uncertain — do not paste this comment into the file.)

- [ ] **Step 3: Verify the table renders**

```bash
curl -s http://localhost:4000/charts/enrollment_vs_staffing/ | grep -c 'data-table'
```

Expected: `1` (one new table on this page).

If the existing site doesn't have a `.data-table` class, the table will still render (browser default styles), but check `assets/site.css` for any existing `.data-table` rules and reuse the most appropriate class name. If `.data-table` doesn't exist, drop it and the table inherits the page's default `<table>` styling — that's acceptable and matches other tables on the site (e.g. in `whats-on-the-ballot.html`).

- [ ] **Step 4: Commit**

```bash
git add charts/enrollment_vs_staffing.html
git commit -m "Add residual table for kids not in MPS

One-row decomposition of school-age residents minus MPS resident
enrollment in the most recent overlapping year, with disclosure that
the residual mixes private, charter, out-of-district SPED, and
homeschool."
```

---

### Task 7: Update SOURCE_LOOKUP.md and DATA_CATALOG.md

**Files:**
- Modify: `data/SOURCE_LOOKUP.md`
- Modify: `data/DATA_CATALOG.md`

- [ ] **Step 1: Append to SOURCE_LOOKUP.md**

Open `data/SOURCE_LOOKUP.md`. Find the last `##` section and append a new section. Match the existing style — short heading, bullet of source URL + citation pattern.

```markdown
## US Census ACS school-age population (B01001)
- API endpoint: `https://api.census.gov/data/<year>/acs/acs5?get=NAME,B01001_004E,...&for=county+subdivision:38400&in=state:25+county:009`
- Browser view: https://data.census.gov/table/ACSDT5Y2023.B01001?g=060XX00US2500938400
- 5-year estimates only (Marblehead is too small for 1-year ACS).
- We sum male+female counts for ages 5-9, 10-14, 15-17 to get total 5-17.
- Margin of error propagated as sqrt(sum of squared component MOEs).
- Raw data: `data/acs_school_age_marblehead.csv`. Fetch script: `scripts/fetch_acs_school_age.py`.

## DESE Selected Populations / Non-Resident Enrollment
- District profile: https://profiles.doe.mass.edu/profiles/general.aspx?orgcode=01710000&orgtypecode=5
- Selected Populations report: https://profiles.doe.mass.edu/statereport/selectedpopulations.aspx?orgcode=01710000&orgtypecode=5
- Bulk Socrata dataset (if found in Task 1): https://educationtocareer.data.mass.gov/resource/<RESOURCE_ID>
- METCO non-residents are a subset of total non-resident students.
- MPS resident enrollment = total enrollment - all non-resident students.
- Raw data: `data/dese_metco_nonresident.csv`. Fetch script: `scripts/fetch_dese_selected_populations.py`.
```

- [ ] **Step 2: Append to DATA_CATALOG.md**

Open `data/DATA_CATALOG.md`. Match the existing style — table row or bullet entry, depending on what's already there. Use the same pattern as the most recently added entry. Add two entries, one per CSV.

Example (adapt to existing format):

```markdown
- `data/acs_school_age_marblehead.csv` — US Census ACS B01001 school-age population (ages 5-17) for Marblehead, end-years 2010-2023. Columns: acs_end_year, ages_5_to_9, ages_10_to_14, ages_15_to_17, total_5_to_17, moe_total. Source: ACS 5-year estimates. Generated by `scripts/fetch_acs_school_age.py`.
- `data/dese_metco_nonresident.csv` — DESE Selected Populations / non-resident enrollment for Marblehead, school years 2009-10 through 2023-24. Columns: school_year, district, total_enrollment, metco, other_nonresident, total_nonresident, mps_resident_enrollment. Source: DESE district profiles. Generated by `scripts/fetch_dese_selected_populations.py`.
```

- [ ] **Step 3: Commit**

```bash
git add data/SOURCE_LOOKUP.md data/DATA_CATALOG.md
git commit -m "Document ACS and DESE Selected Populations sources

Add SOURCE_LOOKUP entries for ACS B01001 and DESE Selected
Populations, and DATA_CATALOG entries for the two new CSVs."
```

---

### Task 8: Add a smoke-test assertion

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Add the test function**

Open `tests/smoke-test.mjs`. After the `testGeneralGovernmentChart` function (around line 164), add a new test function:

```javascript
async function testSchoolAgeVsEnrollment(page) {
  console.log('\n── School-age vs MPS enrollment section ──');
  await page.goto(SITE + '/charts/enrollment_vs_staffing/', { waitUntil: 'domcontentloaded' });

  const heading = await page.$('h2#school-age-vs-enrollment');
  heading
    ? ok('Section <h2 id="school-age-vs-enrollment"> present')
    : fail('School-age section', 'expected <h2 id="school-age-vs-enrollment"> not found');

  // The section adds one new SVG chart, bringing the page total to >= 4.
  const charts = (await page.$$('svg.chart')).length;
  charts >= 4
    ? ok(`${charts} SVG charts on enrollment_vs_staffing`)
    : fail('Enrollment chart count', `expected >= 4, got ${charts}`);
}
```

- [ ] **Step 2: Wire it into the test runner**

Find the runner block at the bottom of the file (around line 193). Add a call to the new test in the same block as `testGeneralGovernmentChart`:

```javascript
    await testGeneralGovernmentChart(page1);
    await testSchoolAgeVsEnrollment(page1);
```

- [ ] **Step 3: Run the smoke tests against local**

```bash
npm run test:local
```

Expected: previous pass count plus 2 new passes (heading present, chart count). If you see `FAIL: School-age section`, revisit Task 5 — the `<h2>` ID may have a typo.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "Add smoke-test coverage for school-age section

Two new assertions: the new section heading exists by ID, and the
enrollment_vs_staffing page now has at least 4 SVG charts."
```

---

### Task 9: Verification + Proof of Work

**Files:**
- Create: `proof/<branch-name>.png` (screenshot, committed)

- [ ] **Step 1: Visual review on dev server**

If the dev server isn't already running:

```bash
bundle exec jekyll serve --port 4000 &
sleep 3
```

Open http://localhost:4000/charts/enrollment_vs_staffing/ in a browser if local; otherwise use Playwright. Scroll to the new section. Verify by eye:

- Three lines visible, distinct colors (`s-neutral`, `s-marblehead`, `s-stoneham`).
- METCO line is near the bottom (small values).
- School-age and MPS resident lines diverge — that's the editorial point.
- End labels positioned near the right edge of the chart, no overlap.
- Caption renders abbreviations as tooltips on hover.
- Residual table renders, three rows, last row bold.
- No console errors in DevTools.

Fix anything off before screenshotting.

- [ ] **Step 2: Capture screenshot proof**

```bash
mkdir -p proof
BRANCH=$(git branch --show-current)
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/charts/enrollment_vs_staffing/#school-age-vs-enrollment" \
  "proof/${BRANCH}.png"

# Full-page companion if the section runs below the fold:
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  --full-page \
  "http://localhost:4000/charts/enrollment_vs_staffing/" \
  "proof/${BRANCH}-full.png"
```

Verify both files exist and the PNGs are roughly 2880px wide:

```bash
file proof/${BRANCH}*.png
```

- [ ] **Step 3: Commit the screenshots**

```bash
git add proof/*.png
git commit -m "Add proof-of-work screenshots for school-age section"
```

- [ ] **Step 4: Run the full smoke-test suite one more time**

```bash
npm run test:local
```

Expected: previous green count plus 2 (or however many new assertions you added). Zero failures.

- [ ] **Step 5: Stop the dev server**

```bash
pkill -f 'jekyll serve' || true
```

---

### Task 10: Open the PR

**Files:** none modified.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin $(git branch --show-current)
```

- [ ] **Step 2: Open the PR with proof inline**

```bash
BRANCH=$(git branch --show-current)
gh pr create \
  --title "Add school-age vs MPS enrollment chart" \
  --body "$(cat <<EOF
## Summary

New section on \`charts/enrollment_vs_staffing.html\` answering a reader question: the existing chart shows enrollment dropped 21% (3,327 → 2,617 over FY14-FY24), but doesn't say whether the underlying school-age population also shrank or whether resident families left MPS for private/charter/SPED/homeschool.

The new section plots three series over 2010-2024 on a single axis:

- **School-age residents (ages 5-17)** — US Census ACS B01001 5-year estimates.
- **MPS resident enrollment** — DESE total enrollment minus non-resident students.
- **METCO non-residents** — DESE Selected Populations.

A residual table beneath the chart sizes the gap between school-age residents and MPS resident enrollment for the most recent overlapping year, with explicit disclosure that the residual mixes private + charter + out-of-district SPED + homeschool.

## Test plan

- [ ] Preview deploy URL (Cloudflare Pages — sticky comment will appear once preview is green): paste the Branch URL here once it lands.
- [ ] Visit \`/charts/enrollment_vs_staffing/#school-age-vs-enrollment\`.
- [ ] Confirm three lines are visible and distinct, METCO is near the floor, school-age and MPS resident lines diverge.
- [ ] Hover any chart point — tooltip shows the year and value.
- [ ] Confirm the residual table reads cleanly and the disclosure paragraph mentions private + charter + SPED + homeschool.
- [ ] Mobile (≤480px width): chart still readable, table doesn't overflow.

## Proof of Work

![Above the fold of the new section](proof/${BRANCH}.png)

Full-page screenshot also committed at \`proof/${BRANCH}-full.png\`. Smoke tests pass locally (\`npm run test:local\`), including the two new assertions for the section heading and chart count.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for the preview comment, then edit the PR body**

The preview workflow posts a sticky comment with `header: preview-url` once the Cloudflare deploy finishes (~3-5 min). When it appears:

```bash
PR=$(gh pr view --json number -q .number)
PREVIEW_URL=$(gh pr view "$PR" --json comments -q '.comments[] | select(.body | startswith("### Preview")) | .body' | grep -oE 'https://[^ )]+pages\.dev/charts/enrollment_vs_staffing[^ )]*' | head -1)
echo "Preview URL: $PREVIEW_URL"
```

Edit the PR body to fill in the preview URL placeholder.

- [ ] **Step 4: Report back to the user**

Reply in chat with the PR URL and the preview URL. Do not say "all done." Do not summarize the diff. Do not auto-merge.

---

## Self-review checklist

After working through the plan once on a copy in your head:

**Spec coverage:**
- [x] Three series in chart — Task 5.
- [x] Same-axis raw counts, 2010-2024 — Task 4 + Task 5.
- [x] Residual table, single year, with disclosure — Task 6.
- [x] ACS MOE disclosure in caption — Task 5 caption + Task 6 caption.
- [x] No green/red, no editorial — verified throughout copy in Task 5/6.
- [x] FY24 cross-check — Task 3 Step 4.
- [x] SOURCE_LOOKUP + DATA_CATALOG updated — Task 7.
- [x] Editorial guardrails — referenced in Task 5 Step 3 (no editorializing the title).

**Placeholders that are intentional and resolve during execution:**
- `<RESOURCE_ID>` in Task 3: resolved in Task 1.
- `XXX_*` in Task 5 SVG: resolved in Task 4.
- `YYY_*` in Task 6: resolved in Task 6 Step 1.
- Y-axis range in Task 5 SVG: resolved in Task 4 Step 2.

These are not lazy placeholders — each one names exactly which step computes its value. The engineer fills them by running the script in the named task.
