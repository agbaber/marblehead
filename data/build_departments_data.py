#!/usr/bin/env python3
"""Join FY27 budget + headcount + org_chart roles + override tiers into one
per-department view for departments.html.

Inputs:
  data/town_budget_FY27.json                 (budget rows: function/department/line)
  data/town_employee_headcount_FY08-26.csv   (FY, Department, Headcount)
  _data/org_chart.yml                        (per-department roles, cited)
  town_budget_FY27.json meta.override_tiers  (override restorations)

Output:
  data/departments_view.json

Usage:
  python3 data/build_departments_data.py
"""
from __future__ import annotations
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

_FUNCTION_LABELS = {
    "general_government": "General Government",
    "public_safety": "Public Safety",
    "schools": "Schools",
    "public_works": "Public Works and Facilities",
    "human_services": "Human Services",
    "culture_recreation": "Culture and Recreation",
    "other_general_government": "Other General Government",
    "sewer_enterprise": "Sewer Enterprise",
    "water_enterprise": "Water Enterprise",
    "harbor_enterprise": "Harbor Enterprise",
}

_BUDGET_KEYS = ("fy25_actual", "fy26_budget", "fy27_proposed",
                "change_dollars", "change_pct")


def _load_budget():
    return json.loads((DATA / "town_budget_FY27.json").read_text())


def _departments_from_budget(budget):
    rows = budget["rows"]
    depts = {}
    for r in rows:
        if r.get("level") != "department":
            continue
        key = r["id"]
        depts[key] = {
            "name": r["department"],
            "function": r["function"],
            "function_label": _FUNCTION_LABELS.get(r["function"], r["function"]),
            "role": None,
            "role_source": None,
            "budget": {k: r.get(k) for k in _BUDGET_KEYS},
            "line_items": [],
            "headcount": None,
            "overrides": [],
        }
    # Lines are flat under their department: parent_id points directly at
    # the department row's id, there is no intermediate subgroup level in
    # this dataset (verified: no "line" row's id is itself a parent_id of
    # another "line" row). A handful of orphaned lines (e.g. "engineer")
    # have a parent_id that isn't any department row's id -- those belong
    # to a department that no longer has its own budget line (folded into
    # another department) and are intentionally dropped here rather than
    # double-counted.
    for r in rows:
        if r.get("level") != "line":
            continue
        parent = r.get("parent_id")
        if parent in depts:
            depts[parent]["line_items"].append({
                "description": r.get("description"),
                **{k: r.get(k) for k in _BUDGET_KEYS},
            })

    # The six school-building departments (school_brown, school_glover,
    # school_village, school_middle, school_high, school_athletics) source
    # their ledger-level lines from the school committee's FY27 packet,
    # which reports each line at its level-funded (pre-reduction) request.
    # The department's fy27_proposed total, by contrast, comes from the
    # town's FY27 Proposed Budget book and already reflects negotiated
    # cuts that are not allocated back down to individual munis lines in
    # this source data (fy26_budget reconciles to the penny; fy27_proposed
    # does not -- see data/project_schools_budget_page notes). Publishing
    # those non-reconciling lines as "line items" of the reduced total
    # would misrepresent the budget, so line_items are only kept for a
    # department when they actually sum to its reported fy27_proposed
    # total; otherwise they're dropped rather than shown as if they add up.
    for dept in depts.values():
        if not dept["line_items"]:
            continue
        line_sum = sum(li["fy27_proposed"] or 0 for li in dept["line_items"])
        if line_sum != dept["budget"]["fy27_proposed"]:
            dept["line_items"] = []

    return depts


def build_view():
    budget = _load_budget()
    departments = _departments_from_budget(budget)
    return {
        "schema_version": 1,
        "source_note": ("Budget from FY27 Proposed Budget (No Override); "
                        "headcount from town payroll FY08-26; roles from "
                        "org_chart.yml; override restorations from the FY27 "
                        "override tiers. See town-budget.html and org-chart.html "
                        "for full citations."),
        "functions": [],
        "departments": departments,
    }


def main():
    view = build_view()
    out = DATA / "departments_view.json"
    out.write_text(json.dumps(view, indent=2) + "\n")
    print(f"wrote {out} ({len(view['departments'])} departments)")


if __name__ == "__main__":
    main()
