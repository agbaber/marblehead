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

import yaml

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

# Budget department key -> headcount CSV "Department" name. Not every budget
# department has its own payroll line; those without one stay None. A single
# CSV line is mapped to at most one budget key.
_HEADCOUNT_CROSSWALK = {
    "select_board": "SELECTMEN",
    "finance": "FINANCE DEPARTMENT",
    "assessor": "ASSESSORS",
    "town_clerk": "TOWN CLERK",
    "election_registration": "ELECTION & REGISTRATION",
    "human_resources": "HUMAN RESOURCES",
    "town_counsel": "Town Counsel",
    "community_development": "COMMUNITY DEV & PLANNING",
    "building_inspection": "BUILDING COMMISSIONER",
    "animal_inspector": "ANIMAL INSPECTOR",
    "police": "POLICE",
    "fire": "FIRE",
    "health": "HEALTH",
    "council_on_aging": "COUNCIL ON AGING",
    "veterans_benefits": "VETERANS AGENT",
    "library": "LIBRARY",
    "rec_park": "PARK",
    "harbor": "HARBORMASTER",
    "cemetery": "CEMETERY",
    "public_buildings": "PUBLIC BUILDINGS",
    "water": "WATER",
    "sewer": "SEWER",
    "school_high": "HIGH SCHOOL",
    "school_middle": "VETERANS MIDDLE SCHOOL",
    "school_brown": "BROWN SCHOOL",
    "school_glover": "GLOVER SCHOOL",
    "school_village": "VILLAGE SCHOOL",
}

# Budget department key -> org_chart.yml town.departments "name".
# Descriptive role text (leadership + context) may be shared by two budget lines
# run by the same office (e.g. town_clerk + election_registration). That is fine
# for role TEXT (not a summed number). Departments with no clean org_chart entry
# (volunteer boards, accounting lines, schools, enterprise sub-lines) stay None.
_ROLE_CROSSWALK = {
    "select_board": "Select Board Office",
    "finance": "Finance",
    "assessor": "Assessors' Office",
    "town_clerk": "Town Clerk + Elections",
    "election_registration": "Town Clerk + Elections",
    "human_resources": "Human Resources",
    "community_development": "Community Development and Planning",
    "public_buildings": "Public Buildings",
    "police": "Police Department",
    "fire": "Fire Department",
    "building_inspection": "Building Inspection",
    "public_works_ops": "Department of Public Works",
    "waste_collection": "Solid Waste",
    "curbside_collection": "Solid Waste",
    "cemetery": "Cemetery Department",
    "health": "Health Department",
    "council_on_aging": "Council on Aging",
    "veterans_benefits": "Veterans Services",
    "library": "Abbot Public Library",
    "rec_park": "Recreation & Parks",
    "harbor": "Harbormaster",
    "sewer": "Sewer Department",
    "water": "Water Department",
}


def _load_budget() -> dict:
    return json.loads((DATA / "town_budget_FY27.json").read_text())


def _load_headcount() -> dict:
    """Return {csv_department_name: [ {fy, headcount}, ... sorted by fy ]}."""
    series = {}
    path = DATA / "town_employee_headcount_FY08-26.csv"
    with path.open(newline="") as f:
        for row in csv.DictReader(f):
            dept = row["Department"]
            try:
                fy = int(row["FY"])
                hc = int(row["Headcount"])
            except (ValueError, KeyError):
                continue
            series.setdefault(dept, []).append({"fy": fy, "headcount": hc})
    for dept in series:
        series[dept].sort(key=lambda pt: pt["fy"])
    return series


def _load_org_roles() -> dict:
    """Return {org_chart "name": {role, role_note, role_source, role_source_url}}."""
    doc = yaml.safe_load((ROOT / "_data" / "org_chart.yml").read_text())
    roles = {}
    for entry in doc.get("town", {}).get("departments", []):
        name = entry.get("name")
        if not name:
            continue
        roles[name] = {
            "role": entry.get("head_title"),
            "role_note": entry.get("note"),
            "role_source": entry.get("source_label"),
            "role_source_url": entry.get("source_url"),
        }
    return roles


def _departments_from_budget(budget: dict) -> dict:
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
            "role_note": None,
            "role_source_url": None,
            "budget": {k: r.get(k) for k in _BUDGET_KEYS},
            "line_items": [],
            "line_items_reconcile": True,
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
    # does not -- see data/project_schools_budget_page notes).
    #
    # Schools are the budget item residents most want to see, so the line
    # detail is preserved rather than dropped. Instead each department
    # carries a line_items_reconcile flag: True when the lines' fy27
    # sum matches the department total (within $1 rounding), False for the
    # six schools whose lines are level-funded pre-reduction. The page can
    # surface a caveat next to non-reconciling line items.
    for dept in depts.values():
        if not dept["line_items"]:
            continue
        line_sum = sum(li["fy27_proposed"] or 0 for li in dept["line_items"])
        total = dept["budget"]["fy27_proposed"] or 0
        dept["line_items_reconcile"] = abs(line_sum - total) <= 1

    return depts


def build_view() -> dict:
    budget = _load_budget()
    departments = _departments_from_budget(budget)

    headcount = _load_headcount()
    for key, dept in departments.items():
        csv_name = _HEADCOUNT_CROSSWALK.get(key)
        if csv_name and csv_name in headcount:
            dept["headcount"] = headcount[csv_name]

    org_roles = _load_org_roles()
    for key, dept in departments.items():
        org_name = _ROLE_CROSSWALK.get(key)
        if org_name and org_name in org_roles:
            dept.update(org_roles[org_name])

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


def main() -> None:
    view = build_view()
    out = DATA / "departments_view.json"
    out.write_text(json.dumps(view, indent=2) + "\n")
    print(f"wrote {out} ({len(view['departments'])} departments)")


if __name__ == "__main__":
    main()
