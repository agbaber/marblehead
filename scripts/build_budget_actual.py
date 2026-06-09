#!/usr/bin/env python3
"""
Build data/budget_actual_FY26.json from:
  - Socrata budget-portal CSV exports in ~/Downloads/ (budget vs. actual,
    Budgeted Annual Funds group, sliced by Fund/Division/Object/Category/
    Department) plus the Adopted_Budget top-level rollup.
  - data/checkbook_FY26_*.csv (15.6k vendor-payment rows) for the
    checkbook totals card.

Output is a single normalized JSON file the checkbook/budget tool reads.

Re-runnable: edit the SOURCE_FILES paths below for a future export, then
`python scripts/build_budget_actual.py`. Prints a sanity summary to stdout.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
DOWNLOADS = Path.home() / "Downloads"

# Source CSV exports (Socrata budget portal). One CSV per dimension; all of
# them cover the BUDGETED ANNUAL FUNDS group and should each total to the
# same ~$127.34M.
SOURCE_FILES = {
    "all_funds_rollup": DOWNLOADS / "Adopted_Budget - All Funds_20260601.csv",
    "by_fund":          DOWNLOADS / "Fund_Group_20260601.csv",
    "by_division":      DOWNLOADS / "Fund_Group_20260601 (1).csv",
    "by_object":        DOWNLOADS / "Fund_Group_20260601 (2).csv",
    "by_category":      DOWNLOADS / "Fund_Group_20260601 (3).csv",
    "by_department":    DOWNLOADS / "Fund_Group_20260601 (4).csv",
}

CHECKBOOK_CSV = DATA_DIR / "checkbook_FY26_2026-06-02.csv"

OUT_PATH = DATA_DIR / "budget_actual_FY26.json"

# Reference values from the task description, used only for sanity-check
# warnings. The script re-derives the real totals from the CSVs.
REFERENCE = {
    "all_funds_revised_budget": 206063591.63,
    "all_funds_actual": 140446487.84,
    "budgeted_annual_revised": 127338097.88,
    "budgeted_annual_actual": 118865422.10,
    "other_funds_revised": 78725493.75,
    "other_funds_actual": 21581065.74,
    "checkbook_total": 98488006.04,
    "checkbook_rows": 15561,
}

# How close computed totals must match each dimension's own revised-budget
# total to trust the export. Larger than penny-rounding, smaller than a
# real discrepancy.
TOLERANCE_DOLLARS = 1.0


def parse_amount(raw: str | None) -> float:
    """Parse a Socrata money string into a float.

    Handles:
      - empty / None / whitespace -> 0.0
      - thousands commas
      - leading/trailing whitespace
      - parenthesized negatives e.g. "(170.73)"
      - stray %, $
    """
    if raw is None:
        return 0.0
    s = str(raw).strip()
    if not s:
        return 0.0
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    s = s.replace(",", "").replace("$", "").replace("%", "").strip()
    if not s or s.upper() in {"N/A", "NA", "-"}:
        return 0.0
    try:
        v = float(s)
    except ValueError:
        return 0.0
    return -v if neg else v


def open_csv(path: Path):
    """Open with utf-8-sig so any BOM on the first header is stripped."""
    return open(path, encoding="utf-8-sig", newline="")


def normalize_headers(fieldnames: list[str]) -> list[str]:
    return [h.strip() for h in fieldnames]


def read_dimension_csv(path: Path, name_col: str) -> list[dict]:
    """Read one dimension CSV and return [{name, revised_budget, actual,
    original_budget}, ...].

    name_col is the canonical column we expect in the first position
    (e.g. 'Fund', 'Division'). Header BOM and trailing spaces are stripped.
    """
    rows: list[dict] = []
    with open_csv(path) as f:
        reader = csv.DictReader(f)
        reader.fieldnames = normalize_headers(reader.fieldnames or [])
        if name_col not in reader.fieldnames:
            raise SystemExit(
                f"{path.name}: expected column '{name_col}' in header "
                f"{reader.fieldnames!r}"
            )
        for raw in reader:
            name = (raw.get(name_col) or "").strip()
            if not name:
                continue
            rows.append({
                "name": name,
                "revised_budget": round(parse_amount(raw.get("Revised Budget")), 2),
                "actual": round(parse_amount(raw.get("Actual")), 2),
                "original_budget": round(parse_amount(raw.get("Original Budget")), 2),
            })
    rows.sort(key=lambda r: r["revised_budget"], reverse=True)
    return rows


def read_fund_group_rollup(path: Path) -> dict:
    """Parse the All Funds top-level rollup (Budgeted Annual / Other Funds)."""
    out: dict[str, dict] = {}
    with open_csv(path) as f:
        reader = csv.DictReader(f)
        reader.fieldnames = normalize_headers(reader.fieldnames or [])
        if "Fund Group" not in reader.fieldnames:
            raise SystemExit(
                f"{path.name}: expected 'Fund Group' column in header "
                f"{reader.fieldnames!r}"
            )
        for raw in reader:
            group = (raw.get("Fund Group") or "").strip()
            if not group:
                continue
            out[group] = {
                "revised_budget": round(parse_amount(raw.get("Revised Budget")), 2),
                "actual": round(parse_amount(raw.get("Actual")), 2),
                "original_budget": round(parse_amount(raw.get("Original Budget")), 2),
            }
    return out


def summarize_checkbook(path: Path) -> tuple[float, int, str]:
    """Sum the Amount column and find the max Date. Returns (total, count,
    max_date_iso)."""
    total = 0.0
    count = 0
    max_date = ""
    with open_csv(path) as f:
        reader = csv.DictReader(f)
        for raw in reader:
            amt = parse_amount(raw.get("Amount"))
            total += amt
            count += 1
            d = (raw.get("Date") or "").strip()
            if d and d > max_date:
                max_date = d
    if max_date:
        # Socrata dumps like '2026-05-29T00:00:00.000' -> keep YYYY-MM-DD
        max_date = max_date.split("T", 1)[0]
    return round(total, 2), count, max_date


def check(label: str, computed: float, reference: float) -> None:
    delta = computed - reference
    flag = "OK" if abs(delta) < TOLERANCE_DOLLARS else "MISMATCH"
    print(
        f"  [{flag}] {label}: computed={computed:>15,.2f}  "
        f"reference={reference:>15,.2f}  delta={delta:+,.2f}"
    )


def main() -> int:
    print("Reading source CSVs...")
    for key, p in SOURCE_FILES.items():
        if not p.exists():
            print(f"  MISSING: {key} -> {p}", file=sys.stderr)
            return 2
        print(f"  {key:18s} {p.name}")

    # All-funds rollup (Budgeted Annual + Other Funds)
    rollup = read_fund_group_rollup(SOURCE_FILES["all_funds_rollup"])
    budgeted_annual = rollup.get("BUDGETED ANNUAL FUNDS") or {}
    other_funds = rollup.get("OTHER FUNDS") or {}

    all_funds_revised = round(
        budgeted_annual.get("revised_budget", 0.0) + other_funds.get("revised_budget", 0.0), 2,
    )
    all_funds_actual = round(
        budgeted_annual.get("actual", 0.0) + other_funds.get("actual", 0.0), 2,
    )

    # Per-dimension breakdowns (all of these are the Budgeted Annual envelope)
    by_fund = read_dimension_csv(SOURCE_FILES["by_fund"], "Fund")
    by_division = read_dimension_csv(SOURCE_FILES["by_division"], "Division")
    by_object = read_dimension_csv(SOURCE_FILES["by_object"], "Object")
    by_category = read_dimension_csv(SOURCE_FILES["by_category"], "Category")
    by_department = read_dimension_csv(SOURCE_FILES["by_department"], "Department")

    # Checkbook actuals (vendor payment line items)
    checkbook_total, checkbook_count, checkbook_max_date = summarize_checkbook(CHECKBOOK_CSV)

    # ---- sanity checks ---------------------------------------------------
    print("\nSanity check (computed vs. reference task values):")
    check("all_funds_revised",      all_funds_revised,                 REFERENCE["all_funds_revised_budget"])
    check("all_funds_actual",       all_funds_actual,                  REFERENCE["all_funds_actual"])
    check("budgeted_annual revised", budgeted_annual.get("revised_budget", 0.0), REFERENCE["budgeted_annual_revised"])
    check("budgeted_annual actual",  budgeted_annual.get("actual", 0.0),         REFERENCE["budgeted_annual_actual"])
    check("other_funds revised",    other_funds.get("revised_budget", 0.0), REFERENCE["other_funds_revised"])
    check("other_funds actual",     other_funds.get("actual", 0.0),          REFERENCE["other_funds_actual"])
    check("checkbook_total",        checkbook_total,                   REFERENCE["checkbook_total"])
    if checkbook_count != REFERENCE["checkbook_rows"]:
        print(
            f"  [MISMATCH] checkbook_rows: computed={checkbook_count} "
            f"reference={REFERENCE['checkbook_rows']}"
        )
    else:
        print(f"  [OK] checkbook_rows: {checkbook_count}")

    # Cross-dimension check: each Budgeted Annual slice should sum to the same total
    dim_sums: dict[str, dict[str, float]] = {}
    for label, rows in [
        ("by_fund", by_fund),
        ("by_division", by_division),
        ("by_object", by_object),
        ("by_category", by_category),
        ("by_department", by_department),
    ]:
        dim_sums[label] = {
            "rows": len(rows),
            "revised_budget": round(sum(r["revised_budget"] for r in rows), 2),
            "actual": round(sum(r["actual"] for r in rows), 2),
            "original_budget": round(sum(r["original_budget"] for r in rows), 2),
        }

    print("\nDimension cross-check (each should sum to BUDGETED ANNUAL FUNDS):")
    ba_rev = budgeted_annual.get("revised_budget", 0.0)
    ba_act = budgeted_annual.get("actual", 0.0)
    biggest_delta = 0.0
    for label, s in dim_sums.items():
        d_rev = s["revised_budget"] - ba_rev
        d_act = s["actual"] - ba_act
        biggest_delta = max(biggest_delta, abs(d_rev), abs(d_act))
        flag = "OK" if max(abs(d_rev), abs(d_act)) < TOLERANCE_DOLLARS else "WARN"
        print(
            f"  [{flag}] {label:14s} rows={s['rows']:>3}  "
            f"revised={s['revised_budget']:>15,.2f} (Δ {d_rev:+,.2f})  "
            f"actual={s['actual']:>15,.2f} (Δ {d_act:+,.2f})"
        )

    # ---- decide if anything is too far off to ship -----------------------
    hard_errors = []
    if abs(all_funds_revised - REFERENCE["all_funds_revised_budget"]) > TOLERANCE_DOLLARS:
        hard_errors.append("all_funds_revised disagrees with reference by > $1")
    if abs(all_funds_actual - REFERENCE["all_funds_actual"]) > TOLERANCE_DOLLARS:
        hard_errors.append("all_funds_actual disagrees with reference by > $1")
    if abs(checkbook_total - REFERENCE["checkbook_total"]) > TOLERANCE_DOLLARS:
        hard_errors.append("checkbook_total disagrees with reference by > $1")
    if checkbook_count != REFERENCE["checkbook_rows"]:
        hard_errors.append(
            f"checkbook_rows {checkbook_count} != reference {REFERENCE['checkbook_rows']}"
        )

    if hard_errors:
        print("\nHard errors -- not writing output:", file=sys.stderr)
        for e in hard_errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    # ---- assemble + write ------------------------------------------------
    out = OrderedDict()
    out["as_of"] = "2026-06-01"
    out["fiscal_year"] = "FY26"
    out["checkbook_period_end"] = checkbook_max_date
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
        ("checkbook_total", checkbook_total),
        ("checkbook_row_count", checkbook_count),
    ])
    out["by_fund"] = by_fund
    out["by_department"] = by_department
    out["by_category"] = by_category
    out["by_division"] = by_division
    out["by_object"] = by_object

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")

    print(f"\nWrote {OUT_PATH.relative_to(REPO_ROOT)}")
    print(
        f"  totals.all_funds_revised_budget = ${out['totals']['all_funds_revised_budget']:,.2f}"
    )
    print(
        f"  totals.all_funds_actual         = ${out['totals']['all_funds_actual']:,.2f}"
    )
    print(
        f"  totals.budgeted_annual.revised  = ${out['totals']['budgeted_annual']['revised_budget']:,.2f}"
    )
    print(
        f"  totals.budgeted_annual.actual   = ${out['totals']['budgeted_annual']['actual']:,.2f}"
    )
    print(
        f"  totals.other_funds.revised      = ${out['totals']['other_funds']['revised_budget']:,.2f}"
    )
    print(
        f"  totals.other_funds.actual       = ${out['totals']['other_funds']['actual']:,.2f}"
    )
    print(
        f"  totals.checkbook_total          = ${out['totals']['checkbook_total']:,.2f} "
        f"({out['totals']['checkbook_row_count']} rows, through {out['checkbook_period_end']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
