#!/usr/bin/env python3
"""Fetch all Prop 2½ override/underride votes from MA DOR DLS Municipal Databank.

Uses curl with session cookies for proper ASPX pagination.
Outputs: data/statewide_overrides.csv
Source:  https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=votes.prop2_5.overrideunderride
"""

import csv
import re
import subprocess
import sys
import time
from html.parser import HTMLParser

BASE_URL = "https://dls-gw.dor.state.ma.us/reports/rdPage.aspx"
REPORT = "votes.prop2_5.overrideunderride"
COOKIE_JAR = "/tmp/dor_cookies.txt"
OUT_PATH = "data/statewide_overrides.csv"

HEADERS = [
    "dor_code", "municipality", "fiscal_year", "vote_date",
    "win_loss", "yes_votes", "no_votes", "vote_type",
    "department", "description", "amount"
]


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_td = self.in_table = False
        self.current_row = []
        self.current_cell = ""
        self.rows = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "table" and "tblProp2_5Votes" in d.get("id", ""):
            self.in_table = True
        if self.in_table and tag == "td":
            self.in_td = True
            self.current_cell = ""

    def handle_endtag(self, tag):
        if self.in_table and tag == "td":
            self.in_td = False
            self.current_row.append(self.current_cell.strip())
        if self.in_table and tag == "tr":
            if len(self.current_row) == len(HEADERS):
                self.rows.append(self.current_row)
            self.current_row = []
        if tag == "table" and self.in_table:
            self.in_table = False

    def handle_data(self, data):
        if self.in_td:
            self.current_cell += data


def curl_get(url):
    r = subprocess.run(
        ["curl", "-sk", "-c", COOKIE_JAR, "-b", COOKIE_JAR, url],
        capture_output=True, text=True, timeout=30
    )
    return r.stdout


def curl_post(url):
    r = subprocess.run(
        ["curl", "-sk", "-c", COOKIE_JAR, "-b", COOKIE_JAR, "-d", "", url],
        capture_output=True, text=True, timeout=30
    )
    return r.stdout


def parse_page(html_text):
    p = TableParser()
    p.feed(html_text)
    return p.rows


def main():
    import os
    try:
        os.remove(COOKIE_JAR)
    except FileNotFoundError:
        pass

    # Page 1: GET to establish session
    print("Fetching page 1 (establishing session)...", flush=True)
    html1 = curl_get(f"{BASE_URL}?rdReport={REPORT}")

    m = re.search(r"rdDataCache=(\d+)", html1)
    if not m:
        print("ERROR: Could not find rdDataCache", file=sys.stderr)
        sys.exit(1)
    cache_id = m.group(1)

    pm = re.search(r"Page\s+\d+\s+of\s+(\d+)", html1)
    total_pages = int(pm.group(1)) if pm else 94

    all_rows = parse_page(html1)
    print(f"Session {cache_id}, {total_pages} pages, page 1: {len(all_rows)} rows", flush=True)

    # Pages 2..N: POST with session cache
    for pg in range(2, total_pages + 1):
        url = (
            f"{BASE_URL}?rdReport={REPORT}"
            f"&tblProp2_5Votes-PageNr={pg}"
            f"&rdDataCache={cache_id}"
            f"&rdShowModes=&rdSort="
            f"&rdNewPageNr=True1"
            f"&rdRequestForwarding=Form"
        )
        try:
            html_pg = curl_post(url)
            rows = parse_page(html_pg)
            all_rows.extend(rows)
            if pg % 10 == 0:
                munis = set(r[1] for r in all_rows)
                print(f"  Page {pg}/{total_pages}: {len(rows)} rows "
                      f"(total: {len(all_rows)}, {len(munis)} towns)", flush=True)
        except Exception as e:
            print(f"  ERROR on page {pg}: {e}", file=sys.stderr)
        time.sleep(0.25)

    # Deduplicate
    seen = set()
    unique = []
    for row in all_rows:
        key = tuple(row)
        if key not in seen:
            seen.add(key)
            unique.append(row)

    munis = set(r[1] for r in unique)
    years = sorted(set(r[2] for r in unique))
    print(f"\nUnique rows: {len(unique)}")
    print(f"Municipalities: {len(munis)}")
    print(f"Years: {years[0]}-{years[-1]}")

    with open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADERS)
        for row in unique:
            w.writerow(row)

    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
