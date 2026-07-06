#!/usr/bin/env python3
"""
Build data/checkbook_performance.json — the pacing / budget-execution /
cadence / per-fund-drill JSON that checkbook.html reads alongside the raw
checkbook CSV. Replaces the one-off file shipped in PR #773 so the data
can refresh nightly and roll over fiscal years.

Inputs:
  - The latest data/checkbook_FY<N>_<date>.csv snapshot
    (columns: Vendor,Fund,Division,Description,Date,Amount)
  - data/budget_actual_FY<N>.json (optional). If missing, a warning is
    printed and budget_execution is emitted with empty lists — a shape
    checkbook.html renders as "No department has exceeded its budget"
    rather than throwing (renderPerf accesses
    perf.budget_execution.by_department unguarded).

Output: data/checkbook_performance.json with exactly the fields the page
reads:
  - as_of, fiscal_year, generated_by
  - fy_months_elapsed, fy_pct_elapsed  (pacing clause in the drill lead)
  - budget_execution.by_department / .all_departments — the same full
    department list from budget_actual, mapped to
    {name, revised, actual, delta, pct}. by_department is sorted by
    delta desc (the page filter+slice(0,5) takes the first five rows
    that qualify), all_departments by revised desc.
  - monthly_cadence: [{month: "YYYY-MM", amount, count}] (cadence chart)
  - drill.by_fund[fund] = {top_vendors: top 12 by amount, monthly}
    monthly covers only months actually present in the data (no
    padded 12-month axis), matching the page's sparkline expectations.

Deterministic: funds sorted alphabetically; vendor/department ties break
on name. Money rounded to 2dp.

Usage:
  scripts/build_checkbook_performance.py              # current fiscal year
  scripts/build_checkbook_performance.py --year 2026  # rebuild for FY26
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from collections import defaultdict
from pathlib import Path

import fylib

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"


def latest_snapshot(year: int) -> Path:
    prefix = f"checkbook_{fylib.fy_label(year)}_"
    candidates = sorted(DATA.glob(prefix + "*.csv"))
    if not candidates:
        sys.exit(f"error: no data/{prefix}*.csv snapshots found")
    return candidates[-1]


def load_rows(path: Path) -> list[dict]:
    with path.open() as fp:
        rows = list(csv.DictReader(fp))
    if not rows:
        sys.exit(f"error: no rows in {path}")
    return rows


def build_budget_execution(year: int) -> dict:
    """Map budget_actual_FY<N>.json by_department into the shapes the page
    filters (by_department) and counts (all_departments). Both carry the
    same full list; only the sort differs."""
    path = DATA / f"budget_actual_{fylib.fy_label(year)}.json"
    if not path.exists():
        print(f"warning: {path.relative_to(REPO)} not found; "
              "emitting empty budget_execution (over-budget panel will "
              "show no departments)")
        return {"by_department": [], "all_departments": []}

    budget = json.loads(path.read_text())
    depts = []
    for row in budget.get("by_department", []):
        revised = row.get("revised_budget") or 0
        actual = row.get("actual") or 0
        depts.append({
            "name": row["name"],
            "revised": round(revised, 2),
            "actual": round(actual, 2),
            "delta": round(actual - revised, 2),
            "pct": round(actual / revised * 100, 2) if revised else None,
        })
    return {
        # Page takes the first five rows with pct>=100 & delta>25000, so
        # biggest overruns must come first.
        "by_department": sorted(depts, key=lambda d: (-d["delta"], d["name"])),
        "all_departments": sorted(depts, key=lambda d: (-d["revised"], d["name"])),
    }


def build(rows: list[dict], year: int) -> dict:
    dates = sorted(r["Date"][:10] for r in rows if r.get("Date"))
    as_of = dates[-1] if dates else fylib.fy_start(year).isoformat()
    as_of_date = dt.date.fromisoformat(as_of)

    # Monthly cadence across all funds.
    cadence: dict[str, list] = defaultdict(lambda: [0.0, 0])
    # Per-fund vendor and monthly rollups.
    fund_vendors: dict[str, dict[str, list]] = defaultdict(
        lambda: defaultdict(lambda: [0.0, 0]))
    fund_monthly: dict[str, dict[str, list]] = defaultdict(
        lambda: defaultdict(lambda: [0.0, 0]))

    for r in rows:
        amount = float(r["Amount"])
        month = r["Date"][:7]
        fund = r["Fund"]
        cadence[month][0] += amount
        cadence[month][1] += 1
        fund_vendors[fund][r["Vendor"]][0] += amount
        fund_vendors[fund][r["Vendor"]][1] += 1
        fund_monthly[fund][month][0] += amount
        fund_monthly[fund][month][1] += 1

    monthly_cadence = [
        {"month": m, "amount": round(v[0], 2), "count": v[1]}
        for m, v in sorted(cadence.items())
    ]

    by_fund = {}
    for fund in sorted(fund_vendors):
        vendors = sorted(
            fund_vendors[fund].items(),
            key=lambda kv: (-kv[1][0], kv[0]))
        by_fund[fund] = {
            "top_vendors": [
                {"name": name, "amount": round(v[0], 2), "count": v[1]}
                for name, v in vendors[:12]
            ],
            # Only months present in the data — the page's fund sparklines
            # expect the actual payment months, not a padded FY axis.
            "monthly": [
                {"month": m, "amount": round(v[0], 2), "count": v[1]}
                for m, v in sorted(fund_monthly[fund].items())
            ],
        }

    return {
        "as_of": as_of,
        "fiscal_year": fylib.fy_label(year),
        "generated_by": "scripts/build_checkbook_performance.py",
        "fy_months_elapsed": fylib.months_elapsed(year, as_of_date),
        "fy_pct_elapsed": fylib.pct_elapsed(year, as_of_date),
        "budget_execution": build_budget_execution(year),
        "monthly_cadence": monthly_cadence,
        "drill": {"by_fund": by_fund},
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=fylib.current_fiscal_year(),
                    help="Fiscal year to build (default: current fiscal year)")
    ap.add_argument("--out", type=Path,
                    default=DATA / "checkbook_performance.json")
    args = ap.parse_args()

    snapshot = latest_snapshot(args.year)
    perf = build(load_rows(snapshot), args.year)
    args.out.write_text(json.dumps(perf, indent=2) + "\n")
    out_label = (args.out.relative_to(REPO)
                 if args.out.resolve().is_relative_to(REPO) else args.out)
    print(f"wrote {out_label} from {snapshot.name} "
          f"(as_of {perf['as_of']}, {len(perf['monthly_cadence'])} months, "
          f"{len(perf['drill']['by_fund'])} funds)")


if __name__ == "__main__":
    main()
