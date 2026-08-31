"""Reconstruct RAW word-level diffs for the 2017-2024 bylaw amendments.

For each diff-eligible amendment, pull its warrant block from the year's report
PDF, trim to the change region, classify chars (bold=added, strike=removed), and
emit one raw diff per affected section (before/after/tokens) with NO validation.
Validation happens in chain_validate.py, which checks each edit against the
current text OR a later same-section amendment's before-text (version-chaining).
Writes data/bylaws-history/diffs.raw.jsonl.
"""
import sys, json, subprocess, re, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import pdfplumber
from pdfblock import locate_articles, article_block_at
from localize import change_region
from classify import classify
from collections import defaultdict

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
AMEND = os.path.join(ROOT, "data/bylaws-history/amendments.jsonl")
IDX = os.path.join(ROOT, "data/bylaws-history/section-index.json")
BYLAWS = os.path.join(ROOT, "data/bylaws-history/bylaws")
PDFS = os.path.join(ROOT, "data/bylaws-history/raw/pdfs")
RAW = os.path.join(ROOT, "data/bylaws-history/diffs.raw.jsonl")

records = [json.loads(l) for l in open(AMEND)]
eligible = [r for r in records if 2017 <= int(r["meeting"]["date"][:4]) <= 2024]
by_year = defaultdict(list)
for r in eligible:
    by_year[r["meeting"]["date"][:4]].append(r)

raw = []
rawf = open(RAW, "w")  # write incrementally so partial runs persist
for year in sorted(by_year):
    with pdfplumber.open(os.path.join(PDFS, f"{year}.pdf")) as pdf:
        located = locate_articles(pdf, [r["article"] for r in by_year[year]])
        for r in by_year[year]:
            art = r["article"]
            block = article_block_at(pdf, art, located.get(art, []))
            if not block:
                continue  # no styled markup for this article
            cl = classify(change_region(block))
            has_change = any(t["op"] in ("+", "-") and t["text"].strip() for t in cl["tokens"])
            if not has_change:
                continue
            for ref in r["affects"]:
                rec = {"date": r["meeting"]["date"], "article": art, "section": ref,
                       "before": cl["before"], "after": cl["after"],
                       "tokens": cl["tokens"], "source": f"Annual-Report-{year}.pdf"}
                raw.append(rec); rawf.write(json.dumps(rec) + "\n"); rawf.flush()
    print(f"  {year}: {len([d for d in raw if d['date'].startswith(year)])} raw section diffs")
rawf.close()

amend_with_raw = len(set((d["date"], d["article"]) for d in raw))
print(f"\neligible amendments (2017-2024): {len(eligible)}")
print(f"amendments with a raw diff: {amend_with_raw}")
print(f"raw section diffs written: {len(raw)}  -> {RAW}")
print("next: chain_validate.py")
