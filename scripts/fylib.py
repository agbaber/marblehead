"""Shared fiscal-year helpers for the data pipeline (MA fiscal year: Jul 1 – Jun 30)."""
from __future__ import annotations

import datetime as dt


def current_fiscal_year(today: dt.date | None = None) -> int:
    today = today or dt.date.today()
    return today.year + 1 if today.month >= 7 else today.year


def fiscal_year_of(d: dt.date) -> int:
    return d.year + 1 if d.month >= 7 else d.year


def fy_label(year: int) -> str:
    return f"FY{year - 2000}"


def fy_start(year: int) -> dt.date:
    return dt.date(year - 1, 7, 1)


def fy_end(year: int) -> dt.date:
    return dt.date(year, 6, 30)


def fy_months(year: int) -> list[str]:
    return [f"{year - 1}-{m:02d}" for m in range(7, 13)] + \
           [f"{year}-{m:02d}" for m in range(1, 7)]


def months_elapsed(year: int, as_of: dt.date) -> int:
    delta = (as_of.year - fy_start(year).year) * 12 + as_of.month - 7
    return max(1, min(12, delta + 1))


def pct_elapsed(year: int, as_of: dt.date) -> float:
    total = (fy_end(year) - fy_start(year)).days + 1
    done = (as_of - fy_start(year)).days + 1
    return round(100 * max(0, min(done, total)) / total, 1)
