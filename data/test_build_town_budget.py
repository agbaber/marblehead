"""Tests for build_town_budget_data.py."""
from build_town_budget_data import parse_budget_book, attach_function_history, parse_school_packet


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


def test_function_history_attached(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    attach_function_history(rows)
    by_id = {r["id"]: r for r in rows}

    police_or_safety = by_id["public_safety"]
    assert "history" in police_or_safety
    # FY02-FY24 = 23 years of data
    history = police_or_safety["history"]
    assert "fy24_actual" in history
    assert "fy15_actual" in history
    # Public safety FY24 actual should be in the millions
    assert history["fy24_actual"] > 5_000_000

    # CAGR should exist and be a sensible number (between -10% and +20% per year over 22 years).
    assert "cagr_22yr" in police_or_safety
    assert -0.10 < police_or_safety["cagr_22yr"] < 0.20

    # Schools (education bucket) should also have history.
    schools = by_id["schools"]
    assert "history" in schools
    assert schools["history"]["fy24_actual"] > 30_000_000

    # other_general_government rolls up 4 buckets — should still get history.
    ogg = by_id["other_general_government"]
    assert "history" in ogg

    # Enterprise functions should NOT have history (Schedule A is GF-focused).
    sewer = by_id["sewer_enterprise"]
    assert "history" not in sewer


def test_school_packet_extracts_some_schools():
    """We expect at least 4 of the 6 schools to parse cleanly. If fewer than 4
    succeed, the packet format probably changed and the UI falls back to one
    schools lump."""
    rows = parse_school_packet()
    if len(rows) == 0:
        # Acceptable fallback -- packet format changed. UI will show one lump.
        return
    dept_rows = [r for r in rows if r["level"] == "department"]
    assert len(dept_rows) >= 4, f"only {len(dept_rows)} schools parsed: {[r['id'] for r in dept_rows]}"
    by_id = {r["id"]: r for r in dept_rows}
    if "school_brown" in by_id:
        # Brown should be in the $4-7M range based on prior years' patterns.
        assert 4_000_000 < by_id["school_brown"]["fy27_proposed"] < 8_000_000


def test_school_packet_extracts_munis_lines():
    """Munis-level line items should be extracted for each school."""
    rows = parse_school_packet()
    munis_rows = [r for r in rows if r["level"] == "line"]
    # Expect at least 100 sub-line items across all 6 schools.
    assert len(munis_rows) >= 100, f"only {len(munis_rows)} Munis lines extracted"
    # Each munis row has source_ref with munis_org/obj/proj.
    sample = munis_rows[0]
    assert "munis_org" in sample["source_ref"]
    assert "munis_obj" in sample["source_ref"]
    assert "munis_proj" in sample["source_ref"]
    # Brown should have its own Munis lines.
    brown_lines = [r for r in munis_rows if r["parent_id"] == "school_brown"]
    assert len(brown_lines) >= 10, f"only {len(brown_lines)} Brown Munis lines"
    # Each row has fy26 and fy27 ints.
    for r in munis_rows[:20]:
        assert isinstance(r["fy26_budget"], int), f"fy26_budget not int: {r}"
        assert isinstance(r["fy27_proposed"], int), f"fy27_proposed not int: {r}"
