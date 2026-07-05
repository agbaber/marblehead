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
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
TRANSCRIPTS_DIR = ROOT / "_transcripts"
TOPICS_DIR = ROOT / "topics"
OUT_DIR = ROOT / "assets" / "data"
OUT_PATH = OUT_DIR / "marbleheaddata.sqlite"
COUNTS_PATH = ROOT / "_data" / "browse_counts.yml"


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


def _checkbook_csvs() -> list[Path]:
    """Return every checkbook_FY##_*.csv in data/, sorted by filename.

    One CSV per fiscal year (e.g. checkbook_FY26_2026-06-30.csv is the
    frozen FY26 archive; checkbook_FY27_*.csv is the live year).
    """
    matches = sorted(DATA_DIR.glob("checkbook_FY[0-9][0-9]_*.csv"))
    if not matches:
        raise FileNotFoundError("No checkbook_FY##_*.csv in data/")
    return matches


def build_vendor_payments(conn: sqlite3.Connection) -> int:
    """Ingest every fiscal-year checkbook CSV into a vendor_payments table.

    The Open Finance export has columns: Vendor, Fund, Division, Description,
    Date, Amount. We normalize the date, derive fiscal_year per row from the
    payment date, and write the spec-defined schema. source_file records
    which CSV each row came from.
    """
    paths = _checkbook_csvs()
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

    payload: list[tuple] = []
    for path in paths:
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_date = (row.get("Date") or "").strip()
                payment_date = raw_date.split("T", 1)[0] if raw_date else ""
                fiscal_year = _massachusetts_fiscal_year(payment_date)
                amount_str = (row.get("Amount") or "").strip().replace(",", "")
                try:
                    amount = float(amount_str) if amount_str else None
                except ValueError:
                    amount = None
                division = (row.get("Division") or "").strip()
                fund = (row.get("Fund") or "").strip()
                if division and division != "UNDEFINED":
                    department = division
                elif fund:
                    department = fund
                else:
                    department = "Unattributed"
                payload.append(
                    (
                        payment_date or None,
                        fiscal_year or None,
                        (row.get("Vendor") or "").strip() or None,
                        department,
                        (row.get("Description") or "").strip() or None,
                        amount,
                        fund or None,
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
    file_list = ", ".join(p.name for p in paths)
    conn.execute(
        'INSERT OR REPLACE INTO _meta '
        '("table", description, source, row_count, csv_name, last_updated) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            "vendor_payments",
            "Every vendor check the town has paid, across all fiscal years "
            "we have exports for, from the Open Finance portal.",
            f"Marblehead Open Finance vendor payments exports: {file_list}.",
            len(payload),
            file_list,
            today,
        ),
    )
    return len(payload)


def _humanize_key(snake: str) -> str:
    """'Health_Insurance_Transfer' -> 'Health Insurance Transfer'."""
    return snake.replace("_", " ").strip()


def build_budget_lines(conn: sqlite3.Connection) -> int:
    """Ingest every FY*_budget_summary.json in data/ into a budget_lines table.

    Each JSON's top-level key (e.g. 'FY26_Budget') names the fiscal year.
    Town_Key_Items and School_Key_Items flatten to long-form rows.
    *_Grand_Total and Combined_Total are skipped (derived from rows).
    """
    conn.execute('DROP TABLE IF EXISTS "budget_lines"')
    conn.execute(
        """CREATE TABLE budget_lines (
            id INTEGER PRIMARY KEY,
            fiscal_year TEXT,
            department TEXT,
            line_item TEXT,
            fund TEXT,
            amount REAL,
            budget_phase TEXT
        )"""
    )
    conn.execute("CREATE INDEX bl_dept ON budget_lines(department)")
    conn.execute("CREATE INDEX bl_fy ON budget_lines(fiscal_year)")

    payload: list[tuple] = []
    json_files = sorted(DATA_DIR.glob("FY*_budget_summary.json"))
    for jf in json_files:
        with jf.open(encoding="utf-8") as f:
            data = json.load(f)
        for top_key, payload_dict in data.items():
            # top_key like 'FY26_Budget'
            m = re.match(r"^FY(\d{2})_Budget$", top_key)
            if not m:
                continue
            fy = f"FY{m.group(1)}"
            for section, dept in (
                ("Town_Key_Items", "Town"),
                ("School_Key_Items", "Schools"),
            ):
                items = payload_dict.get(section, {}) or {}
                for raw_key, amount in items.items():
                    if not isinstance(amount, (int, float)):
                        continue
                    line_item = _humanize_key(raw_key)
                    payload.append(
                        (
                            fy,
                            dept,
                            line_item,
                            "General Fund",
                            float(amount),
                            "adopted",
                        )
                    )

    conn.executemany(
        """INSERT INTO budget_lines (
            fiscal_year, department, line_item, fund, amount, budget_phase
        ) VALUES (?, ?, ?, ?, ?, ?)""",
        payload,
    )

    today = date.today().isoformat()
    file_list = ", ".join(p.name for p in json_files) or "none"
    conn.execute(
        'INSERT OR REPLACE INTO _meta '
        '("table", description, source, row_count, csv_name, last_updated) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            "budget_lines",
            "Marblehead general fund appropriated budget by department "
            "and line item, flattened from the FY*_budget_summary.json files.",
            f"data/{file_list}; adopted budget figures.",
            len(payload),
            "FY*_budget_summary.json",
            today,
        ),
    )
    return len(payload)


def _harvest_topic_tags(path: Path) -> str:
    """Return comma-joined sorted distinct topic slugs from a transcript's
    topic_segments block.

    Returns '' if the block is absent. The transcript's front-matter format
    is stable indented YAML; we don't load PyYAML.
    """
    seen: set[str] = set()
    in_segments = False
    with path.open(encoding="utf-8") as f:
        for line in f:
            line_rstripped = line.rstrip("\n")
            stripped = line_rstripped.strip()
            if not in_segments:
                if stripped == "topic_segments:":
                    in_segments = True
                continue
            # Inside topic_segments: lines look like
            #   "  - topic: public-comment"  (we want public-comment)
            # The block ends at the closing "---" or at the next top-level key
            # (no leading whitespace on the line).
            if line_rstripped == "---":
                break
            if line and not line[0].isspace() and ":" in line:
                # Top-level key like "summary_card:" closes the segments block.
                break
            if stripped.startswith("- topic:"):
                slug = stripped.split(":", 1)[1].strip()
                if slug:
                    seen.add(slug)
    return ",".join(sorted(seen))


def _parse_frontmatter(path: Path) -> dict[str, str]:
    """Read a Jekyll front-matter block. Returns flat dict of key:value strings.

    Assumes the file starts with `---`, a block of `key: value` lines, and ends
    the front-matter with another `---`. Quoted values have their quotes
    stripped. We don't try to handle nested YAML; Phase 1 only needs flat keys.
    """
    out: dict[str, str] = {}
    with path.open(encoding="utf-8") as f:
        first = f.readline().rstrip("\n")
        if first != "---":
            return out
        for line in f:
            line = line.rstrip("\n")
            if line == "---":
                break
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            # Strip surrounding quotes (single or double).
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            out[key] = value
    return out


def build_meetings(conn: sqlite3.Connection) -> int:
    """Ingest every _transcripts/*.md front-matter into a meetings table."""
    conn.execute('DROP TABLE IF EXISTS "meetings"')
    conn.execute(
        """CREATE TABLE meetings (
            id INTEGER PRIMARY KEY,
            meeting_date TEXT,
            board TEXT,
            title TEXT,
            slug TEXT UNIQUE,
            has_transcript INTEGER,
            has_digest INTEGER,
            topic_tags TEXT,
            url TEXT
        )"""
    )
    conn.execute("CREATE INDEX m_date ON meetings(meeting_date)")
    conn.execute("CREATE INDEX m_board ON meetings(board)")

    payload: list[tuple] = []
    seen_slugs: set[str] = set()
    for md in sorted(TRANSCRIPTS_DIR.glob("*.md")):
        fm = _parse_frontmatter(md)
        slug = fm.get("slug") or md.stem
        if slug in seen_slugs:
            # Should not happen; defensive only.
            continue
        seen_slugs.add(slug)
        payload.append(
            (
                fm.get("date") or None,
                fm.get("board") or None,
                fm.get("title") or "",
                slug,
                1,                      # has_transcript
                0,                      # has_digest (future phase)
                _harvest_topic_tags(md), # topic_tags from transcript front-matter
                f"/transcripts/{slug}/",
            )
        )

    conn.executemany(
        """INSERT INTO meetings (
            meeting_date, board, title, slug,
            has_transcript, has_digest, topic_tags, url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        payload,
    )

    today = date.today().isoformat()
    conn.execute(
        'INSERT OR REPLACE INTO _meta '
        '("table", description, source, row_count, csv_name, last_updated) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            "meetings",
            "Every town meeting we have a transcript for: date, board, "
            "title, slug, and a URL into the existing /transcripts/ page.",
            "_transcripts/*.md front-matter (Jekyll-ingested).",
            len(payload),
            "_transcripts/*.md",
            today,
        ),
    )
    return len(payload)


def build_topics(conn: sqlite3.Connection) -> int:
    """Ingest every topics/*.html front-matter into a topics table."""
    conn.execute('DROP TABLE IF EXISTS "topics"')
    conn.execute(
        """CREATE TABLE topics (
            slug TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            page_url TEXT,
            meeting_count INTEGER
        )"""
    )

    payload: list[tuple] = []
    for html in sorted(TOPICS_DIR.glob("*.html")):
        fm = _parse_frontmatter(html)
        slug = fm.get("topic_slug") or html.stem
        title = fm.get("title", "")
        page_url = fm.get("permalink", f"/topics/{slug}/")
        payload.append((slug, title, "", page_url, 0))

    conn.executemany(
        """INSERT INTO topics (
            slug, title, description, page_url, meeting_count
        ) VALUES (?, ?, ?, ?, ?)""",
        payload,
    )

    today = date.today().isoformat()
    conn.execute(
        'INSERT OR REPLACE INTO _meta '
        '("table", description, source, row_count, csv_name, last_updated) '
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            "topics",
            "The site's topic-feed pages: slug, title, page URL. "
            "description and meeting_count populate in later phases.",
            "topics/*.html front-matter.",
            len(payload),
            "topics/*.html",
            today,
        ),
    )
    return len(payload)


def update_meeting_counts(conn: sqlite3.Connection) -> None:
    """Populate topics.meeting_count via LIKE join on meetings.topic_tags.

    The ',,' bookends on both sides prevent prefix-match collisions
    (e.g. 'override' must not match 'override-prep' if such a slug existed).
    Run AFTER both build_meetings and build_topics have populated their tables.
    """
    conn.execute(
        "UPDATE topics SET meeting_count = ("
        "  SELECT COUNT(*) FROM meetings "
        "  WHERE (',' || meetings.topic_tags || ',') "
        "        LIKE ('%,' || topics.slug || ',%')"
        ")"
    )


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
        vp_files = ", ".join(p.name for p in _checkbook_csvs())
        print(f"  {'vendor_payments':32s} {n_vp:>7,} rows  ({vp_files})")
        n_bl = build_budget_lines(conn)
        print(f"  {'budget_lines':32s} {n_bl:>7,} rows  (FY*_budget_summary.json)")
        n_m = build_meetings(conn)
        print(f"  {'meetings':32s} {n_m:>7,} rows  (_transcripts/*.md)")
        n_t = build_topics(conn)
        print(f"  {'topics':32s} {n_t:>7,} rows  (topics/*.html)")
        update_meeting_counts(conn)
        print(f"  {'topics.meeting_count':32s} populated via JOIN")
        conn.commit()
        conn.execute("VACUUM")
        # Emit row counts for the /browse/ index page cards.
        counts = {}
        for entity in ("vendor_payments", "budget_lines", "meetings", "topics"):
            n = conn.execute(f'SELECT COUNT(*) FROM "{entity}"').fetchone()[0]
            counts[entity] = n
        COUNTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with COUNTS_PATH.open("w", encoding="utf-8") as f:
            f.write("# Auto-generated by scripts/build_sqlite_db.py. Do not edit.\n")
            for k, v in counts.items():
                f.write(f"{k}: {v}\n")
        print(f"\nWrote {COUNTS_PATH.relative_to(ROOT)}")
    finally:
        conn.close()
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\nWrote {OUT_PATH.relative_to(ROOT)} ({size_kb:,.1f} KB)")


if __name__ == "__main__":
    main()
