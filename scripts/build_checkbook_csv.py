#!/usr/bin/env python3
"""
Build the published checkbook CSV from a raw spending-portal export,
keeping the Description column with surgical redaction instead of
dropping it wholesale.

Input: the town spending portal's CSV export (Vendor, Fund, Division,
Description, Date, Amount), downloaded manually from
https://townofmarblehead-ma-oe.spending.socrata.com/ with the year
filter set to the target fiscal year. The raw export contains employee
surnames (injury/comp medical claims) and student initials (out-of-
district SpEd placements), so it must never be committed to the repo.

What this script does:
  1. Drops every row in the two medical-claim funds (111F Injury Leave,
     Workers Compensation), same as the original 2026-06 redaction.
  2. Keeps Description on all other rows, except rows matching the
     student/employee-identifying rules below, where Description is
     replaced with "[withheld]". Vendor, fund, date, and amount stay.
  3. Writes data/checkbook_FY26_<as-of>.csv and rewrites
     data/checkbook_redaction_disclosure.json with computed counts.
  4. Writes a review file (NOT in data/, never commit it) listing every
     masked description and every kept description in student-related
     funds.

REVIEW THE REVIEW FILE BEFORE COMMITTING. The masking rules are
heuristics; the review file is the actual privacy gate. If a kept
description identifies a person, add a pattern below and re-run.

Usage:
  python3 scripts/build_checkbook_csv.py ~/Downloads/raw_export.csv
  python3 scripts/build_checkbook_csv.py --selftest

After committing the regenerated CSV, update in checkbook.html:
  - CHECKBOOK_URL (the file name carries the as-of date)
  - the Source files list in the Notes section
The Description column and the matching redaction note switch on
automatically once the page sees the new column.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
REVIEW_PATH = Path("/tmp/checkbook_redaction_review.tsv")
WITHHELD = "[withheld]"

REQUIRED_COLUMNS = ["Vendor", "Fund", "Division", "Description", "Date", "Amount"]

# Rows in these funds are dropped entirely: vendor + amount + the fund
# itself combine into identifiable medical claim data even without a
# description.
EXCLUDED_FUNDS = {
    "111F INJURY LEAVE FUND": (
        "Pays for medical care of named police/fire employees injured on "
        "duty under MGL c.41 §111F. Vendor + amount + employee identity "
        "combine to form identifiable medical claim data."
    ),
    "WORKERS COMPENSATION FUND": (
        "Pays for medical care of named town employees with workers-"
        "compensation claims. Same identifiability concern as 111F."
    ),
}

# Funds whose descriptions can identify individual students. In these
# funds a description is masked when any STUDENT_DESC_RES rule matches.
STUDENT_FUND_RE = re.compile(r"SCHOOL|SPED|CIRCUIT BREAKER|METCO|STUDENT", re.I)

# Dotted initials ("J.D.", "J. D."), excluding common non-name pairs.
INITIALS_RE = re.compile(r"\b([A-Z])\s?\.\s?([A-Z])\b\.?")
INITIALS_ALLOW = {
    "PO", "US", "MA", "AM", "PM", "DC", "RI", "NH", "CT", "VT", "ME",
    "MR", "MS", "DR", "IT", "AV", "EL",
}

# Run on desc.upper(): catches trailing initials and the literal STUDENT keyword.
STUDENT_DESC_RES = [
    re.compile(
        r"\b(TUITION|PLACEMENT|OOD|OUT[- ]OF[- ]DISTRICT|RESIDENTIAL)\b"
        r".*\b[A-Z]{1,3}\b[\s.]*$"
    ),
    re.compile(r"\bSTUDENT\b\s+[A-Z]"),
]

# Run on raw desc (case-sensitive): catches truncated student first names
# at the end of an OOD/tuition line. Munis' description column truncates
# at 30 chars, so e.g. "Out of district tuition Williamson" lands in the
# export as "Out of district tuition Willia". The pattern requires a
# Title-case trailing token (initial cap, 2+ lowercase) so all-caps boiler-
# plate like "TUITION FY26 INVOICE" or "RESIDENTIAL CIRCUIT BREAKER" is
# left alone, while real student first names get masked. Over-masking
# Title-case program names ("Day tuition Riverview Circuit") is fine:
# vendor + fund + amount still convey what the spend was for.
STUDENT_DESC_RES_RAW = [
    re.compile(
        r"\b(?i:tuition|placement|OOD|out[- ]of[- ]district|residential)\b"
        r".*\b[A-Z][a-z]{2,}\b[\s.]*$"
    ),
]

# Masked in any fund. The injury funds are dropped outright, but injury
# references occasionally appear elsewhere in the ledger.
GLOBAL_DESC_RES = [re.compile(r"\bINJURY\b", re.I)]


def has_initials(desc: str) -> bool:
    for m in INITIALS_RE.finditer(desc):
        if (m.group(1) + m.group(2)) not in INITIALS_ALLOW:
            return True
    return False


def mask_reason(fund: str, desc: str) -> str | None:
    """Return a short rule label if this description must be masked."""
    if not desc:
        return None
    for rx in GLOBAL_DESC_RES:
        if rx.search(desc):
            return "injury reference"
    if STUDENT_FUND_RE.search(fund):
        if has_initials(desc):
            return "initials in student-related fund"
        for rx in STUDENT_DESC_RES:
            if rx.search(desc.upper()):
                return "placement/tuition pattern in student-related fund"
        for rx in STUDENT_DESC_RES_RAW:
            if rx.search(desc):
                return "placement/tuition pattern in student-related fund"
    return None


def selftest() -> None:
    cases = [
        ("GENERAL FUND - SCHOOL", "TUITION J.D.", True),
        ("GENERAL FUND - SCHOOL", "OOD PLACEMENT - JD", True),
        ("SPED IDEA 94-142 (240)", "RESIDENTIAL Q3 KM", True),
        ("GENERAL FUND - SCHOOL", "STUDENT A TRANSPORT", True),
        ("GENERAL FUND - TOWN", "BURT INJURY CLAIM", True),
        ("GENERAL FUND - SCHOOL", "P.O. BOX RENEWAL", False),
        ("GENERAL FUND - SCHOOL", "ART SUPPLIES GR 3", False),
        ("GENERAL FUND - TOWN", "ELECTRIC SVC 5/20", False),
        ("WATER ENTERPRISE OPERATING", "HYDRANT REPAIR J.D.", False),
        ("GENERAL FUND - SCHOOL", "TUITION FY26 INVOICE", False),
        # Munis 30-char truncation of a student first name on an OOD row
        ("GENERAL FUND - SCHOOL", "Out of district tuition Willia", True),
        # Program/school name after "tuition" — over-mask is acceptable
        ("CIRCUIT BREAKER", "Day tuition Riverview Circuit", True),
    ]
    failures = []
    for fund, desc, expect_masked in cases:
        got = mask_reason(fund, desc) is not None
        if got != expect_masked:
            failures.append(f"  {fund!r} / {desc!r}: expected masked={expect_masked}, got {got}")
    if failures:
        sys.exit("selftest FAILED:\n" + "\n".join(failures))
    print(f"selftest OK ({len(cases)} cases)")


def main() -> None:
    if "--selftest" in sys.argv:
        selftest()
        return
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    raw_path = Path(sys.argv[1]).expanduser()
    if not raw_path.exists():
        sys.exit(f"raw export not found: {raw_path}")

    with raw_path.open(newline="") as f:
        reader = csv.DictReader(f)
        cols = {c.strip().title(): c for c in reader.fieldnames or []}
        missing = [c for c in REQUIRED_COLUMNS if c not in cols]
        if missing:
            sys.exit(f"raw export is missing columns: {missing} (found {reader.fieldnames})")
        raw_rows = [{k: (r[cols[k]] or "").strip() for k in REQUIRED_COLUMNS} for r in reader]

    excluded = defaultdict(lambda: {"row_count": 0, "total_amount": 0.0, "vendors": set()})
    masked_rows = []
    kept_student_descs = defaultdict(int)
    out_rows = []

    for r in raw_rows:
        amount = float(r["Amount"])
        if r["Fund"] in EXCLUDED_FUNDS:
            ex = excluded[r["Fund"]]
            ex["row_count"] += 1
            ex["total_amount"] += amount
            ex["vendors"].add(r["Vendor"])
            continue
        reason = mask_reason(r["Fund"], r["Description"])
        if reason:
            masked_rows.append((r["Fund"], r["Vendor"], r["Description"], r["Amount"], reason))
            r = dict(r, Description=WITHHELD)
        elif r["Description"] and STUDENT_FUND_RE.search(r["Fund"]):
            kept_student_descs[(r["Fund"], r["Description"])] += 1
        out_rows.append(r)

    as_of = max(r["Date"][:10] for r in out_rows)
    out_path = DATA_DIR / f"checkbook_FY26_{as_of}.csv"
    with out_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=REQUIRED_COLUMNS)
        w.writeheader()
        w.writerows(out_rows)

    disclosure = {
        "as_of": as_of,
        "generated_by": "scripts/build_checkbook_csv.py",
        "excluded_funds": [
            {
                "name": fund,
                "reason": EXCLUDED_FUNDS[fund],
                "row_count": ex["row_count"],
                "total_amount": round(ex["total_amount"], 2),
                "distinct_vendors": len(ex["vendors"]),
            }
            for fund, ex in sorted(excluded.items())
        ],
        "columns_dropped": [],
        "description_masking": {
            "masked_row_count": len(masked_rows),
            "placeholder": WITHHELD,
            "reason": (
                "The source export's Description field includes employee "
                "surnames tied to medical claims and student initials tied "
                "to out-of-district special-ed placements. Descriptions "
                "matching those patterns are replaced with the placeholder; "
                "vendor, fund, date, and amount are unchanged. All other "
                "descriptions are published as exported."
            ),
        },
    }
    disclosure_path = DATA_DIR / "checkbook_redaction_disclosure.json"
    disclosure_path.write_text(json.dumps(disclosure, indent=1) + "\n")

    with REVIEW_PATH.open("w") as f:
        f.write("# Review before committing. Section 1: masked rows (published as "
                f"{WITHHELD}). Section 2: kept descriptions in student-related funds; "
                "if any identifies a person, add a pattern to the script and re-run.\n")
        f.write("== MASKED ==\nfund\tvendor\tdescription\tamount\trule\n")
        for row in masked_rows:
            f.write("\t".join(row) + "\n")
        f.write("== KEPT (student-related funds) ==\ncount\tfund\tdescription\n")
        for (fund, desc), n in sorted(kept_student_descs.items(), key=lambda x: -x[1]):
            f.write(f"{n}\t{fund}\t{desc}\n")

    total = sum(float(r["Amount"]) for r in out_rows)
    dropped_total = sum(ex["total_amount"] for ex in excluded.values())
    nonempty = sum(1 for r in out_rows if r["Description"] not in ("", WITHHELD))

    # Dashboard JSON read by index.html, checkbook.html, and anything
    # else that wants to cite the latest published total. Lives under
    # _data/ so Jekyll loads it as `site.data.checkbook` and the page
    # values stay locked together with no per-template regex.
    as_of_dt = date.fromisoformat(as_of)
    dashboard = {
        "as_of": as_of,
        "as_of_human": as_of_dt.strftime("%b ") + str(as_of_dt.day),
        "total_amount": round(total, 2),
        "total_M": f"${total / 1_000_000:.1f}M",
        "row_count": len(out_rows),
        "row_count_human": f"{len(out_rows):,}",
        "csv_filename": out_path.name,
        "generated_by": "scripts/build_checkbook_csv.py",
    }
    dashboard_path = REPO_ROOT / "_data" / "checkbook.json"
    dashboard_path.parent.mkdir(parents=True, exist_ok=True)
    dashboard_path.write_text(json.dumps(dashboard, indent=1) + "\n")

    print(f"input rows:      {len(raw_rows):,}")
    print(f"dropped rows:    {sum(ex['row_count'] for ex in excluded.values()):,} "
          f"(${dropped_total:,.2f}) across {len(excluded)} funds")
    print(f"masked descs:    {len(masked_rows):,}")
    print(f"published rows:  {len(out_rows):,} (${total:,.2f}), "
          f"{nonempty:,} with a visible description")
    print(f"wrote {out_path.relative_to(REPO_ROOT)}")
    print(f"wrote {disclosure_path.relative_to(REPO_ROOT)}")
    print(f"wrote {dashboard_path.relative_to(REPO_ROOT)}")
    print(f"wrote {REVIEW_PATH}  <-- review this before committing")


if __name__ == "__main__":
    main()
