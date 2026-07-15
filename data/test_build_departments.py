"""Tests for build_departments_data.py."""
import json
from pathlib import Path
from build_departments_data import build_view, _HEADCOUNT_CROSSWALK

DATA = Path(__file__).resolve().parent


def test_all_40_departments_present():
    view = build_view()
    assert len(view["departments"]) == 40


def test_department_has_budget_and_function():
    view = build_view()
    police = view["departments"]["police"]
    assert police["function"] == "public_safety"
    assert police["budget"]["fy27_proposed"] > 0
    assert police["budget"]["fy27_proposed"] == 5216914
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


def test_police_headcount_series_present_and_labeled():
    view = build_view()
    police = view["departments"]["police"]
    assert police["headcount"] is not None
    assert police["headcount"][0]["fy"] == 2008
    assert police["headcount"][-1]["fy"] == 2026
    assert all("headcount" in pt for pt in police["headcount"])


def test_unmapped_department_headcount_is_none():
    # reserve_fund / debt_service have no payroll headcount line
    view = build_view()
    assert view["departments"]["reserve_fund"]["headcount"] is None


def test_headcount_crosswalk_targets_unique():
    # No CSV department name should be mapped by more than one budget key,
    # or one department's staff headcount gets duplicated onto another.
    values = list(_HEADCOUNT_CROSSWALK.values())
    assert len(set(values)) == len(values)
