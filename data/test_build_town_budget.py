"""Tests for build_town_budget_data.py."""
from build_town_budget_data import parse_budget_book


def test_parser_finds_grand_total(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    grand_total = next(r for r in rows if r["id"] == "total_budgets")
    assert grand_total["fy27_proposed"] == 122_762_030


def test_parser_finds_general_fund_total(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    gf = next(r for r in rows if r["id"] == "total_general_fund")
    assert gf["fy27_proposed"] == 109_777_938
    assert gf["fy26_budget"] == 106_206_380


EXPECTED_FUNCTIONS = {
    "general_government":     ("VOTE TOTAL GENERAL GOVERNMENT",                4_618_544, -0.0286),
    "public_safety":          ("VOTE TOTAL PUBLIC SAFETY",                    11_861_711, +0.0555),
    "schools":                ("VOTE TOTAL SCHOOLS",                          47_620_287, -0.0305),
    "public_works":           ("VOTE TOTAL PUBLIC WORKS AND FACILITIES",       6_862_170, +0.1741),
    "human_services":         ("VOTE TOTAL HUMAN SERVICES",                      881_569, -0.0183),
    "culture_recreation":     ("VOTE TOTAL CULTURE AND RECREATION",            1_870_167, -0.2631),
    "other_general_government": ("VOTE TOTAL OTHER GENERAL GOVERNMENT",       24_965_092, +0.1096),
    "sewer_enterprise":       ("VOTE TOTAL SEWER ENTERPRISE FUND",             4_799_291, -0.1325),
    "water_enterprise":       ("VOTE TOTAL WATER ENTERPRISE FUND",             6_865_301, +0.0621),
    "harbor_enterprise":      ("VOTE TOTAL HARBOR ENTERPRISE FUND",            1_319_500, +0.0334),
}


def test_parser_finds_all_function_totals(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    for slug, (descr, amount, pct) in EXPECTED_FUNCTIONS.items():
        assert slug in by_id, f"missing function row {slug}"
        assert by_id[slug]["description"] == descr
        assert by_id[slug]["fy27_proposed"] == amount
        assert abs(by_id[slug]["change_pct"] - pct) < 0.0001
        assert by_id[slug]["level"] == "function"


def test_parser_finds_known_line_items(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    by_descr_in_dept = {
        (r.get("department"), r["description"]): r
        for r in rows if r["level"] == "line"
    }
    police_salaries = by_descr_in_dept[("police", "Salaries")]
    assert police_salaries["fy27_proposed"] == 4_988_616
    assert police_salaries["function"] == "public_safety"
    assert police_salaries["parent_id"] == "police"

    fire_expense = by_descr_in_dept[("fire", "Expense")]
    assert fire_expense["fy27_proposed"] == 372_780


def test_parser_creates_department_rows(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    assert "police" in by_id
    assert by_id["police"]["level"] == "department"
    assert by_id["police"]["parent_id"] == "public_safety"
    assert by_id["police"]["fy27_proposed"] == 5_216_914


def test_function_subtotals_reconcile(fy27_budget_text):
    """Each function's department children should sum to its function total
    within $1 (rounding tolerance)."""
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    for fn_slug in ["general_government", "public_safety", "public_works",
                    "human_services", "culture_recreation",
                    "sewer_enterprise", "water_enterprise", "harbor_enterprise"]:
        function_total = by_id[fn_slug]["fy27_proposed"]
        children_sum = sum(r["fy27_proposed"] for r in rows
                           if r["level"] == "department" and r["function"] == fn_slug)
        assert abs(function_total - children_sum) < 5, \
            f"{fn_slug}: function total {function_total} ≠ children sum {children_sum}"
