#!/usr/bin/env python3
"""Extract Marblehead elected official rosters across annual reports 2006-2025
and emit a YAML file mapping current (2025) officials to their first-seen year.

The annual reports follow a stable pattern for the ELECTED OFFICIALS section:
- A section header like "SELECT BOARD" on its own line
- An optional address line starting with "--" or with the format "city, MA zip"
- A "Term Expires" header
- Member lines of the form: <name with letters/spaces/periods/hyphens> + lots of spaces + 4-digit year
- A blank line ends the section

The appointed-officials section (after ~line 5067 in 2025) has OCR damage that
makes reliable parsing infeasible, so this script ignores it. Appointed exec
names are sourced manually with explicit citations in the YAML output.
"""

from __future__ import annotations

import re
from pathlib import Path

REPORTS_DIR = Path(__file__).resolve().parent.parent / "data" / "town_docs" / "annual_reports"
YEARS = list(range(2006, 2026))  # 2006-2025 inclusive

SECTION_HEADERS = {
    "SELECT BOARD": "select_board",
    "BOARD OF SELECTMEN": "select_board",
    "SELECTMEN": "select_board",
    "SELECTMAN": "select_board",  # pre-2022 the header was sometimes "SELECTMAN"
    "MODERATOR": "moderator",
    "TOWN CLERK": "town_clerk",
    "ASSESSORS": "assessors",
    "CEMETERY COMMISSION": "cemetery",
    "BOARD OF HEALTH": "board_of_health",
    "HOUSING AUTHORITY": "housing_authority",
    "TRUSTEES OF ABBOT PUBLIC LIBRARY": "library_trustees",
    "MARBLEHEAD MUNICIPAL LIGHT COMMISSIONER": "light_commission",
    "MARBLEHEAD MUNICIPAL LIGHT COMMISSIONERS": "light_commission",
    "MUNICIPAL LIGHT COMMISSIONERS": "light_commission",
    "PLANNING BOARD": "planning_board",
    "RECREATION & PARK COMMISSION": "recreation_park",
    "RECREATION AND PARK COMMISSION": "recreation_park",
    "SCHOOL COMMITTEE": "school_committee",
    "WATER & SEWER COMMISSION": "water_sewer",
    "WATER AND SEWER COMMISSION": "water_sewer",
}

# Lines that look like roster ends or appointed-section starts
APPOINTED_MARKER = re.compile(r"^\s*APPOINTED OFFICIALS\b", re.IGNORECASE)

# Member line: name followed by lots of whitespace and a 4-digit year (term expires).
# We do NOT anchor to end-of-line because some older reports are 2-column OCR'd
# (the same roster line appears twice side-by-side on one source line). Take
# only the first match.
MEMBER_LINE = re.compile(
    r"^\s*(?P<name>[A-Z][A-Za-z'.\-]+(?:\s+(?:[A-Z][A-Za-z'.\-]+|[A-Z]\.|Jr\.|Sr\.|II|III|IV|van|de|della|Van|De|Della))+)"
    r"(?:[\s\-]*\([^)]+\))?(?:\s*-\s*[A-Za-z][A-Za-z\s]+?)?\s+(?P<year>20\d{2})\b"
)

# Lines we should skip inside a section
SKIP_LINE = re.compile(r"^\s*(--|Term Expires|MARBLEHEAD TOWN REPORT|_+|\d+\s*$|$)")


def parse_report(path: Path) -> dict[str, list[str]]:
    """Returns {role_key: [name, ...]} for one annual report.

    Stops parsing once it hits the APPOINTED OFFICIALS marker (OCR-noisy section).
    """
    out: dict[str, list[str]] = {}
    current_role: str | None = None

    with path.open(encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.rstrip()
            stripped = line.strip()

            if APPOINTED_MARKER.search(stripped):
                break

            # Section header?
            up = stripped.upper()
            for header, key in SECTION_HEADERS.items():
                if up == header or up.startswith(header + " "):
                    current_role = key
                    out.setdefault(current_role, [])
                    break
            else:
                if current_role is None:
                    continue
                # Try to parse a member line
                m = MEMBER_LINE.match(line)
                if m:
                    name = clean_name(re.sub(r"\s+", " ", m.group("name").strip()))
                    if name not in out[current_role]:
                        out[current_role].append(name)
                elif stripped == "":
                    # Blank line in a section ends it for safety
                    current_role = None

    return out


ROLE_SUFFIX = re.compile(
    r"\s*[-,]\s*(chair|chairman|vice\s*chair|clerk|secretary|treasurer)\s*$",
    re.IGNORECASE,
)


def clean_name(s: str) -> str:
    """Strip role suffixes like '-Chair' that older reports embed in names."""
    return ROLE_SUFFIX.sub("", s).strip()


def normalize_name(s: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace, drop middle initials.

    Returns the LAST TWO meaningful tokens (first + last name) so that
    'Marc C. Moses Grader', 'M.C. Moses Grader', and 'Moses Grader' all
    collapse to 'moses grader'. Generational suffixes (Jr., III) stay attached
    to the surname so we don't collapse parent/child onto the same key.
    """
    s = clean_name(s)
    s = re.sub(r"[.,]", "", s.lower())
    parts = s.split()
    # Pull generational suffix off the end so we can re-attach after picking tokens.
    suffix = ""
    if parts and parts[-1] in {"jr", "sr", "ii", "iii", "iv"}:
        suffix = " " + parts.pop()
    # Drop single-letter "initials" (e.g. "M", "C")
    parts = [p for p in parts if len(p) > 1]
    if len(parts) >= 2:
        parts = [parts[-2], parts[-1]]
    return " ".join(parts) + suffix


def main() -> None:
    history: dict[str, dict[str, dict[str, int]]] = {}  # role -> normalized_name -> {first, last, display}

    for year in YEARS:
        report = REPORTS_DIR / f"Annual-Report-{year}.txt"
        if not report.exists():
            continue
        parsed = parse_report(report)
        for role, names in parsed.items():
            history.setdefault(role, {})
            for name in names:
                key = normalize_name(name)
                if not key:
                    continue
                entry = history[role].setdefault(key, {"first": year, "last": year, "display": name})
                if year < entry["first"]:
                    entry["first"] = year
                    entry["display"] = name  # prefer earliest spelling
                if year > entry["last"]:
                    entry["last"] = year

    # Print summary keyed to 2025-era officials (last == 2025)
    print("# Auto-extracted from annual reports 2006-2025")
    print("# Each entry: name (current role, first seen YYYY, last seen YYYY)")
    print()
    for role in sorted(history):
        current = [(e["display"], e["first"], e["last"]) for e in history[role].values() if e["last"] == 2025]
        if not current:
            continue
        print(f"## {role}")
        for display, first, last in sorted(current, key=lambda x: (x[1], x[0])):
            tag = "(pre-2006)" if first == 2006 else f"(since {first})"
            print(f"  - {display} {tag}")
        print()


if __name__ == "__main__":
    main()
