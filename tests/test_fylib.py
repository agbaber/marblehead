import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fylib


def test_current_fiscal_year_boundaries():
    assert fylib.current_fiscal_year(dt.date(2026, 6, 30)) == 2026
    assert fylib.current_fiscal_year(dt.date(2026, 7, 1)) == 2027
    assert fylib.current_fiscal_year(dt.date(2027, 1, 15)) == 2027


def test_fy_label():
    assert fylib.fy_label(2027) == "FY27"
    assert fylib.fy_label(2026) == "FY26"


def test_fy_bounds():
    assert fylib.fy_start(2027) == dt.date(2026, 7, 1)
    assert fylib.fy_end(2027) == dt.date(2027, 6, 30)


def test_fy_months():
    months = fylib.fy_months(2027)
    assert months[0] == "2026-07"
    assert months[-1] == "2027-06"
    assert len(months) == 12


def test_fiscal_year_of():
    assert fylib.fiscal_year_of(dt.date(2025, 7, 1)) == 2026
    assert fylib.fiscal_year_of(dt.date(2026, 6, 30)) == 2026
    assert fylib.fiscal_year_of(dt.date(2026, 7, 5)) == 2027


def test_months_elapsed():
    assert fylib.months_elapsed(2027, dt.date(2026, 7, 5)) == 1
    assert fylib.months_elapsed(2026, dt.date(2026, 5, 29)) == 11
    assert fylib.months_elapsed(2026, dt.date(2026, 6, 30)) == 12
    assert fylib.months_elapsed(2027, dt.date(2026, 6, 15)) == 1
    assert fylib.months_elapsed(2026, dt.date(2026, 8, 1)) == 12


def test_pct_elapsed():
    assert fylib.pct_elapsed(2027, dt.date(2026, 7, 1)) == 0.3
    assert fylib.pct_elapsed(2027, dt.date(2027, 6, 30)) == 100.0
    assert fylib.pct_elapsed(2026, dt.date(2026, 5, 29)) == 91.2
    assert fylib.pct_elapsed(2027, dt.date(2026, 6, 15)) == 0.0
    assert fylib.pct_elapsed(2027, dt.date(2027, 7, 15)) == 100.0
