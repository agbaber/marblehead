#!/usr/bin/env python3
"""Join FY27 budget + headcount + org_chart roles into one
per-department view for departments.html.

Inputs:
  data/town_budget_FY27.json                 (budget rows: function/department/line)
  data/town_employee_headcount_FY08-26.csv   (FY, Department, Headcount)
  _data/org_chart.yml                        (per-department roles, cited)

Output:
  data/departments_view.json

Usage:
  python3 data/build_departments_data.py
"""
from __future__ import annotations
import csv
import json
import re
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


def _staffing_from_org_entry(entry: dict) -> dict:
    """FY27 position roster + summary for a department, from its org_chart entry."""
    positions = []
    for p in entry.get("positions", []) or []:
        positions.append({
            "title": p.get("title"),
            # pool_count is the number of people in the title; a null pool_count
            # is a single named position (Chief, Senior Clerk, etc.), so show 1.
            "count": p.get("pool_count") if p.get("pool_count") else 1,
            "fy27": p.get("fy27"),
            # continuing / new / eliminated / reduced. An "eliminated" line is a
            # removed budget code (fy27 = 0), shown as such so a prior-year count
            # next to $0 does not read as unpaid staff.
            "status": p.get("status"),
            "note": p.get("note"),
        })
    return {
        "fte": entry.get("fte"),
        "fte_basis": entry.get("fte_basis"),
        "salary_total": entry.get("fy27_salary_total"),
        "position_summary": entry.get("fy27_position_summary"),
        "positions": positions,
    }


def _load_org_roles() -> dict:
    """Return {org_chart "name": {role, role_note, role_source, role_source_url,
    staffing}}."""
    doc = yaml.safe_load((ROOT / "_data" / "org_chart.yml").read_text())
    roles = {}
    for entry in doc.get("town", {}).get("departments", []):
        name = entry.get("name")
        if not name:
            continue
        staffing = _staffing_from_org_entry(entry)
        roles[name] = {
            "role": entry.get("head_title"),
            "role_note": entry.get("note"),
            "role_source": entry.get("source_label"),
            "role_source_url": entry.get("source_url"),
            # Only attach a roster when the entry actually lists positions.
            "staffing": staffing if staffing["positions"] else None,
        }
    return roles


def _load_services() -> dict:
    """Return {budget dept key: {summary, source_url, source_label, deep_dive}}
    from data/department_services.yml (authored, cited what-they-do text)."""
    path = DATA / "department_services.yml"
    if not path.exists():
        return {}
    doc = yaml.safe_load(path.read_text()) or {}
    services = {}
    for key, val in doc.items():
        if not isinstance(val, dict):
            continue
        services[key] = {
            "summary": val.get("summary"),
            "source_url": val.get("source_url"),
            "source_label": val.get("source_label"),
            "deep_dive": val.get("deep_dive"),
        }
    return services


# The FY27 budget rows are the *No Override* proposed budget. The override passed
# (voters chose Tier 3), so the adopted per-department budget is the no-override
# proposal plus that department's Tier-3 restorations. These ordered rules map an
# override line to the department it funds (specific phrase first so "finance
# committee reserve fund" resolves to reserve_fund, not finance). Town-wide lines
# (OPEB/stabilization/workers-comp/recurring-capital/unemployment offset) match
# nothing and are not attributed to a department.
_OVERRIDE_RULES = [
    ("finance committee reserve fund", "reserve_fund"),
    ("school resource officer", "police"),
    ("police", "police"),
    ("fire", "fire"),
    ("inspections", "building_inspection"),
    ("department of public works", "public_works_ops"),
    ("cemetery", "cemetery"),
    ("abbot library", "library"),
    ("recreation and parks", "rec_park"),
    ("hr other technical", "human_resources"),
    ("community development", "community_development"),
    ("town clerk", "town_clerk"),
    ("public buildings", "public_buildings"),
    ("council on aging", "council_on_aging"),
    ("health department", "health"),
    ("finance", "finance"),
]


def _match_override_dept(description: str):
    d = (description or "").lower()
    for keyword, key in _OVERRIDE_RULES:
        if keyword in d:
            return key
    return None


def _override_added_by_dept(budget: dict) -> dict:
    """{dept key: total Tier-3 override dollars restored to that department}."""
    added = {}
    for tier in budget["meta"]["override_tiers"]:
        key = _match_override_dept(tier.get("description"))
        if key:
            added[key] = added.get(key, 0) + (tier.get("tier_3") or 0)
    return added


# Budget dept key -> checkbook fund names (SQLite vendor_payments.department).
# HAND-CURATED: the fund taxonomy is messy and keyword-matching mis-attributes
# (e.g. "FIREWORKS DONATION" is the July-4th fund, not the Fire Dept). Only funds
# clearly named for the department are listed. IMPORTANT: the town's checkbook
# does NOT tag general-fund operating spending by department; for most
# departments these are grant/capital/donation funds only, not operating money.
_CHECKBOOK_FUNDS = {
    "water": [
        "MASS WATER RESOURCES AUTHORITY", "MWRA PROJECT LWSAP26-3021",
        "PRINCIPAL ON LONG TERM MWRA", "A36 2019 MWRA LOAN",
        "ATM25A11A-WATER CONSTRCUTION", "ART 11 2024 WATER CONSTRUCTION",
        "ART 14 2022 WATER CONSTRUCTION", "ART 15 2023 WATER CONSTRUCTION",
        "WATER LEAD SERVICE GRANT",
    ],
    "sewer": [
        "SOUTH ESSEX SEWER DISTRICT", "A11 2024 SEWER CONSTRUCTION",
        "A15 2022 SEWER CONSTRUCTION", "A16 2023 SEWER CONSTRUCTION",
        "ATM25A11B-SEWER CONSTRUCTION",
    ],
    "harbor": ["HARBOR ACCESS GRANT", "HARBOR CAPITAL OUTLAYS", "HARBOR ENTERPRISE OPERATING"],
    "rec_park": [
        "PARK REVOLVING FUND", "PARK FACILITY", "REC AND PARK DONATION FUND",
        "GERRY PLAYGROUND DONATION", "GREEN ST BIKE PARK DONATION", "DOG PARK DONATION",
        "YOUTH BASEBALL DONATION FUND", "SHATTUCK MEM FUND-PARK",
        "ATM25A6-P&R-ELECTRIC MOWER", "ATM25A7-P&R-F-450 DUMP TRUCK",
        "ATM25A7-P&R-WIDE AREA MOWER",
    ],
    "police": [
        "POLICE DUTY FIREARMS GRANT", "DUE TO COMMONWEALTH-FIREARMS",
        "ATM25A6-POL-PORTABLE RADIOS", "ATM25A7-POL-2 FORD HYBRIDS",
        "ATM25A7-POL-CRUISER", "ATM25A7-POL-FORD INTERCEPTOR", "ATM25A8-POL-FLOOR REPLCE",
    ],
    "fire": ["FIRE EQUIPMENT GRANT", "FIRE SAFE GRANT", "ATM25A7-FIRE-TRAIN VEHICLE"],
    "council_on_aging": [
        "COA REVOLVING", "COA FORMULA SPENDING PLAN", "COA TRANSPORTATION GRANT",
        "COUNCIL ON AGING DONATION FUND", "SHATTUCK MEM FUND-COA", "HARRY PARKER STEELE COA FUND",
    ],
    "cemetery": [
        "ATM25A42,43-CEM-CEMETERY IMPRO", "SALE OF CEMETERY LOTS",
        "PERPETUAL CARE DONATIONS", "OLD BURIAL HILL DONATION",
    ],
    "health": ["BOH DONATION FUND", "VACCINE REVOLVING FUND", "OPIOID SETTLEMENT FUND"],
    "waste_collection": [
        "COMMERCIAL WASTE COLL REVOLV", "ATM25A6-WASTE-F-150 CREW CAB",
        "ATM25A7-WASTE-BACKHOE LEASE", "ATM25A7-WASTE-JD LOADER",
        "LANDFILL MONITORING EXPENSE", "A34 2015 NEW TRANSF STATION",
    ],
    "public_works_ops": [
        "PW MAINTAIN STREETS & SIDEWALK", "CHAPTER 90", "CH90 FAIR SHARE GRANT",
        "ATM25A6-DPW-F350 W PLOW", "ATM25A7-DPW-BUCKET LIFT TRUCK",
        "ATM25A7-DPW-F550 TRUCK W PLOW", "ATM25A7-DPW-INTERNATIONAL TRUC",
        "ATM26A9-DPW -F55O W PLOW", "ATM26A9-DPW BUCKET LIFT TRUCK",
        "STORMWATER CONSTRUCTION", "ART 14 DRAIN CONSTRUCTION", "A15 20 DRAIN CONSTRUCTION",
        "STREET LIGHTING", "STREET OPENNING REVOLVING", "ROAD SAFETY GRANT",
    ],
    "public_buildings": ["ATM25A6-PB-F-150 CREW CAB", "HOBBS MEM BLDG REVOLVING"],
    "veterans_benefits": ["VETERANS BENEFITS", "VETERANS DONATION FUND"],
}
# Departments whose named funds are their real spending (enterprise + regional
# assessments + their own capital), vs those where the named funds are only
# grants/capital/donations layered on an operating budget the checkbook lumps
# into general buckets.
_CHECKBOOK_ENTERPRISE = {"water", "sewer", "harbor", "rec_park"}


def _clean_purpose(cat) -> str | None:
    """Turn a checkbook category/description into a short 'what for' label, or
    None if it is blank or just a reference/invoice number. Leading article and
    project codes are stripped; the town's own wording is otherwise kept."""
    if not cat:
        return None
    c = str(cat).strip()
    # Strip leading warrant-article / capital-project / CIP codes.
    c = re.sub(r"^(ATM\S+\s*-?\s*|A\d+\s+20\d\d\s*-?\s*|20\d\d-\d+\s+|CIP\s+)",
               "", c, flags=re.IGNORECASE).strip(" -")
    # Skip values that are essentially a reference/invoice number, not a purpose.
    if sum(ch.isalpha() for ch in c) < 3:
        return None
    return c[:52]


def _load_checkbook() -> dict:
    """Per-department attributable checkbook payments (FY26) from the SQLite the
    /browse product uses. Returns {} if the DB is absent."""
    import sqlite3
    db = ROOT / "assets" / "data" / "marbleheaddata.sqlite"
    if not db.exists():
        return {}
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    cur = con.cursor()
    out = {}
    for key, funds in _CHECKBOOK_FUNDS.items():
        ph = ",".join("?" * len(funds))
        cur.execute(
            f"SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM vendor_payments "
            f"WHERE fiscal_year = 'FY26' AND department IN ({ph})", funds)
        count, total = cur.fetchone()
        if not count:
            continue
        # Aggregate by vendor, keeping the description of each vendor's largest
        # payment so the table can say what the money was FOR (a bare "CROSSROADS
        # BANK" is opaque; "Ford Hybrid cruiser lease" is not).
        cur.execute(
            f"SELECT vendor, category, SUM(amount) s FROM vendor_payments "
            f"WHERE fiscal_year = 'FY26' AND department IN ({ph}) "
            f"GROUP BY vendor, category", funds)
        agg = {}
        for v, cat, s in cur.fetchall():
            e = agg.setdefault(v, {"total": 0.0, "best_cat": None, "best_amt": 0.0})
            e["total"] += s
            if s > e["best_amt"]:
                e["best_amt"] = s
                e["best_cat"] = cat
        ranked = sorted(agg.items(), key=lambda kv: kv[1]["total"], reverse=True)[:5]
        top = [{"vendor": v, "amount": round(e["total"], 2),
                "purpose": _clean_purpose(e["best_cat"])} for v, e in ranked]
        out[key] = {
            "kind": "enterprise" if key in _CHECKBOOK_ENTERPRISE else "grant_capital",
            "fiscal_year": "FY26",
            "total": round(total, 2),
            "count": count,
            "top_vendors": top,
        }
    con.close()
    return out


# Budget department key -> human display name shown on cards + profile headings.
# The source budget JSON stores the same slug in both `id` and `department`, so
# the raw value ("school_high", "public_works_ops") is unfit to display. School
# building names follow org_chart.yml's schools section; town department names
# follow org_chart.yml's town.departments where one exists.
_DISPLAY_NAMES = {
    "moderator": "Town Moderator",
    "select_board": "Select Board Office",
    "finance_committee": "Finance Committee",
    "reserve_fund": "Reserve Fund",
    "finance": "Finance Department",
    "assessor": "Assessors' Office",
    "town_counsel": "Town Counsel",
    "parking_clerk": "Parking Clerk",
    "town_clerk": "Town Clerk",
    "election_registration": "Elections & Registration",
    "planning_board": "Planning Board",
    "public_buildings": "Public Buildings",
    "human_resources": "Human Resources",
    "community_development": "Community Development & Planning",
    "police": "Police Department",
    "fire": "Fire Department",
    "building_inspection": "Building Inspection",
    "sealer_weights_measures": "Sealer of Weights & Measures",
    "animal_inspector": "Animal Inspector",
    "public_works_ops": "Public Works Operations",
    "waste_collection": "Waste Collection",
    "curbside_collection": "Curbside Collection",
    "cemetery": "Cemetery",
    "health": "Health Department",
    "council_on_aging": "Council on Aging",
    "veterans_benefits": "Veterans' Benefits",
    "library": "Abbot Public Library",
    "rec_park": "Recreation & Parks",
    "memorial_veterans_day": "Memorial & Veterans Day",
    "debt_service": "Debt Service",
    "other_general_government_dept": "Other General Government",
    "sewer": "Sewer Department",
    "water": "Water Department",
    "harbor": "Harbormaster",
    "school_brown": "Brown Elementary School",
    "school_glover": "Glover Elementary School",
    "school_village": "Village Elementary School",
    "school_middle": "Marblehead Veterans Middle School",
    "school_high": "Marblehead High School",
    "school_athletics": "School Athletics",
}


def _departments_from_budget(budget: dict) -> dict:
    rows = budget["rows"]
    depts = {}
    for r in rows:
        if r.get("level") != "department":
            continue
        key = r["id"]
        depts[key] = {
            "name": _DISPLAY_NAMES.get(key, r["department"].replace("_", " ").title()),
            "function": r["function"],
            "function_label": _FUNCTION_LABELS.get(r["function"], r["function"]),
            "role": None,
            "role_source": None,
            "role_note": None,
            "role_source_url": None,
            "staffing": None,
            "services": None,
            "deep_dive": None,
            "budget": {k: r.get(k) for k in _BUDGET_KEYS},
            "line_items": [],
            "line_items_reconcile": True,
            "headcount": None,
            "checkbook": None,
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

    services = _load_services()
    for key, dept in departments.items():
        svc = services.get(key)
        if not svc:
            continue
        if svc.get("summary"):
            dept["services"] = {
                "summary": svc["summary"],
                "source_url": svc["source_url"],
                "source_label": svc["source_label"],
            }
        dept["deep_dive"] = svc.get("deep_dive")

    checkbook = _load_checkbook()
    for key, dept in departments.items():
        dept["checkbook"] = checkbook.get(key)

    # Adopted FY27 = No-Override proposed + this department's Tier-3 override
    # restorations. The change figure is then adopted-vs-FY26 (the source data's
    # change_dollars/change_pct were proposed-vs-FY26). fy27_proposed is kept so
    # the page can show the derivation.
    override_added = _override_added_by_dept(budget)
    for key, dept in departments.items():
        b = dept["budget"]
        add = override_added.get(key, 0)
        proposed = b.get("fy27_proposed") or 0
        adopted = proposed + add
        b["override_added"] = add
        b["fy27_adopted"] = adopted
        fy26 = b.get("fy26_budget")
        if fy26:
            b["change_dollars"] = adopted - fy26
            b["change_pct"] = round((adopted - fy26) / fy26, 4)
        else:
            b["change_dollars"] = None
            b["change_pct"] = None

    functions = []
    for r in budget["rows"]:
        if r.get("level") == "function":
            functions.append({
                "key": r["id"],
                "label": _FUNCTION_LABELS.get(r["id"], r["id"]),
                "fy27_proposed": r.get("fy27_proposed"),
                "change_pct": r.get("change_pct"),
            })

    return {
        "schema_version": 1,
        "source_note": ("Budget from FY27 Proposed Budget (No Override); "
                        "headcount from town payroll FY08-26; roles and FY27 "
                        "position roster from org_chart.yml; service descriptions "
                        "from department_services.yml (each dept's town page). "
                        "See town-budget.html and org-chart.html for full "
                        "citations."),
        "functions": functions,
        "departments": departments,
    }


def main() -> None:
    view = build_view()
    out = DATA / "departments_view.json"
    out.write_text(json.dumps(view, indent=2) + "\n")
    print(f"wrote {out} ({len(view['departments'])} departments)")


if __name__ == "__main__":
    main()
