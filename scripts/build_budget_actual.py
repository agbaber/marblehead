#!/usr/bin/env python3
"""
Build data/budget_actual_FY<N>.json from data/operating_budget_FY<N>.csv
(fetched daily by scripts/fetch_operating_budget.py from the Town of
Marblehead Open Budget portal).

Replaces the prior workflow that required manually downloading five
Fund_Group CSVs and one Adopted_Budget rollup from the budget portal
UI. The portal exposes the same underlying ledger as a single public
CSV via /api/operating_budget.csv. That endpoint also includes
encumbrance and unencumbered-balance columns the manual export
omitted, and is keyed by fiscalmonth so monthly granularity is
available downstream.

Output JSON shape is preserved (modulo the added `encumbrance` field
on each dimension row) so consumers like /monthly-pacing/ and
/checkbook/ don't need to be updated in lockstep.

The portal export is NOT strictly scoped to the requested year: the
year=<N> CSV can carry rows tagged with other fiscalyears (the FY26
export grew FY27 rows once FY27 opened, and the FY27 export includes
thousands of FY26 rows). All aggregation therefore filters on the CSV's
`fiscalyear` column first.

Also writes _data/budget.json (the small dashboard blob Jekyll exposes
as site.data.budget) — but only when building the current fiscal year,
so a close-out re-run of a prior FY can't clobber the live dashboard.

Aggregation rules:
  - by_fund / by_department / by_category / by_division / by_object:
    sliced to BUDGETED ANNUAL FUNDS only (matches the prior dimension
    CSVs the manual flow produced; Other Funds rolls up separately).
  - segment3 is used as the "Department" dimension (matches the
    portal's by_department report).
  - segment4 is used as "Division".
  - object is used as "Object" (segment7 / character codes are too
    coarse; this matches the manual export label).
  - charactercodedescription is used as "Category".

Usage:
  python3 scripts/build_budget_actual.py              # current fiscal year
  python3 scripts/build_budget_actual.py --year 2026  # rebuild a prior FY
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import OrderedDict, defaultdict
from datetime import UTC, date, datetime
from pathlib import Path

import fylib

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

BUDGETED_ANNUAL = "BUDGETED ANNUAL FUNDS"


def safe_float(s: str | None) -> float:
    if s is None or s == "":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def aggregate_dimension(rows: list[dict], key_field: str) -> list[dict]:
    """Aggregate the BUDGETED ANNUAL FUNDS slice by `key_field`, returning
    [{name, revised_budget, actual, original_budget, encumbrance}, ...] sorted
    by revised_budget desc.
    """
    agg: dict[str, dict[str, float]] = defaultdict(
        lambda: {"revised_budget": 0.0, "actual": 0.0,
                 "original_budget": 0.0, "encumbrance": 0.0}
    )
    for r in rows:
        if r.get("fundgroup") != BUDGETED_ANNUAL:
            continue
        name = (r.get(key_field) or "").strip()
        if not name:
            continue
        agg[name]["revised_budget"] += safe_float(r.get("revisedbudget"))
        agg[name]["actual"] += safe_float(r.get("actual"))
        agg[name]["original_budget"] += safe_float(r.get("originalbudget"))
        agg[name]["encumbrance"] += safe_float(r.get("encumbrance"))

    out = []
    for name, vals in agg.items():
        out.append({
            "name": name,
            "revised_budget": round(vals["revised_budget"], 2),
            "actual": round(vals["actual"], 2),
            "original_budget": round(vals["original_budget"], 2),
            "encumbrance": round(vals["encumbrance"], 2),
        })
    out.sort(key=lambda r: r["revised_budget"], reverse=True)
    return out


def total_by_fundgroup(rows: list[dict]) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = defaultdict(
        lambda: {"revised_budget": 0.0, "actual": 0.0, "original_budget": 0.0}
    )
    for r in rows:
        fg = r.get("fundgroup") or ""
        if not fg:
            continue
        out[fg]["revised_budget"] += safe_float(r.get("revisedbudget"))
        out[fg]["actual"] += safe_float(r.get("actual"))
        out[fg]["original_budget"] += safe_float(r.get("originalbudget"))
    return out


def latest_fiscalmonth(rows: list[dict]) -> str | None:
    """Return the latest fiscalmonth date present that has any non-zero
    actual amount, ISO-formatted YYYY-MM-DD.
    """
    latest: date | None = None
    for r in rows:
        if safe_float(r.get("actual")) == 0:
            continue
        fm = (r.get("fiscalmonth") or "")[:10]
        if not fm:
            continue
        try:
            d = date.fromisoformat(fm)
        except ValueError:
            continue
        if latest is None or d > latest:
            latest = d
    return latest.isoformat() if latest else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--year", type=int, default=fylib.current_fiscal_year(),
                    help="fiscal year to build (default: current fiscal year)")
    args = ap.parse_args()
    year = args.year
    label = fylib.fy_label(year)

    src = DATA_DIR / f"operating_budget_{label}.csv"
    out_path = DATA_DIR / f"budget_actual_{label}.json"

    if not src.exists():
        sys.exit(f"missing {src}; run scripts/fetch_operating_budget.py first")

    with src.open(newline="") as f:
        raw_rows = list(csv.DictReader(f))

    # The portal's year=<N> export can include rows tagged with other
    # fiscalyears (verified 2026-07-05: year=2027 returned 13k FY26 rows
    # alongside 3.5k FY27 rows). Keep only the requested year.
    rows = [r for r in raw_rows if (r.get("fiscalyear") or "").strip() == str(year)]

    fundgroup_totals = total_by_fundgroup(rows)
    budgeted_annual = fundgroup_totals.get(BUDGETED_ANNUAL, {})
    other_funds = fundgroup_totals.get("OTHER FUNDS", {})

    all_funds_revised = round(
        budgeted_annual.get("revised_budget", 0.0)
        + other_funds.get("revised_budget", 0.0), 2)
    all_funds_actual = round(
        budgeted_annual.get("actual", 0.0)
        + other_funds.get("actual", 0.0), 2)

    by_fund = aggregate_dimension(rows, "fund")
    by_department = aggregate_dimension(rows, "segment3")
    by_division = aggregate_dimension(rows, "segment4")
    by_object = aggregate_dimension(rows, "object")
    by_category = aggregate_dimension(rows, "charactercodedescription")

    period_end = latest_fiscalmonth(rows) or date.today().isoformat()

    out = OrderedDict()
    out["as_of"] = datetime.now(UTC).date().isoformat()
    out["fiscal_year"] = label
    out["checkbook_period_end"] = period_end
    out["source"] = (f"data/operating_budget_{label}.csv (Town of Marblehead "
                     "Open Budget portal, /api/operating_budget.csv)")
    out["generated_by"] = "scripts/build_budget_actual.py"
    out["totals"] = OrderedDict([
        ("all_funds_revised_budget", all_funds_revised),
        ("all_funds_actual", all_funds_actual),
        ("budgeted_annual", OrderedDict([
            ("revised_budget", round(budgeted_annual.get("revised_budget", 0.0), 2)),
            ("actual", round(budgeted_annual.get("actual", 0.0), 2)),
            ("original_budget", round(budgeted_annual.get("original_budget", 0.0), 2)),
        ])),
        ("other_funds", OrderedDict([
            ("revised_budget", round(other_funds.get("revised_budget", 0.0), 2)),
            ("actual", round(other_funds.get("actual", 0.0), 2)),
            ("original_budget", round(other_funds.get("original_budget", 0.0), 2)),
        ])),
    ])
    out["by_fund"] = by_fund
    out["by_department"] = by_department
    out["by_category"] = by_category
    out["by_division"] = by_division
    out["by_object"] = by_object

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")

    # Dashboard JSON Jekyll exposes as site.data.budget so pages can cite
    # the live FY's budget totals and artifact filenames without per-page
    # regexes. Only written for the current fiscal year: a close-out
    # re-run of a prior FY must not clobber the live dashboard.
    dashboard_path = REPO_ROOT / "_data" / "budget.json"
    if year == fylib.current_fiscal_year():
        dashboard = {
            "fiscal_year": label,
            "year": year,
            "fy_start": fylib.fy_start(year).isoformat(),
            "fy_end": fylib.fy_end(year).isoformat(),
            "actual_filename": f"budget_actual_{label}.json",
            "burn_filename": f"monthly_burn_{label}.json",
            "drill_filename": f"budget_drill_{label}.json",
            "all_funds_budget_M": f"${all_funds_revised / 1_000_000:.1f}M",
            "annual_operating_M": (
                f"${out['totals']['budgeted_annual']['revised_budget'] / 1_000_000:.1f}M"),
            "generated_by": "scripts/build_budget_actual.py",
        }
        dashboard_path.parent.mkdir(parents=True, exist_ok=True)
        dashboard_path.write_text(json.dumps(dashboard, indent=1) + "\n")
        print(f"Wrote {dashboard_path.relative_to(REPO_ROOT)}")
    else:
        print(f"Skipped {dashboard_path.relative_to(REPO_ROOT)}: {label} is not "
              f"the current fiscal year ({fylib.fy_label(fylib.current_fiscal_year())})")

    print(f"Wrote {out_path.relative_to(REPO_ROOT)}")
    print(f"  rows in source CSV     = {len(raw_rows):,} "
          f"({len(rows):,} tagged fiscalyear={year})")
    print(f"  as_of                  = {out['as_of']}")
    print(f"  period_end (data)      = {period_end}")
    print(f"  all_funds_revised      = ${all_funds_revised:>13,.2f}")
    print(f"  all_funds_actual       = ${all_funds_actual:>13,.2f}")
    print(f"  budgeted_annual_rev    = ${out['totals']['budgeted_annual']['revised_budget']:>13,.2f}")
    print(f"  budgeted_annual_actual = ${out['totals']['budgeted_annual']['actual']:>13,.2f}")
    print(f"  by_department          = {len(by_department)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
