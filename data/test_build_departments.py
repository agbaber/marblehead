"""Tests for build_departments_data.py."""
import json
from pathlib import Path
from build_departments_data import build_view

DATA = Path(__file__).resolve().parent


def test_all_40_departments_present():
    view = build_view()
    assert len(view["departments"]) == 40


def test_department_has_budget_and_function():
    view = build_view()
    police = view["departments"]["police"]
    assert police["function"] == "public_safety"
    assert police["budget"]["fy27_proposed"] > 0
    assert "fy25_actual" in police["budget"]


def test_line_items_sum_to_department_total():
    view = build_view()
    for key, dept in view["departments"].items():
        if not dept["line_items"]:
            continue
        if not dept["line_items_reconcile"]:
            continue
        line_sum = sum(li["fy27_proposed"] for li in dept["line_items"])
        total = dept["budget"]["fy27_proposed"]
        assert abs(line_sum - total) <= 1, f"{key} lines != total"


def test_schools_flagged_non_reconciling():
    view = build_view()
    for key in ("school_high", "school_village"):
        dept = view["departments"][key]
        assert dept["line_items_reconcile"] is False, f"{key} should be flagged"
        assert dept["line_items"], f"{key} line items should be preserved"
