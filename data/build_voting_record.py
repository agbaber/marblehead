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
# SVG CHART
# ---------------------------------------------------------------------------

# Viewbox / layout constants
VB_W, VB_H   = 880, 520
ML, MR       = 65, 15          # left / right margin
MT, MB       = 35, 60          # top / bottom margin
CHART_W      = VB_W - ML - MR  # 800
CHART_H      = VB_H - MT - MB  # 425

LOSS_FRAC    = 0.20            # 20% of chart height below baseline
WIN_H        = CHART_H * (1 - LOSS_FRAC)   # 340 px
LOSS_H       = CHART_H * LOSS_FRAC         # 85 px

# Y pixel of the baseline
BASELINE_Y   = MT + WIN_H      # 375

# Minimum bar height for zero-amount rows (marker)
MARKER_PX    = 2

# Bar width / gap inside each year group
BAR_W        = 5               # per bar; will be adjusted dynamically
BAR_GAP      = 2               # gap between override and debt-exclusion bar


def build_chart(rows):
    """Return a complete <svg> string."""

    # ------------------------------------------------------------------
    # 1. Group rows by calendar year, skip zero-vote clerk error from chart
    # ------------------------------------------------------------------
    chart_rows = [r for r in rows if not is_clerk_error(r)]

    by_year = defaultdict(lambda: {"Override": [], "Debt Exclusion": []})
    for r in chart_rows:
        yr = calendar_year(r["vote_date"])
        if yr is None:
            continue
        mtype = r["measure_type"]
        if mtype in ("Override", "Debt Exclusion"):
            by_year[yr][mtype].append(r)

    all_years = sorted(by_year.keys())
    if not all_years:
        return "<svg></svg>"

    n_years = len(all_years)

    # ------------------------------------------------------------------
    # 2. Find maximum real dollar amount for scaling
    # ------------------------------------------------------------------
    max_real = 0
    for yr, groups in by_year.items():
        for mtype, rlist in groups.items():
            for r in rlist:
                v = r["real_val"] or 0
                if v > max_real:
                    max_real = v

    if max_real == 0:
        max_real = 1  # guard against all-empty

    # ------------------------------------------------------------------
    # 3. Compute x positions
    #    Each year slot gets equal width; bars are centred in the slot.
    # ------------------------------------------------------------------
    slot_w = CHART_W / n_years

    # Dynamic bar width: at most 12px, at least 3px
    bar_w = max(3, min(12, slot_w * 0.35))
    bar_gap = max(1, bar_w * 0.4)

    def slot_x(yr):
        """Left edge of the year slot in chart coordinates (add ML to get SVG x)."""
        idx = all_years.index(yr)
        return idx * slot_w

    def bar_center_x(yr):
        """Centre x of the year slot in SVG coordinates."""
        return ML + slot_x(yr) + slot_w / 2

    # ------------------------------------------------------------------
    # 4. Helpers: pixel height for a real-dollar amount
    # ------------------------------------------------------------------
    def win_px(real_val):
        if real_val is None:
            return MARKER_PX
        if real_val <= 0:
            return MARKER_PX
        return max(MARKER_PX, (real_val / max_real) * WIN_H)

    def loss_px(real_val):
        """For failed votes: bar goes down, capped at LOSS_H."""
        if real_val is None:
            return MARKER_PX
        if real_val <= 0:
            return MARKER_PX
        return max(MARKER_PX, min((real_val / max_real) * WIN_H, LOSS_H))

    # ------------------------------------------------------------------
    # 5. Build SVG elements list
    # ------------------------------------------------------------------
    parts = []

    # -- 5a. defs: hatch patterns for each dept color --
    defs_patterns = []
    for dept, color_token in DEPT_COLOR.items():
        pid = f"hatch-{color_token}"
        defs_patterns.append(
            f'    <pattern id="{pid}" patternUnits="userSpaceOnUse" '
            f'width="4" height="4" patternTransform="rotate(45)">\n'
            f'      <rect width="2" height="4" class="hatch-stripe hatch-stripe--{color_token}"/>\n'
            f'    </pattern>'
        )

    parts.append('<defs>')
    parts.extend(defs_patterns)
    parts.append('</defs>')

    # -- 5b. Grid lines (25%, 50%, 75%, 100% of max above baseline; 50% below) --
    grid_fracs_above = [0.25, 0.50, 0.75, 1.00]
    grid_x1 = ML
    grid_x2 = ML + CHART_W

    for frac in grid_fracs_above:
        gy = BASELINE_Y - frac * WIN_H
        label = fmt_dollars(max_real * frac)
        parts.append(
            f'<line class="grid-major" x1="{grid_x1}" y1="{gy:.1f}" '
            f'x2="{grid_x2}" y2="{gy:.1f}"/>'
        )
        parts.append(
            f'<text class="tick-label" x="{ML - 5}" y="{gy + 4:.1f}" '
            f'text-anchor="end">{label}</text>'
        )

    # One grid line 50% of loss height below baseline
    loss_grid_y = BASELINE_Y + LOSS_H * 0.5
    parts.append(
        f'<line class="grid-major" x1="{grid_x1}" y1="{loss_grid_y:.1f}" '
        f'x2="{grid_x2}" y2="{loss_grid_y:.1f}"/>'
    )
    parts.append(
        f'<text class="tick-label" x="{ML - 5}" y="{loss_grid_y + 4:.1f}" '
        f'text-anchor="end">{fmt_dollars(max_real * 0.5)}</text>'
    )

    # -- 5c. Baseline --
    parts.append(
        f'<line class="axis-base" x1="{ML}" y1="{BASELINE_Y:.1f}" '
        f'x2="{ML + CHART_W}" y2="{BASELINE_Y:.1f}"/>'
    )

    # "Passed ↑" / "Failed ↓" labels near baseline on left
    parts.append(
        f'<text class="tick-label" x="{ML + 4}" y="{BASELINE_Y - 6:.1f}" '
        f'text-anchor="start" font-size="8">Passed &#x2191;</text>'
    )
    parts.append(
        f'<text class="tick-label" x="{ML + 4}" y="{BASELINE_Y + 14:.1f}" '
        f'text-anchor="start" font-size="8">Failed &#x2193;</text>'
    )

    # -- 5d. Bars --
    for yr in all_years:
        cx = bar_center_x(yr)
        ov_list = by_year[yr]["Override"]
        de_list = by_year[yr]["Debt Exclusion"]

        # Centre the two bars (override left, debt exclusion right)
        # Total group width = 2*bar_w + bar_gap; offset from centre
        half_group = bar_w + bar_gap / 2

        # Override bars
        ov_x = cx - half_group
        for r in ov_list:
            color = dept_color(r["department"])
            wl = r["win_loss"]
            rv = r["real_val"]
            av = r["amount_val"]
            h = win_px(rv) if wl == "WIN" else loss_px(rv)
            if wl == "WIN":
                bx = ov_x - bar_w / 2
                by = BASELINE_Y - h
            else:
                bx = ov_x - bar_w / 2
                by = BASELINE_Y
            dept_attr = r["department"].replace(" ", "_").replace("&", "and")
            parts.append(
                f'<rect class="bar-solid-{color}" '
                f'x="{bx:.1f}" y="{by:.1f}" '
                f'width="{bar_w:.1f}" height="{h:.1f}" '
                f'data-nominal="{int(av) if av else ""}" '
                f'data-real="{int(rv) if rv else ""}" '
                f'data-win="{wl}" '
                f'data-dept="{dept_attr}" '
                f'data-type="override">'
                f'<title>{r["description"]} ({yr}, {wl}, {fmt_dollars(rv)})</title>'
                f'</rect>'
            )

        # Debt Exclusion bars
        de_x = cx + bar_gap / 2
        for r in de_list:
            color = dept_color(r["department"])
            wl = r["win_loss"]
            rv = r["real_val"]
            av = r["amount_val"]
            h = win_px(rv) if wl == "WIN" else loss_px(rv)
            if wl == "WIN":
                bx = de_x
                by = BASELINE_Y - h
            else:
                bx = de_x
                by = BASELINE_Y
            dept_attr = r["department"].replace(" ", "_").replace("&", "and")
            parts.append(
                f'<rect class="bar-hatch-{color}" '
                f'x="{bx:.1f}" y="{by:.1f}" '
                f'width="{bar_w:.1f}" height="{h:.1f}" '
                f'data-nominal="{int(av) if av else ""}" '
                f'data-real="{int(rv) if rv else ""}" '
                f'data-win="{wl}" '
                f'data-dept="{dept_attr}" '
                f'data-type="debt-exclusion">'
                f'<title>{r["description"]} ({yr}, {wl}, {fmt_dollars(rv)})</title>'
                f'</rect>'
            )

    # -- 5e. X-axis year labels --
    # Compute minimum pixel spacing to decide which to show
    prev_label_x = None
    MIN_LABEL_GAP = 22

    for yr in all_years:
        cx = bar_center_x(yr)
        is_mult5 = (yr % 5 == 0)
        cls = "tick-label tick-label--major" if is_mult5 else "tick-label tick-label--minor"

        # Skip if too close to previous label
        if prev_label_x is not None and abs(cx - prev_label_x) < MIN_LABEL_GAP:
            continue

        parts.append(
            f'<text class="{cls}" x="{cx:.1f}" y="{VB_H - MB + 16}" '
            f'text-anchor="middle">{yr}</text>'
        )
        prev_label_x = cx

    # Assemble final SVG
    inner = "\n".join(parts)
    min_yr = all_years[0]
    max_yr = all_years[-1]
    svg = (
        f'<svg class="chart" viewBox="0 0 {VB_W} {VB_H}" '
        f'xmlns="http://www.w3.org/2000/svg" '
        f'role="img" '
        f'aria-label="Diverging bar chart of Marblehead Proposition 2½ votes '
        f'from {min_yr} to {max_yr}. '
        f'Bars above the baseline are passed questions; bars below are failed. '
        f'Solid bars are overrides; hatched bars are debt exclusions. '
        f'Bar height represents the inflation-adjusted dollar amount.">\n'
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
