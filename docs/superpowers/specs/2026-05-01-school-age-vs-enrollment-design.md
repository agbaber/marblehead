# School-age population vs. MPS enrollment — design

A new section appended to `charts/enrollment_vs_staffing.html` answering a reader question: the existing chart shows MPS enrollment dropping 21% (3,327 in FY14 to 2,617 in FY24). Are the kids leaving Marblehead, or just leaving Marblehead Public Schools?

## Why

The current chart establishes the enrollment decline but offers no denominator. Three plausible explanations are conflated:

1. The school-age cohort residing in Marblehead is shrinking (demographic transition).
2. Resident families are choosing private schools, charters, or out-of-district SPED.
3. The METCO non-resident contribution to MPS enrollment has changed.

A reader asked exactly this question. The data exists (with caveats) to answer it honestly.

## Page location and shape

- **File:** append a new `<section>` to `charts/enrollment_vs_staffing.html`, between the existing three-staffing-measures section and the page footer.
- **Section title:** `<h2>` — working title *"Are the kids leaving, or just the public schools?"* (final wording set during implementation; must not editorialize per STYLE_GUIDE).
- **No new layout, no new scripts.** Reuses the SVG line-chart pattern already used elsewhere in the file, the existing tooltip helper, and existing peer color classes.

## The chart

Single SVG line chart, ~2010-2024 x-axis, single y-axis in raw counts, three series:

| Series | Color class | Source |
|---|---|---|
| School-age residents (ages 5-17) | `s-neutral` | US Census ACS B01001 5-year estimates |
| MPS resident enrollment | `s-marblehead` | DESE total enrollment − DESE METCO/non-resident |
| METCO non-residents | `s-stoneham` (or another muted peer color) | DESE Selected Populations |

All three series live in the 30-3,300 count range — single axis works without a dual axis or indexing.

X-axis labeled by year (ACS end-year for the school-age series, school year ending for DESE). FY/SY/calendar reconciliation handled in the data files; the chart does not try to surface it.

A short caption sits beneath the chart, stating facts only:

- The factual trajectories (e.g., "school-age residents fell ~X%, MPS resident enrollment fell ~Y%").
- ACS margin-of-error disclosure: "ACS 5-year estimates carry margins of error of roughly ±150-200 for small-area age bands; read the school-age line as a trend, not an exact count."
- Source attribution: ACS table B01001 + DESE Selected Populations, with the existing `<sup class="cite">` citation pattern.

## The residual table

A small static table beneath the chart, one data row, most-recent overlapping year (likely 2023):

```
School-age residents (5-17), 2023:           ~2,950
MPS resident enrollment, SY 2023-24:         −2,540
                                              ─────
Marblehead kids not in MPS:                    ~410
```

Disclosure under the table: "These ~410 children are a mix of private school, charter, out-of-district SPED placements, and homeschool. ACS does not break that down, and we do not have a clean per-resident-town count from any single source. We name the residual rather than guess at its composition."

(Numbers above are illustrative — actual values come from the fetched data.)

## Data sources

Two new data files, two new fetch scripts.

### `data/acs_school_age_marblehead.csv`

Columns:
- `acs_end_year` — e.g., `2023` for the 2019-2023 5-year estimate.
- `ages_5_to_9`
- `ages_10_to_14`
- `ages_15_to_17`
- `total_5_to_17` — sum of the three.
- `moe_total` — propagated margin of error for the sum (sqrt of sum of squared component MOEs).

Source: US Census ACS Table B01001 (sex by age), 5-year estimates. Geography: state 25, county 009, county subdivision 38400 (Marblehead town). End years 2010 (covering 2006-2010) through 2023 (covering 2019-2023), aligning with the 2010-2024 chart x-axis. The 2009 5-year ACS exists but is excluded for axis alignment; before 2009, only decennial census is available.

### `data/dese_metco_nonresident.csv`

Columns:
- `school_year` — e.g., `2023-24`.
- `district` — `Marblehead`.
- `total_enrollment` — DESE total enrollment count for the district.
- `metco` — non-resident students enrolled via METCO.
- `other_nonresident` — school choice, tuitioned-in, etc.
- `total_nonresident` — `metco + other_nonresident`.
- `mps_resident_enrollment` — `total_enrollment − total_nonresident`.

Source: MA DESE "Enrollment by Selected Populations" district-level reports (`profiles.doe.mass.edu`). Annual files, target range FY10-FY24. METCO is broken out separately in those reports under "Non-Resident Students" subcategories.

### `scripts/fetch_acs_school_age.py`

Python script. Calls the Census API once per ACS vintage (2009-2023). Writes `data/acs_school_age_marblehead.csv`. Uses `CENSUS_API_KEY` env var if available; works without a key for the small request volume here. Idempotent — rerun safely.

### `scripts/fetch_dese_selected_populations.py`

Python script. Two implementations possible, in order of preference:

1. **Bulk download** if DESE publishes a multi-district, multi-year CSV of Selected Populations data. Filter to district=Marblehead.
2. **Per-year district profile pages** if no bulk file exists. Iterate FY10-FY24, parse the HTML/Excel for the Selected Populations table.

Writes `data/dese_metco_nonresident.csv`. If a year's METCO breakout is missing or schema-changed, the row is written with `metco=NULL` and the chart series starts from the first reliable year. School-age and total-enrollment series remain on the full window.

**Risk:** I don't have direct verification that DESE publishes a clean machine-readable METCO time series back to FY10. If the scrape is brittle, fallback is a hand-compiled CSV from per-year district profile PDFs (15 data points — slow but tractable). The implementation plan must include a discovery step before committing to either path.

## Build order

1. Write `scripts/fetch_acs_school_age.py`. Run it. Verify the 2019-2023 row against `data.census.gov` manually (Marblehead town, B01001).
2. Discover DESE METCO data shape (bulk vs. per-year). Write `scripts/fetch_dese_selected_populations.py` accordingly. Run it. Spot-check FY24 row against the public DESE district profile.
3. Add the new `<section>` to `charts/enrollment_vs_staffing.html`. Reuse SVG patterns from the same file.
4. Update `data/SOURCE_LOOKUP.md` with the two new sources.
5. Update `data/DATA_CATALOG.md` with the two new CSVs.
6. Verify FY24 cross-check: existing chart's enrollment of 2,617 must equal `metco + other_nonresident + mps_resident_enrollment` for the same year, ±1 row of FY/SY alignment.

## Verification

- `npm run dev` and load `/charts/enrollment_vs_staffing/`. Eyeball the new section: line shapes plausible, tooltip values match CSV, no overflow on mobile.
- `npm run test:local` passes 52/0. Add one assertion that the new section's `<h2>` exists.
- Playwright screenshot at `proof/<branch>.png` (1440×900, DPR 2), above the fold of the new section. Full-page companion if needed.
- Cross-check arithmetic: FY24 cells in old chart and new chart agree to within FY/SY rounding.

## Editorial guardrails

From `STYLE_GUIDE.md` and `CLAUDE.md`:

- Caption states facts; no "shocking", "skyrocketing", etc.
- No green/red value coloring on the residual; neutral semantics only.
- ACS margin-of-error disclosed in the caption.
- Residual disclosure explicit: "private + charter + out-of-district SPED + homeschool, not separated."
- No meta-narration ("This chart shows..."). Lead with the finding in the caption.
- Every number traces to source: ACS table + year, DESE report + year, with `<sup class="cite">` footnotes.
- Abbreviations on first use wrapped with `<abbr class="g">` (ACS, DESE, METCO, MPS, SPED, MOE).

## Out of scope

- Peer-town comparison of school-age population (could be a follow-up if there's appetite).
- Per-private-school enrollment lines (not honest as a "where MPS kids went" answer — privates draw regionally).
- Pre-2010 ACS data (doesn't exist at this geography).
- Decomposing the residual into private/SPED/charter/homeschool. Possible in a follow-up using DESE charter enrollment + DESE special education out-of-district counts + MA private school census, but each adds its own data plumbing and reconciliation; spec keeps the residual aggregated for honesty and brevity.

## Success criteria

- A reader scrolling past "enrollment dropped 21%" immediately sees a chart showing whether the underlying school-age cohort dropped by a similar amount.
- METCO is visibly present, not hidden in the resident-enrollment number.
- The residual table acknowledges the question "where did the rest go?" without overclaiming.
- Every number on the page traces to a primary source.
- Page passes lint, smoke test, and Playwright screenshot review.
