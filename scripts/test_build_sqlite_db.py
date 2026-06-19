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

        # Backfill: rows where Division was empty/UNDEFINED in the CSV
        # should now have department derived from fund.
        undefined_rows = conn.execute(
            "SELECT COUNT(*) FROM vendor_payments WHERE department = 'UNDEFINED'"
        ).fetchone()[0]
        assert undefined_rows == 0, (
            f"Expected no UNDEFINED department after backfill, got {undefined_rows}"
        )

        # Electric Enterprise should be a visible department now
        # (it was UNDEFINED before the backfill).
        ee_total = conn.execute(
            "SELECT ROUND(SUM(amount), 0) FROM vendor_payments "
            "WHERE department = 'ELECTRIC ENTERPRISE' AND fiscal_year = 'FY26'"
        ).fetchone()[0]
        assert ee_total is not None and ee_total > 5_000_000, (
            f"Expected Electric Enterprise to surface as a department, got total {ee_total}"
        )

        # Genuinely tagless rows become 'Unattributed' (single label).
        unattributed = conn.execute(
            "SELECT COUNT(*) FROM vendor_payments WHERE department = 'Unattributed'"
        ).fetchone()[0]
        # We expect some Unattributed rows (the rows with both Division
        # and Fund empty), but not millions.
        assert unattributed >= 0 and unattributed < n // 4, (
            f"Unexpected Unattributed count {unattributed}"
        )
    finally:
        conn.close()


def test_budget_lines_ingest():
    """budget_lines ingest flattens FY*_budget_summary.json into long-form rows."""
    conn = _open_memory_db()
    try:
        n = build_sqlite_db.build_budget_lines(conn)
        assert n >= 35, f"Expected at least 35 budget_lines rows, got {n}"

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

        # Phase 1c: topic_tags populated from topic_segments[].topic
        select_board_2026_04_15 = conn.execute(
            "SELECT topic_tags FROM meetings WHERE slug = 'select-board-2026-04-15'"
        ).fetchone()
        assert select_board_2026_04_15 is not None, "Select Board 2026-04-15 row missing"
        tags = select_board_2026_04_15[0]
        # Should contain at least 'override' since the file has that topic_segment.
        assert "override" in tags, (
            f"Expected 'override' in topic_tags, got: {tags!r}"
        )
        # Sorted, comma-joined, no spaces.
        if tags:
            parts = tags.split(",")
            assert parts == sorted(parts), f"Topic tags not sorted: {tags!r}"
            assert " " not in tags, f"Topic tags contain spaces: {tags!r}"

        # At least one meeting somewhere should have non-empty topic_tags.
        with_tags = conn.execute(
            "SELECT COUNT(*) FROM meetings WHERE topic_tags != ''"
        ).fetchone()[0]
        assert with_tags > 0, "Expected at least one meeting with non-empty topic_tags"
    finally:
        conn.close()


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
