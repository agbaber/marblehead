#!/usr/bin/env python3
"""
Build data/monthly_burn_FY26.json — the JSON the /monthly-pacing/ page
reads to render the per-fund monthly cumulative-spend chart.

Aggregates data/operating_budget_FY26.csv (fetched daily from the
Open Budget portal) by Fund x fiscalmonth and emits the top funds by
total actual spending. Unlike the checkbook (vendor payments only),
this dataset INCLUDES payroll, so General Fund - School can be charted
honestly instead of dropped.

Inputs:
  - data/operating_budget_FY26.csv  (built by fetch_operating_budget.py)

Output:
  - data/monthly_burn_FY26.json

Usage:
  scripts/build_monthly_burn.py
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import UTC, date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
SRC = DATA_DIR / "operating_budget_FY26.csv"
OUT = DATA_DIR / "monthly_burn_FY26.json"

FY26_MONTHS = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
]
TOP_N = 6


def safe_float(s: str | None) -> float:
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def latest_period_end(rows: list[dict]) -> str:
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
    return latest.isoformat() if latest else datetime.now(UTC).date().isoformat()


def main() -> int:
    if not SRC.exists():
        sys.exit(f"missing {SRC}; run scripts/fetch_operating_budget.py first")

    with SRC.open(newline="") as f:
        rows = list(csv.DictReader(f))

    # Aggregate actual by fund x fiscal month
    fund_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in rows:
        actual = safe_float(r.get("actual"))
        if actual == 0:
            continue
        fund = r.get("fund") or ""
        if not fund:
            continue
        ym = (r.get("fiscalmonth") or "")[:7]
        if ym not in FY26_MONTHS:
            continue
        fund_month[fund][ym] += actual

    totals = {fund: sum(months.values()) for fund, months in fund_month.items()}
    top = sorted(totals.items(), key=lambda kv: -kv[1])[:TOP_N]

    funds_out = []
    for fund_name, total in top:
        cum = 0.0
        series = []
        for ym in FY26_MONTHS:
            cum += fund_month[fund_name].get(ym, 0.0)
            series.append({
                "month": ym,
                "cumulative": round(cum, 2),
                "monthly": round(fund_month[fund_name].get(ym, 0.0), 2),
            })
        funds_out.append({
            "fund": fund_name,
            "total_through_as_of": round(total, 2),
            "series": series,
        })

    payload = {
        "as_of": latest_period_end(rows),
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "fiscal_year": "FY26",
        "fy_months": FY26_MONTHS,
        "funds": funds_out,
        "source": "data/operating_budget_FY26.csv (Open Budget portal, payroll included)",
        "generated_by": "scripts/build_monthly_burn.py",
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(REPO_ROOT)} "
          f"(as_of={payload['as_of']}, {len(funds_out)} funds)")
    for f in funds_out:
        print(f"  {f['fund']:<32} ${f['total_through_as_of']:>13,.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
