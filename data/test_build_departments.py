"""Tests for build_departments_data.py."""
import json
from pathlib import Path
from build_departments_data import build_view, _HEADCOUNT_CROSSWALK, _ROLE_CROSSWALK, ROOT

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


def test_police_role_populated_from_org_chart():
    view = build_view()
    police = view["departments"]["police"]
    assert police["role"] == "Chief of Police"
    assert police["role_source"] is not None


def test_role_none_when_no_org_chart_match():
    view = build_view()
    # reserve_fund is an accounting line, not a real org_chart department
    assert view["departments"]["reserve_fund"]["role"] is None
    assert view["departments"]["moderator"]["role"] is None


def test_role_note_and_source_url_present_for_finance():
    view = build_view()
    finance = view["departments"]["finance"]
    assert finance["role"] == "Finance Director / CFO"
    assert finance["role_source_url"] is not None


def test_police_has_sro_override_restoration():
    view = build_view()
    police = view["departments"]["police"]
    assert any("School Resource Officer" in o["description"] for o in police["overrides"])
    sro = next(o for o in police["overrides"] if "School Resource Officer" in o["description"])
    assert sro["tier_1"] == 65482


def test_library_has_four_override_items():
    view = build_view()
    lib = view["departments"]["library"]
    assert len(lib["overrides"]) == 4  # items 9,10,11,12 (Abbot Library)


def test_townwide_transfers_not_attributed_to_any_department():
    view = build_view()
    for dept in view["departments"].values():
        for o in dept["overrides"]:
            desc = o["description"].lower()
            assert "opeb" not in desc
            assert "stabilization" not in desc
            assert "workers comp" not in desc
            assert "recurring capital" not in desc


def test_finance_committee_reserve_fund_not_mapped_to_finance():
    # "Finance Committee Reserve Fund Cut" must NOT land on the finance dept
    view = build_view()
    for o in view["departments"]["finance"]["overrides"]:
        assert "Reserve Fund" not in o["description"]


def test_role_crosswalk_targets_exist_in_org_chart():
    import yaml
    doc = yaml.safe_load((ROOT / "_data" / "org_chart.yml").read_text())
    names = {d["name"] for d in doc["town"]["departments"]}
    for org_name in _ROLE_CROSSWALK.values():
        assert org_name in names, f"{org_name!r} not in org_chart.yml"
