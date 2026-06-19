# Phase 1a: Data Layer Salvage and Extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvage the SQLite data layer from PR #849 (build script + SQLite artifact + `_meta` citation pattern) and extend it with the four Phase 1 tables (`vendor_payments`, `budget_lines`, `meetings`, `topics`) so the database GUI in Phase 1b can read from it.

**Architecture:** Single Python build script (`scripts/build_sqlite_db.py`) reads heterogeneous source files (CSV, JSON, markdown front-matter, HTML front-matter) and writes a single `marbleheaddata.sqlite` artifact. PR #849's original 8 tables ship unchanged. Four new tables and four `_meta` rows are added by extending the script with per-entity ingest functions. The SQLite file is committed to git; Jekyll serves it as a static asset.

**Tech Stack:** Python 3 (stdlib only: `csv`, `json`, `sqlite3`, `pathlib`, `re`, `dataclasses`), pytest for tests. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-06-18-town-database-gui-design.md` (Phase 1a section).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/build_sqlite_db.py` | Salvage from `data-lab-v0` branch, then extend | Build entire SQLite from source files |
| `assets/data/marbleheaddata.sqlite` | Salvage from `data-lab-v0` branch, then regenerate | Build artifact, committed to git |
| `scripts/test_build_sqlite_db.py` | Create new | Pytest suite for the four new ingest functions |
| `data/checkbook_FY26_*.csv` | Read | Source for `vendor_payments` |
| `data/FY26_budget_summary.json` | Read | Source for `budget_lines` |
| `_transcripts/*.md` | Read | Source for `meetings` |
| `topics/*.html` | Read | Source for `topics` |
| `docs/superpowers/specs/...` | Read | The spec governing this plan |

Files explicitly NOT salvaged from PR #849:
- `assets/data-lab.js` (SQL editor JS)
- `data/lab.html` (SQL editor page)
- `data/index.html` modification (Data Lab tile, +5 lines)
- Both `proof/data-lab-v0*.png` (proof for the dropped UI)

---

## Task 1: Salvage build script + SQLite from PR #849

**Files:**
- Modify: `scripts/build_sqlite_db.py` (new on this branch, copied from `data-lab-v0`)
- Modify: `assets/data/marbleheaddata.sqlite` (new on this branch, copied from `data-lab-v0`)

- [ ] **Step 1.1: Confirm the source branch exists locally**

```bash
git fetch origin data-lab-v0:data-lab-v0 2>&1 || true
git branch --list data-lab-v0
```

Expected: `data-lab-v0` listed. If `git fetch` errored because the branch is already checked out in another worktree (the message `refusing to fetch into branch ... checked out at /home/claude/marblehead/.claude/worktrees/data-lab-v0`), that's fine. The local ref already exists.

- [ ] **Step 1.2: Cherry-pick the two salvage files into the working tree**

```bash
git checkout data-lab-v0 -- scripts/build_sqlite_db.py assets/data/marbleheaddata.sqlite
```

This copies the files from the `data-lab-v0` branch into the current branch's working tree, staged for commit. **Crucially, do NOT also pull `assets/data-lab.js` or `data/lab.html` or the `data/index.html` change.**

- [ ] **Step 1.3: Verify what got copied and what didn't**

```bash
git status
ls -lh scripts/build_sqlite_db.py assets/data/marbleheaddata.sqlite
test ! -f assets/data-lab.js && echo "OK: data-lab.js NOT here"
test ! -f data/lab.html && echo "OK: lab.html NOT here"
git diff --cached data/index.html  # should be empty (no changes to index.html)
```

Expected: build script ~218 lines, SQLite ~1.4 MB. Other PR #849 files absent.

- [ ] **Step 1.4: Verify the salvaged script runs as-is**

```bash
python3 scripts/build_sqlite_db.py
```

Expected: prints a table summary like:
```
  ma_towns_fy26                       351 rows  (dor_all_351_FY26.csv)
  ma_overrides                      ...
  ...
Wrote assets/data/marbleheaddata.sqlite (X,XXX.X KB)
```

If any source CSV is missing in `data/`, the script raises `FileNotFoundError`. In that case, document the missing file in Task 1's commit message rather than skipping the entry. The spec requires all 8 PR #849 tables stay.

- [ ] **Step 1.5: Verify the SQLite opens cleanly**

```bash
sqlite3 assets/data/marbleheaddata.sqlite "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected output (one per line):
```
_meta
ma_debt_exclusions
ma_overrides
ma_towns_fy26
marblehead_general_fund
marblehead_gic_premiums
marblehead_levy
marblehead_per_pupil
minutes_catalog
```

Eight data tables plus `_meta`. Confirm `_meta` has one row per table:

```bash
sqlite3 assets/data/marbleheaddata.sqlite 'SELECT "table", row_count FROM _meta ORDER BY "table";'
```

- [ ] **Step 1.6: Commit the salvage**

```bash
git add scripts/build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Salvage data layer from PR #849 (drop SQL editor)

Brings in scripts/build_sqlite_db.py and assets/data/marbleheaddata.sqlite
from the data-lab-v0 branch. Deliberately does NOT include the SQL
editor surface (data-lab.js, lab.html, the Data Lab tile on /data/).
The data layer is the keeper; the SQL UI is not.

Eight tables salvaged (ma_towns_fy26, ma_overrides, ma_debt_exclusions,
marblehead_levy, marblehead_general_fund, marblehead_per_pupil,
marblehead_gic_premiums, minutes_catalog) plus the _meta citation
table. Phase 1a extends with four more tables in subsequent commits.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 2: Set up the pytest scaffold

Before extending the build script, set up the test file. Subsequent tasks add tests to it as they implement each ingest.

**Files:**
- Create: `scripts/test_build_sqlite_db.py`

- [ ] **Step 2.1: Create the test file with a smoke test**

Write `scripts/test_build_sqlite_db.py`:

```python
"""Tests for scripts/build_sqlite_db.py.

Run with: pytest scripts/test_build_sqlite_db.py -v

Each test exercises one ingest function in isolation against a fresh
in-memory SQLite database, asserting the resulting table shape and at
least one known row from the real data.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

# Add scripts/ to path so we can import the build script as a module.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_sqlite_db  # type: ignore


def _open_memory_db() -> sqlite3.Connection:
    """Fresh in-memory SQLite with the _meta table prepared."""
    conn = sqlite3.connect(":memory:")
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
    return conn


def test_build_script_imports():
    """Smoke test: the build script imports without errors."""
    assert hasattr(build_sqlite_db, "main")
    assert hasattr(build_sqlite_db, "DATASETS")
```

- [ ] **Step 2.2: Run the smoke test**

```bash
pytest scripts/test_build_sqlite_db.py -v
```

Expected: 1 passed.

- [ ] **Step 2.3: Commit**

```bash
git add scripts/test_build_sqlite_db.py
git commit -m "$(cat <<'EOF'
Add pytest scaffold for build_sqlite_db.py

In-memory SQLite + import-the-script-as-a-module pattern. Subsequent
commits add one test per Phase 1 entity ingest function.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 3: Add `vendor_payments` ingest

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`

The source CSV is `data/checkbook_FY26_<latest-date>.csv`. The file has columns: `Vendor, Fund, Division, Description, Date, Amount`. Date is ISO `YYYY-MM-DDT00:00:00.000` format.

Schema we want (per spec):

```sql
CREATE TABLE vendor_payments (
  id INTEGER PRIMARY KEY,
  payment_date TEXT,
  fiscal_year TEXT,
  vendor TEXT,
  department TEXT,
  category TEXT,
  amount REAL,
  fund TEXT,
  source_file TEXT
);
```

Mapping CSV → schema columns:
- `Date` (cleaned of `T00:00:00.000`) → `payment_date`
- Derived from date: `fiscal_year` (Massachusetts fiscal year starts July 1, so July 2025 → FY26, June 2025 → FY25)
- `Vendor` → `vendor`
- `Division` → `department` (the Division column is the spend's owning unit)
- `Description` → `category` (semi-structured; we keep as-is)
- `Amount` → `amount`
- `Fund` → `fund`
- The CSV filename → `source_file`

- [ ] **Step 3.1: Write the failing test**

Add to `scripts/test_build_sqlite_db.py`:

```python
def test_vendor_payments_ingest():
    """vendor_payments ingest pulls rows from the FY26 checkbook CSV."""
    conn = _open_memory_db()
    try:
        n = build_sqlite_db.build_vendor_payments(conn)
        assert n > 1000, f"Expected >1000 vendor payment rows, got {n}"

        # Schema check
        cols = [
            row[1]
            for row in conn.execute("PRAGMA table_info(vendor_payments)").fetchall()
        ]
        assert cols == [
            "id",
            "payment_date",
            "fiscal_year",
            "vendor",
            "department",
            "category",
            "amount",
            "fund",
            "source_file",
        ], f"Unexpected schema: {cols}"

        # Fiscal year derivation: July 1, 2025 must be FY26
        fy_july = conn.execute(
            "SELECT fiscal_year FROM vendor_payments "
            "WHERE payment_date = '2025-07-01' LIMIT 1"
        ).fetchone()
        assert fy_july is not None, "Expected a row dated 2025-07-01"
        assert fy_july[0] == "FY26", f"Expected FY26, got {fy_july[0]}"

        # June 2025 must be FY25
        # (skip if no such row in this snapshot)
        june_row = conn.execute(
            "SELECT fiscal_year FROM vendor_payments "
            "WHERE payment_date LIKE '2025-06-%' LIMIT 1"
        ).fetchone()
        if june_row:
            assert june_row[0] == "FY25", f"Expected FY25, got {june_row[0]}"

        # All amounts are real numbers
        non_numeric = conn.execute(
            "SELECT COUNT(*) FROM vendor_payments WHERE amount IS NULL"
        ).fetchone()[0]
        # CSV may legitimately have empty amounts; allow up to 1% empty
        assert non_numeric < n // 100, (
            f"Too many null amounts: {non_numeric} of {n}"
        )

        # _meta row written
        meta = conn.execute(
            "SELECT description, source, row_count FROM _meta "
            "WHERE \"table\" = 'vendor_payments'"
        ).fetchone()
        assert meta is not None, "Expected _meta row for vendor_payments"
        assert meta[2] == n, f"_meta row_count {meta[2]} != n {n}"
    finally:
        conn.close()
```

- [ ] **Step 3.2: Run the test to verify it fails**

```bash
pytest scripts/test_build_sqlite_db.py::test_vendor_payments_ingest -v
```

Expected: `FAIL` with `AttributeError: module 'build_sqlite_db' has no attribute 'build_vendor_payments'`.

- [ ] **Step 3.3: Implement `build_vendor_payments` in the build script**

Add `import re` to the top of the file (near the other stdlib imports). Then add, after the existing `_build_table` function:

```python
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
```

- [ ] **Step 3.4: Wire the new ingest into `main()`**

Find the `main()` function. After the `for ds in DATASETS:` loop and before `conn.commit()`, add:

```python
        n_vp = build_vendor_payments(conn)
        print(f"  {'vendor_payments':32s} {n_vp:>7,} rows  ({_latest_checkbook_csv().name})")
```

- [ ] **Step 3.5: Run the test to verify it passes**

```bash
pytest scripts/test_build_sqlite_db.py::test_vendor_payments_ingest -v
```

Expected: PASS.

- [ ] **Step 3.6: Rebuild the SQLite file end-to-end**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT COUNT(*) FROM vendor_payments;"
sqlite3 assets/data/marbleheaddata.sqlite 'SELECT description, row_count FROM _meta WHERE "table" = "vendor_payments";'
```

Expected: a row count in the thousands, a `_meta` row with matching count.

- [ ] **Step 3.7: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Add vendor_payments table to SQLite build

Ingests the latest data/checkbook_FY26_*.csv into a vendor_payments
table with the schema in the spec (payment_date, fiscal_year, vendor,
department, category, amount, fund, source_file). Adds three indexes
(vendor, department, date) for list-view performance in Phase 1b.

Fiscal-year derivation: MA FY runs July 1 to June 30, so July 2025
maps to FY26. Pytest verifies the derivation against a known row.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 4: Add `budget_lines` ingest

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`

The source is `data/FY26_budget_summary.json` (with similar shape for prior years if they exist). Structure:

```json
{
  "FY26_Budget": {
    "Town_Grand_Total": 57086093,
    "School_Grand_Total": 49120287,
    "Combined_Total": 106206380,
    "Town_Key_Items": {
      "Health_Insurance_Transfer": 11828487,
      "Debt_Service": 9314141,
      ...
    },
    "School_Key_Items": {
      "District_Wide": 14556594,
      ...
    }
  }
}
```

Schema we want:

```sql
CREATE TABLE budget_lines (
  id INTEGER PRIMARY KEY,
  fiscal_year TEXT,
  department TEXT,
  line_item TEXT,
  fund TEXT,
  amount REAL,
  budget_phase TEXT
);
```

Mapping:
- The JSON file's top-level key (`FY26_Budget`, `FY25_Budget`, etc.) → `fiscal_year` (e.g. "FY26")
- `Town_Key_Items` entries → `department = "Town"`, `line_item = <key>` (un-snake-cased)
- `School_Key_Items` entries → `department = "Schools"`, `line_item = <key>`
- `*_Grand_Total` and `Combined_Total` → skip (these are derived totals, not appropriations)
- `fund = "General Fund"` for all rows in this source (the JSON is general-fund only)
- `budget_phase = "adopted"` (the summary file represents the adopted budget)

- [ ] **Step 4.1: Write the failing test**

Add to `scripts/test_build_sqlite_db.py`:

```python
def test_budget_lines_ingest():
    """budget_lines ingest flattens FY*_budget_summary.json into long-form rows."""
    conn = _open_memory_db()
    try:
        n = build_sqlite_db.build_budget_lines(conn)
        # At minimum we expect FY26's ~28 Town items + ~11 School items
        assert n >= 35, f"Expected at least 35 budget_lines rows, got {n}"

        # Schema
        cols = [
            row[1]
            for row in conn.execute("PRAGMA table_info(budget_lines)").fetchall()
        ]
        assert cols == [
            "id",
            "fiscal_year",
            "department",
            "line_item",
            "fund",
            "amount",
            "budget_phase",
        ], f"Unexpected schema: {cols}"

        # Known row: Health insurance transfer in FY26
        hi = conn.execute(
            "SELECT amount FROM budget_lines "
            "WHERE fiscal_year = 'FY26' "
            "AND department = 'Town' "
            "AND line_item LIKE 'Health Insurance%'"
        ).fetchone()
        assert hi is not None, "Expected Health Insurance Transfer row for FY26"
        assert 11_000_000 < hi[0] < 13_000_000, (
            f"Expected ~$11.8M for Health Insurance Transfer, got {hi[0]}"
        )

        # Grand totals NOT included as rows
        grand = conn.execute(
            "SELECT COUNT(*) FROM budget_lines WHERE line_item LIKE '%Grand_Total%'"
        ).fetchone()[0]
        assert grand == 0, "Grand totals should be filtered out"

        # _meta row
        meta = conn.execute(
            "SELECT row_count FROM _meta WHERE \"table\" = 'budget_lines'"
        ).fetchone()
        assert meta is not None and meta[0] == n
    finally:
        conn.close()
```

- [ ] **Step 4.2: Run the test to verify it fails**

```bash
pytest scripts/test_build_sqlite_db.py::test_budget_lines_ingest -v
```

Expected: FAIL with `AttributeError: module 'build_sqlite_db' has no attribute 'build_budget_lines'`.

- [ ] **Step 4.3: Implement `build_budget_lines`**

Add `import json` to the top of the file (near `import csv`). Then add:

```python
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
```

- [ ] **Step 4.4: Wire into `main()`**

In the `main()` function, after the `build_vendor_payments` call from Task 3, add:

```python
        n_bl = build_budget_lines(conn)
        print(f"  {'budget_lines':32s} {n_bl:>7,} rows  (FY*_budget_summary.json)")
```

- [ ] **Step 4.5: Run the test to verify it passes**

```bash
pytest scripts/test_build_sqlite_db.py::test_budget_lines_ingest -v
```

Expected: PASS.

- [ ] **Step 4.6: Rebuild and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT department, COUNT(*), ROUND(SUM(amount)/1000000, 1) AS total_M FROM budget_lines WHERE fiscal_year='FY26' GROUP BY department;"
```

Expected: rows for `Town` and `Schools`, with Schools total around $49M and Town around $57M.

- [ ] **Step 4.7: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Add budget_lines table to SQLite build

Flattens every data/FY*_budget_summary.json into long-form rows
(fiscal_year, department, line_item, fund, amount, budget_phase).
Town_Key_Items become department='Town', School_Key_Items become
department='Schools'. Derived totals (*_Grand_Total, Combined_Total)
are filtered out.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 5: Add `meetings` ingest

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`

The source is `_transcripts/*.md`. Each file has YAML front-matter delimited by `---`:

```yaml
---
slug: board-of-health-2022-05-31
board: board-of-health
board_display: "Board of Health"
date: 2022-05-31
title: "Board of Health: May 31, 2022"
vimeo_id: 716019682
vimeo_url: "https://vimeo.com/716019682"
duration_seconds: 3543
ai_generated: true
status: published
source: vimeo-auto+llm
---
```

There are 230+ files. We parse only the front-matter, not the body. We do NOT use a YAML library to keep dependencies minimal; the files have a stable line-per-key format.

Schema we want:

```sql
CREATE TABLE meetings (
  id INTEGER PRIMARY KEY,
  meeting_date TEXT,
  board TEXT,
  title TEXT,
  slug TEXT UNIQUE,
  has_transcript INTEGER,
  has_digest INTEGER,
  topic_tags TEXT,
  url TEXT
);
```

For Phase 1a:
- `has_transcript = 1` for every row (since we're scanning transcript files)
- `has_digest = 0` (no digest data ingested yet; future phase)
- `topic_tags = ''` (cross-tagging with topics is a Phase 1c concern)
- `url = '/transcripts/' + slug + '/'` (the Jekyll permalink for the existing page; if the actual permalink differs, fix in Task 6's verification step)

- [ ] **Step 5.1: Write the failing test**

Add to `scripts/test_build_sqlite_db.py`:

```python
def test_meetings_ingest():
    """meetings ingest scans _transcripts/*.md front-matter."""
    conn = _open_memory_db()
    try:
        n = build_sqlite_db.build_meetings(conn)
        assert n >= 200, f"Expected at least 200 meeting rows, got {n}"

        cols = [
            row[1]
            for row in conn.execute("PRAGMA table_info(meetings)").fetchall()
        ]
        assert cols == [
            "id",
            "meeting_date",
            "board",
            "title",
            "slug",
            "has_transcript",
            "has_digest",
            "topic_tags",
            "url",
        ], f"Unexpected schema: {cols}"

        # Known row: Board of Health 2022-05-31
        row = conn.execute(
            "SELECT board, title FROM meetings "
            "WHERE slug = 'board-of-health-2022-05-31'"
        ).fetchone()
        assert row is not None, "Expected board-of-health-2022-05-31 row"
        assert row[0] == "board-of-health"
        assert "Board of Health" in row[1]

        # All rows have has_transcript=1
        without_transcript = conn.execute(
            "SELECT COUNT(*) FROM meetings WHERE has_transcript != 1"
        ).fetchone()[0]
        assert without_transcript == 0, (
            f"Expected all meetings to have has_transcript=1, got {without_transcript} that don't"
        )

        # Slugs unique
        dupes = conn.execute(
            "SELECT slug, COUNT(*) c FROM meetings "
            "GROUP BY slug HAVING c > 1 LIMIT 1"
        ).fetchone()
        assert dupes is None, f"Duplicate slug found: {dupes}"
    finally:
        conn.close()
```

- [ ] **Step 5.2: Run the test to verify it fails**

```bash
pytest scripts/test_build_sqlite_db.py::test_meetings_ingest -v
```

Expected: FAIL.

- [ ] **Step 5.3: Implement `build_meetings`**

Add to `scripts/build_sqlite_db.py`:

```python
TRANSCRIPTS_DIR = ROOT / "_transcripts"


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
                "",                     # topic_tags (future phase)
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
```

- [ ] **Step 5.4: Wire into `main()`**

After the `build_budget_lines` call in `main()`, add:

```python
        n_m = build_meetings(conn)
        print(f"  {'meetings':32s} {n_m:>7,} rows  (_transcripts/*.md)")
```

- [ ] **Step 5.5: Run the test to verify it passes**

```bash
pytest scripts/test_build_sqlite_db.py::test_meetings_ingest -v
```

Expected: PASS.

- [ ] **Step 5.6: Rebuild and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT board, COUNT(*) FROM meetings GROUP BY board ORDER BY board;"
```

Expected: rows for `board-of-health`, `school-committee`, `select-board`, and any other boards present in the transcripts.

- [ ] **Step 5.7: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Add meetings table to SQLite build

Scans _transcripts/*.md front-matter (date, board, title, slug) into
a meetings table. has_transcript=1 for every ingested row;
has_digest and topic_tags are zero/blank in Phase 1a and get populated
in later phases. URL points at /transcripts/<slug>/.

Front-matter parser is hand-rolled (no PyYAML dep) since the files
use a stable flat key:value format. Front-matter without a slug
field falls back to the filename stem.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 6: Add `topics` ingest

**Files:**
- Modify: `scripts/build_sqlite_db.py`
- Modify: `scripts/test_build_sqlite_db.py`

The source is `topics/*.html`. Each file has Jekyll front-matter:

```yaml
---
layout: page
title: "Topic: Health insurance and GIC"
permalink: /topics/health-insurance/
body_class: transcripts-page
topic_slug: health-insurance
---
```

Schema:

```sql
CREATE TABLE topics (
  slug TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  page_url TEXT,
  meeting_count INTEGER
);
```

`description` is left empty in Phase 1a (no source for it in the front-matter today); Phase 1c can populate it from `data/topic_seeds.json` or a new field. `meeting_count` is computed at ingest time from a `JOIN` against `meetings` if `topic_tags` ever gets populated; in Phase 1a it's left as 0.

- [ ] **Step 6.1: Write the failing test**

Add to `scripts/test_build_sqlite_db.py`:

```python
def test_topics_ingest():
    """topics ingest scans topics/*.html front-matter."""
    conn = _open_memory_db()
    try:
        n = build_sqlite_db.build_topics(conn)
        assert n >= 10, f"Expected at least 10 topic rows, got {n}"

        cols = [
            row[1]
            for row in conn.execute("PRAGMA table_info(topics)").fetchall()
        ]
        assert cols == [
            "slug",
            "title",
            "description",
            "page_url",
            "meeting_count",
        ], f"Unexpected schema: {cols}"

        # Known row: health-insurance
        row = conn.execute(
            "SELECT title, page_url FROM topics WHERE slug = 'health-insurance'"
        ).fetchone()
        assert row is not None, "Expected health-insurance topic row"
        assert "Health insurance" in row[0]
        assert row[1] == "/topics/health-insurance/"

        # Slug uniqueness (PRIMARY KEY)
        n_rows = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
        n_distinct = conn.execute("SELECT COUNT(DISTINCT slug) FROM topics").fetchone()[0]
        assert n_rows == n_distinct, "Slug collision"
    finally:
        conn.close()
```

- [ ] **Step 6.2: Run the test to verify it fails**

```bash
pytest scripts/test_build_sqlite_db.py::test_topics_ingest -v
```

Expected: FAIL.

- [ ] **Step 6.3: Implement `build_topics`**

Add to `scripts/build_sqlite_db.py`:

```python
TOPICS_DIR = ROOT / "topics"


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
```

- [ ] **Step 6.4: Wire into `main()`**

After the `build_meetings` call, add:

```python
        n_t = build_topics(conn)
        print(f"  {'topics':32s} {n_t:>7,} rows  (topics/*.html)")
```

- [ ] **Step 6.5: Run the test to verify it passes**

```bash
pytest scripts/test_build_sqlite_db.py::test_topics_ingest -v
```

Expected: PASS.

- [ ] **Step 6.6: Rebuild and spot-check**

```bash
python3 scripts/build_sqlite_db.py
sqlite3 assets/data/marbleheaddata.sqlite "SELECT slug, title FROM topics ORDER BY slug;"
```

Expected: ~13 rows, one per HTML file in `topics/`.

- [ ] **Step 6.7: Commit**

```bash
git add scripts/build_sqlite_db.py scripts/test_build_sqlite_db.py assets/data/marbleheaddata.sqlite
git commit -m "$(cat <<'EOF'
Add topics table to SQLite build

Scans topics/*.html front-matter into a topics table keyed by
topic_slug. description and meeting_count are blank/zero in Phase 1a
and populate in later phases (description from topic_seeds.json or
new front-matter; meeting_count via JOIN once meetings.topic_tags
exists).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 7: End-to-end verification + file-size budget check

**Files:**
- Read: `assets/data/marbleheaddata.sqlite`

- [ ] **Step 7.1: Run the full test suite**

```bash
pytest scripts/test_build_sqlite_db.py -v
```

Expected: 5 passed (smoke test + 4 ingest tests).

- [ ] **Step 7.2: Run the full build end-to-end**

```bash
python3 scripts/build_sqlite_db.py
```

Expected: prints a table summary including all 8 PR #849 tables AND the 4 new tables (`vendor_payments`, `budget_lines`, `meetings`, `topics`).

- [ ] **Step 7.3: Verify all 12 tables + `_meta`**

```bash
sqlite3 assets/data/marbleheaddata.sqlite "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected (13 tables total):
```
_meta
budget_lines
ma_debt_exclusions
ma_overrides
ma_towns_fy26
marblehead_general_fund
marblehead_gic_premiums
marblehead_levy
marblehead_per_pupil
meetings
minutes_catalog
topics
vendor_payments
```

- [ ] **Step 7.4: Verify the `_meta` table has citations for all 12 data tables**

```bash
sqlite3 assets/data/marbleheaddata.sqlite 'SELECT "table", row_count FROM _meta ORDER BY "table";'
```

Expected: 12 rows, every Phase 1 entity's row matches the row count of its corresponding data table.

- [ ] **Step 7.5: File-size budget check (Open Question 2 in the spec)**

```bash
ls -lh assets/data/marbleheaddata.sqlite
```

If the file exceeds 10 MB, the database GUI's first-page load becomes painful on slow connections. Document the size in the commit message.

If size is > 10 MB, the spec's open question #2 needs to be revisited before Phase 1b ships. The mitigations the spec proposes:
- Drop the salvaged PR #849 tables that aren't surfaced in the GUI yet (`ma_overrides`, `ma_debt_exclusions`, `marblehead_gic_premiums`, etc.) and bring them back when their list views are built.
- Paginate `vendor_payments` by fiscal year into separate `.sqlite` files.

Choose the mitigation NOW if needed, not in Phase 1b. The Phase 1b plan assumes a single SQLite asset.

- [ ] **Step 7.6: Open the SQLite in `sqlite3` CLI and run a real query for sanity**

```bash
sqlite3 assets/data/marbleheaddata.sqlite "SELECT department, ROUND(SUM(amount), 0) AS total FROM vendor_payments WHERE fiscal_year='FY26' GROUP BY department ORDER BY total DESC LIMIT 5;"
```

Expected: top 5 departments by FY26 vendor spend. Sanity-check the numbers against the existing /checkbook/ page.

- [ ] **Step 7.7: Commit the final SQLite + summary note**

```bash
git add assets/data/marbleheaddata.sqlite
git commit --allow-empty -m "$(cat <<'EOF'
Phase 1a complete: SQLite has 12 data tables + _meta

Tables: 8 from the PR #849 salvage (ma_towns_fy26, ma_overrides,
ma_debt_exclusions, marblehead_levy, marblehead_general_fund,
marblehead_per_pupil, marblehead_gic_premiums, minutes_catalog)
plus 4 new (vendor_payments, budget_lines, meetings, topics).

Every table has a _meta row with primary-source citation.

Closes the gap between PR #849 (data layer + SQL UI) and the
database-GUI spec by salvaging just the data layer and extending
with the Phase 1 entities. Phase 1b builds the /browse/ shell on
top of this file.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 8: Close PR #849 with a referencing comment

**Files:**
- No working-tree changes. GitHub-only action.

- [ ] **Step 8.1: Push the branch and open a PR**

```bash
git push -u origin <current-branch-name>
gh pr create --title "Phase 1a: SQLite data layer (salvaged from #849, extended with 4 Phase 1 tables)" --body-file - <<'EOF'
## Summary

First implementation phase of the town database GUI (`docs/superpowers/specs/2026-06-18-town-database-gui-design.md`).

Salvages the data layer from #849 (the SQLite build script + the `_meta` citation pattern) and extends it with four new tables (`vendor_payments`, `budget_lines`, `meetings`, `topics`) to support Phase 1 of the GUI. The SQL editor surface from #849 (`/data/lab/`, `assets/data-lab.js`) is intentionally dropped.

12 data tables + `_meta` in `assets/data/marbleheaddata.sqlite`. Pytest coverage on the four new ingest functions.

## Preview & How to Test

- **Preview URL:** No user-facing change in this PR; the SQLite is a static asset consumed by Phase 1b. Cloudflare preview will still render the site for regression checking.
- **Specific paths/screens to check:**
  1. Site renders without errors. The Data Lab page (`/data/lab/`) does NOT appear (it was never on this branch).
  2. `/data/` page is unchanged (no Data Lab tile).
  3. Optional: download `assets/data/marbleheaddata.sqlite` and open in DB Browser. Confirm 12 data tables + `_meta`.
- **Expected behavior:** site behaves exactly as on `main` from a user perspective. The SQLite asset is there for Phase 1b to consume.
- **Edge cases:** none for this phase (no UI).

## Proof of Work

- [x] `pytest scripts/test_build_sqlite_db.py -v` passes (5/5)
- [x] `python3 scripts/build_sqlite_db.py` runs end-to-end, generates the SQLite
- [x] `sqlite3 assets/data/marbleheaddata.sqlite "..."` queries return expected results

Test output, build output, and SQLite size pasted in the latest commit body.

## Risk

- **SQLite file size.** Spec open question #2 sets a 10 MB budget for first-page-load on slow connections. If this PR's SQLite exceeds 10 MB, edit this PR body with the actual size and proposed mitigation (drop unused PR #849 tables, or paginate vendor_payments by fiscal year). Phase 1b assumes a single SQLite asset under budget.
- **Existing site unchanged.** The `assets/data/marbleheaddata.sqlite` file is a passive asset; no Jekyll page references it yet. Zero behavior delta for visitors.

## Closes

Closes #849 (data layer salvaged into this PR; SQL editor surface intentionally dropped).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)
EOF
```

- [ ] **Step 8.2: Add a closing comment to PR #849**

```bash
gh pr comment 849 --body "$(cat <<'EOF'
Closing in favor of the cleaner replacement that salvages just the data layer (the SQLite + build script + `_meta` pattern) and drops the `/data/lab/` SQL editor surface.

The replacement also extends the data layer with the four Phase 1 entities (vendor_payments, budget_lines, meetings, topics) for the database GUI now being built per `docs/superpowers/specs/2026-06-18-town-database-gui-design.md`.

Replacement PR: <link from Step 8.1>
EOF
)"
```

- [ ] **Step 8.3: Close PR #849**

```bash
gh pr close 849
```

Do NOT delete the `data-lab-v0` branch. Leave it as a reference until the replacement PR merges, in case anything needs to be re-salvaged.

---

## Definition of done

- Branch pushed, PR open, PR #849 closed with a referencing comment.
- `pytest scripts/test_build_sqlite_db.py -v` reports 5/5 passing.
- `assets/data/marbleheaddata.sqlite` opens in `sqlite3` CLI with 12 data tables plus `_meta`.
- Every Phase 1 entity (`vendor_payments`, `budget_lines`, `meetings`, `topics`) has a `_meta` row with a primary-source citation.
- No regression in the existing site. The new SQLite is a passive asset; nothing on the site references it yet.

## Out of scope reminders

- No `/browse/` Jekyll pages. That's Phase 1b.
- No list views, detail views, or search UI. Phase 1b/1c.
- No migration of `/checkbook/` or `/explore/` to the new SQLite. Future phase.
- No `/data/lab/` SQL editor restoration. Dropped on purpose; see spec non-goals.
- No new entities beyond the four. Officials, Documents, Charts, Peer towns are later phases.
