#!/usr/bin/env python3
"""build_cherry_sheet_csv.py

Reproducibly rebuild data/cherry_sheet_FY26.csv by scraping the MA DLS
Gateway Cherry Sheet by-Program view for the 37 municipalities used by
why-not-elsewhere.html, then joining each town net Cherry Sheet aid
against population from data/dor_all_351_FY26.csv to derive per-capita
figures.

Source URL pattern (one HTTP GET per town):
    https://dls-gw.dor.state.ma.us/reports/rdPage.aspx
        ?rdReport=CherrySheets.CSbyProgMunis.MuniBudgFinal
        &islMuni={3-digit DOR code}
        &islYear=2026

Scrape date: 2026-05-03 (FY26 estimates final at time of scrape).
Net aid = total_receipts - total_charges. Run:
    python3 scripts/build_cherry_sheet_csv.py

macOS Python builds frequently fail SSL verification against state.ma.us;
this script falls back to subprocess curl -k if urllib raises an SSL
error. No third-party packages required.
"""

import csv
import os
import re
import ssl
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POP_CSV = os.path.join(REPO_ROOT, "data", "dor_all_351_FY26.csv")
OUT_CSV = os.path.join(REPO_ROOT, "data", "cherry_sheet_FY26.csv")

URL_TEMPLATE = (
    "https://dls-gw.dor.state.ma.us/reports/rdPage.aspx"
    "?rdReport=CherrySheets.CSbyProgMunis.MuniBudgFinal"
    "&islMuni={code}&islYear=2026"
)

# 37 municipalities scraped: residential suburbs, mixed-use suburbs,
# commercial-anchor cities, and gateway cities used on
# why-not-elsewhere.html, plus a few additional North Shore peers.
TOWNS = [
    ("Arlington", "010"), ("Beverly", "030"), ("Boston", "035"),
    ("Boxford", "038"), ("Brookline", "046"), ("Burlington", "048"),
    ("Cambridge", "049"), ("Cohasset", "065"), ("Danvers", "071"),
    ("Framingham", "100"), ("Gloucester", "107"), ("Hamilton", "119"),
    ("Hingham", "131"), ("Ipswich", "144"), ("Lexington", "155"),
    ("Lynn", "163"), ("Lynnfield", "164"), ("Malden", "165"),
    ("Marblehead", "168"), ("Melrose", "178"), ("Nahant", "196"),
    ("Natick", "198"), ("Needham", "199"), ("Peabody", "229"),
    ("Reading", "246"), ("Revere", "248"), ("Rockport", "252"),
    ("Salem", "258"), ("Saugus", "262"), ("Stoneham", "284"),
    ("Swampscott", "291"), ("Topsfield", "298"), ("Wakefield", "305"),
    ("Waltham", "308"), ("Wellesley", "317"), ("Wenham", "320"),
    ("Winchester", "344"),
]

# DLS program-name patterns mapped to CSV column names. The CSbyProgMunis
# report renders each program label in a SPAN with id lblPROGRAM_RowN, and
# the corresponding amount in lblCS_ESTIMATE_RowN.
RECEIPT_FIELDS = {
    "ch70": ("chapter 70",),
    "school_transport": ("school transportation",),
    "charter_reimb": ("charter tuition reimbursement", "charter school reimbursement"),
    "school_choice_recv": ("school choice receiving tuition",),
    "ugga": ("unrestricted general government aid",),
    "veterans": ("veterans benefits",),
    "exempt_vbs_eld": ("exempt: vets, blind, surviving sp", "exemptions"),
    "public_libs": ("public libraries",),
    "regional_libs": ("regional libraries",),
    "state_owned_land": ("state-owned land", "state owned land"),
    "smart_growth": ("smart growth", "chapter 40r"),
}

CHARGE_FIELDS = {
    "mbta_charge": ("mbta",),
    "charter_send": ("charter school sending tuition",),
    "school_choice_send": ("school choice sending tuition",),
    "mapc_charge": ("metropolitan area planning council", "mapc"),
    "mosquito_charge": ("mosquito control",),
}

PROGRAM_RE = re.compile(r'<SPAN [^>]*id="lblPROGRAM_Row\d+"[^>]*>([^<]+)</SPAN>', re.I)
AMOUNT_RE = re.compile(r'<SPAN[^>]*id="lblCS_ESTIMATE_Row\d+"[^>]*>([^<]+)</SPAN>', re.I)
TOTAL_RECEIPTS_RE = re.compile(r'TotReceipts.*?<SPAN[^>]*>([\d,]+)</SPAN>', re.I | re.S)
TOTAL_CHARGES_RE = re.compile(r'TOTAL ESTIMATED CHARGES.*?<SPAN[^>]*>([\d,]+)</SPAN>', re.I | re.S)


def fetch(url):
    """GET url and return body text. Falls back to curl -k on SSL errors."""
    req = Request(url, headers={"User-Agent": "marbleheaddata.org build_cherry_sheet_csv"})
    try:
        with urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
            return r.read().decode("utf-8", errors="replace")
    except (URLError, ssl.SSLError):
        # macOS Python often misses the LetsEncrypt root for state.ma.us.
        out = subprocess.run(["curl", "-sk", url], capture_output=True, text=True, timeout=30)
        return out.stdout


def parse_amount(s):
    s = (s or "").replace(",", "").replace("$", "").strip()
    if not s or s in ("-", "N/A"):
        return 0
    try:
        return int(round(float(s)))
    except ValueError:
        return 0


def field_for(name, mapping):
    n = name.lower().strip()
    for key, needles in mapping.items():
        for needle in needles:
            if needle in n:
                return key
    return None


def parse_cherry_sheet(html):
    """Return a dict of column to integer dollars for one town HTML."""
    programs = PROGRAM_RE.findall(html)
    amounts = AMOUNT_RE.findall(html)
    receipts = {k: 0 for k in RECEIPT_FIELDS}
    charges = {k: 0 for k in CHARGE_FIELDS}
    for label, amount in zip(programs, amounts):
        v = parse_amount(amount)
        rk = field_for(label, RECEIPT_FIELDS)
        if rk:
            receipts[rk] += v
            continue
        ck = field_for(label, CHARGE_FIELDS)
        if ck:
            charges[ck] += v
    tr_match = TOTAL_RECEIPTS_RE.search(html)
    tc_match = TOTAL_CHARGES_RE.search(html)
    total_receipts = parse_amount(tr_match.group(1)) if tr_match else sum(receipts.values())
    total_charges = parse_amount(tc_match.group(1)) if tc_match else sum(charges.values())
    out = {}
    out.update(receipts)
    out["total_receipts"] = total_receipts
    out.update(charges)
    out["total_charges"] = total_charges
    return out


def load_populations():
    pops = {}
    with open(POP_CSV, newline="") as f:
        for row in csv.DictReader(f):
            pops[row["municipality"].strip()] = int(row["population"])
    return pops


def per_capita(amount, pop):
    if not pop:
        return 0
    return int(round(amount / pop))


HEADERS = [
    "muni", "dor_code", "population",
    "ch70", "school_transport", "charter_reimb", "school_choice_recv",
    "ugga", "veterans", "exempt_vbs_eld", "public_libs", "regional_libs",
    "state_owned_land", "smart_growth", "total_receipts",
    "mbta_charge", "charter_send", "school_choice_send",
    "mapc_charge", "mosquito_charge", "total_charges",
    "net_aid", "net_per_capita", "ch70_per_capita", "ugga_per_capita",
]


def main():
    pops = load_populations()
    rows = []
    for name, code in TOWNS:
        pop = pops.get(name)
        if pop is None:
            print(f"WARN: no population for {name}", file=sys.stderr)
            continue
        url = URL_TEMPLATE.format(code=code)
        print(f"Fetching {name} ({code})...", flush=True)
        html = fetch(url)
        parsed = parse_cherry_sheet(html)
        net = parsed["total_receipts"] - parsed["total_charges"]
        row = {
            "muni": name, "dor_code": code, "population": pop,
            "ch70": parsed["ch70"],
            "school_transport": parsed["school_transport"],
            "charter_reimb": parsed["charter_reimb"],
            "school_choice_recv": parsed["school_choice_recv"],
            "ugga": parsed["ugga"],
            "veterans": parsed["veterans"],
            "exempt_vbs_eld": parsed["exempt_vbs_eld"],
            "public_libs": parsed["public_libs"],
            "regional_libs": parsed["regional_libs"],
            "state_owned_land": parsed["state_owned_land"],
            "smart_growth": parsed["smart_growth"],
            "total_receipts": parsed["total_receipts"],
            "mbta_charge": parsed["mbta_charge"],
            "charter_send": parsed["charter_send"],
            "school_choice_send": parsed["school_choice_send"],
            "mapc_charge": parsed["mapc_charge"],
            "mosquito_charge": parsed["mosquito_charge"],
            "total_charges": parsed["total_charges"],
            "net_aid": net,
            "net_per_capita": per_capita(net, pop),
            "ch70_per_capita": per_capita(parsed["ch70"], pop),
            "ugga_per_capita": per_capita(parsed["ugga"], pop),
        }
        rows.append(row)
        time.sleep(0.25)  # be polite to DLS
    rows.sort(key=lambda r: r["muni"])
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"Wrote {OUT_CSV} with {len(rows)} rows")


if __name__ == "__main__":
    main()
