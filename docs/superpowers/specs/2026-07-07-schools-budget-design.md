# Schools budget history page design

Date: 2026-07-07. Status: draft, pending user approval.

## Purpose

A new page (`/schools-budget.html`) answering "how has Marblehead schools spending changed over time, and what has the district said it plans to do with the money?" for residents trying to contextualize the FY27 override debate around the school-side budget.

Sibling of `inside-school-staffing.html` (staffing over time), `town-budget.html` (town-wide budget), and `labor-contracts.html` (contract expirations). The gap this fills: no existing page charts total schools spending against enrollment over a long horizon, and no existing page reconciles "what the schools asked for" against "what actually got spent."

## Editorial stance

Data-first, no advocacy. Two panels present two different views of "schools spending" that residents talk about interchangeably but which are not the same number. The page names the difference plainly.

- **Audited actuals** (ACFR): what was actually spent, published each fall for the prior fiscal year, comparable across towns via DOR.
- **Superintendent's proposed budget**: what the schools *asked for* the following year, presented at the February SC meeting. Never matches actuals — givebacks, unfilled positions, GIC pad (see [[project_group_insurance_pad]]) all shrink the actual below the proposal.

The gap between the two is itself neutral information, not evidence of malfeasance.

## Data sources

### Panel 1 (ACFR actuals, FY01–FY24, 24 years)

- `data/education_expenditure_FY01-24.csv` — total education spending per FY, cited to FY24 ACFR p.129. Already extracted, no new work.
- `data/education_per_student_FY01-24.csv` — same $ ÷ enrollment, with FTE and students-per-FTE columns.
- `data/bea_state_local_ipd.csv` — BEA state/local government implicit price deflator, for inflation-adjustment view.

Known anomalies documented in the CSV `Note` column:
- FY22: "Anomaly — likely GASB adjustment"
- FY23: "Anomaly — includes prior year adjustments"

These get inline `<sup>` annotations on the chart, not silent smoothing.

### Panel 2 (MPS proposed budget by category, FY18–FY27, 10 years)

Source: Feb-meeting budget packets in `data/schools/sc-archive-fy18/` through `data/schools/sc-archive-fy25/`, plus `data/schools/sc-meetings-fy26/agenda-and-materials-2-5-2026-fy27-budget-packet.txt` for FY27.

Not extracted yet. Extraction is part of this project (see "Extraction plan" below).

### Peer comparison block

`data/peer_schedule_a_expenditures.csv` — DOR Schedule A total education expenditures per town per year. Marblehead + 8 peers, latest available year only (FY24). Deliberate scope limit: no multi-year peer trend in v1.

## Page structure

```
schools-budget.html
├── Hero: single sentence + one number
├── Panel 1: ACFR education spending, FY01–FY24
│   ├── Default view: nominal $
│   ├── Toggle: per-pupil ($ ÷ enrollment)
│   ├── Toggle: real $ (BEA IPD adjusted, base FY24)
│   ├── Inline annotations for FY22 GASB / FY23 adjustment
│   └── Caption: source (FY24 ACFR p.129), what "actuals" means
├── Panel 2: MPS proposed budget by top-line category, FY18–FY27
│   ├── Stacked area chart, 6 category buckets
│   ├── Caption: this is PROPOSED not spent — cite Panel 1 for actuals
│   └── Proposed-vs-actual gap callout (inset): (proposed total − ACFR actual) per FY
├── Peer comparison block
│   ├── FY24 education spending per pupil, Marblehead vs. 8 peers
│   └── FY24 education spending per capita, same peer set
├── Methodology
│   ├── ACFR source pages per FY
│   ├── Packet source URL per FY per category value
│   ├── Category mapping across years (which packet lines → which bucket)
│   └── Note on why proposed ≠ actual (GIC pad, unfilled positions, givebacks)
└── Entry points and cross-links
    ├── Link from inside-school-staffing.html ("companion page")
    ├── Link from labor-contracts.html (payroll drives the trend)
    └── Optional homepage answer-card (deferred; ask user)
```

## Top-line category buckets (Panel 2)

Six buckets, DESE-inspired but pragmatic for what MPS packets actually break out:

| Bucket | What it captures | DESE function |
|---|---|---|
| Regular instruction | K-12 general ed: teachers, IAs, classroom supplies, textbooks | 2000 (subset) |
| Special education | In-district SPED staff + supplies, out-of-district tuitions | 2000 (SPED) + 9000 |
| Student services | Nurses, counselors, guidance, library, athletics, cocurricular | 3000 |
| Operations | Facilities (custodians, utilities) + transportation | 4000 |
| Administration | District office + principals + business office | 1000 |
| Capital | Non-recurring, if broken out in that year's packet | 7000 |

**Fixed charges (5000)** — health insurance, retirement, Medicare — is intentionally excluded because Marblehead budgets these at the town level, not school-side (see [[project_group_insurance_pad]]). Panel 2 says this explicitly in caption.

## Extraction plan (Panel 2)

New script: `scripts/extract_mps_proposed_budget.mjs`.

Input: each Feb packet text file. Output: `data/mps_proposed_budget_by_category.csv` with columns:

```
FY, bucket, amount, source_packet_slug, source_page, extraction_confidence
```

extraction_confidence is `high` (parsed from a clear summary table), `medium` (parsed from line items and summed), or `low` (mapped from a category name that doesn't match cleanly — flagged for manual review).

Per-year approach:
1. Find the summary table in each packet (usually first 20-30 pages).
2. Extract line items with their $ and their program/function label.
3. Map program/function label to one of the 6 buckets.
4. Sum by bucket, write row.

Two known extraction complications:
- **FY24 and FY25 packets are ~80% OCR** (scanned-to-PDF). Number recognition may need manual spot-check against source PDF for those years. FY18-FY23 are mostly native — extraction is high-confidence.
- **Category names drift** — "Cocurricular" in FY18 may be under "Athletics" in FY22. Mapping table lives in the script, one row per (year, source label, target bucket).

Any bucket that fails to extract cleanly for a given year is shown as a visible gap in the chart, not filled or interpolated.

## Testing and proof

- `tests/smoke-test.mjs` — new page renders without errors, has expected heading structure.
- `tests/nav-test.mjs` — companion link from `inside-school-staffing.html` resolves.
- New: `tests/schools_budget_data_test.py` — verifies that every value shown on the page traces to a row in the source CSV (guards against silent copy-paste drift).
- Playwright screenshot in `proof/schools-budget-page.png` (above-fold, 1440×900 × DPR 2) + `proof/schools-budget-page-full.png` (below-fold context).

## Style conformance

- No em-dashes in site copy (`STYLE_GUIDE.md`).
- No inline `style=""` on SVG elements; use scoped CSS classes.
- No CPI/inflation comparisons as sole benchmark — Panel 1's inflation-adjusted view is one of three toggles, not the default.
- Comparisons use neutral semantic colors (no green/red good/bad).
- All numbers cite source; every chart has a `<figcaption>` linking to source.
- Q-answering headings ("What actually gets spent?" not "Expenditure data").

## Entry points

1. `inside-school-staffing.html` gets a "See also: schools budget history" cross-link where it currently says "How positions are funded" — the two pages together answer "who + how much."
2. `labor-contracts.html` gets a bottom-of-page "Payroll drives the trend →" link.
3. Homepage answer-cards: **not adding in v1** — ask user whether an existing Q gets rewritten to point here vs. a new Q gets added.

## Open questions

1. **Homepage entry point?** New answer-card or rewrite of an existing card? Deferred to user.
2. **Peer set for the peer block?** Existing peer selections in `peer_schedule_a_expenditures.csv` — should we use the DOR "socioeconomic-similar" cohort or the user's curated peer list from Town Explorer? Deferred; pick during implementation.
3. **FY13 OPEB spike** in `education_expenditure_FY01-24.csv` — memory says this exists and needs a caveat. Confirm during Panel 1 build and add an annotation if present.

## Out of scope for v1

- DESE End-of-Year Report cross-check against ACFR (would answer "which is right when they disagree"). Deferred.
- Per-school breakdown (MHS vs. elementary vs. district-wide). Data exists in packets but complicates the chart. Deferred.
- Multi-year peer trend (per earlier scope decision). Deferred.
- Object-level breakdown (salaries vs. benefits vs. supplies). Munis chart-of-accounts detail exists for FY26 only. Deferred until we have >1 year.

## Risks

- **Extraction turns up nonsense for old years**: MVP fallback is Panel 2 shows only FY23–FY27 (packets closest to today, most reliably extractable), with a note that older years' extraction is in flight. This ships something useful even if 2018-2022 fails cleanly.
- **Category mapping is wrong**: mitigated by `extraction_confidence` column and by showing gaps rather than fabricating.
- **Panel 2 makes MPS look worse or better than the audited number**: this is the point of showing both panels. Caption states the reconciliation plainly.

## Deliverables

- `docs/superpowers/specs/2026-07-07-schools-budget-design.md` (this file)
- `docs/superpowers/plans/2026-07-07-schools-budget-plan.md` (produced by writing-plans, after user approves this spec)
- `scripts/extract_mps_proposed_budget.mjs`
- `data/mps_proposed_budget_by_category.csv`
- `schools-budget.html`
- Cross-link edits to `inside-school-staffing.html` and `labor-contracts.html`
- Tests + Playwright proof screenshots
