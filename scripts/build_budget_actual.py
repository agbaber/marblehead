#!/usr/bin/env python3
"""
Build data/budget_actual_FY26.json from data/operating_budget_FY26.csv
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
  python3 scripts/build_budget_actual.py
"""
from __future__ import annotations

import csv
import json
import sys
from collections import OrderedDict, defaultdict
from datetime import UTC, date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
SRC = DATA_DIR / "operating_budget_FY26.csv"
OUT_PATH = DATA_DIR / "budget_actual_FY26.json"

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
    if not SRC.exists():
        sys.exit(f"missing {SRC}; run scripts/fetch_operating_budget.py first")

    with SRC.open(newline="") as f:
        rows = list(csv.DictReader(f))

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
    out["fiscal_year"] = "FY26"
    out["checkbook_period_end"] = period_end
    out["source"] = "data/operating_budget_FY26.csv (Town of Marblehead Open Budget portal, /api/operating_budget.csv)"
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
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)}")
    print(f"  rows in source CSV     = {len(rows):,}")
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
