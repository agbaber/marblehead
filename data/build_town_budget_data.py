#!/usr/bin/env python3
"""Parse the FY27 Proposed Budget book into a structured row list.

Source: data/FY27_Proposed_Budget_No_Override.txt (whitespace-delimited
text dump of the FY27 budget book PDF).

Output: data/town_budget_FY27.json + data/town_budget_FY27_lookup.json

Usage:
  python3 data/build_town_budget_data.py
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Pattern matches a line like:
#   "TOTAL BUDGETS    115,368,206   111,991,311   119,479,480   122,762,030   3,282,550   2.75%"
# Six numeric columns, last is a percentage.
_NUM = r"[\d,]+|-"
_PCT = r"-?[\d.]+%"
_GRAND_TOTAL_RE = re.compile(
    rf"^\s*TOTAL BUDGETS\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+(\(?{_NUM}\)?)\s+({_PCT})",
    re.MULTILINE,
)

_GENERAL_FUND_TOTAL_RE = re.compile(
    rf"^\s*TOTAL GENERAL FUND ACCOUNTS\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+(\(?{_NUM}\)?)\s+({_PCT})",
    re.MULTILINE,
)


def _parse_int(s: str) -> Optional[int]:
    s = s.strip().replace(",", "")
    if s in {"", "-"}:
        return 0
    if s.startswith("(") and s.endswith(")"):
        return -int(s[1:-1])
    return int(s)


def _parse_pct(s: str) -> Optional[float]:
    s = s.strip().rstrip("%")
    if s in {"", "-"}:
        return 0.0
    return float(s) / 100.0


def parse_budget_book(text: str) -> list[dict]:
    """Parse the FY27 budget book text into a flat list of rows.

    Rows have fields: id, level, parent_id, function, department,
    description, spend_type, fy25_actual, fy25_budget, fy26_budget,
    fy27_proposed, change_dollars, change_pct.
    """
    rows: list[dict] = []

    m = _GENERAL_FUND_TOTAL_RE.search(text)
    if m:
        rows.append({
            "id": "total_general_fund",
            "level": "grand_total",
            "parent_id": None,
            "function": None,
            "department": None,
            "description": "TOTAL GENERAL FUND ACCOUNTS",
            "spend_type": None,
            "fy25_budget": _parse_int(m.group(1)),
            "fy25_actual": _parse_int(m.group(2)),
            "fy26_budget": _parse_int(m.group(3)),
            "fy27_proposed": _parse_int(m.group(4)),
            "change_dollars": _parse_int(m.group(5)),
            "change_pct": _parse_pct(m.group(6)),
        })

    m = _GRAND_TOTAL_RE.search(text)
    if m:
        rows.append({
            "id": "total_budgets",
            "level": "grand_total",
            "parent_id": None,
            "function": None,
            "department": None,
            "description": "TOTAL BUDGETS",
            "spend_type": None,
            "fy25_budget": _parse_int(m.group(1)),
            "fy25_actual": _parse_int(m.group(2)),
            "fy26_budget": _parse_int(m.group(3)),
            "fy27_proposed": _parse_int(m.group(4)),
            "change_dollars": _parse_int(m.group(5)),
            "change_pct": _parse_pct(m.group(6)),
        })

    return rows


if __name__ == "__main__":
    text = (DATA / "FY27_Proposed_Budget_No_Override.txt").read_text()
    rows = parse_budget_book(text)
    print(json.dumps(rows[:5], indent=2))
