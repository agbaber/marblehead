"""Tests for build_town_budget_data.py."""
from build_town_budget_data import parse_budget_book


def test_parser_finds_grand_total(fy27_budget_text):
    rows = parse_budget_book(fy27_budget_text)
    grand_total = next(r for r in rows if r["id"] == "total_budgets")
    assert grand_total["fy27_proposed"] == 122_762_030
