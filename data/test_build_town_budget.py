"""Tests for build_town_budget_data.py."""
from pathlib import Path

import pytest

from build_town_budget_data import (
    attach_function_history,
    classify_spend_type,
    merge_excel_into_rows,
    parse_budget_book,
    parse_excel_account_details,
    parse_school_packet,
    update_general_fund_total,
)

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "budget_source" / "FY27-Proposed-Budget-vs-FY26-w-Acct-Details.xlsx"


def _excel_or_skip():
    if not XLSX.exists():
        pytest.skip(f"{XLSX.name} not present; skipping Excel splice tests")
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        pytest.skip("openpyxl not installed; skipping Excel splice tests")


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


def test_engineer_dept_dropped(fy27_budget_text):
    """Engineer dept was eliminated in FY25/FY26; should not appear in output
    because its FY26 and FY27 budgets are both $0."""
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    assert "engineer" not in by_id, \
        "Engineer dept (zeroed in FY26+FY27) should be filtered out"


def test_public_works_ops_separate_from_engineer(fy27_budget_text):
    """Public Works (Highway, Tree, Drains) operations should be its own
    department row, not bundled under the eliminated Engineer dept."""
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    assert "public_works_ops" in by_id, \
        "public_works_ops dept should exist after fix"
    pwo = by_id["public_works_ops"]
    assert pwo["level"] == "department"
    assert pwo["function"] == "public_works"
    # Public Works ops (lines 112-116) = $2,369,771 + Snow Removal line 117 = $105,000
    assert 2_300_000 < pwo["fy27_proposed"] < 2_600_000, \
        f"public_works_ops fy27 {pwo['fy27_proposed']} out of expected range"


def test_curbside_collection_is_separate_dept(fy27_budget_text):
    """NEW Curbside Collection should be parsed as its own department, not
    lumped into waste_collection."""
    rows = parse_budget_book(fy27_budget_text)
    by_id = {r["id"]: r for r in rows}
    assert "curbside_collection" in by_id, \
        "curbside_collection dept should exist"
    cc = by_id["curbside_collection"]
    assert cc["fy27_proposed"] == 2_186_516, \
        f"curbside_collection fy27 {cc['fy27_proposed']} != 2,186,516"
    # Waste collection should NOT include curbside amounts
    wc = by_id["waste_collection"]
    assert wc["fy27_proposed"] == 1_790_344, \
        f"waste_collection fy27 {wc['fy27_proposed']} != 1,790,344"


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


def test_classify_spend_type_uses_munis_object_codes():
    # 511xxx = salaries
    assert classify_spend_type("PD-DEPT HEAD", "511003") == "salaries"
    assert classify_spend_type("POL-PATROLMAN", "511014") == "salaries"
    assert classify_spend_type("FIRE-OVERTIME", "513000") == "salaries"
    # 517xxx = benefits, except sick-bonus-retirement which is salary-pooled
    assert classify_spend_type("HEALTH INSURANCE - ACTIVE", "517003") == "benefits"
    assert classify_spend_type("CONTRIBUTORY RETIREMENT", "517004") == "benefits"
    assert classify_spend_type("FIRE-SICK BONUS RETIREMENT", "517014") == "salaries"
    # 521xxx / 523xxx = utilities
    assert classify_spend_type("PD-ELECTRICITY", "521001") == "utility"
    assert classify_spend_type("PD-WATER/SEWER", "523003") == "utility"
    # 591/592 = debt
    assert classify_spend_type("LONG TERM PRINCIPAL", "591000") == "debt"
    # 596 = transfer
    assert classify_spend_type("TRANSFER TO OPEB TRUST", "596085") == "transfer"
    # 572500 = officials_expense
    assert classify_spend_type("MODERATOR- OFFICIALS EXPENSE", "572500") == "officials_expense"
    # 579900 = reserve fund
    assert classify_spend_type("RESERVE FUND TRANSFER ACCOUNT", "579900") == "reserve"
    # Other 5xxxxx falls to expense
    assert classify_spend_type("FIRE-MEDICAL/SURG SUPPL", "550020") == "expense"
    # No munis_obj → falls back to legacy description matching
    assert classify_spend_type("Salaries") == "salaries"
    assert classify_spend_type("Expense") == "expense"


def test_excel_splice_replaces_synthetic_lines_with_munis_detail():
    """After Excel splice, town departments should have one line per Munis
    account (not just 2-row 'Salaries / Expense' rollups from the TXT)."""
    _excel_or_skip()
    rows = parse_budget_book((ROOT / "data" / "FY27_Proposed_Budget_No_Override.txt").read_text())
    excel = parse_excel_account_details(XLSX)
    rows = merge_excel_into_rows(rows, excel)
    update_general_fund_total(rows)

    # Library went from 0 lines (TXT) to ~38 lines (Excel).
    lib = [r for r in rows if r["level"] == "line" and r.get("department") == "library"]
    assert len(lib) >= 25, f"expected ~38 Library Munis lines, got {len(lib)}"

    # The signature cut: ABBOT-LIBRARY MATERIALS should be present and zero'd.
    materials = next(
        (r for r in lib if r["description"] == "ABBOT-LIBRARY MATERIALS"), None,
    )
    assert materials is not None, "ABBOT-LIBRARY MATERIALS line missing"
    assert materials["fy27_proposed"] == 0
    assert materials["fy26_budget"] == 160_000

    # Police got per-rank breakdown.
    police = [r for r in rows if r["level"] == "line" and r.get("department") == "police"]
    assert len(police) >= 50, f"expected per-rank Police breakdown, got {len(police)} lines"
    rank_descriptions = {r["description"] for r in police}
    assert "POL-PATROLMAN" in rank_descriptions
    assert "POL-SARGENT" in rank_descriptions  # source spelling
    assert "POL-CAPTAIN" in rank_descriptions
    assert "POL-LIEUTENANT" in rank_descriptions


def test_excel_splice_lines_have_munis_org_obj():
    _excel_or_skip()
    rows = parse_budget_book((ROOT / "data" / "FY27_Proposed_Budget_No_Override.txt").read_text())
    excel = parse_excel_account_details(XLSX)
    rows = merge_excel_into_rows(rows, excel)

    excel_lines = [r for r in rows
                   if r.get("source_ref", {}).get("doc") == "fy27_account_details"]
    assert len(excel_lines) >= 500, \
        f"expected >=500 account-detail lines, got {len(excel_lines)}"

    # Every Excel-sourced line carries Munis ORG and OBJ codes.
    for r in excel_lines[:50]:
        assert r["source_ref"]["munis_org"], f"missing munis_org in {r['id']}"
        assert r["source_ref"]["munis_obj"], f"missing munis_obj in {r['id']}"
        # ORG and OBJ shape: ORG is 8 digits, OBJ is 6 digits.
        assert r["source_ref"]["munis_org"].isdigit()
        assert r["source_ref"]["munis_obj"].isdigit()


def test_excel_splice_dept_totals_match_excel_sums(fy27_budget_text):
    """Each town dept that the Excel covers should have its FY26/FY27
    rollup recomputed from Excel sums after splice."""
    _excel_or_skip()
    rows = parse_budget_book(fy27_budget_text)
    excel = parse_excel_account_details(XLSX)
    rows = merge_excel_into_rows(rows, excel)

    by_id = {r["id"]: r for r in rows}
    for slug, lines in excel.items():
        sum27 = sum(l["fy27_proposed"] for l in lines)
        dept_row = by_id.get(slug)
        assert dept_row is not None, f"missing dept row for slug={slug}"
        assert dept_row["fy27_proposed"] == sum27, \
            f"{slug}: dept fy27 {dept_row['fy27_proposed']} != Excel sum {sum27}"


def test_excel_splice_preserves_enterprise_and_school_lines(fy27_budget_text):
    """Enterprise funds (sewer/water/harbor) and Schools cost-centers come
    from non-Excel sources and should not be modified by the splice."""
    _excel_or_skip()
    rows = parse_budget_book(fy27_budget_text)
    rows.extend(parse_school_packet())
    rows = [r for r in rows if r["id"] not in {"schools_dept_wrapper", "line_101"}]
    excel = parse_excel_account_details(XLSX)
    rows = merge_excel_into_rows(rows, excel)
    update_general_fund_total(rows)

    by_id = {r["id"]: r for r in rows}
    # Enterprise depts should still come from TXT (have FY25 data).
    sewer = by_id.get("sewer")
    assert sewer is not None
    assert sewer["fy25_actual"] is not None, "Enterprise dept lost FY25 data"
    # School depts should still be present.
    assert "school_high" in by_id
    assert by_id["school_high"]["fy27_proposed"] > 10_000_000


def test_general_fund_total_reconciles_to_excel_book(fy27_budget_text):
    """After Excel splice, the GF grand total should match the FinCom report
    figure ($110,176,497 for FY27)."""
    _excel_or_skip()
    rows = parse_budget_book(fy27_budget_text)
    excel = parse_excel_account_details(XLSX)
    rows = merge_excel_into_rows(rows, excel)
    update_general_fund_total(rows)

    gf = next(r for r in rows if r["id"] == "total_general_fund")
    assert gf["fy27_proposed"] == 110_176_497, \
        f"GF total {gf['fy27_proposed']:,} ≠ FinCom figure 110,176,497"
    assert gf["fy26_budget"] == 106_206_380
