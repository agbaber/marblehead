#!/usr/bin/env python3
"""Build a SQLite database from curated CSVs in data/ for the Data Lab page.

Reads a hand-curated list of CSV files, infers column types from the data,
and writes them as tables into assets/data/marbleheaddata.sqlite. A `_meta`
table records the source citation for every table so every value the user
queries traces back to a primary document.

Output: assets/data/marbleheaddata.sqlite (committed to git; rebuilt by
running this script when underlying CSVs change).

Usage:
  python3 scripts/build_sqlite_db.py
"""
from __future__ import annotations

import csv
import re
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "assets" / "data"
OUT_PATH = OUT_DIR / "marbleheaddata.sqlite"


@dataclass
class Dataset:
    csv_name: str
    table: str
    description: str
    source: str


# Curated v0 set. Each entry is one table residents can query in the Data Lab.
# Order here is the order shown on the page.
DATASETS: list[Dataset] = [
    Dataset(
        "dor_all_351_FY26.csv",
        "ma_towns_fy26",
        "Every Massachusetts municipality in FY26: population, income, tax bills, levy, education spending, bond rating.",
        "MA DOR Division of Local Services, At-a-Glance Report FY26.",
    ),
    Dataset(
        "dor_override_history_all.csv",
        "ma_overrides",
        "Every Proposition 2 1/2 override vote in Massachusetts since 1981. WIN/LOSS, yes/no counts, amount, purpose.",
        "MA DOR DLS Levy Limit Override and Underride history (statewide).",
    ),
    Dataset(
        "dor_debt_exclusion_all.csv",
        "ma_debt_exclusions",
        "Every debt exclusion vote in Massachusetts. WIN/LOSS, department, project description.",
        "MA DOR DLS Debt Exclusion history (statewide).",
    ),
    Dataset(
        "marblehead_levy.csv",
        "marblehead_levy",
        "Marblehead's Proposition 2 1/2 levy limit by fiscal year, 2000 to present.",
        "MA DOR DLS Tax Recap Sheets, FY00 through FY26.",
    ),
    Dataset(
        "general_fund_spending_FY15-26.csv",
        "marblehead_general_fund",
        "Marblehead general fund spending by fiscal year, FY15 to FY26.",
        "Marblehead ACFRs, FY15 through FY24; FY25-26 from town budget books.",
    ),
    Dataset(
        "marblehead_per_pupil.csv",
        "marblehead_per_pupil",
        "Marblehead per-pupil spending, in-district vs total, by fiscal year.",
        "DESE Per-Pupil Expenditures Report, all years.",
    ),
    Dataset(
        "gic_premium_rates_FY19-26.csv",
        "marblehead_gic_premiums",
        "Group Insurance Commission monthly and annual full-cost premium rates for plans Marblehead uses, FY19 to FY26.",
        "GIC municipal rate charts (mass.gov, archived via Wayback for older years).",
    ),
    Dataset(
        "catalog.csv",
        "minutes_catalog",
        "Structured catalog of School Committee and Select Board minutes: meeting date, topic, what was tried, outcome, verbatim quote.",
        "Marblehead School Committee and Select Board minutes (data/minutes/).",
    ),
]


def _strip_thousands(value: str) -> str:
    """'1,383' -> '1383'. Leaves non-numeric strings alone."""
    s = value.strip().strip('"').strip("'")
    if not s:
        return s
    # Only strip commas if the result looks like a number.
    candidate = s.replace(",", "")
    # Allow leading -, optional decimal point.
    test = candidate.lstrip("-")
    if test and (test.replace(".", "", 1).isdigit()):
        return candidate
    return s


def _infer_type(values: list[str]) -> str:
    """Return 'INTEGER', 'REAL', or 'TEXT' based on a sample of values."""
    sample = [v for v in values if v != ""]
    if not sample:
        return "TEXT"
    all_int = True
    all_real = True
    for v in sample:
        try:
            int(v)
        except ValueError:
            all_int = False
        try:
            float(v)
        except ValueError:
            all_real = False
        if not all_real:
            break
    if all_int:
        return "INTEGER"
    if all_real:
        return "REAL"
    return "TEXT"


def _load_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        columns = list(reader.fieldnames or [])
        rows = [dict(row) for row in reader]
    return columns, rows


def _normalize(rows: list[dict[str, str]], columns: list[str]) -> list[dict[str, str]]:
    """Strip thousands separators column-wide where it's safe."""
    cleaned: list[dict[str, str]] = []
    for row in rows:
        cleaned.append({c: _strip_thousands(row.get(c, "") or "") for c in columns})
    return cleaned


def _build_table(conn: sqlite3.Connection, ds: Dataset) -> int:
    path = DATA_DIR / ds.csv_name
    if not path.exists():
        raise FileNotFoundError(f"Curated CSV missing: {path}")
    columns, rows = _load_csv(path)
    rows = _normalize(rows, columns)
    # Type inference per column from the (cleaned) values.
    column_types = {
        c: _infer_type([row[c] for row in rows[:200]]) for c in columns
    }
    quoted_cols = ", ".join(
        f'"{c}" {column_types[c]}' for c in columns
    )
    conn.execute(f'DROP TABLE IF EXISTS "{ds.table}"')
    conn.execute(f'CREATE TABLE "{ds.table}" ({quoted_cols})')
    placeholders = ", ".join("?" for _ in columns)
    insert_sql = (
        f'INSERT INTO "{ds.table}" ({", ".join(f"\"{c}\"" for c in columns)}) '
        f"VALUES ({placeholders})"
    )
    payload = []
    for row in rows:
        record = []
        for c in columns:
            v = row[c]
            if v == "":
                record.append(None)
            elif column_types[c] == "INTEGER":
                record.append(int(v))
            elif column_types[c] == "REAL":
                record.append(float(v))
            else:
                record.append(v)
        payload.append(record)
    conn.executemany(insert_sql, payload)
    return len(payload)


def _massachusetts_fiscal_year(iso_date: str) -> str:
    """Return e.g. 'FY26' for any date in MA fiscal year 2026 (Jul 1 2025 - Jun 30 2026)."""
    # iso_date is "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS.sss".
    m = re.match(r"^(\d{4})-(\d{2})", iso_date)
    if not m:
        return ""
    year = int(m.group(1))
    month = int(m.group(2))
    fy = year + 1 if month >= 7 else year
    return f"FY{fy % 100:02d}"


def _latest_checkbook_csv() -> Path:
    """Return the most recent checkbook_FY26_*.csv in data/, by filename date."""
    matches = sorted(DATA_DIR.glob("checkbook_FY26_*.csv"))
    if not matches:
        raise FileNotFoundError("No checkbook_FY26_*.csv in data/")
    return matches[-1]


def build_vendor_payments(conn: sqlite3.Connection) -> int:
    """Ingest the latest FY26 checkbook CSV into a vendor_payments table.

    The Open Finance export has columns: Vendor, Fund, Division, Description,
    Date, Amount. We normalize the date, derive fiscal_year, and write the
    spec-defined schema.
    """
    path = _latest_checkbook_csv()
    conn.execute('DROP TABLE IF EXISTS "vendor_payments"')
    conn.execute(
        """CREATE TABLE vendor_payments (
            id INTEGER PRIMARY KEY,
            payment_date TEXT,
            fiscal_year TEXT,
            vendor TEXT,
            department TEXT,
            category TEXT,
            amount REAL,
            fund TEXT,
            source_file TEXT
        )"""
    )
    conn.execute(
        "CREATE INDEX vp_vendor ON vendor_payments(vendor)"
    )
    conn.execute(
        "CREATE INDEX vp_department ON vendor_payments(department)"
    )
    conn.execute(
        "CREATE INDEX vp_date ON vendor_payments(payment_date)"
    )

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        payload: list[tuple] = []
        for row in reader:
            raw_date = (row.get("Date") or "").strip()
            payment_date = raw_date.split("T", 1)[0] if raw_date else ""
            fiscal_year = _massachusetts_fiscal_year(payment_date)
            amount_str = (row.get("Amount") or "").strip().replace(",", "")
            try:
                amount = float(amount_str) if amount_str else None
            except ValueError:
                amount = None
            payload.append(
                (
                    payment_date or None,
                    fiscal_year or None,
                    (row.get("Vendor") or "").strip() or None,
                    (row.get("Division") or "").strip() or None,
                    (row.get("Description") or "").strip() or None,
                    amount,
                    (row.get("Fund") or "").strip() or None,
                    path.name,
                )
            )

    conn.executemany(
        """INSERT INTO vendor_payments (
            payment_date, fiscal_year, vendor, department,
            category, amount, fund, source_file
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        payload,
    )

    today = date.today().isoformat()
    conn.execute(
        'INSERT OR REPLACE INTO _meta '
        '("table", description, source, row_count, csv_name, last_updated) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            "vendor_payments",
            "Every vendor check the town has paid this fiscal year, "
            "from the Open Finance portal export.",
            f"Marblehead Open Finance vendor payments export, {path.name}.",
            len(payload),
            path.name,
            today,
        ),
    )
    return len(payload)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_PATH.exists():
        OUT_PATH.unlink()
    conn = sqlite3.connect(OUT_PATH)
    try:
        conn.execute(
            """CREATE TABLE _meta (
                "table" TEXT PRIMARY KEY,
                description TEXT,
                source TEXT,
                row_count INTEGER,
                csv_name TEXT,
                last_updated TEXT
            )"""
        )
        today = date.today().isoformat()
        for ds in DATASETS:
            n = _build_table(conn, ds)
            conn.execute(
                'INSERT INTO _meta ("table", description, source, row_count, csv_name, last_updated) '
                "VALUES (?, ?, ?, ?, ?, ?)",
                (ds.table, ds.description, ds.source, n, ds.csv_name, today),
            )
            print(f"  {ds.table:32s} {n:>7,} rows  ({ds.csv_name})")
        n_vp = build_vendor_payments(conn)
        print(f"  {'vendor_payments':32s} {n_vp:>7,} rows  ({_latest_checkbook_csv().name})")
        conn.commit()
        conn.execute("VACUUM")
    finally:
        conn.close()
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\nWrote {OUT_PATH.relative_to(ROOT)} ({size_kb:,.1f} KB)")


if __name__ == "__main__":
    main()
