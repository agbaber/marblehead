# How Marblehead's workforce has changed — design

**Date:** 2026-06-19
**Page:** `town-staffing-over-time.html`
**Status:** Approved design, pre-implementation

## Purpose

The "over time" companion to `org-chart.html`. The org chart is an explicit
point-in-time FY26 snapshot of *who* runs the town; this page answers the
adjacent question the snapshot can't: **who does the work now versus then.**
It charts the full municipal workforce across 19 fiscal years (FY08–FY26)
and surfaces the structural changes underneath the totals — functions added,
functions retired, departments that grew or shrank.

Not an advocacy page. No "bloat," "lean," "swollen," or any value word. The
data shows deltas; readers draw conclusions.

## Data

Source already ingested (PR #735, April 2026 public records request, RAO Kyle
A. Wiley). No new sourcing.

- `data/employee_count_FY2008-2026.xls` — raw payroll Employee Earnings
  History rosters, FY08–FY26.
- `data/town_employee_headcount_FY08-26.csv` — long-form `FY, Department,
  Headcount` (911 rows).
- `data/town_employee_headcount_summary_FY08-26.csv` — `FY × Schools / Town /
  Total`.

Cataloged in `data/DATA_CATALOG.md` and `data/SOURCE_LOOKUP.md`.

**Standing caveat (must appear at the numbers):** this is *headcount, not
FTE*. A 0.1 FTE substitute counts as 1 employee. Year-over-year deltas are
reliable because methodology is consistent across years; absolute levels are
not FTE-weighted.

### Data artifacts to exclude (documented filter)

The raw extract contains parsing residue from subtotal/relabel rows. Exclude,
with the reason recorded in the data file:

- `Total` — pseudo-row appearing FY16–17 (captured subtotal).
- `COFFIN SCHOOL` — single-year FY16 blip (peak 68), a relabel artifact.
- `SNOW REMOVAL` — single-year FY17 (peak 1).
- `TREE GROUP` — single-year FY15 (peak 1).

### Curated mapping: `_data/town_staffing.yml`

A hand-curated data file (mirrors the `_data/org_chart.yml` pattern) so Liquid
stays simple and every editorial choice is auditable in one place. For each
department: display name, band, status (`stable` | `new` | `retired`), FY08
and FY26 headcount, and an optional sourced note. The page reads this file;
the CSVs remain the provenance of record.

## Structure — three movements

### 1. The 19-year arc

One total-municipal-headcount line, FY08→FY26. The big picture in a single
shape: 999 (FY08) → 1,212 peak (FY19) → 1,069 (FY21 COVID dip) → 1,020
(FY26). Caption: neutral, names the COVID dip and the headcount-not-FTE
caveat. This is the only chart that uses every year.

### 2. The core — grouped slope chart, then (FY08) vs now (FY26)

Each stable department: two dots (FY08, FY26) joined by a line; direction and
length encode the change. New functions render as a dot that appears; retired
lines as a dot that ends. Grouped into bands:

| Band | Departments (FY08 → FY26) |
|---|---|
| General Government | Selectmen 9→6, Finance 6→9, Assessors 3→3, Town Clerk 2→3, Cust Records 6→2, **HR (new FY22) →3**, **Community Dev & Planning (new FY18) →5**, *Town Counsel (ended FY13)* |
| Public Safety | Police 76→68, Fire 43→40, Harbormaster 11→17, Building Commissioner 8→10, *Animal Inspector (ended FY16)* |
| Public Works | Highway 16→22, Water 12→17, Sewer 12→10, Waste 7→9, Cemetery 9→9, Public Buildings 5→6, *Engineering (ended FY25)*, *Drains (ended FY21)*, *Tree (ended FY18)* |
| Health & Human Services | Health 4→3, Council on Aging 5→12, Veterans Agent 1→1, *Health Anti-Smoking (ended FY12)* |
| Culture & Recreation | Library 29→27, Park 19→26 |
| Schools (totals only) | charted as one combined line; "why" deferred to `inside-school-staffing.html` and `enrollment_vs_staffing.html` |

### 3. The quarantine

A separate, clearly-labeled block for lines that swing for reasons other than
staffing decisions — shown (the page covers *everything*) but fenced so they
can't masquerade as a town-hall trend:

- **Election & Registration** 62→25 — poll workers, election-cycle dependent.
- **Revolving / seasonal funds** — Park Revolving 4→41, COA Revolving, etc.;
  count seasonal/program staff.
- **Light enterprise sub-accounts** — the `5xx` overhead/meter/underground
  lines consolidating. Light is the independent municipal enterprise (its own
  aside on the org chart); its internal account restructuring is accounting,
  not a town-admin change.

## Editorial guardrails (baked in)

- A vanished line is a **fact** ("Engineering no longer appears as a separate
  line after FY25"). *Where* it went is an **inference** — verify each
  consolidation against annual reports / budget docs, or state only that the
  line ended without asserting a destination. No unsourced "folded into DPW."
- Caveats sit *at* the numbers: headcount-not-FTE; poll-worker volatility;
  COVID dip; FY23 school reporting change (link, don't re-litigate).
- School detail is deferred to the existing pages via links, not duplicated,
  to avoid two competing canonical sources for the same school numbers.

## Build checklist

- Read `STYLE_GUIDE.md` before authoring any CSS / SVG (palette, chart
  classes, chart principles, "What Not To Do").
- `town-staffing-over-time.html` — page using existing SVG chart classes;
  hand-authored, no inline `style=""` on SVG.
- `_data/town_staffing.yml` — curated department → band/status/notes mapping
  plus the excluded-artifacts list with reasons.
- Cross-links: org-chart → this page ("how this has changed") and this page →
  org-chart ("the snapshot"); links out to school-staffing pages.
- Verify each asserted consolidation against a primary source before stating a
  destination; otherwise phrase as line-ended-only.
- No em-dash / en-dash-as-em-dash in copy (scan the diff before commit).
- `DATA_CATALOG.md` already documents the source; add a one-line pointer to
  the new page if useful.

## Out of scope

- Re-telling the FY23 school-staffing mystery (lives on existing pages).
- Staff-vs-spending or staff-vs-population analysis (a different page's job;
  overlaps `where-has-the-money-gone.html`).
- Any FTE reconstruction — this dataset is headcount only.
