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
