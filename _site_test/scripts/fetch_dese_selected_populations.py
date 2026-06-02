#!/usr/bin/env python3
"""Fetch DESE enrollment-by-reason breakdown for Marblehead.

Pulls per-school-year row counts from DESE's "Reasons for Student Enrollment
by Town (Receiving)" Socrata dataset, aggregates the (enr_reason, town_name)
rows into three buckets, and cross-checks the resulting total against the
"Enrollment: Grade, Race/Ethnicity, Gender, and Selected Populations" dataset.

Output: data/dese_metco_nonresident.csv
Sources:
  - https://educationtocareer.data.mass.gov/resource/8xyg-59b2.json
    (Reasons for Enrollment by Town - Receiving, SY 2014+)
  - https://educationtocareer.data.mass.gov/resource/t8td-gens.json
    (Enrollment Selected Populations - district totals, SY 1994+)

DESE district code for Marblehead: 01680000.
The `sy` field is the academic-year-ending year (sy=2024 means SY 2023-24,
which Marblehead reports as FY24).

Categorization (per enr_reason × town_name row):
  - town_name == "Marblehead"    -> mps_resident
  - enr_reason == "METCO"         -> metco
  - else                          -> other_nonresident

Total_enrollment = mps_resident + metco + other_nonresident, and must
match `t8td-gens` total_cnt for the same district + sy within +/-1.
"""
import csv
import json
import os
import sys
import urllib.parse
import urllib.request

OUT_PATH = "data/dese_metco_nonresident.csv"
DISTRICT_CODE = "01680000"
SCHOOL_YEARS = [str(y) for y in range(2014, 2027)]  # 2014..2026 inclusive

REASONS_RESOURCE = "8xyg-59b2"
TOTALS_RESOURCE = "t8td-gens"
SOCRATA_BASE = "https://educationtocareer.data.mass.gov/resource"

HEADERS = [
    "school_year",
    "district",
    "total_enrollment",
    "metco",
    "other_nonresident",
    "total_nonresident",
    "mps_resident_enrollment",
]


def fetch_json(url: str):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def fetch_reasons(sy: str):
    params = {"dist_code": DISTRICT_CODE, "sy": sy, "$limit": "200"}
    url = f"{SOCRATA_BASE}/{REASONS_RESOURCE}.json?{urllib.parse.urlencode(params)}"
    return fetch_json(url)


def fetch_district_total(sy: str):
    params = {"dist_code": DISTRICT_CODE, "sy": sy, "org_type": "District"}
    url = f"{SOCRATA_BASE}/{TOTALS_RESOURCE}.json?{urllib.parse.urlencode(params)}"
    rows = fetch_json(url)
    if not rows:
        return None
    return int(rows[0]["total_cnt"])


def aggregate(rows: list) -> dict:
    """Bucket rows into resident / metco / other_nonresident."""
    resident = metco = other = 0
    for r in rows:
        cnt = int(r["enr_cnt"])
        if r["town_name"] == "Marblehead":
            resident += cnt
        elif r["enr_reason"] == "METCO":
            metco += cnt
        else:
            other += cnt
    return {"resident": resident, "metco": metco, "other": other}


def school_year_label(sy: str) -> str:
    """sy=2024 -> '2023-24'."""
    end = int(sy)
    return f"{end - 1}-{str(end)[-2:]}"


def main():
    out_rows = []
    for sy in SCHOOL_YEARS:
        try:
            raw = fetch_reasons(sy)
            if not raw:
                print(f"  SY {sy}: no rows in 8xyg-59b2", file=sys.stderr)
                continue
            agg = aggregate(raw)
            total_check = fetch_district_total(sy)
            total = agg["resident"] + agg["metco"] + agg["other"]
            if total_check is not None and abs(total - total_check) > 1:
                print(
                    f"  SY {sy}: WARN total mismatch reasons={total} "
                    f"vs t8td-gens={total_check}",
                    file=sys.stderr,
                )
            print(
                f"  SY {sy}: total={total} resident={agg['resident']} "
                f"metco={agg['metco']} other={agg['other']}",
                flush=True,
            )
            out_rows.append([
                school_year_label(sy),
                "Marblehead",
                total,
                agg["metco"],
                agg["other"],
                agg["metco"] + agg["other"],
                agg["resident"],
            ])
        except Exception as e:
            print(f"  SY {sy}: FAILED ({e})", file=sys.stderr)

    if not out_rows:
        print("No rows fetched, refusing to write empty CSV.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for r in out_rows:
            w.writerow(r)
    print(f"\nWrote {OUT_PATH} ({len(out_rows)} rows)")


if __name__ == "__main__":
    main()
