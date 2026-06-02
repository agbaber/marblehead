#!/usr/bin/env python3
"""
build_voting_record.py
Reads data/marblehead_prop25_votes.csv (and data/cpi_us.csv for the CPI reference year)
and prints three HTML fragments to stdout:

    === KEY_STATS ===
    [HTML for the .key-stats strip]
    === CHART ===
    [Complete SVG for the diverging bar chart]
    === TABLE ===
    [HTML for the year-grouped detail table]

Usage:
    python3 data/build_voting_record.py
"""

import csv
import os
import sys
import math
from collections import defaultdict
from datetime import datetime

# ---------------------------------------------------------------------------
# Paths (relative to this script's location)
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VOTES_CSV = os.path.join(SCRIPT_DIR, "marblehead_prop25_votes.csv")
CPI_CSV   = os.path.join(SCRIPT_DIR, "cpi_us.csv")

# ---------------------------------------------------------------------------
# Department -> CSS colour token mapping
# ---------------------------------------------------------------------------
DEPT_COLOR = {
    "School":                     "teal",
    "General Government":         "navy",
    "Public Works & Facilities":  "sage",
    "Public Safety":              "buoy",
    "Culture & Recreation":       "brass",
    "Health & Human Services":    "plum",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fmt_dollars(amount):
    """Format an integer/float as $1.2M / $542K / $500 (no cents)."""
    if amount is None:
        return "—"
    amount = float(amount)
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.1f}M"
    if amount >= 1_000:
        return f"${amount / 1_000:.0f}K"
    return f"${amount:,.0f}"


def fmt_month_year(date_str):
    """'2019-06-18'  ->  'June 2019'."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.strftime("%B %Y")
    except (ValueError, TypeError):
        return date_str or ""


def calendar_year(date_str):
    """Extract the calendar year int from a date string."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").year
    except (ValueError, TypeError):
        return None


def vote_margin_pct(yes, no):
    """(yes - no) / (yes + no) * 100, signed."""
    total = yes + no
    if total == 0:
        return None
    return (yes - no) / total * 100


def dept_color(dept):
    return DEPT_COLOR.get(dept, "navy")


def is_clerk_error(row):
    return (
        row["yes_votes"] == 0
        and row["no_votes"] == 0
        and row.get("amount", "") in ("", "0")
    )


def parse_amount(val):
    """Return float or None for blank/zero."""
    val = (val or "").strip()
    if val in ("", "0"):
        return None
    try:
        f = float(val)
        return f if f > 0 else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

def load_votes():
    rows = []
    with open(VOTES_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            r["yes_votes"]  = int(r.get("yes_votes",  0) or 0)
            r["no_votes"]   = int(r.get("no_votes",   0) or 0)
            r["amount_val"] = parse_amount(r.get("amount", ""))
            r["real_val"]   = parse_amount(r.get("amount_real", ""))
            rows.append(r)
    return rows


def load_cpi():
    cpi = {}
    with open(CPI_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            cpi[int(r["year"])] = float(r["cpi_u"])
    return cpi


# ---------------------------------------------------------------------------
# KEY STATS
# ---------------------------------------------------------------------------

def build_key_stats(rows):
    total_ballot = len(rows)

    # Total $ approved (sum of real dollars for WIN rows)
    total_approved_real = 0
    for r in rows:
        if r["win_loss"] == "WIN" and r["real_val"] is not None:
            total_approved_real += r["real_val"]

    # Debt exclusion pass rate
    de_rows = [r for r in rows if r["measure_type"] == "Debt Exclusion"]
    de_pass = sum(1 for r in de_rows if r["win_loss"] == "WIN")
    de_total = len(de_rows)

    # Override pass rate
    ov_rows = [r for r in rows if r["measure_type"] == "Override"]
    ov_pass = sum(1 for r in ov_rows if r["win_loss"] == "WIN")
    ov_total = len(ov_rows)

    approved_fmt = fmt_dollars(total_approved_real)

    html = (
        '<div class="key-stats">\n'
        f'  <div class="key-stat">\n'
        f'    <div class="key-stat-value">{total_ballot}</div>\n'
        f'    <div class="key-stat-label">Ballot Questions</div>\n'
        f'  </div>\n'
        f'  <div class="key-stat">\n'
        f'    <div class="key-stat-value">{approved_fmt}</div>\n'
        f'    <div class="key-stat-label">Approved (inflation-adj.)</div>\n'
        f'  </div>\n'
        f'  <div class="key-stat">\n'
        f'    <div class="key-stat-value">{de_pass}/{de_total}</div>\n'
        f'    <div class="key-stat-label">Debt Exclusion Pass Rate</div>\n'
        f'  </div>\n'
        f'  <div class="key-stat">\n'
        f'    <div class="key-stat-value">{ov_pass}/{ov_total}</div>\n'
        f'    <div class="key-stat-label">Override Pass Rate</div>\n'
        f'  </div>\n'
        '</div>'
    )
    return html


# ---------------------------------------------------------------------------
# SVG CHART  (dot plot / strip plot)
# ---------------------------------------------------------------------------

# Layout constants for dot plot
DOT_VB_W = 800
DOT_VB_H = 260
DOT_R = 6

# Timeline area
TL_X_MIN = 110       # left edge of timeline (room for row labels)
TL_X_MAX = 760       # right edge of timeline

# Row Y positions
ROW_OV_Y = 70        # operating overrides center y
ROW_DE_Y = 160       # debt exclusions center y

# Timeline date range
TL_YEAR_MIN = 1982
TL_YEAR_MAX = 2026


def _date_to_x(date_str):
    """Map a vote_date string to an x position on the timeline."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        # Convert to fractional year
        year_frac = d.year + (d.month - 1) / 12 + (d.day - 1) / 365
    except (ValueError, TypeError):
        return None
    t = (year_frac - TL_YEAR_MIN) / (TL_YEAR_MAX - TL_YEAR_MIN)
    return TL_X_MIN + t * (TL_X_MAX - TL_X_MIN)


def _year_to_x(year):
    """Map a calendar year (or fractional year) to an x position."""
    t = (year - TL_YEAR_MIN) / (TL_YEAR_MAX - TL_YEAR_MIN)
    return TL_X_MIN + t * (TL_X_MAX - TL_X_MIN)


def build_chart(rows):
    """Return a complete <svg> string (dot plot / strip plot)."""

    # ------------------------------------------------------------------
    # 1. Filter to chart rows, skip clerk-error rows
    # ------------------------------------------------------------------
    chart_rows = [r for r in rows if not is_clerk_error(r)]
    chart_rows = [r for r in chart_rows
                  if r["measure_type"] in ("Override", "Debt Exclusion")]

    if not chart_rows:
        return "<svg></svg>"

    # ------------------------------------------------------------------
    # 2. Compute pass rates for row labels
    # ------------------------------------------------------------------
    ov_rows = [r for r in chart_rows if r["measure_type"] == "Override"]
    de_rows = [r for r in chart_rows if r["measure_type"] == "Debt Exclusion"]
    ov_pass = sum(1 for r in ov_rows if r["win_loss"] == "WIN")
    de_pass = sum(1 for r in de_rows if r["win_loss"] == "WIN")

    # ------------------------------------------------------------------
    # 3. Group dots by (row, date) for jitter
    # ------------------------------------------------------------------
    ov_by_date = defaultdict(list)
    de_by_date = defaultdict(list)
    for r in chart_rows:
        if r["measure_type"] == "Override":
            ov_by_date[r["vote_date"]].append(r)
        else:
            de_by_date[r["vote_date"]].append(r)

    # ------------------------------------------------------------------
    # 4. Build SVG parts
    # ------------------------------------------------------------------
    parts = []

    # -- Row labels --
    parts.append('<text class="row-label" x="10" y="58">Operating</text>')
    parts.append('<text class="row-label" x="10" y="71">overrides</text>')
    parts.append(f'<text class="row-sub" x="10" y="84">{ov_pass} of {len(ov_rows)}</text>')

    parts.append('<text class="row-label" x="10" y="130">Debt</text>')
    parts.append('<text class="row-label" x="10" y="143">exclusions</text>')
    parts.append(f'<text class="row-sub" x="10" y="156">{de_pass} of {len(de_rows)}</text>')

    # -- Decade grid lines --
    for decade in [1990, 2000, 2010, 2020]:
        gx = _year_to_x(decade)
        parts.append(
            f'<line class="grid-line" x1="{gx:.1f}" y1="40" '
            f'x2="{gx:.1f}" y2="175"/>'
        )

    # -- Row baselines --
    parts.append(f'<line class="axis-line" x1="{TL_X_MIN - 50}" y1="85" x2="{TL_X_MAX}" y2="85"/>')
    parts.append(f'<line class="axis-line" x1="{TL_X_MIN - 50}" y1="175" x2="{TL_X_MAX}" y2="175"/>')

    # -- FY2027 upcoming vote indicator --
    fy27_x = _year_to_x(2026.4)  # June 2026
    parts.append(
        f'<line class="future-line" x1="{fy27_x:.0f}" y1="40" '
        f'x2="{fy27_x:.0f}" y2="175"/>'
    )
    parts.append(f'<text class="annotation annotation--upcoming" x="{fy27_x + 3:.0f}" y="52">FY2027</text>')
    parts.append(f'<text class="annotation annotation--upcoming" x="{fy27_x + 3:.0f}" y="64">vote</text>')
    parts.append(f'<text class="annotation annotation--upcoming" x="{fy27_x + 3:.0f}" y="76">Jun 9</text>')

    # -- Helper to emit dots for a row --
    def emit_dots(by_date, base_y):
        """Emit circle elements for all votes in a row, with jitter."""
        annotation_dots = {}
        for date_str in sorted(by_date.keys()):
            group = by_date[date_str]
            cx = _date_to_x(date_str)
            if cx is None:
                continue

            n = len(group)
            for i, r in enumerate(group):
                # Jitter vertically when multiple votes share a date
                if n == 1:
                    cy = base_y
                else:
                    offset = (i - (n - 1) / 2) * 8
                    cy = base_y + offset

                approved = r["win_loss"] == "WIN"
                cls = "vote-dot vote-dot--approved" if approved else "vote-dot vote-dot--rejected"
                result_text = "Approved" if approved else "Rejected"

                # Format data attributes
                amt = fmt_dollars(r["amount_val"]) if r["amount_val"] else "\u2014"
                amt_real = fmt_dollars(r["real_val"]) if r["real_val"] else "\u2014"
                date_label = fmt_month_year(r["vote_date"])

                yes = r["yes_votes"]
                no = r["no_votes"]
                margin = vote_margin_pct(yes, no)
                margin_str = (f"+{margin:.1f}%" if margin is not None and margin >= 0
                              else (f"{margin:.1f}%" if margin is not None else "\u2014"))

                mtype = r["measure_type"]

                # Escape HTML entities in description
                desc = r["description"].replace("&", "&amp;").replace('"', "&quot;")

                parts.append(
                    f'<circle class="{cls}" '
                    f'cx="{cx:.1f}" cy="{cy:.1f}" r="{DOT_R}" '
                    f'data-desc="{desc}" '
                    f'data-amount="{amt}" '
                    f'data-amount-real="{amt_real}" '
                    f'data-result="{result_text}" '
                    f'data-yes="{yes:,}" '
                    f'data-no="{no:,}" '
                    f'data-margin="{margin_str}" '
                    f'data-date="{date_label}" '
                    f'data-type="{mtype}"/>'
                )

                # Track special dots for annotations
                if (mtype == "Override" and approved
                        and r["vote_date"] == "2005-06-15"):
                    annotation_dots["last_override"] = (cx, cy)

                if (mtype == "Debt Exclusion" and not approved
                        and "Tucker" in r["description"]):
                    annotation_dots["only_de_rejected"] = (cx, cy)

        return annotation_dots

    # -- Emit override dots --
    ov_annotations = emit_dots(ov_by_date, ROW_OV_Y)

    # -- Emit debt exclusion dots --
    de_annotations = emit_dots(de_by_date, ROW_DE_Y)

    # -- Annotations --
    if "last_override" in ov_annotations:
        ax, ay = ov_annotations["last_override"]
        parts.append(
            f'<line class="grid-line" x1="{ax:.1f}" y1="{ay + DOT_R + 2:.0f}" '
            f'x2="{ax:.1f}" y2="{ay + 28:.0f}"/>'
        )
        parts.append(
            f'<text class="annotation" x="{ax:.1f}" y="{ay + 42:.0f}" '
            f'text-anchor="middle">Last approved override</text>'
        )

    if "only_de_rejected" in de_annotations:
        ax, ay = de_annotations["only_de_rejected"]
        parts.append(
            f'<line class="grid-line" x1="{ax:.1f}" y1="{ay + DOT_R + 2:.0f}" '
            f'x2="{ax:.1f}" y2="{ay + 28:.0f}"/>'
        )
        parts.append(
            f'<text class="annotation" x="{ax:.1f}" y="{ay + 42:.0f}" '
            f'text-anchor="middle">Only debt exclusion rejected</text>'
        )

    # -- X-axis year labels --
    for yr in [1982, 1990, 2000, 2010, 2020, 2026]:
        lx = _year_to_x(yr)
        parts.append(
            f'<text class="tick-label" x="{lx:.0f}" y="222" '
            f'text-anchor="middle">{yr}</text>'
        )

    # -- Assemble SVG --
    inner = "\n".join(parts)
    svg = (
        f'<svg class="chart" viewBox="0 0 {DOT_VB_W} {DOT_VB_H}" '
        f'xmlns="http://www.w3.org/2000/svg" '
        f'role="img" '
        f'aria-label="Dot plot timeline of every Marblehead Proposition 2&#189; '
        f'vote, 1982 to 2026. Operating overrides on top row, debt exclusions '
        f'on bottom row. Filled dots are approved, hollow dots are rejected.">\n'
        f'{inner}\n'
        f'</svg>'
    )
    return svg


# ---------------------------------------------------------------------------
# DETAIL TABLE
# ---------------------------------------------------------------------------

def build_table(rows):
    """Return the vote-history div with details/summary year groups."""

    # Group rows by calendar year (from vote_date)
    by_year = defaultdict(list)
    for r in rows:
        yr = calendar_year(r["vote_date"])
        if yr is not None:
            by_year[yr].append(r)

    all_years = sorted(by_year.keys(), reverse=True)

    out = ['<div class="vote-history" data-mode="real">']

    for yr in all_years:
        yr_rows = by_year[yr]

        n_q = len(yr_rows)
        n_pass = sum(1 for r in yr_rows if r["win_loss"] == "WIN")

        # Sum of amounts for the summary row
        total_real    = sum(r["real_val"]  for r in yr_rows if r["real_val"]  is not None)
        total_nominal = sum(r["amount_val"] for r in yr_rows if r["amount_val"] is not None)
        any_amount    = total_real > 0 or total_nominal > 0

        # Pick the date label from the first row (they share a date in practice)
        date_label = fmt_month_year(yr_rows[0]["vote_date"]) if yr_rows else str(yr)

        # Build summary counts
        q_word = "question" if n_q == 1 else "questions"
        pass_word = f"{n_pass} passed" if n_pass > 0 else "0 passed"

        # Amount for summary
        if any_amount:
            passed_real    = sum(r["real_val"]  for r in yr_rows if r["win_loss"] == "WIN" and r["real_val"]  is not None)
            passed_nominal = sum(r["amount_val"] for r in yr_rows if r["win_loss"] == "WIN" and r["amount_val"] is not None)
            amt_text = f"{fmt_dollars(passed_real)} approved" if passed_real > 0 else ""
        else:
            passed_real = passed_nominal = 0
            amt_text = ""

        out.append(f'<details class="vote-year">')
        out.append(f'  <summary>')
        out.append(f'    <span class="vote-year-date">{date_label}</span>')
        out.append(f'    <span class="vote-year-count">{n_q} {q_word}</span>')
        out.append(f'    <span class="vote-year-result">{pass_word}</span>')
        if amt_text:
            out.append(
                f'    <span class="vote-year-amount" '
                f'data-real="{int(passed_real)}" '
                f'data-nominal="{int(passed_nominal)}">'
                f'{amt_text}</span>'
            )
        out.append(f'  </summary>')
        out.append(f'  <div class="vote-detail-wrap">')
        out.append(f'  <table class="vote-detail">')
        out.append(f'    <thead>')
        out.append(f'      <tr>')
        for th in ["Result", "Type", "Dept", "Description", "Amount", "Yes", "No", "Margin", "Source"]:
            out.append(f'        <th data-label="{th}">{th}</th>')
        out.append(f'      </tr>')
        out.append(f'    </thead>')
        out.append(f'    <tbody>')

        for r in yr_rows:
            wl = r["win_loss"]
            pill_cls = "vote-pill--pass" if wl == "WIN" else "vote-pill--fail"
            pill_text = "Passed" if wl == "WIN" else "Failed"

            mtype = r["measure_type"]

            dept = r["department"]
            color = dept_color(dept)
            dept_cell = (
                f'<span class="dept-dot dept-dot--{color}"></span> {dept}'
            )

            desc = r["description"]
            clerk_note = ""
            if is_clerk_error(r):
                clerk_note = " <em class=\"vote-note\">(Administrative correction; no ballot vote held)</em>"

            rv  = r["real_val"]
            av  = r["amount_val"]
            if rv is not None or av is not None:
                amt_html = (
                    f'<span class="vote-amount" '
                    f'data-real="{int(rv) if rv is not None else ""}" '
                    f'data-nominal="{int(av) if av is not None else ""}">'
                    f'{fmt_dollars(rv)}</span>'
                )
            else:
                amt_html = "—"

            yes  = r["yes_votes"]
            no   = r["no_votes"]
            margin = vote_margin_pct(yes, no)
            margin_str = f"+{margin:.1f}%" if margin is not None and margin >= 0 else (f"{margin:.1f}%" if margin is not None else "—")

            # Source cell
            src_doc = (r.get("source_doc") or "").strip()
            src_url = (r.get("source_url") or "").strip()
            src_conf = (r.get("source_confidence") or "").strip()
            if src_conf == "unsourced" or (not src_doc and not src_url):
                src_cell = "<em>unsourced</em>"
            elif src_url:
                # Truncate long doc names
                src_label = src_doc if src_doc else src_url
                if len(src_label) > 35:
                    src_label = src_label[:32] + "..."
                src_cell = f'<a href="{src_url}" target="_blank" rel="noopener">{src_label}</a>'
            else:
                src_label = src_doc if len(src_doc) <= 35 else src_doc[:32] + "..."
                src_cell = src_label

            out.append(f'      <tr>')
            out.append(f'        <td data-label="Result"><span class="vote-pill {pill_cls}">{pill_text}</span></td>')
            out.append(f'        <td data-label="Type">{mtype}</td>')
            out.append(f'        <td data-label="Dept">{dept_cell}</td>')
            out.append(f'        <td data-label="Desc">{desc}{clerk_note}</td>')
            out.append(f'        <td data-label="Amount">{amt_html}</td>')
            out.append(f'        <td data-label="Yes" class="num">{yes:,}</td>')
            out.append(f'        <td data-label="No" class="num">{no:,}</td>')
            out.append(f'        <td data-label="Margin" class="num">{margin_str}</td>')
            out.append(f'        <td data-label="Source" class="src">{src_cell}</td>')
            out.append(f'      </tr>')

        out.append(f'    </tbody>')
        out.append(f'  </table>')
        out.append(f'  </div>')
        out.append(f'</details>')

    out.append('</div>')
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rows = load_votes()

    print("=== KEY_STATS ===")
    print(build_key_stats(rows))

    print("=== CHART ===")
    print(build_chart(rows))

    print("=== TABLE ===")
    print(build_table(rows))


if __name__ == "__main__":
    main()
