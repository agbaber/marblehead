#!/usr/bin/env python3
"""
Build data/checkbook_view.json — the JSON the choice-bucketed checkbook
sketch reads to fill in every dollar amount, percentage, project status
card, carve-out segment, and what-moved-this-week row.

Inputs:
  - The latest data/checkbook_FY26_<date>.csv  (current snapshot)
  - The previous data/checkbook_FY26_<date>.csv (prior snapshot, optional)
    Used for the "what moved this week" panel. If missing, the panel
    data is omitted and the sketch will hide that section.

Output:
  - data/checkbook_view.json

Usage:
  scripts/build_checkbook_view.py              # auto-detect current + prior
  scripts/build_checkbook_view.py --current data/checkbook_FY26_2026-06-11.csv \\
                                  --prior   data/checkbook_FY26_2026-06-09.csv

The classification logic mirrors what the sketch v2 page describes in
prose. Changes to bucket/carve-out definitions need to update both this
file AND the sketch's bracket labels so they stay in sync.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"


# ----- Classification rules (shared with the sketch's prose) ---------------

def bucket_for_fund(fund: str) -> str:
    """Classify a fund into one of six top-level buckets."""
    f = fund.upper()
    if re.match(r"^A\d+\s", f):
        # A-numbered capital funds are ballot exclusions
        # except A36 MWRA which is enterprise borrowing
        if "MWRA" in f:
            return "ratepayer"
        return "ballot"
    if "ELECTRIC ENTERPRISE" in f:
        return "ratepayer"
    if "WATER ENTERPRISE" in f or "WATER CAPITAL" in f:
        return "ratepayer"
    if "SEWER ENTERPRISE" in f or "SEWER CAPITAL" in f:
        return "ratepayer"
    if "HARBOR ENTERPRISE" in f or "HARBOR CAPITAL" in f:
        return "ratepayer"
    if "MWRA" in f:
        return "ratepayer"
    if "GENERAL FUND" in f:
        return "town_meeting"
    if any(t in f for t in ("CIRCUIT BREAKER", "ARPA", "IDEA", "SCHOOL LUNCH",
                            "TITLE I", "SPED", "METCO", "GRANT", "ESSER",
                            "CHAPTER 90")):
        return "state_fed"
    if "REVOLVING" in f or "REVOLV" in f:
        return "revolving"
    return "other"


def carveout_for_gf_town_row(row: dict) -> str:
    """Classify a GF-Town row into one of the carve-out segments."""
    div = row["Division"].upper()
    vendor = row["Vendor"].upper()
    if div in {"GROUP INSURANCE", "OTHER INSURANCE"}:
        return "gic_insurance"
    if div == "CONTRIBUTORY RETIREMENT":
        return "pension"
    if "U.S. BANK" in vendor:
        return "debt_us_bank"
    if "COMMONWEALTH OF MA" in vendor:
        return "cherry_sheet"
    # Multi-year Town Administrator contracts the town can't unilaterally
    # cancel mid-year. Matched by known recurring vendor families.
    admin_vendors = {
        "REPUBLIC SERVICES", "WASTE MANAGEMENT OF MA", "TYLER TECHNOLOGIES",
        "FUTURE TECHNOLOGIES", "ALTUS DENTAL", "VOYA", "CLIFTONLARSONALLEN",
        "MIIA", "MEAD TALERMAN", "PARETO HEALTH",
    }
    if any(v in vendor for v in admin_vendors):
        return "admin_contracts"
    return "other_recurring"


# ----- Project status inference for ballot-funded capital projects ---------

def infer_project_status(row_count: int, last_paid_iso: str,
                         vendor_mix: list, snapshot_date_iso: str) -> str:
    """
    Status label inferred from ledger activity. Heuristic:
      - Closing out: small total OR no payment in 90+ days
      - Engineering / design phase: 100% to one engineering firm; small total
      - Active: recent payment + multiple GCs
    """
    if not last_paid_iso:
        return "unknown"
    snap = datetime.fromisoformat(snapshot_date_iso)
    last = datetime.fromisoformat(last_paid_iso)
    days_since = (snap - last).days

    if days_since > 120 and row_count < 10:
        return "closing"
    top_vendor_share = vendor_mix[0][1] if vendor_mix else 0
    if vendor_mix and top_vendor_share >= 0.9 and row_count < 15:
        # Single dominant vendor + small footprint: engineering/design phase
        return "engineering"
    if days_since <= 60:
        return "active"
    return "wrapping"


# ----- Build pipeline ------------------------------------------------------

def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as fp:
        return list(csv.DictReader(fp))


def latest_snapshot() -> Path:
    candidates = sorted(DATA.glob("checkbook_FY26_*.csv"))
    if not candidates:
        sys.exit("error: no data/checkbook_FY26_*.csv snapshots found")
    return candidates[-1]


def prior_snapshot(current: Path) -> Path | None:
    candidates = sorted(DATA.glob("checkbook_FY26_*.csv"))
    if current not in candidates:
        return None
    idx = candidates.index(current)
    if idx == 0:
        return None
    return candidates[idx - 1]


def snapshot_date_from_filename(path: Path) -> str:
    """data/checkbook_FY26_2026-06-11.csv  →  '2026-06-11'."""
    m = re.search(r"checkbook_FY26_(\d{4}-\d{2}-\d{2})", path.name)
    return m.group(1) if m else ""


def build(current_path: Path, prior_path: Path | None) -> dict:
    current_rows = load_csv(current_path)
    if not current_rows:
        sys.exit(f"error: no rows in {current_path}")
    snap_date = snapshot_date_from_filename(current_path)

    total_paid = sum(float(r["Amount"]) for r in current_rows)
    dates = [r["Date"][:10] for r in current_rows if r["Date"]]

    # --- Bucket rollup ---
    by_fund = defaultdict(float)
    by_fund_rows = defaultdict(int)
    for r in current_rows:
        by_fund[r["Fund"]] += float(r["Amount"])
        by_fund_rows[r["Fund"]] += 1

    bucket_totals = defaultdict(float)
    bucket_funds = defaultdict(list)
    for fund, amount in by_fund.items():
        b = bucket_for_fund(fund)
        bucket_totals[b] += amount
        bucket_funds[b].append({
            "name": fund,
            "amount": round(amount, 2),
            "row_count": by_fund_rows[fund],
        })
    for funds in bucket_funds.values():
        funds.sort(key=lambda f: -f["amount"])

    bucket_order = ["ballot", "town_meeting", "ratepayer",
                    "state_fed", "revolving", "other"]
    bucket_labels = {
        "ballot":       "Voted by you, at the ballot",
        "town_meeting": "Ratified at Town Meeting",
        "ratepayer":    "Paid by ratepayers, not your tax bill",
        "state_fed":    "State & federal restricted grants",
        "revolving":    "Revolving funds (paid by users of the service)",
        "other":        "Trusts, donations, and small fundraising funds",
    }
    buckets = [{
        "key":        k,
        "label":      bucket_labels[k],
        "amount":     round(bucket_totals[k], 2),
        "share":      round(bucket_totals[k] / total_paid, 4),
        "fund_count": len(bucket_funds[k]),
        "top_funds":  bucket_funds[k][:8],
    } for k in bucket_order]

    # --- GF-Town carve-out (six segments) ---
    gf_town = [r for r in current_rows if r["Fund"] == "GENERAL FUND - TOWN"]
    gf_total = sum(float(r["Amount"]) for r in gf_town)
    carve_totals = defaultdict(float)
    carve_rows = defaultdict(int)
    carve_top_vendors = defaultdict(lambda: defaultdict(float))
    for r in gf_town:
        seg = carveout_for_gf_town_row(r)
        amt = float(r["Amount"])
        carve_totals[seg] += amt
        carve_rows[seg] += 1
        carve_top_vendors[seg][r["Vendor"]] += amt

    carve_order = ["gic_insurance", "debt_us_bank", "pension", "cherry_sheet",
                   "admin_contracts", "other_recurring"]
    carve_labels = {
        "gic_insurance":   "GIC + insurance",
        "debt_us_bank":    "Bond debt service (U.S. Bank)",
        "pension":         "Pension assessment (PERAC)",
        "cherry_sheet":    "State assessments (Cherry Sheet)",
        "admin_contracts": "Town Administrator multi-year contracts",
        "other_recurring": "Other recurring (refunds, commodities, transfers)",
    }
    # Pre-compute zone sums for the hero claim + bracket annotations
    fixed_keys = {"gic_insurance", "debt_us_bank", "pension", "cherry_sheet"}
    fixed_total = sum(carve_totals[k] for k in fixed_keys)
    admin_total = carve_totals["admin_contracts"]
    other_total = carve_totals["other_recurring"]
    carveout = {
        "total": round(gf_total, 2),
        "fixed_total":         round(fixed_total, 2),
        "fixed_share":         round(fixed_total / gf_total, 4) if gf_total else 0,
        "admin_contracts_total": round(admin_total, 2),
        "admin_contracts_share": round(admin_total / gf_total, 4) if gf_total else 0,
        "other_recurring_total": round(other_total, 2),
        "other_recurring_share": round(other_total / gf_total, 4) if gf_total else 0,
        "segments": [{
            "key":   k,
            "label": carve_labels[k],
            "amount": round(carve_totals[k], 2),
            "share":  round(carve_totals[k] / gf_total, 4) if gf_total else 0,
            "row_count": carve_rows[k],
            "top_vendors": sorted(
                ({"name": v, "amount": round(a, 2)}
                 for v, a in carve_top_vendors[k].items()),
                key=lambda x: -x["amount"]
            )[:8],
        } for k in carve_order],
    }

    # --- Ballot projects ---
    ballot_project_ids = [f for f, b in
                          ((f, bucket_for_fund(f)) for f in by_fund)
                          if b == "ballot"]
    # Hand-mapped ballot citations (matches what the sketch already shows;
    # easy to extend as more A-funds get added)
    ballot_meta = {
        "A11 2022 CAPITAL IMPROVEMENT": {
            "display":   "A11 2022 Capital Improvement (omnibus)",
            "ballot":    "2022-06-21",
            "purpose":   "roofs, roads/sidewalks, smart panels, HVAC, salt shed, HS boiler",
            "context":   "Bonds run 10-20 years; debt service appears in U.S. Bank rows through the late 2030s.",
        },
        "A34 2015 NEW TRANSF STATION": {
            "display":   "A34 2015 New Transfer Station + drainage",
            "ballot":    "2015-06-16",
            "purpose":   "transfer-station construction + drainage pipe replacement",
            "context":   "Eleven fiscal years on, construction draws still moving - phased build-out or scope amendment under the original authorization.",
        },
        "A33 2025-ALLEY BLDG IMPROV": {
            "display":   "A33 2025 Mary Alley Building Improv + HVAC",
            "ballot":    "2025-06-10",
            "purpose":   "town's most recent debt exclusion",
            "context":   "Bond is in pre-issuance design phase; debt service starts once construction draws begin.",
        },
        "A35 2021 ABBOT LIBRARY RENOV": {
            "display":   "A35 2021 Abbot Public Library Renovation",
            "ballot":    "2021-06-22",
            "purpose":   "~$8.5M bond, the library reopened in 2023",
            "context":   "Project fund essentially closed; bond debt service on the $8.5M continues in U.S. Bank rows for the remainder of the ~20-year term.",
        },
        "A36 2019 MWRA LOAN": {
            "display":   "A36 2019 MWRA Loan project",
            "ballot":    "2019-06-18",
            "purpose":   "MWRA borrowing for water-system work",
            "context":   "MWRA loan repayment is via water rates rather than the property-tax levy, so this one shows up in the Ratepayer bucket on the bond-service side.",
        },
    }

    ballot_projects = []
    for fund_id in sorted(ballot_project_ids,
                          key=lambda f: -by_fund[f]):
        fund_rows = [r for r in current_rows if r["Fund"] == fund_id]
        amount = sum(float(r["Amount"]) for r in fund_rows)
        fund_dates = sorted([r["Date"][:10] for r in fund_rows if r["Date"]])
        first_paid = fund_dates[0] if fund_dates else ""
        last_paid = fund_dates[-1] if fund_dates else ""
        vendor_totals = defaultdict(float)
        for r in fund_rows:
            vendor_totals[r["Vendor"]] += float(r["Amount"])
        vmix = sorted(((v, a / amount) for v, a in vendor_totals.items()
                       if amount), key=lambda x: -x[1])
        top_vendors = [{"name": v, "amount": round(vendor_totals[v], 2),
                        "share": round(vendor_totals[v] / amount, 4)}
                       for v, _ in vmix[:5]]
        status = infer_project_status(len(fund_rows), last_paid,
                                      vmix, snap_date)
        meta = ballot_meta.get(fund_id, {})
        ballot_projects.append({
            "fund_id":     fund_id,
            "display":     meta.get("display", fund_id),
            "ballot_date": meta.get("ballot", ""),
            "purpose":     meta.get("purpose", ""),
            "context":     meta.get("context", ""),
            "amount":      round(amount, 2),
            "row_count":   len(fund_rows),
            "first_paid":  first_paid,
            "last_paid":   last_paid,
            "days_since_last_paid": (
                (datetime.fromisoformat(snap_date)
                 - datetime.fromisoformat(last_paid)).days
                if last_paid else None
            ),
            "status":      status,
            "top_vendors": top_vendors,
        })

    # --- What moved since prior snapshot ---
    what_moved = None
    if prior_path:
        prior_rows = load_csv(prior_path)
        # Stable row key across the two snapshots' (slightly different)
        # schemas: Vendor, Fund, Division, Date, Amount.
        def key(r):
            return (r["Vendor"], r["Fund"], r["Division"], r["Date"],
                    r["Amount"])
        prior_keys = {key(r) for r in prior_rows}
        current_keys = {key(r) for r in current_rows}
        added = [r for r in current_rows if key(r) not in prior_keys]
        removed_count = len(prior_keys - current_keys)
        added_amount = sum(float(r["Amount"]) for r in added)
        mover_totals = defaultdict(lambda: [0, 0.0])
        for r in added:
            mover_totals[r["Vendor"]][0] += 1
            mover_totals[r["Vendor"]][1] += float(r["Amount"])
        top_movers = sorted(mover_totals.items(),
                            key=lambda kv: -kv[1][1])[:8]
        what_moved = {
            "prior_snapshot_date":   snapshot_date_from_filename(prior_path),
            "current_snapshot_date": snap_date,
            "new_rows":   len(added),
            "new_amount": round(added_amount, 2),
            "edited_or_removed_rows": removed_count,
            "top_movers": [{
                "vendor":    v,
                "delta":     round(amt, 2),
                "rows":      c,
            } for v, (c, amt) in top_movers],
        }

    return {
        "schema_version": 1,
        "snapshot": {
            "date":           snap_date,
            "fiscal_year":    "FY26",
            "row_count":      len(current_rows),
            "total_paid":     round(total_paid, 2),
            "first_payment":  min(dates) if dates else "",
            "last_payment":   max(dates) if dates else "",
            "source_file":    current_path.name,
        },
        "buckets":         buckets,
        "gf_town_carveout": carveout,
        "ballot_projects": ballot_projects,
        "what_moved":      what_moved,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--current", type=Path,
                    help="Current checkbook CSV (defaults to newest)")
    ap.add_argument("--prior", type=Path,
                    help="Prior checkbook CSV (defaults to one before current)")
    ap.add_argument("--out", type=Path, default=DATA / "checkbook_view.json")
    args = ap.parse_args()

    current = args.current or latest_snapshot()
    prior = args.prior or prior_snapshot(current)

    view = build(current, prior)
    args.out.write_text(json.dumps(view, indent=2) + "\n")
    print(f"wrote {args.out.relative_to(REPO)} from {current.name}"
          + (f" (diffed vs {prior.name})" if prior else " (no prior diff)"))


if __name__ == "__main__":
    main()
