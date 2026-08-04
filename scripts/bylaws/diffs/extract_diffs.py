"""Reconstruct validated word-level diffs for the 2017-2024 bylaw amendments.

For each diff-eligible amendment, pull its warrant block from the year's report
PDF, trim to the change region, classify chars (bold=added, strike=removed), and
keep the diff only if every added token appears in the current codified section.
Writes data/bylaws-history/diffs.jsonl (+ .rejects.jsonl) and a coverage report.
"""
import sys, json, subprocess, re, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import pdfplumber
from pdfblock import locate_articles, article_block_at
from localize import change_region, validate
from classify import classify
from collections import defaultdict

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
AMEND = os.path.join(ROOT, "data/bylaws-history/amendments.jsonl")
IDX = os.path.join(ROOT, "data/bylaws-history/section-index.json")
BYLAWS = os.path.join(ROOT, "data/bylaws-history/bylaws")
PDFS = os.path.join(ROOT, "data/bylaws-history/raw/pdfs")
OUT = os.path.join(ROOT, "data/bylaws-history/diffs.jsonl")
REJ = os.path.join(ROOT, "data/bylaws-history/diffs.rejects.jsonl")

idx = json.load(open(IDX))
_md = {}
def sec_body(ref):
    meta = idx.get(ref)
    if not meta:
        return ""
    f = meta["file"]
    if f not in _md:
        _md[f] = open(os.path.join(BYLAWS, f)).read()
    m = re.search(r"## § " + re.escape(ref) + r" .*?\n(.*?)(?=\n## |\Z)", _md[f], re.S)
    return m.group(1) if m else ""

records = [json.loads(l) for l in open(AMEND)]
eligible = [r for r in records if 2017 <= int(r["meeting"]["date"][:4]) <= 2024]
by_year = defaultdict(list)
for r in eligible:
    by_year[r["meeting"]["date"][:4]].append(r)

diffs, rejects = [], []
covered = set()
outf = open(OUT, "w"); rejf = open(REJ, "w")  # write incrementally so partial runs persist
for year in sorted(by_year):
    with pdfplumber.open(os.path.join(PDFS, f"{year}.pdf")) as pdf:
        located = locate_articles(pdf, [r["article"] for r in by_year[year]])
        for r in by_year[year]:
            art = r["article"]
            key = f'{r["meeting"]["date"]}#{art}'
            block = article_block_at(pdf, art, located.get(art, []))
            if not block:
                rec = {"key": key, "reason": "no styled warrant block found"}
                rejects.append(rec); rejf.write(json.dumps(rec) + "\n"); rejf.flush(); continue
            cl = classify(change_region(block))
            for ref in r["affects"]:
                ok, why = validate(cl["tokens"], sec_body(ref))
                if ok:
                    rec = {"date": r["meeting"]["date"], "article": art, "section": ref,
                           "before": cl["before"], "after": cl["after"],
                           "tokens": cl["tokens"], "source": f"Annual-Report-{year}.pdf"}
                    diffs.append(rec); outf.write(json.dumps(rec) + "\n"); outf.flush()
                    covered.add(key)
                else:
                    rec = {"key": key, "section": ref, "reason": why}
                    rejects.append(rec); rejf.write(json.dumps(rec) + "\n"); rejf.flush()
    print(f"  {year}: {len([d for d in diffs if d['date'].startswith(year)])} diffs so far")
outf.close(); rejf.close()

print(f"eligible amendments (2017-2024): {len(eligible)}")
print(f"amendments with >=1 validated diff: {len(covered)}")
print(f"validated section diffs written: {len(diffs)}")
print(f"rejected (logged): {len(rejects)}")
print("\ncovered:", ", ".join(sorted(covered)))
