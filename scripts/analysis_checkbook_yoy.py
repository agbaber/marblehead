#!/usr/bin/env python3
"""
FY27-to-date vs FY26 comparison of Marblehead's vendor checkbook and the
payroll-inclusive budget portal, for the working analysis in
docs/analysis/2026-10-22-fy27-checkbook-vs-fy26.md.

Every table the document quotes is produced here, from committed files,
so a number can be re-derived by re-running this script:

  python3 scripts/analysis_checkbook_yoy.py            # markdown to stdout
  python3 scripts/analysis_checkbook_yoy.py --json out.json

Inputs (all in data/ unless noted):
  checkbook_FY26_2026-06-30.csv        full FY26 vendor checkbook (AP only)
  checkbook_FY27_<as-of>.csv           FY27 to date (newest file wins)
  operating_budget_FY26.csv / FY27.csv monthly budget portal export, payroll included
  budget_actual_FY25.json              FY25 department actuals (year-end only)
  town_budget_FY27.json                FY27 "no override" proposed budget by department
  group_insurance_FY06-27.csv, pension_expenditure_FY01-24.csv   long-run series
  legal/fy26_law_firm_payments.csv     law-firm names

The FY26 comparison window is July 1 through the FY27 as-of month/day one
year earlier, so both sides cover the same number of days.
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
sys.path.insert(0, str(REPO / "scripts"))
from build_checkbook_view import bucket_for_fund, carveout_for_gf_town_row  # noqa: E402

SALARY_CATS = {"PROFESSIONAL SALARY", "OTHER SALARIES", "CLERICAL SALARIES"}
Q1_MONTHS = {"07", "08", "09"}


# ---------------------------------------------------------------- loading

def load_checkbook(path: Path) -> list[dict]:
    rows = list(csv.DictReader(path.open(newline="")))
    for r in rows:
        r["Amount"] = float(r["Amount"])
        r["Date"] = r["Date"][:10]
    return rows


def newest_fy27_csv() -> Path:
    paths = sorted(DATA.glob("checkbook_FY27_*.csv"))
    if not paths:
        sys.exit("no data/checkbook_FY27_*.csv")
    return paths[-1]


def load_budget(path: Path, fy: str) -> list[dict]:
    out = []
    for r in csv.DictReader(path.open(newline="")):
        if r["fiscalyear"] != fy or r["fundgroup"] != "BUDGETED ANNUAL FUNDS":
            continue
        for c in ("originalbudget", "revisedbudget", "actual", "encumbrance"):
            r[c] = float(r[c] or 0)
        r["month"] = r["fiscalmonth"][5:7]
        out.append(r)
    return out


# ---------------------------------------------------------------- helpers

def total(rows): return sum(r["Amount"] for r in rows)


def by(rows, key):
    d = defaultdict(float)
    for r in rows:
        d[key(r) if callable(key) else r[key]] += r["Amount"]
    return d


def pct(new, old):
    return None if not old else 100.0 * (new / old - 1)


def money(x):
    if x is None:
        return ""
    return f"-${abs(x):,.0f}" if x < 0 else f"${x:,.0f}"


def p(x):
    return "" if x is None else f"{x:+.1f}%"


def md_table(title, cols, rows, note=None):
    print(f"\n### {title}\n")
    if note:
        print(f"_{note}_\n")
    print("| " + " | ".join(c for c, _ in cols) + " |")
    print("|" + "|".join("---:" if f in ("m", "p", "n") else "---" for _, f in cols) + "|")
    for r in rows:
        cells = []
        for c, f in cols:
            v = r.get(c)
            cells.append(money(v) if f == "m" else p(v) if f == "p" else ("" if v is None else str(v)))
        print("| " + " | ".join(cells) + " |")


def cagr(first, last, years):
    return None if not first or years <= 0 else 100.0 * ((last / first) ** (1.0 / years) - 1)


# ---------------------------------------------------------------- lenses

def lens_headline(w26, y27, f26):
    rows = [
        {"series": "Vendor payments ($)", "fy26w": total(w26), "fy27": total(y27), "fy26full": total(f26), "chg": pct(total(y27), total(w26))},
        {"series": "Rows (count)", "rows26w": len(w26), "rows27": len(y27), "rows26full": len(f26)},
        {"series": "Distinct vendors (count)", "rows26w": len(by(w26, "Vendor")), "rows27": len(by(y27, "Vendor")), "rows26full": len(by(f26, "Vendor"))},
    ]
    b26, b27, bf = by(w26, lambda r: bucket_for_fund(r["Fund"])), by(y27, lambda r: bucket_for_fund(r["Fund"])), by(f26, lambda r: bucket_for_fund(r["Fund"]))
    bucket_rows = []
    for k in sorted(set(b26) | set(b27), key=lambda k: -b27.get(k, 0)):
        bucket_rows.append({"bucket": k, "fy26w": b26.get(k, 0), "fy27": b27.get(k, 0), "chg": pct(b27.get(k, 0), b26.get(k, 0)),
                            "fy26full": bf.get(k, 0), "share": (100.0 * b26.get(k, 0) / bf[k]) if bf.get(k) else None})
    return rows, bucket_rows


def lens_funds(w26, y27, f26, n=16):
    a, b, f = by(w26, "Fund"), by(y27, "Fund"), by(f26, "Fund")
    keys = sorted(set(a) | set(b), key=lambda k: -abs(b.get(k, 0) - a.get(k, 0)))[:n]
    return [{"fund": k, "fy26w": a.get(k, 0), "fy27": b.get(k, 0), "delta": b.get(k, 0) - a.get(k, 0), "fy26full": f.get(k, 0)} for k in keys]


def gf_town(rows): return [r for r in rows if r["Fund"] == "GENERAL FUND - TOWN"]


def lens_carveouts(w26, y27, f26):
    a, b, f = (by(gf_town(x), carveout_for_gf_town_row) for x in (w26, y27, f26))
    return [{"carveout": k, "fy26w": a.get(k, 0), "fy27": b.get(k, 0), "delta": b.get(k, 0) - a.get(k, 0), "chg": pct(b.get(k, 0), a.get(k, 0)), "fy26full": f.get(k, 0)}
            for k in sorted(set(a) | set(b), key=lambda k: -b.get(k, 0))]


def is_gic(r):
    # GIC invoices carry an "...MB" invoice number ("666016820260902MB",
    # "MBJUNE") or say "MARBLEHEAD GIC BILL". Other Commonwealth payments
    # (sales tax, "MARCH", "AUGUST") do not.
    if r["Vendor"] != "COMMONWEALTH OF MA":
        return False
    d = r["Description"].upper().replace("MARBLEHEAD", "")
    return "GIC" in d or "MB" in d
def is_pension(r): return "CONTRIBUTORY RETIREMENT" in r["Vendor"].upper()
def is_debt(r): return r["Vendor"].upper().startswith("U.S. BANK") and r["Fund"] == "GENERAL FUND - TOWN"
ASSESSMENT_VENDORS = {"ESSEX NS AGRIC & TECHN SCHOOL DISTR": "Essex North Shore Agricultural & Technical",
                      "MASSACHUSETTS WATER RESOURCES AUTHORITY": "MWRA",
                      "SOUTH ESSEX SEWERAGE DISTRICT": "South Essex Sewerage District"}


def lens_fixed(w26, y27, f26):
    out = {}
    for name, pred in (("Pension (Contributory Retirement System)", is_pension), ("GIC health bill (Commonwealth of MA, 'MB' invoices)", is_gic), ("Debt service (U.S. Bank, GF-Town, voids included)", is_debt)):
        a, b, f = (total([r for r in x if pred(r)]) for x in (w26, y27, f26))
        out[name] = {"item": name, "fy26w": a, "fy27": b, "delta": b - a, "chg": pct(b, a), "fy26full": f}
    for v, label in ASSESSMENT_VENDORS.items():
        a, b, f = (total([r for r in x if r["Vendor"] == v]) for x in (w26, y27, f26))
        out[label] = {"item": label, "fy26w": a, "fy27": b, "delta": b - a, "chg": pct(b, a), "fy26full": f}
    oi = lambda x: [r for r in x if r["Division"] == "OTHER INSURANCE"]
    a, b, f = (total(oi(x)) for x in (w26, y27, f26))
    out["other"] = {"item": "Other insurance (division), all vendors", "fy26w": a, "fy27": b, "delta": b - a, "chg": pct(b, a), "fy26full": f}
    # GIC by month
    m26, m27 = (by([r for r in x if is_gic(r)], lambda r: r["Date"][5:7]) for x in (f26, y27))
    gic_months = [{"month": m, "fy26": m26.get(m, 0), "fy27": m27.get(m), "chg": pct(m27.get(m), m26.get(m, 0)) if m in m27 else None}
                  for m in ["07", "08", "09", "10", "11", "12", "01", "02", "03", "04", "05", "06"]]
    # debt by month
    d26, d27 = (by([r for r in x if is_debt(r)], lambda r: r["Date"][5:7]) for x in (f26, y27))
    debt_months = [{"month": m, "fy26": d26.get(m, 0), "fy27": d27.get(m)} for m in ["07", "08", "09", "10", "11", "12", "01", "02", "03", "04", "05", "06"]]
    other_vendors = sorted(by(oi(y27), "Vendor").items(), key=lambda kv: -kv[1])[:6]
    oi26 = by(oi(w26), "Vendor")
    other_rows = [{"vendor": k, "fy26w": oi26.get(k, 0), "fy27": v} for k, v in other_vendors]
    return list(out.values()), gic_months, debt_months, other_rows


def lens_longrun():
    gi = {int(r["FY"]): float(r["Group_Insurance_Budget"]) for r in csv.DictReader((DATA / "group_insurance_FY06-27.csv").open())}
    pe = {int(r["FY"]): float(r["Pension_Expenditure"]) for r in csv.DictReader((DATA / "pension_expenditure_FY01-24.csv").open())}
    rows = []
    for label, s, spans in (("Group insurance budget", gi, [(2006, 2027), (2017, 2027), (2022, 2027), (2026, 2027)]),
                            ("Pension expenditure", pe, [(2001, 2024), (2014, 2024), (2019, 2024), (2023, 2024)])):
        for a, b in spans:
            if a in s and b in s:
                rows.append({"series": label, "span": f"FY{a % 100:02d} to FY{b % 100:02d}", "start": s[a], "end": s[b], "cagr": cagr(s[a], s[b], b - a)})
    return rows


# Categories that are transfers, assessments or placeholders rather than
# operating spend; excluded from the "operating" first-quarter comparison.
NON_OPERATING_CATS = {"OFU", "GOVERNMENTAL", "UNDEFINED", "INVESTMENT INCOME", "UNKNOWN"}

# Budget-portal department (segment3) -> normalized name in the FY27
# no-override proposal (data/town_budget_FY27.json), where the names differ.
PROPOSAL_ALIASES = {
    "ABBOT LIBRARY": "ABBOT PUBLIC LIBRARY",
    "PUBLIC WORKS": "PUBLIC WORKS HIGHWAY TREE DRAINS",
    "COMMUNITY DEVELOP AND PLANNING": "COMM DEV AND PLANNING",
    "ASSESSORS": "ASSESSOR",
    "CURBSIDE COLLECTION": "NEW CURBSIDE COLLECTION",
    "DEBT SERVICE": "MATURING BONDS AND INTEREST",
    "OTHER GOVERNMENTAL": "OTHER GENERAL GOVERNMENT",
    "HIGH SCHOOL": "MARBLEHEAD HIGH SCHOOL",
    "VILLAGE SCHOOL": "VILLAGE ELEMENTARY SCHOOL",
    "GLOVER SCHOOL": "GLOVER ELEMENTARY SCHOOL",
    "BROWN SCHOOL": "BROWN ELEMENTARY SCHOOL",
    "MIDDLE SCHOOL": "VETERANS MIDDLE SCHOOL",
    "PARKS & RECREATION": "RECREATION AND PARK",
    "VETERANS": "VETERANS BENEFITS",
}


def norm_name(s):
    s = s.upper().replace("DEPARTMENT", "").replace("&", " AND ")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", "", s)).strip()


def dept_agg(rows, key="segment3"):
    d = defaultdict(lambda: defaultdict(float))
    for r in rows:
        k = r[key]
        d[k]["orig"] += r["originalbudget"]; d[k]["rev"] += r["revisedbudget"]; d[k]["act"] += r["actual"]
        if r["month"] in Q1_MONTHS:
            cat = r["charactercodedescription"]
            d[k]["q1_all"] += r["actual"]
            if cat not in NON_OPERATING_CATS:
                d[k]["q1_op"] += r["actual"]
                d[k]["q1_sal" if cat in SALARY_CATS else "q1_exp"] += r["actual"]
    return d


def lens_departments(b26, b27, fy25, proposed):
    a26, a27 = dept_agg(b26), dept_agg(b27)
    f25 = {d["name"]: d["actual"] for d in fy25["by_department"]}
    prop = {}
    for r in proposed["rows"]:
        if r.get("level") == "department" and r.get("fy27_proposed") is not None:
            prop[norm_name(r["description"])] = (r["description"], r["fy27_proposed"], r.get("fy26_budget"))
    rows = []
    for k in sorted(set(a26) | set(a27), key=lambda k: -a27.get(k, {}).get("orig", 0)):
        pr = prop.get(PROPOSAL_ALIASES.get(k, norm_name(k)))
        g26, g27 = a26.get(k, {}), a27.get(k, {})
        rows.append({"dept": k, "fy25_act": f25.get(k), "fy26_act": g26.get("act", 0), "fy26_orig": g26.get("orig", 0),
                     "fy27_orig": g27.get("orig", 0), "orig_delta": g27.get("orig", 0) - g26.get("orig", 0), "orig_chg": pct(g27.get("orig", 0), g26.get("orig", 0)),
                     "proposal_name": pr[0] if pr else None, "proposal_fy26": pr[2] if pr else None,
                     "fy27_proposed_no_override": pr[1] if pr else None, "adopted_minus_proposed": (g27.get("orig", 0) - pr[1]) if pr else None,
                     "q1_op_26": g26.get("q1_op", 0), "q1_op_27": g27.get("q1_op", 0), "q1_op_chg": pct(g27.get("q1_op", 0), g26.get("q1_op", 0)),
                     "q1_sal_26": g26.get("q1_sal", 0), "q1_sal_27": g27.get("q1_sal", 0), "q1_sal_chg": pct(g27.get("q1_sal", 0), g26.get("q1_sal", 0)),
                     "q1_all_26": g26.get("q1_all", 0), "q1_all_27": g27.get("q1_all", 0)})
    totals = {"fy25_act": sum(f25.values()), "fy26_act": sum(v["act"] for v in a26.values()), "fy26_orig": sum(v["orig"] for v in a26.values()),
              "fy27_orig": sum(v["orig"] for v in a27.values()), "q1_op_26": sum(v["q1_op"] for v in a26.values()), "q1_op_27": sum(v["q1_op"] for v in a27.values()),
              "q1_sal_26": sum(v["q1_sal"] for v in a26.values()), "q1_sal_27": sum(v["q1_sal"] for v in a27.values()), "matched_proposed": sum(1 for r in rows if r["fy27_proposed_no_override"] is not None)}
    return rows, totals


def lens_override_by_function(depts, proposed):
    """Adopted FY27 budget minus the no-override proposal, summed by the
    proposal's own function groups over the departments that matched by
    name. Comparable to the Article 29 contingent appropriation by function."""
    func_of = {norm_name(r["description"]): r.get("function") for r in proposed["rows"] if r.get("level") == "department"}
    label = {r["function"] if r.get("function") else norm_name(r["description"]).replace("VOTE TOTAL ", ""): r["description"].replace("VOTE TOTAL ", "").title()
             for r in proposed["rows"] if r.get("level") == "function"}
    agg = defaultdict(lambda: defaultdict(float))
    for d in depts:
        if d["fy27_proposed_no_override"] is None:
            continue
        fn = func_of.get(norm_name(d["proposal_name"])) or "unknown"
        agg[fn]["adopted"] += d["fy27_orig"]; agg[fn]["proposed"] += d["fy27_proposed_no_override"]; agg[fn]["n"] += 1
    rows = [{"function": label.get(fn, fn), "departments_matched": int(v["n"]), "fy27_proposed_no_override": v["proposed"], "fy27_adopted_portal": v["adopted"], "adopted_minus_proposed": v["adopted"] - v["proposed"]}
            for fn, v in sorted(agg.items(), key=lambda kv: -(kv[1]["adopted"] - kv[1]["proposed"]))]
    return rows


def lens_functions(b26, b27):
    a26, a27 = dept_agg(b26, "segment2"), dept_agg(b27, "segment2")
    rows = []
    for k in sorted(set(a26) | set(a27), key=lambda k: -a27.get(k, {}).get("orig", 0)):
        g26, g27 = a26.get(k, {}), a27.get(k, {})
        rows.append({"function": k, "fy26_orig": g26.get("orig", 0), "fy27_orig": g27.get("orig", 0), "orig_chg": pct(g27.get("orig", 0), g26.get("orig", 0)),
                     "q1_op_26": g26.get("q1_op", 0), "q1_op_27": g27.get("q1_op", 0), "q1_op_chg": pct(g27.get("q1_op", 0), g26.get("q1_op", 0)),
                     "q1_sal_26": g26.get("q1_sal", 0), "q1_sal_27": g27.get("q1_sal", 0), "q1_sal_chg": pct(g27.get("q1_sal", 0), g26.get("q1_sal", 0))})
    return rows


CAPITAL_FUNDS = ("GENERAL FUND - TAX ARTICLES", "WATER CAPITAL ARTICLES", "SEWER CAPITAL ARTICLES", "HARBOR CAPITAL")


def is_capital(r):
    f = r["Fund"].upper()
    return bucket_for_fund(r["Fund"]) == "ballot" or any(f.startswith(c) for c in CAPITAL_FUNDS) or "ARPA" in f or "DONATION" in f or "MWRA LOAN" in f


def cap_key(r):
    f = r["Fund"]
    return f"{f} / {r['Division']}" if any(f.upper().startswith(c) for c in CAPITAL_FUNDS) else f


def lens_capital(w26, y27, f26, as_of):
    a, b, f = (by([r for r in x if is_capital(r)], cap_key) for x in (w26, y27, f26))
    last27, first27, top27 = {}, {}, {}
    for r in y27:
        if is_capital(r):
            k = cap_key(r)
            last27[k] = max(last27.get(k, ""), r["Date"]); first27[k] = min(first27.get(k, "9999"), r["Date"])
    vend = defaultdict(lambda: defaultdict(float))
    for r in y27:
        if is_capital(r): vend[cap_key(r)][r["Vendor"]] += r["Amount"]
    rows = []
    for k in sorted(set(a) | set(b) | set(f), key=lambda k: -(b.get(k, 0) + f.get(k, 0)))[:40]:
        tv = max(vend[k].items(), key=lambda kv: kv[1])[0] if vend.get(k) else ""
        rows.append({"fund_division": k, "fy26full": f.get(k, 0), "fy26w": a.get(k, 0), "fy27": b.get(k, 0), "last_paid_fy27": last27.get(k, ""), "top_vendor_fy27": tv})
    # vendor detail inside the four largest capital keys
    detail = []
    for k in [r["fund_division"] for r in rows[:4]]:
        v26, v27, desc = defaultdict(float), defaultdict(float), defaultdict(float)
        for r in f26:
            if is_capital(r) and cap_key(r) == k: v26[r["Vendor"]] += r["Amount"]
        for r in y27:
            if is_capital(r) and cap_key(r) == k: v27[r["Vendor"]] += r["Amount"]; desc[(r["Vendor"], r["Description"][:38])] += r["Amount"]
        for vendor in sorted(set(v26) | set(v27), key=lambda x: -(v27.get(x, 0) + v26.get(x, 0)))[:6]:
            top_desc = max(((d, amt) for (vn, d), amt in desc.items() if vn == vendor), key=lambda kv: kv[1], default=("", 0))[0]
            detail.append({"fund_division": k, "vendor": vendor, "fy26full": v26.get(vendor, 0), "fy27": v27.get(vendor, 0), "fy27_top_description": top_desc})
    return rows, detail


def lens_vendors(w26, y27, f26, as_of):
    a, b, f = by(w26, "Vendor"), by(y27, "Vendor"), by(f26, "Vendor")
    top = [{"vendor": k, "fy26w": a.get(k, 0), "fy27": b[k], "delta": b[k] - a.get(k, 0), "fy26full": f.get(k, 0),
            "note": "interfund" if k == "TOWN OF MARBLEHEAD" else ("GIC health bill" if k == "COMMONWEALTH OF MA" else "")} for k in sorted(b, key=lambda k: -b[k])[:25]]
    new = [k for k in b if k not in f]
    fundof = defaultdict(lambda: defaultdict(float))
    for r in y27: fundof[r["Vendor"]][f"{r['Fund']} / {r['Division']}"] += r["Amount"]
    new_rows = [{"vendor": k, "fy27": b[k], "where": max(fundof[k].items(), key=lambda kv: kv[1])[0], "n": sum(1 for r in y27 if r["Vendor"] == k)} for k in sorted(new, key=lambda k: -b[k])[:20]]
    gone = [k for k in a if a[k] >= 20000 and k not in b]
    gone_rows = [{"vendor": k, "fy26w": a[k], "fy26full": f.get(k, 0)} for k in sorted(gone, key=lambda k: -a[k])[:15]]
    conc = []
    for label, d in (("FY26 window", a), ("FY27 to date", b), ("FY26 full", f)):
        s = sorted(d.values(), reverse=True); t = sum(s)
        conc.append({"period": label, "vendors": len(d), "top10_share": 100.0 * sum(s[:10]) / t, "top25_share": 100.0 * sum(s[:25]) / t, "under_1k": sum(1 for v in s if 0 < v < 1000)})
    firms = [r["firm"].upper() for r in csv.DictReader((DATA / "legal" / "fy26_law_firm_payments.csv").open())]
    def is_firm(v):
        u = v.upper(); return any(u.startswith(fm.split()[0]) and fm.split()[1][:4] in u for fm in firms)
    legal = {}
    for label, x in (("fy26w", w26), ("fy27", y27), ("fy26full", f26)):
        for r in x:
            if is_firm(r["Vendor"]): legal.setdefault(r["Vendor"], {})[label] = legal.get(r["Vendor"], {}).get(label, 0) + r["Amount"]
    legal_rows = [{"vendor": k, "fy26w": v.get("fy26w", 0), "fy27": v.get("fy27", 0), "fy26full": v.get("fy26full", 0)} for k, v in sorted(legal.items(), key=lambda kv: -kv[1].get("fy27", 0))]
    trash = {}
    for label, x in (("fy26w", w26), ("fy27", y27)):
        for r in x:
            if any(t in r["Division"].upper() for t in ("WASTE", "CURBSIDE", "RECYCL", "TRANSFER STATION")) or any(t in r["Vendor"].upper() for t in ("REPUBLIC SERVICES", "WASTE MANAGEMENT")):
                trash.setdefault(r["Vendor"], {})[label] = trash.get(r["Vendor"], {}).get(label, 0) + r["Amount"]
    trash_rows = [{"vendor": k, "fy26w": v.get("fy26w", 0), "fy27": v.get("fy27", 0)} for k, v in sorted(trash.items(), key=lambda kv: -(kv[1].get("fy27", 0) + kv[1].get("fy26w", 0)))[:8]]
    # anomaly screens on FY27
    seen = defaultdict(int)
    for r in y27: seen[(r["Vendor"], r["Date"], r["Amount"], r["Description"])] += 1
    dupes = [{"vendor": k[0], "date": k[1], "amount": k[2], "description": k[3][:40], "copies": n} for k, n in seen.items() if n > 1 and k[2] > 0]
    dupes.sort(key=lambda d: -d["amount"] * d["copies"])
    skip = lambda r: is_gic(r) or is_pension(r) or is_debt(r)
    pos = sorted([r for r in y27 if r["Amount"] >= 5000 and not skip(r)], key=lambda r: (r["Vendor"], r["Amount"], r["Date"]))
    near = []
    for i in range(1, len(pos)):
        p0, p1 = pos[i - 1], pos[i]
        if p0["Vendor"] == p1["Vendor"] and p0["Amount"] == p1["Amount"] and p0["Date"] != p1["Date"] and (date.fromisoformat(p1["Date"]) - date.fromisoformat(p0["Date"])).days <= 14:
            near.append({"vendor": p0["Vendor"], "amount": p0["Amount"], "dates": f"{p0['Date']} / {p1['Date']}", "desc0": p0["Description"][:34], "desc1": p1["Description"][:34]})
    near.sort(key=lambda d: -d["amount"])
    negs = sorted([r for r in y27 if r["Amount"] < 0], key=lambda r: r["Amount"])[:12]
    neg_rows = [{"date": r["Date"], "vendor": r["Vendor"], "fund": r["Fund"], "amount": r["Amount"], "description": r["Description"][:36]} for r in negs]
    neg_tot = {"fy26_rows": sum(1 for r in f26 if r["Amount"] < 0), "fy26_sum": sum(r["Amount"] for r in f26 if r["Amount"] < 0), "fy27_rows": sum(1 for r in y27 if r["Amount"] < 0), "fy27_sum": sum(r["Amount"] for r in y27 if r["Amount"] < 0)}
    return top, new_rows, len(new), sum(b[k] for k in new), gone_rows, conc, legal_rows, trash_rows, dupes[:12], near[:12], neg_rows, neg_tot


ENTERPRISE = ["ELECTRIC ENTERPRISE", "WATER ENTERPRISE OPERATING", "SEWER ENTERPRISE OPERATING", "HARBOR ENTERPRISE", "WATER CAPITAL ARTICLES", "SEWER CAPITAL ARTICLES"]


def lens_enterprise(w26, y27, f26):
    rows, vend = [], []
    for fund in ENTERPRISE:
        sel = lambda x: [r for r in x if r["Fund"].upper().startswith(fund)]
        a, b, f = (total(sel(x)) for x in (w26, y27, f26))
        rows.append({"fund": fund, "fy26w": a, "fy27": b, "delta": b - a, "chg": pct(b, a), "fy26full": f})
        va, vb = by(sel(w26), "Vendor"), by(sel(y27), "Vendor")
        for k in sorted(set(va) | set(vb), key=lambda k: -abs(vb.get(k, 0) - va.get(k, 0)))[:4]:
            vend.append({"fund": fund, "vendor": k, "fy26w": va.get(k, 0), "fy27": vb.get(k, 0), "delta": vb.get(k, 0) - va.get(k, 0)})
    return rows, vend


SCHOOL_KEYS = [("SpEd / out-of-district", ("COLLABORATIVE", "ACADEMY", "LEARNING CENTER", "SCHOOL", "CENTER FOR", "INSTITUTE", "LANDMARK", "MAY INSTITUTE", "NEW ENGLAND", "LEAGUE SCHOOL")),
               ("Transportation", ("TRANSPORT", "BUS", "COACH", "LIVERY", "SALTER")), ("Utilities / energy", ("NATIONAL GRID", "ELECTRIC", "GAS", "ENERGY", "OIL", "LIGHT DEPT", "LIGHT DEPARTMENT", "WATER")),
               ("Technology / software", ("TECHNOLOG", "SOFTWARE", "COMPUTER", "APPLE", "DELL", "CDW", "POWERSCHOOL", "GOOGLE", "FRONTLINE")), ("Legal", ("LAW", "LLC", "ATTORNEY"))]


def lens_schools(w26, y27, f26):
    gs = lambda x: [r for r in x if r["Fund"] == "GENERAL FUND - SCHOOL"]
    a, b, f = by(gs(w26), "Vendor"), by(gs(y27), "Vendor"), by(gs(f26), "Vendor")
    top = [{"vendor": k, "fy26w": a.get(k, 0), "fy27": b.get(k, 0), "delta": b.get(k, 0) - a.get(k, 0), "fy26full": f.get(k, 0)} for k in sorted(set(a) | set(b), key=lambda k: -abs(b.get(k, 0) - a.get(k, 0)))[:18]]
    def cat(v):
        u = v.upper()
        for name, keys in SCHOOL_KEYS:
            if any(k in u for k in keys): return name
        return "Other"
    ca, cb, cf = (by(gs(x), lambda r: cat(r["Vendor"])) for x in (w26, y27, f26))
    cats = [{"category": k, "fy26w": ca.get(k, 0), "fy27": cb.get(k, 0), "chg": pct(cb.get(k, 0), ca.get(k, 0)), "fy26full": cf.get(k, 0)} for k in sorted(set(ca) | set(cb), key=lambda k: -cf.get(k, 0))]
    other = []
    for fund in ("SCHOOL LUNCH", "CIRCUIT BREAKER", "IDEA", "TITLE I", "METCO"):
        sel = lambda x: [r for r in x if fund in r["Fund"].upper()]
        other.append({"fund": fund, "fy26w": total(sel(w26)), "fy27": total(sel(y27)), "fy26full": total(sel(f26))})
    monthly = []
    for name in ("SpEd / out-of-district", "Transportation"):
        m26 = by([r for r in gs(f26) if cat(r["Vendor"]) == name], lambda r: r["Date"][5:7])
        m27 = by([r for r in gs(y27) if cat(r["Vendor"]) == name], lambda r: r["Date"][5:7])
        for m in ["07", "08", "09", "10", "11", "12", "01", "02", "03", "04", "05", "06"]:
            monthly.append({"category": name, "month": m, "fy26": m26.get(m, 0), "fy27": m27.get(m)})
    return top, cats, other, monthly, {"fy26w": total(gs(w26)), "fy27": total(gs(y27)), "fy26full": total(gs(f26))}


def lens_projection(w26, y27, f26):
    rows = []
    groups = [("bucket: " + k, lambda r, k=k: bucket_for_fund(r["Fund"]) == k) for k in ("town_meeting", "ratepayer", "ballot", "state_fed", "revolving", "other")]
    groups += [("GF-Town: " + k, lambda r, k=k: r["Fund"] == "GENERAL FUND - TOWN" and carveout_for_gf_town_row(r) == k) for k in ("gic_insurance", "pension", "debt_us_bank", "cherry_sheet", "admin_contracts", "other_recurring")]
    groups += [("GENERAL FUND - SCHOOL", lambda r: r["Fund"] == "GENERAL FUND - SCHOOL"), ("All vendor payments", lambda r: True)]
    for label, pred in groups:
        a, b, f = (total([r for r in x if pred(r)]) for x in (w26, y27, f26))
        share = (a / f) if f else None
        rows.append({"group": label, "fy26w": a, "fy26full": f, "share": 100 * share if share else None, "fy27": b, "fy27_projected": (b / share) if share else None, "proj_vs_fy26": pct(b / share, f) if share else None})
    return rows


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path)
    args = ap.parse_args()
    p27 = newest_fy27_csv()
    as_of = re.search(r"(\d{4}-\d{2}-\d{2})", p27.name).group(1)
    win_end = f"{int(as_of[:4]) - 1}{as_of[4:]}"
    f26 = load_checkbook(DATA / "checkbook_FY26_2026-06-30.csv")
    y27 = load_checkbook(p27)
    w26 = [r for r in f26 if r["Date"] <= win_end]
    b26 = load_budget(DATA / "operating_budget_FY26.csv", "2026")
    b27 = load_budget(DATA / "operating_budget_FY27.csv", "2027")
    fy25 = json.loads((DATA / "budget_actual_FY25.json").read_text())
    proposed = json.loads((DATA / "town_budget_FY27.json").read_text())
    out = {"as_of": as_of, "fy26_window_end": win_end, "fy27_csv": p27.name}
    print(f"# Checkbook FY27 to date ({as_of}) vs FY26 window (2025-07-01 to {win_end})\n")
    print(f"_Generated by `python3 scripts/analysis_checkbook_yoy.py` on {date.today().isoformat()} from `data/{p27.name}`, "
          "`data/checkbook_FY26_2026-06-30.csv`, `data/operating_budget_FY26.csv`, `data/operating_budget_FY27.csv`, "
          "`data/budget_actual_FY25.json`, `data/town_budget_FY27.json`. Do not edit by hand; re-run the script._")

    head, buckets = lens_headline(w26, y27, f26)
    md_table("Headline", [("series", "s"), ("fy26w", "m"), ("fy27", "m"), ("chg", "p"), ("fy26full", "m"), ("rows26w", "n"), ("rows27", "n"), ("rows26full", "n")], head)
    md_table("By funding bucket (who voted on the money)", [("bucket", "s"), ("fy26w", "m"), ("fy27", "m"), ("chg", "p"), ("fy26full", "m"), ("share", "p")], buckets, "share = FY26 window as % of FY26 full year")
    out["headline"], out["buckets"] = head, buckets

    out["funds"] = lens_funds(w26, y27, f26)
    md_table("Largest fund swings", [("fund", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("fy26full", "m")], out["funds"])

    out["carveouts"] = lens_carveouts(w26, y27, f26)
    md_table("General Fund - Town, by carve-out (build_checkbook_view rules)", [("carveout", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("chg", "p"), ("fy26full", "m")], out["carveouts"], "cherry_sheet = vendor 'Commonwealth of MA', which is in fact the GIC health bill; see fixed costs")

    fixed, gic_m, debt_m, other_v = lens_fixed(w26, y27, f26)
    out.update(fixed=fixed, gic_months=gic_m, debt_months=debt_m, other_insurance_vendors=other_v)
    md_table("Fixed costs and assessments", [("item", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("chg", "p"), ("fy26full", "m")], fixed)
    md_table("GIC health bill by month", [("month", "s"), ("fy26", "m"), ("fy27", "m"), ("chg", "p")], gic_m)
    md_table("Debt service (U.S. Bank) by month, voids included", [("month", "s"), ("fy26", "m"), ("fy27", "m")], debt_m)
    md_table("Other insurance division, top FY27 vendors", [("vendor", "s"), ("fy26w", "m"), ("fy27", "m")], other_v)

    out["longrun"] = lens_longrun()
    md_table("Long-run growth of the two big fixed costs", [("series", "s"), ("span", "s"), ("start", "m"), ("end", "m"), ("cagr", "p")], out["longrun"], "CAGR = compound annual growth rate")

    depts, dtot = lens_departments(b26, b27, fy25, proposed)
    out["departments"], out["departments_totals"] = depts, dtot
    md_table("Budget portal (payroll included): budget by department, FY26 vs FY27 adopted, and FY27 no-override proposal",
             [("dept", "s"), ("fy26_orig", "m"), ("fy27_orig", "m"), ("orig_delta", "m"), ("orig_chg", "p"), ("fy27_proposed_no_override", "m"), ("adopted_minus_proposed", "m"), ("proposal_name", "s")],
             sorted(depts, key=lambda r: -abs(r["orig_delta"]))[:36], f"{dtot['matched_proposed']} departments matched to the no-override proposal by name")
    md_table("Budget portal: first-quarter operating actuals (Jul to Sep, transfers and assessments excluded) by department, with salaries",
             [("dept", "s"), ("fy25_act", "m"), ("fy26_act", "m"), ("q1_op_26", "m"), ("q1_op_27", "m"), ("q1_op_chg", "p"), ("q1_sal_26", "m"), ("q1_sal_27", "m"), ("q1_sal_chg", "p")],
             sorted(depts, key=lambda r: -abs(r["q1_op_27"] - r["q1_op_26"]))[:34])
    print(f"\nDepartment totals: {json.dumps({k: (round(v) if isinstance(v, float) else v) for k, v in dtot.items()})}")
    out["override_by_function"] = lens_override_by_function(depts, proposed)
    md_table("Adopted FY27 budget minus the no-override proposal, by the proposal's function groups (matched departments only)",
             [("function", "s"), ("departments_matched", "n"), ("fy27_proposed_no_override", "m"), ("fy27_adopted_portal", "m"), ("adopted_minus_proposed", "m")], out["override_by_function"])
    out["functions"] = lens_functions(b26, b27)
    md_table("Budget portal: by function (segment2)", [("function", "s"), ("fy26_orig", "m"), ("fy27_orig", "m"), ("orig_chg", "p"), ("q1_op_26", "m"), ("q1_op_27", "m"), ("q1_op_chg", "p"), ("q1_sal_26", "m"), ("q1_sal_27", "m"), ("q1_sal_chg", "p")], out["functions"])

    out["capital"], out["capital_vendors"] = lens_capital(w26, y27, f26, as_of)
    md_table("Capital articles, borrowing, grants and donations: drawdown", [("fund_division", "s"), ("fy26full", "m"), ("fy26w", "m"), ("fy27", "m"), ("last_paid_fy27", "s"), ("top_vendor_fy27", "s")], out["capital"])
    md_table("Inside the four largest capital keys: vendors", [("fund_division", "s"), ("vendor", "s"), ("fy26full", "m"), ("fy27", "m"), ("fy27_top_description", "s")], out["capital_vendors"])

    top, new_rows, n_new, new_total, gone, conc, legal, trash, dupes, near, negs, neg_tot = lens_vendors(w26, y27, f26, as_of)
    out.update(vendors_top=top, vendors_new=new_rows, vendors_new_count=n_new, vendors_new_total=new_total, vendors_gone=gone, concentration=conc, legal=legal, trash=trash, dupes=dupes, near_duplicates=near, negatives=negs, negatives_totals=neg_tot)
    md_table("Top 25 vendors, FY27 to date", [("vendor", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("fy26full", "m"), ("note", "s")], top)
    md_table(f"Vendors never paid in FY26: {n_new} vendors, {money(new_total)} (top 20)", [("vendor", "s"), ("fy27", "m"), ("n", "n"), ("where", "s")], new_rows)
    md_table("Vendors paid at least $20K in the FY26 window and nothing so far in FY27", [("vendor", "s"), ("fy26w", "m"), ("fy26full", "m")], gone)
    md_table("Vendor concentration", [("period", "s"), ("vendors", "n"), ("top10_share", "p"), ("top25_share", "p"), ("under_1k", "n")], conc)
    md_table("Law firms (names from data/legal)", [("vendor", "s"), ("fy26w", "m"), ("fy27", "m"), ("fy26full", "m")], legal)
    md_table("Trash and recycling vendors", [("vendor", "s"), ("fy26w", "m"), ("fy27", "m")], trash)
    md_table("Screen: identical rows (same vendor, date, amount, description) in FY27", [("vendor", "s"), ("date", "s"), ("amount", "m"), ("copies", "n"), ("description", "s")], dupes)
    md_table("Screen: same vendor and amount within 14 days, FY27 (recurring bills excluded)", [("vendor", "s"), ("amount", "m"), ("dates", "s"), ("desc0", "s"), ("desc1", "s")], near)
    md_table("Screen: largest negative rows (voids, refunds) in FY27", [("date", "s"), ("vendor", "s"), ("fund", "s"), ("amount", "m"), ("description", "s")], negs, f"negatives: FY26 {neg_tot['fy26_rows']} rows {money(neg_tot['fy26_sum'])}; FY27 {neg_tot['fy27_rows']} rows {money(neg_tot['fy27_sum'])}")

    ent, ent_v = lens_enterprise(w26, y27, f26)
    out.update(enterprise=ent, enterprise_vendors=ent_v)
    md_table("Enterprise funds", [("fund", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("chg", "p"), ("fy26full", "m")], ent)
    md_table("Enterprise funds: biggest vendor swings", [("fund", "s"), ("vendor", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m")], ent_v)

    s_top, s_cat, s_other, s_monthly, s_tot = lens_schools(w26, y27, f26)
    out.update(school_vendors=s_top, school_categories=s_cat, school_other_funds=s_other, school_monthly=s_monthly, school_totals=s_tot)
    md_table("General Fund - School: SpEd placements and transportation by month (timing check)", [("category", "s"), ("month", "s"), ("fy26", "m"), ("fy27", "m")], s_monthly)
    md_table(f"General Fund - School vendor payments: {money(s_tot['fy26w'])} FY26 window, {money(s_tot['fy27'])} FY27 ({p(pct(s_tot['fy27'], s_tot['fy26w']))}); FY26 full {money(s_tot['fy26full'])}",
             [("category", "s"), ("fy26w", "m"), ("fy27", "m"), ("chg", "p"), ("fy26full", "m")], s_cat, "categories by vendor-name keyword; descriptions for SpEd placements are redacted")
    md_table("General Fund - School: biggest vendor swings", [("vendor", "s"), ("fy26w", "m"), ("fy27", "m"), ("delta", "m"), ("fy26full", "m")], s_top)
    md_table("School grant and lunch funds", [("fund", "s"), ("fy26w", "m"), ("fy27", "m"), ("fy26full", "m")], s_other)

    out["projection"] = lens_projection(w26, y27, f26)
    md_table("Full-year projection from FY26 seasonality", [("group", "s"), ("fy26w", "m"), ("fy26full", "m"), ("share", "p"), ("fy27", "m"), ("fy27_projected", "m"), ("proj_vs_fy26", "p")], out["projection"], "share = FY26 window / FY26 full; projected = FY27 to date / share. Lumpy groups (ballot capital) are not projectable this way.")

    if args.json:
        args.json.write_text(json.dumps(out, indent=1, default=str))
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
