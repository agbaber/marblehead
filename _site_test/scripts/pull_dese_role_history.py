#!/usr/bin/env python3
"""Pull DESE EPIMS role-level FTE history for Marblehead and three North
Shore peers (Melrose, Swampscott, Stoneham), SY2008 through SY2026.

Output: data/dese_role_staffing_history.csv with columns
district, school_year, role, fte, source.

Source dataset: educationtocareer.data.mass.gov/resource/j5ue-xkfn.json
(Education Personnel Information Management System, EPIMS).
"""
import csv
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://educationtocareer.data.mass.gov/resource/j5ue-xkfn.json"
SOURCE_LABEL = "DESE EPIMS via E2C Hub Socrata API"

DISTRICTS = ["Marblehead", "Melrose", "Swampscott", "Stoneham"]
YEARS = list(range(2008, 2027))

# (display_label, kind, value)
# kind="cat": sum all rows where jobclass_cat == value (and jobclass != All)
# kind="job": sum all rows where jobclass == value
ROLES = [
    ("Tutors", "job", "Tutor"),
    ("Paraprofessionals", "cat", "Paraprofessional"),
    ("Co-teachers", "job", "Co-teacher"),
    ("Special ed related", "cat", "Special Education Related Staff"),
    ("School counselors", "job", "School Counselor"),
    ("Administrators", "cat", "Administrators"),
    ("Teachers (core)", "job", "Teacher"),
]


def fetch(dist: str, sy: int) -> list[dict]:
    params = {
        "$select": "jobclass_cat,jobclass,fte_total",
        "$where": (
            f"dist_name='{dist}' AND sy='{sy}' "
            f"AND org_type='District' AND jobclass!='All'"
        ),
        "$limit": "500",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


def role_value(rows: list[dict], kind: str, value: str) -> float:
    if kind == "cat":
        total = sum(float(r["fte_total"]) for r in rows if r["jobclass_cat"] == value)
    else:
        total = sum(float(r["fte_total"]) for r in rows if r["jobclass"] == value)
    return round(total, 1)


def main() -> None:
    out_path = Path(__file__).resolve().parent.parent / "data" / "dese_role_staffing_history.csv"
    out_rows = [("district", "school_year", "role", "fte", "source")]
    for dist in DISTRICTS:
        for sy in YEARS:
            rows = fetch(dist, sy)
            if not rows:
                print(f"  {dist} SY{sy}: no rows", file=sys.stderr)
                continue
            for label, kind, value in ROLES:
                fte = role_value(rows, kind, value)
                out_rows.append((dist, sy, label, fte, SOURCE_LABEL))
            print(f"  {dist} SY{sy}: {len(rows)} input rows", file=sys.stderr)
    with out_path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(out_rows)
    print(f"Wrote {out_path} ({len(out_rows) - 1} data rows)")


if __name__ == "__main__":
    main()
