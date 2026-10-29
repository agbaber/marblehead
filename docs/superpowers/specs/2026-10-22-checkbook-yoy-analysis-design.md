# Checkbook year-over-year analysis: FY27 to date vs FY26

Design notes, 2026-10-22. Status: approved (working document first, page
second).

## Goal

A comprehensive, reproducible comparison of Marblehead's FY27 spending to
date against prior years, written up first as a working analysis in
`docs/analysis/` so every finding can be checked against primary sources
before anything is published, then turned into a site page.

## What the data allows

- **Transaction-level checkbook** (vendor payments, AP only, no payroll):
  the spending portal serves FY26 and FY27 only. Comparisons are FY27 to
  date (through the as-of date in the newest `data/checkbook_FY27_*.csv`)
  against the same July 1 to month/day window of FY26, plus FY26 full-year
  run rates. Earlier years are not available at this grain.
- **Budget portal** (payroll included, budget vs actual): FY25 at year-end
  department level, FY26 and FY27 monthly. `data/budget_actual_FY25.json`
  is derived from a one-off `fetch_operating_budget.py --year 2025` (the
  9.9 MB CSV is not committed; it carries only 2,560 FY25 rows).
- **Long-run series** already in `data/` (ACFR-derived): group insurance
  FY06 to FY27, pension expenditure FY01 to FY24, debt summary, cash
  reserves, free cash.
- **Primary-source context**: `_transcripts/` (464 meeting transcripts),
  `_data/override_tracker.yml` (28 commitments), the April 15, 2026
  override presentation, `data/town_budget_FY27.json` (the no-override
  proposal by department), the FY26 cherry sheet.

## Lenses (in order of importance)

1. Override money by department: FY27 adopted budget vs FY26 and vs the
   no-override proposal; first-quarter payroll-inclusive actuals and
   salaries by department; reconciliation to the Article 29 contingent
   appropriation by function; mapped to the tracker's commitments.
2. Fixed-cost escalators: pension, GIC, other insurance, debt service,
   assessments (Essex Tech, MWRA, SESD, state assessments), each against
   its long-run trend.
3. Capital drawdown by article, with vendors.
4. Vendor dynamics: top vendors, new and departed, concentration, contract
   switches, legal, anomaly screens (identical rows, near-duplicates,
   voids).
5. Enterprise funds.
6. School vendor spending, with payment-timing evidence.
7. Full-year projection from FY26 seasonality, with lumpy groups flagged.

## Method rules

- Same-window alignment on both sides; voids and reversals stay in the
  totals; division coding is unreliable for schools and capital, so those
  lenses key on fund and vendor; the checkbook excludes payroll, so
  override positions are read from the budget portal only.
- Every table in the document is produced by
  `scripts/analysis_checkbook_yoy.py` from committed files; the document
  quotes the table and the primary source, never a remembered number.
- Editorial stance per README: facts, not conclusions; no green/red
  framing; caveats next to the numbers they qualify.

## Deliverables

- `docs/analysis/2026-10-22-fy27-checkbook-vs-fy26.md` (this round).
- A site page fed by the same script's `--json` output (next round, only
  from findings that survive review).

## Decisions and rejected options

- Working document before page: several readings (GIC growth, school
  tuition timing, the school function's budget in the portal) needed
  primary-source confirmation; publishing first would have shipped at
  least one wrong claim.
- No transaction-level history before FY26: the portal does not serve it;
  aggregate context comes from the ACFR series instead.
- FY25 CSV not committed; derived JSON is, with its provenance in the
  script header.
