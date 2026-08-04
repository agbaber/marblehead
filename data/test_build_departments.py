"""Tests for build_departments_data.py."""
import json
from pathlib import Path
from build_departments_data import (
    build_view, _HEADCOUNT_CROSSWALK, _ROLE_CROSSWALK, _DISPLAY_NAMES, ROOT,
)

DATA = Path(__file__).resolve().parent


def test_all_40_departments_present():
    view = build_view()
    assert len(view["departments"]) == 40


def test_every_department_has_a_human_display_name():
    view = build_view()
    for key, dept in view["departments"].items():
        name = dept["name"]
        # A real display name, not the raw slug echoed back.
        assert name == _DISPLAY_NAMES[key], f"{key} missing curated display name"
        assert "_" not in name, f"{key} name still looks like a slug: {name!r}"
        assert name != key


def test_specific_display_names_are_grammatical():
    view = build_view()
    d = view["departments"]
    assert d["select_board"]["name"] == "Select Board Office"
    assert d["school_high"]["name"] == "Marblehead High School"
    assert d["public_works_ops"]["name"] == "Public Works Operations"
    assert d["rec_park"]["name"] == "Recreation & Parks"


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


def test_no_override_list_on_departments():
    # Override restorations are not shown as a "what the override would restore"
    # section. The dollar amounts are folded into the adopted budget instead.
    view = build_view()
    for dept in view["departments"].values():
        assert "overrides" not in dept


def test_police_adopted_budget_is_proposed_plus_override():
    view = build_view()
    b = view["departments"]["police"]["budget"]
    assert b["fy27_proposed"] == 5_216_914
    # SRO 65,482 + staffing 130,964 + equipment 2,000 (Tier 3).
    assert b["override_added"] == 198_446
    assert b["fy27_adopted"] == 5_216_914 + 198_446
    # Change is adopted-vs-FY26, not proposed-vs-FY26.
    assert b["change_dollars"] == b["fy27_adopted"] - b["fy26_budget"]


def test_department_without_override_has_adopted_equal_proposed():
    view = build_view()
    b = view["departments"]["moderator"]["budget"]
    assert b["override_added"] == 0
    assert b["fy27_adopted"] == b["fy27_proposed"]


def test_police_checkbook_is_grant_capital_with_vendors():
    view = build_view()
    cb = view["departments"]["police"]["checkbook"]
    assert cb is not None
    assert cb["kind"] == "grant_capital"
    assert cb["total"] > 0 and cb["count"] > 0
    assert cb["top_vendors"] and "vendor" in cb["top_vendors"][0]


def test_checkbook_top_vendors_carry_a_purpose():
    view = build_view()
    tv = view["departments"]["police"]["checkbook"]["top_vendors"]
    # At least the largest vendor should have a human "what for" label.
    assert tv[0].get("purpose")
    assert "vendor" in tv[0] and "amount" in tv[0]


def test_sewer_checkbook_is_enterprise_and_material():
    view = build_view()
    cb = view["departments"]["sewer"]["checkbook"]
    assert cb is not None and cb["kind"] == "enterprise"
    # Dominated by the South Essex regional sewer assessment (~$3.27M).
    assert cb["total"] > 3_000_000


def test_general_fund_department_has_no_checkbook_attribution():
    view = build_view()
    assert view["departments"]["finance"]["checkbook"] is None


def test_checkbook_fund_names_all_exist_in_the_db():
    import sqlite3
    from build_departments_data import _CHECKBOOK_FUNDS
    db = ROOT / "assets" / "data" / "marbleheaddata.sqlite"
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    real = {r[0] for r in con.execute(
        "SELECT DISTINCT department FROM vendor_payments WHERE department IS NOT NULL")}
    con.close()
    for key, funds in _CHECKBOOK_FUNDS.items():
        for fund in funds:
            assert fund in real, f"{key}: fund {fund!r} not in checkbook DB (typo?)"


def test_police_has_position_roster_from_org_chart():
    view = build_view()
    st = view["departments"]["police"]["staffing"]
    assert st is not None
    assert st["fte"] == 68
    assert st["salary_total"] > 0
    titles = [pos["title"] for pos in st["positions"]]
    assert any("Patrolman" in t for t in titles)
    # Every roster row carries a people count and an FY27 figure.
    for pos in st["positions"]:
        assert pos["count"] is not None
        assert "fy27" in pos


def test_service_summary_present_for_pilot_departments():
    view = build_view()
    for key in ("police", "fire", "public_works_ops"):
        svc = view["departments"][key]["services"]
        assert svc is not None and svc["summary"]
        assert svc["source_url"]  # cited to the department's own page


def test_library_deep_dive_links_out_and_defers_detail():
    view = build_view()
    lib = view["departments"]["library"]
    assert lib["deep_dive"] and lib["deep_dive"]["url"] == "/library.html"


def test_department_without_org_chart_has_no_staffing_roster():
    # moderator is not an org_chart department, so it has no position roster,
    # but it now carries a factual service description like every department.
    view = build_view()
    moderator = view["departments"]["moderator"]
    assert moderator["staffing"] is None
    assert moderator["services"] and moderator["services"]["summary"]


def test_all_forty_departments_have_a_description():
    view = build_view()
    missing = [k for k, d in view["departments"].items()
               if not (d["services"] and d["services"]["summary"])]
    assert missing == [], f"departments still missing a description: {missing}"


def test_role_crosswalk_targets_exist_in_org_chart():
    import yaml
    doc = yaml.safe_load((ROOT / "_data" / "org_chart.yml").read_text())
    names = {d["name"] for d in doc["town"]["departments"]}
    for org_name in _ROLE_CROSSWALK.values():
        assert org_name in names, f"{org_name!r} not in org_chart.yml"


def test_functions_index_has_ten_groups():
    view = build_view()
    assert len(view["functions"]) == 10
    keys = {f["key"] for f in view["functions"]}
    assert "public_safety" in keys and "schools" in keys
    for f in view["functions"]:
        assert "label" in f and "fy27_proposed" in f
