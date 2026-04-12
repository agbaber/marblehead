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
# SVG CHART  (horizontal diverging bar chart)
# ---------------------------------------------------------------------------

# Layout constants
H_ML   = 55          # left margin (year labels)
H_MR   = 15          # right margin
H_MT   = 22          # top margin (for "Failed" / "Passed" labels + grid labels)
H_MB   = 10          # bottom margin
H_VB_W = 880         # viewBox width

ROW_H  = 20          # total height per row (bar + gap)
BAR_H  = 14          # bar height within row

FAIL_MIN_W = 80      # minimum pixel width for the fail (left) side
MARKER_W   = 3       # thin marker for unsourced amounts


def build_chart(rows):
    """Return a complete <svg> string (horizontal diverging bar chart)."""

    # ------------------------------------------------------------------
    # 1. Group rows by calendar year, skip clerk-error rows
    # ------------------------------------------------------------------
    chart_rows = [r for r in rows if not is_clerk_error(r)]

    by_year = defaultdict(lambda: {"pass": [], "fail": []})
    for r in chart_rows:
        yr = calendar_year(r["vote_date"])
        if yr is None:
            continue
        mtype = r["measure_type"]
        if mtype not in ("Override", "Debt Exclusion"):
            continue
        key = "pass" if r["win_loss"] == "WIN" else "fail"
        by_year[yr][key].append(r)

    all_years = sorted(by_year.keys())
    if not all_years:
        return "<svg></svg>"

    n_years = len(all_years)

    # ------------------------------------------------------------------
    # 2. Compute per-year totals for pass and fail sides (real dollars)
    # ------------------------------------------------------------------
    year_pass_total = {}
    year_fail_total = {}
    for yr in all_years:
        year_pass_total[yr] = sum(r["real_val"] or 0 for r in by_year[yr]["pass"])
        year_fail_total[yr] = sum(r["real_val"] or 0 for r in by_year[yr]["fail"])

    max_pass = max(year_pass_total.values()) if year_pass_total else 1
    max_fail = max(year_fail_total.values()) if year_fail_total else 1
    if max_pass == 0:
        max_pass = 1
    if max_fail == 0:
        max_fail = 1

    # ------------------------------------------------------------------
    # 3. Layout geometry
    # ------------------------------------------------------------------
    chart_w = H_VB_W - H_ML - H_MR                  # 810
    # Fail side gets the larger of FAIL_MIN_W or its proportional share
    proportional_fail = chart_w * (max_fail / (max_pass + max_fail))
    fail_w = max(FAIL_MIN_W, proportional_fail)
    pass_w = chart_w - fail_w

    baseline_x = H_ML + fail_w                       # vertical center line

    # Same dollar-per-pixel scale on both sides (use the pass side scale
    # since it always has more data; the fail side gets the same scale
    # but is guaranteed at least FAIL_MIN_W pixels of space)
    px_per_dollar = pass_w / max_pass

    vb_h = H_MT + n_years * ROW_H + H_MB
    chart_area_h = n_years * ROW_H

    def row_y(idx):
        """Top y of row idx."""
        return H_MT + idx * ROW_H

    def bar_y(idx):
        """Top y of the bar within row idx (centred vertically)."""
        return row_y(idx) + (ROW_H - BAR_H) / 2

    # ------------------------------------------------------------------
    # 4. Sort votes within each side
    #    Overrides first, then debt exclusions; within each type by
    #    amount descending.
    # ------------------------------------------------------------------
    def sort_key(r):
        type_order = 0 if r["measure_type"] == "Override" else 1
        amt = r["real_val"] or 0
        return (type_order, -amt)

    # ------------------------------------------------------------------
    # 5. Build SVG parts
    # ------------------------------------------------------------------
    parts = []

    # -- 5a. No defs needed: debt exclusion bars use opacity via CSS --

    # -- 5b. "Failed" / "Passed" header labels --
    parts.append(
        f'<text class="tick-label" x="{H_ML + 2}" y="{H_MT - 6}" '
        f'text-anchor="start" font-size="9">Failed</text>'
    )
    parts.append(
        f'<text class="tick-label" x="{H_VB_W - H_MR - 2}" y="{H_MT - 6}" '
        f'text-anchor="end" font-size="9">Passed</text>'
    )

    # -- 5c. Vertical dollar grid lines on the pass side --
    # Choose a nice interval: $20M steps
    grid_interval = 20_000_000
    grid_val = grid_interval
    while grid_val <= max_pass:
        gx = baseline_x + grid_val * px_per_dollar
        if gx <= H_VB_W - H_MR:
            parts.append(
                f'<line class="grid-minor" x1="{gx:.1f}" y1="{H_MT}" '
                f'x2="{gx:.1f}" y2="{H_MT + chart_area_h}"/>'
            )
            parts.append(
                f'<text class="tick-label tick-label--minor" '
                f'x="{gx:.1f}" y="{H_MT - 6}" '
                f'text-anchor="middle" font-size="8">{fmt_dollars(grid_val)}</text>'
            )
        grid_val += grid_interval

    # -- 5d. Vertical baseline --
    parts.append(
        f'<line class="axis-base" x1="{baseline_x:.1f}" y1="{H_MT}" '
        f'x2="{baseline_x:.1f}" y2="{H_MT + chart_area_h}"/>'
    )

    # -- 5e. Year labels and bar segments --
    for idx, yr in enumerate(all_years):
        by = bar_y(idx)
        label_y = row_y(idx) + ROW_H / 2 + 4   # vertically centred text

        # Year label (2-digit with apostrophe)
        yr_short = f"'{yr % 100:02d}"
        parts.append(
            f'<text class="tick-label" x="{H_ML - 4}" y="{label_y:.1f}" '
            f'text-anchor="end" font-size="9">{yr_short}</text>'
        )

        pass_votes = sorted(by_year[yr]["pass"], key=sort_key)
        fail_votes = sorted(by_year[yr]["fail"], key=sort_key)

        # --- Pass side (extending RIGHT from baseline) ---
        cursor_x = baseline_x
        for r in pass_votes:
            color = dept_color(r["department"])
            rv = r["real_val"]
            av = r["amount_val"]
            mtype = r["measure_type"]

            if rv is not None and rv > 0:
                w = rv * px_per_dollar
            else:
                w = MARKER_W

            fill_cls = f"bar-solid-{color}" if mtype == "Override" else f"bar-hatch-{color}"
            dept_attr = r["department"].replace(" ", "_").replace("&", "and")
            data_type = "override" if mtype == "Override" else "debt-exclusion"
            result_label = "Passed" if r["win_loss"] == "WIN" else "Failed"

            parts.append(
                f'<rect class="{fill_cls}" '
                f'x="{cursor_x:.1f}" y="{by:.1f}" '
                f'width="{w:.1f}" height="{BAR_H}" '
                f'data-nominal="{int(av) if av else ""}" '
                f'data-real="{int(rv) if rv else ""}" '
                f'data-win="1" '
                f'data-dept="{dept_attr}" '
                f'data-type="{data_type}" '
                f'data-year="{yr}">'
                f'<title>{r["description"]} ({yr}, {result_label}, {fmt_dollars(rv)})</title>'
                f'</rect>'
            )
            cursor_x += w

        # --- Fail side (extending LEFT from baseline) ---
        cursor_x = baseline_x
        for r in fail_votes:
            color = dept_color(r["department"])
            rv = r["real_val"]
            av = r["amount_val"]
            mtype = r["measure_type"]

            if rv is not None and rv > 0:
                w = rv * px_per_dollar
            else:
                w = MARKER_W

            fill_cls = f"bar-solid-{color}" if mtype == "Override" else f"bar-hatch-{color}"
            dept_attr = r["department"].replace(" ", "_").replace("&", "and")
            data_type = "override" if mtype == "Override" else "debt-exclusion"
            result_label = "Passed" if r["win_loss"] == "WIN" else "Failed"

            rect_x = cursor_x - w
            parts.append(
                f'<rect class="{fill_cls}" '
                f'x="{rect_x:.1f}" y="{by:.1f}" '
                f'width="{w:.1f}" height="{BAR_H}" '
                f'data-nominal="{int(av) if av else ""}" '
                f'data-real="{int(rv) if rv else ""}" '
                f'data-win="0" '
                f'data-dept="{dept_attr}" '
                f'data-type="{data_type}" '
                f'data-year="{yr}">'
                f'<title>{r["description"]} ({yr}, {result_label}, {fmt_dollars(rv)})</title>'
                f'</rect>'
            )
            cursor_x -= w

    # -- Assemble SVG --
    inner = "\n".join(parts)
    min_yr = all_years[0]
    max_yr = all_years[-1]
    svg = (
        f'<svg class="chart" viewBox="0 0 {H_VB_W} {vb_h}" '
        f'xmlns="http://www.w3.org/2000/svg" '
        f'role="img" '
        f'aria-label="Horizontal diverging bar chart of Marblehead Proposition 2½ '
        f'votes from {min_yr} to {max_yr}. '
        f'Bars extending right of the center line are passed questions; '
        f'bars extending left are failed. '
        f'Solid bars are overrides; translucent bars are debt exclusions. '
        f'Bar width represents the inflation-adjusted dollar amount.">\n'
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
