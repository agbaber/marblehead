#!/usr/bin/env python3
"""Compute chart values for charts/general_government_over_time.html.

Reads:
  data/peer_schedule_a_expenditures.csv  (DOR Schedule A, FY02-FY24)
  data/demographics_FY01-24.csv          (Marblehead population)
  data/cpi_us.csv                        (BLS CPI-U, calendar year)
  data/dor_income_eqv_pop_FY27.csv       (peer populations, current)

Emits JSON to stdout with the values needed by the chart page.
Run from the repo root:

  python3 data/build_general_government_chart_data.py > /tmp/gg_chart_values.json
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

PEERS = ["Brookline", "Wellesley", "Hingham", "Winchester",
         "Lexington", "Needham", "Newton", "Natick"]
COHORT = ["Marblehead"] + PEERS

# Layout constants matching healthcare_costs.html conventions.
CHART_LEFT, CHART_RIGHT = 60, 620
CHART_TOP, CHART_BOTTOM = 42, 246


def read_schedule_a():
    """Returns {(town, fy): {'gg': int, 'total': int}} for FY02-FY24."""
    out = {}
    with (DATA / "peer_schedule_a_expenditures.csv").open() as f:
        for row in csv.DictReader(f):
            fy = int(row["fiscal_year"])
            if not (2002 <= fy <= 2024):
                continue
            gg = int(row["general_government"].replace(",", "")) if row["general_government"] else 0
            tot = int(row["total_expenditures"].replace(",", "")) if row["total_expenditures"] else 0
            if gg == 0 or tot == 0:
                continue
            out[(row["municipality"], fy)] = {"gg": gg, "total": tot}
    return out


def read_population():
    """Marblehead population by FY (FY02-FY24) and peer populations (current vintage)."""
    mh_pop = {}
    with (DATA / "demographics_FY01-24.csv").open() as f:
        for row in csv.DictReader(f):
            mh_pop[int(row["FY"])] = int(row["Population"])
    peer_pop = {}
    with (DATA / "dor_income_eqv_pop_FY27.csv").open() as f:
        for row in csv.DictReader(f):
            if row["municipality"] in COHORT:
                peer_pop[row["municipality"]] = int(row["population"])
    return mh_pop, peer_pop


def read_cpi():
    """Calendar-year CPI-U All Urban Consumers, US average."""
    cpi = {}
    with (DATA / "cpi_us.csv").open() as f:
        for row in csv.DictReader(f):
            cpi[int(row["year"])] = float(row["cpi_u"])
    return cpi


def linspace(start, end, n):
    """n evenly spaced floats from start to end inclusive."""
    if n == 1:
        return [start]
    step = (end - start) / (n - 1)
    return [round(start + i * step, 2) for i in range(n)]


def y_for(value, vmin, vmax):
    """Map a value to a Y coordinate (top=CHART_TOP, bottom=CHART_BOTTOM)."""
    if vmax == vmin:
        return CHART_BOTTOM
    frac = (value - vmin) / (vmax - vmin)
    return round(CHART_BOTTOM - frac * (CHART_BOTTOM - CHART_TOP), 1)


def main():
    sched = read_schedule_a()
    mh_pop, peer_pop = read_population()
    cpi = read_cpi()

    years = list(range(2002, 2025))
    x_positions = linspace(CHART_LEFT, CHART_RIGHT, len(years))

    # ── View 1: indexed (FY02 = 100) ────────────────────────────────────
    mh_gg_base = sched[("Marblehead", 2002)]["gg"]
    mh_total_base = sched[("Marblehead", 2002)]["total"]
    cpi_base = cpi[2002]

    mh_gg_idx = [round(sched[("Marblehead", fy)]["gg"] / mh_gg_base * 100, 1) for fy in years]
    mh_total_idx = [round(sched[("Marblehead", fy)]["total"] / mh_total_base * 100, 1) for fy in years]
    cpi_idx = [round(cpi[fy] / cpi_base * 100, 1) for fy in years]

    v1_min = min(mh_gg_idx + mh_total_idx + cpi_idx)
    v1_max = max(mh_gg_idx + mh_total_idx + cpi_idx)
    # Round axis bounds to clean increments of 25.
    v1_axis_min = (int(v1_min) // 25) * 25
    v1_axis_max = ((int(v1_max) // 25) + 1) * 25

    def to_points(values, vmin, vmax):
        return " ".join(f"{x},{y_for(v, vmin, vmax)}" for x, v in zip(x_positions, values))

    view1 = {
        "x_labels": [f"FY{fy % 100:02d}" for fy in years],
        "x_positions": x_positions,
        "y_axis_min": v1_axis_min,
        "y_axis_max": v1_axis_max,
        "series": [
            {"name": "Marblehead general government", "className": "s-emphasis",
             "values": mh_gg_idx,
             "points": to_points(mh_gg_idx, v1_axis_min, v1_axis_max)},
            {"name": "Marblehead total expenditures", "className": "s-revenue",
             "values": mh_total_idx,
             "points": to_points(mh_total_idx, v1_axis_min, v1_axis_max)},
            {"name": "CPI-U (US, all items)", "className": "s-neutral",
             "values": cpi_idx,
             "points": to_points(cpi_idx, v1_axis_min, v1_axis_max)},
        ],
    }

    # ── View 2: real per-capita (2024 dollars) ──────────────────────────
    cpi_2024 = cpi[2024]
    real_pc = []
    for fy in years:
        gg = sched[("Marblehead", fy)]["gg"]
        pop = mh_pop[fy]
        real_dollars = gg * (cpi_2024 / cpi[fy])
        real_pc.append(round(real_dollars / pop, 0))

    v2_axis_min = (int(min(real_pc)) // 25) * 25
    v2_axis_max = ((int(max(real_pc)) // 25) + 2) * 25
    mean_v2 = round(sum(real_pc) / len(real_pc), 0)

    view2 = {
        "x_labels": view1["x_labels"],
        "x_positions": x_positions,
        "y_axis_min": v2_axis_min,
        "y_axis_max": v2_axis_max,
        "mean_value": mean_v2,
        "mean_y": y_for(mean_v2, v2_axis_min, v2_axis_max),
        "values": real_pc,
        "points": " ".join(f"{x},{y_for(v, v2_axis_min, v2_axis_max)}"
                           for x, v in zip(x_positions, real_pc)),
    }

    # ── View 3: peer comparison FY24 ─────────────────────────────────────
    rows = []
    for town in COHORT:
        gg = sched[(town, 2024)]["gg"]
        pop = peer_pop[town]
        rows.append({
            "town": town,
            "gg_pc": round(gg / pop, 0),
            "gg_pct_total": round(sched[(town, 2024)]["gg"] / sched[(town, 2024)]["total"] * 100, 2),
        })
    rows.sort(key=lambda r: r["gg_pc"])
    marblehead_rank = next(i for i, r in enumerate(rows, start=1) if r["town"] == "Marblehead")
    view3 = {
        "rows": rows,
        "marblehead_rank": marblehead_rank,
        "n_towns": len(rows),
    }

    print(json.dumps({"view1": view1, "view2": view2, "view3": view3}, indent=2))


if __name__ == "__main__":
    main()
