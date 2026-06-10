#!/usr/bin/env python3
"""Stage 2: parse data/patriot_raw/*.html into two CSVs.

  data/parcels.csv                    committed, de-identified (no owner/mailing)
  data/patriot_raw/parcels_full.csv   gitignored, includes owner + mailing

Usage: python3 scripts/build_patriot_parcels.py
"""
import csv
import glob
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from patriot_parse import parse_summary  # noqa: E402

RAW_DIR = "data/patriot_raw"
PUBLIC_OUT = "data/parcels.csv"
FULL_OUT = os.path.join(RAW_DIR, "parcels_full.csv")

PUBLIC_COLS = [
    "account_number", "parcel_id", "address", "zoning", "land_use", "style",
    "year_built", "land_area_acres", "units", "rooms", "bedrooms", "bathrooms",
    "half_baths", "building_value", "extra_features_value", "land_value",
    "total_value", "assessment_fy", "card_count", "sale_date", "sale_price",
    "book_page",
]
FULL_COLS = PUBLIC_COLS + ["owner", "mailing_address"]


def main():
    files = sorted(
        glob.glob(os.path.join(RAW_DIR, "*.html")),
        key=lambda p: int(pathlib.Path(p).stem),
    )
    rows = []
    errors = []
    for f in files:
        acct = int(pathlib.Path(f).stem)
        try:
            with open(f, encoding="latin-1") as fh:
                rec = parse_summary(fh.read())
            rec["account_number"] = acct
            rows.append(rec)
        except Exception as e:  # noqa: BLE001 - record it, never silently drop
            errors.append((acct, repr(e)))

    rows.sort(key=lambda r: r["account_number"])

    with open(PUBLIC_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=PUBLIC_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    with open(FULL_OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FULL_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} parcels -> {PUBLIC_OUT} and {FULL_OUT}", file=sys.stderr)
    if errors:
        print(f"{len(errors)} parse errors:", file=sys.stderr)
        for acct, err in errors[:20]:
            print(f"  account {acct}: {err}", file=sys.stderr)


if __name__ == "__main__":
    main()
