#!/usr/bin/env python3
"""Parse the FY27 Proposed Budget book into a structured row list.

Source: data/FY27_Proposed_Budget_No_Override.txt (whitespace-delimited
text dump of the FY27 budget book PDF).

Output: data/town_budget_FY27.json + data/town_budget_FY27_lookup.json

Usage:
  python3 data/build_town_budget_data.py
"""
from __future__ import annotations
import csv
import json
import re
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Pattern matches a line like:
#   "TOTAL BUDGETS    115,368,206   111,991,311   119,479,480   122,762,030   3,282,550   2.75%"
# Six numeric columns, last is a percentage.
_NUM = r"[\d,]+|-"
_PCT = r"-?[\d.]+%"
_CHANGE = r"(?:\([\d,]+\)|[\d,]+|-)"
_GRAND_TOTAL_RE = re.compile(
    rf"^\s*TOTAL BUDGETS\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_CHANGE})\s+({_PCT})",
    re.MULTILINE,
)

_GENERAL_FUND_TOTAL_RE = re.compile(
    rf"^\s*TOTAL GENERAL FUND ACCOUNTS\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_CHANGE})\s+({_PCT})",
    re.MULTILINE,
)

# Map "VOTE TOTAL <CAPS DESCRIPTION>" → slug.
_FUNCTION_DESC_TO_SLUG = {
    "VOTE TOTAL GENERAL GOVERNMENT":            "general_government",
    "VOTE TOTAL PUBLIC SAFETY":                 "public_safety",
    "VOTE TOTAL SCHOOLS":                       "schools",
    "VOTE TOTAL PUBLIC WORKS AND FACILITIES":   "public_works",
    "VOTE TOTAL HUMAN SERVICES":                "human_services",
    "VOTE TOTAL CULTURE AND RECREATION":        "culture_recreation",
    "VOTE TOTAL OTHER GENERAL GOVERNMENT":      "other_general_government",
    "VOTE TOTAL SEWER ENTERPRISE FUND":         "sewer_enterprise",
    "VOTE TOTAL WATER ENTERPRISE FUND":         "water_enterprise",
    "VOTE TOTAL HARBOR ENTERPRISE FUND":        "harbor_enterprise",
}

_VOTE_TOTAL_RE = re.compile(
    rf"^\s*(VOTE TOTAL [A-Z& ]+?)\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_CHANGE})\s+({_PCT})",
    re.MULTILINE,
)

# A line item: "62 Salaries  4,644,044  4,608,022  4,730,006  4,988,616  258,610  5.47%"
_LINE_ITEM_RE = re.compile(
    rf"^\s*(\d+)\s+([A-Za-z][A-Za-z &/-]+?)\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_NUM})\s+({_CHANGE})\s+({_PCT})\s*$"
)

# Department header: caps-or-mixed line ending in known suffixes.
_DEPT_HEADER_RE = re.compile(
    r"^\s+([A-Z][A-Za-z][A-Za-z &/'-]+?(?: Department| Inspector| Inspection| Fund| Reserve| Inspectional Services| Counsel| Clerk| Board| Committee| Department| Commission)?)\s*$"
)

# Map known department display names → slug.
_DEPT_DISPLAY_TO_SLUG = {
    "Police Department": "police",
    "Fire Department": "fire",
    "Building Inspection Department": "building_inspection",
    "Sealer of Weights and Measures": "sealer_weights_measures",
    "Animal Inspector": "animal_inspector",
    "Emergency Management Department": "emergency_management",
    "Harbor & Waterways Board": "harbor_waterways_board",
    "Police": "police",
    "Fire": "fire",
    "Moderator": "moderator",
    "Select Board": "select_board",
    "Finance Committee": "finance_committee",
    "Reserve Fund": "reserve_fund",
    "Finance Department": "finance",
    "Assessor": "assessor",
    "Town Counsel": "town_counsel",
    "Parking Clerk": "parking_clerk",
    "Town Clerk": "town_clerk",
    "Election and Registration Department": "election_registration",
    "Planning Board": "planning_board",
    "Public Buildings Department": "public_buildings",
    "Human Resources Department": "human_resources",
    "Comm Dev & Planning Department": "community_development",
    "Public Works Department": "public_works_dept",
    "Trash and Recycling": "trash_recycling",
    "Cemetery Department": "cemetery",
    "Health Department": "health",
    "Council on Aging": "council_on_aging",
    "Veterans Benefits": "veterans_benefits",
    "Abbot Public Library": "library",
    "Recreation and Park Department": "rec_park",
    "Memorial & Veterans Day": "memorial_veterans_day",
    "School Department": "schools_dept_wrapper",
    "Maturing Bonds and Interest": "debt_service",
    "Other General Government": "other_general_government_dept",
    "Sewer": "sewer",
    "Water": "water",
    "Light": "light",
    "Harbor": "harbor",
}

# Function vote-totals in the order they appear in the doc, used to
# attribute departments encountered between two VOTE TOTALs to a function.
_FUNCTION_ORDER = [
    "general_government",
    "public_safety",
    "schools",
    "public_works",
    "human_services",
    "culture_recreation",
    "other_general_government",
    "sewer_enterprise",
    "water_enterprise",
    "harbor_enterprise",
]


def _parse_int(s: str) -> int:
    s = s.strip().replace(",", "")
    if s in {"", "-"}:
        return 0
    if s.startswith("(") and s.endswith(")"):
        return -int(s[1:-1])
    return int(s)


def _parse_pct(s: str) -> float:
    s = s.strip().rstrip("%")
    if s in {"", "-"}:
        return 0.0
    return float(s) / 100.0


def _make_grand_total_row(slug: str, descr: str, m: re.Match) -> dict:
    return {
        "id": slug,
        "level": "grand_total",
        "parent_id": None,
        "function": None,
        "department": None,
        "description": descr,
        "spend_type": None,
        "fy25_budget": _parse_int(m.group(1)),
        "fy25_actual": _parse_int(m.group(2)),
        "fy26_budget": _parse_int(m.group(3)),
        "fy27_proposed": _parse_int(m.group(4)),
        "change_dollars": _parse_int(m.group(5)),
        "change_pct": _parse_pct(m.group(6)),
    }


def _make_function_row(slug: str, descr: str, m: re.Match) -> dict:
    return {
        "id": slug,
        "level": "function",
        "parent_id": None,
        "function": slug,
        "department": None,
        "description": descr,
        "spend_type": None,
        "fy25_budget": _parse_int(m.group(2)),
        "fy25_actual": _parse_int(m.group(3)),
        "fy26_budget": _parse_int(m.group(4)),
        "fy27_proposed": _parse_int(m.group(5)),
        "change_dollars": _parse_int(m.group(6)),
        "change_pct": _parse_pct(m.group(7)),
    }


def classify_spend_type(descr: str) -> str:
    """Bucket a line-item description into a spend type.

    Buckets: salaries | expense | officials_expense | benefits | debt
    | transfer | utility | reserve | other.
    """
    d = descr.lower()
    if "salaries" in d or "salary reserve" in d:
        return "salaries"
    if "officials expense" in d:
        return "officials_expense"
    if "expense" in d:
        return "expense"
    if "benefits" in d or "retirement" in d or "insurance" in d \
       or "medicare" in d or "unemployment" in d \
       or "post employment" in d or "workers compensation" in d \
       or "flex spending" in d:
        return "benefits"
    if "maturing debt" in d or "interest" in d or "bonds" in d:
        return "debt"
    if "transfer" in d or "stabilization" in d:
        return "transfer"
    if "lighting" in d or "utility reserve" in d or "energy reserve" in d:
        return "utility"
    if "reserves" in d or "reserve fund" in d:
        return "reserve"
    return "other"


def parse_budget_book(text: str) -> list[dict]:
    """Parse the FY27 budget book text into a flat list of rows.

    Rows have fields: id, level, parent_id, function, department,
    description, spend_type, fy25_budget, fy25_actual, fy26_budget,
    fy27_proposed, change_dollars, change_pct.
    Line-level rows additionally have source_ref.
    """
    rows: list[dict] = []

    # Pass 1: extract grand totals + function totals.
    m = _GENERAL_FUND_TOTAL_RE.search(text)
    if m:
        rows.append(_make_grand_total_row("total_general_fund",
                                          "TOTAL GENERAL FUND ACCOUNTS", m))
    for m in _VOTE_TOTAL_RE.finditer(text):
        descr = m.group(1).strip()
        slug = _FUNCTION_DESC_TO_SLUG.get(descr)
        if slug:
            rows.append(_make_function_row(slug, descr, m))
    m = _GRAND_TOTAL_RE.search(text)
    if m:
        rows.append(_make_grand_total_row("total_budgets", "TOTAL BUDGETS", m))

    # Pass 2: line items and department headers.
    current_function_idx = 0
    current_dept_slug: Optional[str] = None
    current_dept_descr: Optional[str] = None
    dept_subtotals: dict[str, dict] = {}

    lines = text.splitlines()
    for raw in lines:
        if "VOTE TOTAL" in raw and current_function_idx < len(_FUNCTION_ORDER):
            current_function_idx += 1
            current_dept_slug = None
            continue

        line_m = _LINE_ITEM_RE.match(raw)
        if line_m:
            num, descr = line_m.group(1), line_m.group(2).strip()
            fy25_b = _parse_int(line_m.group(3))
            fy25_a = _parse_int(line_m.group(4))
            fy26_b = _parse_int(line_m.group(5))
            fy27_p = _parse_int(line_m.group(6))
            chg_d = _parse_int(line_m.group(7))
            chg_p = _parse_pct(line_m.group(8))
            fn_slug = (_FUNCTION_ORDER[current_function_idx]
                       if current_function_idx < len(_FUNCTION_ORDER) else None)
            line_id = f"line_{num}"
            rows.append({
                "id": line_id,
                "level": "line",
                "parent_id": current_dept_slug,
                "function": fn_slug,
                "department": current_dept_slug,
                "description": descr,
                "spend_type": classify_spend_type(descr),
                "fy25_budget": fy25_b,
                "fy25_actual": fy25_a,
                "fy26_budget": fy26_b,
                "fy27_proposed": fy27_p,
                "change_dollars": chg_d,
                "change_pct": chg_p,
                "source_ref": {
                    "doc": "fy27_budget_book",
                    "line_item": int(num),
                },
            })
            if current_dept_slug:
                d = dept_subtotals.setdefault(current_dept_slug, {
                    "id": current_dept_slug,
                    "level": "department",
                    "parent_id": fn_slug,
                    "function": fn_slug,
                    "department": current_dept_slug,
                    "description": current_dept_descr,
                    "spend_type": None,
                    "fy25_budget": 0, "fy25_actual": 0,
                    "fy26_budget": 0, "fy27_proposed": 0,
                    "change_dollars": 0,
                })
                d["fy25_budget"] += fy25_b
                d["fy25_actual"] += fy25_a
                d["fy26_budget"] += fy26_b
                d["fy27_proposed"] += fy27_p
                d["change_dollars"] += chg_d
            continue

        dept_m = _DEPT_HEADER_RE.match(raw)
        if dept_m:
            dept_descr = dept_m.group(1).strip()
            dept_slug = _DEPT_DISPLAY_TO_SLUG.get(dept_descr)
            if dept_slug is None:
                dept_slug = re.sub(r"[^a-z0-9]+", "_", dept_descr.lower()).strip("_")
            current_dept_slug = dept_slug
            current_dept_descr = dept_descr

    # Compute change_pct for dept subtotals and append.
    for d in dept_subtotals.values():
        prior = d["fy26_budget"]
        d["change_pct"] = (d["change_dollars"] / prior) if prior else 0.0
        rows.append(d)

    return rows


# Schedule A function-bucket → our function slug.
# `other_general_government` rolls up four Schedule A buckets that the FY27
# budget book combines under "Other General Government" + "Debt Service" lines.
SCHEDULE_A_FUNCTION_MAPPING = {
    "general_government": ["general_government"],
    "public_safety":      ["public_safety"],
    "schools":            ["education"],
    "public_works":       ["public_works"],
    "human_services":     ["human_services"],
    "culture_recreation": ["culture_recreation"],
    "other_general_government":
        ["fixed_costs", "intergov_assessments", "other", "debt_service"],
}


def load_schedule_a_history() -> dict[str, dict[str, int]]:
    """Read peer_schedule_a_expenditures.csv, filter to Marblehead, return
    {function_slug: {fyXX_actual: int}}.
    Combines (sums) buckets per SCHEDULE_A_FUNCTION_MAPPING for our slugs.
    """
    p = DATA / "peer_schedule_a_expenditures.csv"
    by_year: dict[int, dict[str, int]] = {}
    with p.open(newline="") as f:
        for row in csv.DictReader(f):
            if row["municipality"] != "Marblehead":
                continue
            fy = int(row["fiscal_year"])
            year_buckets: dict[str, int] = {}
            for col in ["general_government", "public_safety", "education",
                        "public_works", "human_services", "culture_recreation",
                        "fixed_costs", "intergov_assessments", "other",
                        "debt_service"]:
                val = row.get(col, "").replace(",", "").strip()
                year_buckets[col] = int(val) if val and val != "-" else 0
            by_year[fy] = year_buckets

    history: dict[str, dict[str, int]] = {}
    for fn_slug, schedule_a_buckets in SCHEDULE_A_FUNCTION_MAPPING.items():
        history[fn_slug] = {}
        for fy, buckets in by_year.items():
            total = sum(buckets.get(b, 0) for b in schedule_a_buckets)
            # Use 2-digit year suffix: 2002 → fy02, 2024 → fy24.
            yy = fy % 100
            history[fn_slug][f"fy{yy:02d}_actual"] = total
    return history


def attach_function_history(rows: list[dict]) -> None:
    """Attach `history` and `cagr_22yr` to each function-level row that has
    Schedule A coverage. Mutates rows in place."""
    history_by_fn = load_schedule_a_history()
    for r in rows:
        if r["level"] != "function":
            continue
        fn_history = history_by_fn.get(r["id"])
        if not fn_history:
            continue  # enterprise funds, schools_dept_wrapper, etc.
        r["history"] = fn_history
        # Compute CAGR FY02 → FY24 (22-year span).
        start = fn_history.get("fy02_actual")
        end = fn_history.get("fy24_actual")
        if start and end and start > 0:
            r["cagr_22yr"] = (end / start) ** (1 / 22) - 1


def parse_school_packet() -> list[dict]:
    """Parse the FY27 school budget packet for per-school cost-center totals.

    Returns rows for the schools that could be parsed cleanly. If the packet
    format prevents extraction (different layout in a future year), returns
    an empty list -- the UI will fall back to showing Schools as one $47.6M
    lump matching the town book.
    """
    p = (DATA / "schools" / "sc-meetings-fy26"
         / "agenda-and-materials-2-5-2026-fy27-budget-packet.txt")
    if not p.exists():
        return []
    try:
        text = p.read_text()
    except OSError:
        return []

    rows: list[dict] = []

    # Schools to extract: (slug, header pattern substring, display name)
    SCHOOLS = [
        ("school_brown",    "Marblehead Public Schools - Brown Elementary School",
         "Brown Elementary School"),
        ("school_glover",   "Marblehead Public Schools - Glover Elementary School",
         "Glover Elementary School"),
        ("school_village",  "Marblehead Public Schools - Village Elementary School",
         "Village Elementary School"),
        ("school_middle",   "Marblehead Public Schools - Veterans Middle School",
         "Veterans Middle School"),
        ("school_high",     "Marblehead Public Schools - Marblehead High School",
         "Marblehead High School"),
        ("school_athletics", "Marblehead Public Schools - Athletics",
         "Athletics"),
    ]

    # Pattern matching the TOTAL line format (various whitespace layouts):
    #   TOTAL :  $  5,481,505   $  5,554,252   $  72,747   1.33%
    #   TOTAL :  $  646,395     $  660,030     $  13,635    2.11%
    #   TOTAL :  $  4,472,968   $  4,437,815   $  (35,152) $  (0)   <- no % sign
    # The percentage column is optional/inconsistent; compute pct from dollars.
    total_re = re.compile(
        r"TOTAL\s*:\s+\$\s*([\d,]+)\s+\$\s*([\d,]+)\s+\$\s*\(?([\d,]+)\)?"
    )

    # Only search the first half of the document (level-fund section).
    # The packet appears twice: first with level-fund adjustments, then
    # level-service only. We want the first occurrence of each school.
    # Use the midpoint of the text as a safe upper bound.
    midpoint = len(text) // 2

    for slug, header_substr, display in SCHOOLS:
        idx = text.find(header_substr)
        if idx < 0 or idx > midpoint:
            # Try again -- Athletics header doesn't include "Marblehead Public Schools -"
            # in the same way; fall through gracefully.
            continue
        # Look in the section starting at this header through a generous window.
        section_end = min(idx + 60_000, midpoint)
        # Tighten to the next school header if it's closer.
        for s2, hs2, _ in SCHOOLS:
            if s2 == slug:
                continue
            other = text.find(hs2, idx + len(header_substr))
            if 0 < other < section_end:
                section_end = other
        section = text[idx:section_end]
        totals = list(total_re.finditer(section))
        if len(totals) >= 2:
            # Take the second TOTAL -- level fund (what gets appropriated).
            m = totals[1]
        elif totals:
            m = totals[0]
        else:
            continue
        fy26 = int(m.group(1).replace(",", ""))
        fy27 = int(m.group(2).replace(",", ""))
        # change_dollars from the regex may have wrong sign (parens notation);
        # always recompute from the actual dollar diff for accuracy.
        change = fy27 - fy26
        pct = (change / fy26) if fy26 else 0.0
        rows.append({
            "id": slug,
            "level": "department",
            "parent_id": "schools",
            "function": "schools",
            "department": slug,
            "description": display,
            "spend_type": None,
            "fy25_budget": None, "fy25_actual": None,
            "fy26_budget": fy26,
            "fy27_proposed": fy27,
            "change_dollars": change,
            "change_pct": pct,
            "source_ref": {"doc": "fy27_school_packet"},
        })

    return rows


if __name__ == "__main__":
    text = (DATA / "FY27_Proposed_Budget_No_Override.txt").read_text()
    rows = parse_budget_book(text)
    attach_function_history(rows)
    rows.extend(parse_school_packet())
    print(json.dumps(rows[:5], indent=2))
