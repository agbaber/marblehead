"""Version-chaining validation of raw diffs.

A superseded edit's added text is no longer in the *current* codified section, so
validating against current text alone rejects it. But a later amendment to the
same section quoted the then-current text (which still contained the earlier
addition) as its strikethrough/unchanged run. So we validate each amendment's
added tokens against an expanded corpus:

    current section text  +  the before-text of every LATER amendment to that section

An addition present anywhere in that corpus is confirmed real. This recovers
edits that a subsequent amendment overwrote, without fragile intermediate-state
reconstruction. Writes data/bylaws-history/diffs.jsonl (+ .rejects.jsonl).
"""
import sys, json, subprocess, re, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
from localize import _substantive_adds, _norm
from difflib import SequenceMatcher
from collections import defaultdict

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
RAW = os.path.join(ROOT, "data/bylaws-history/diffs.raw.jsonl")
IDX = os.path.join(ROOT, "data/bylaws-history/section-index.json")
BYLAWS = os.path.join(ROOT, "data/bylaws-history/bylaws")
OUT = os.path.join(ROOT, "data/bylaws-history/diffs.jsonl")
REJ = os.path.join(ROOT, "data/bylaws-history/diffs.rejects.jsonl")

idx = json.load(open(IDX))
_md = {}
def current_text(ref):
    meta = idx.get(ref)
    if not meta:
        return ""
    f = meta["file"]
    if f not in _md:
        _md[f] = open(os.path.join(BYLAWS, f)).read()
    m = re.search(r"## § " + re.escape(ref) + r" .*?\n(.*?)(?=\n## |\Z)", _md[f], re.S)
    return _norm(m.group(1)) if m else ""

def present(tok, hay):
    tok = tok.lower()
    if tok in hay:
        return True
    w = len(tok)
    for i in range(0, max(1, len(hay) - w + 1), 3):
        if SequenceMatcher(None, tok, hay[i:i + w]).ratio() >= 0.9:
            return True
    return False

raw = [json.loads(l) for l in open(RAW)]
by_section = defaultdict(list)
for d in raw:
    by_section[d["section"]].append(d)
for ref in by_section:
    by_section[ref].sort(key=lambda d: d["date"])  # oldest -> newest

diffs, rejects = [], []
for ref, edits in by_section.items():
    cur = current_text(ref).lower()
    for i, d in enumerate(edits):
        # corpus = current text + before-text of all LATER same-section amendments
        later_befores = " ".join(_norm(e["before"]).lower() for e in edits[i + 1:])
        corpus = cur + " " + later_befores
        added = _substantive_adds(d["tokens"])
        if not added:
            rejects.append({"key": f'{d["date"]}#{d["article"]}', "section": ref,
                            "reason": "no substantive additions"}); continue
        missing = [a for a in added if not present(a.lower(), corpus)]
        if missing:
            rejects.append({"key": f'{d["date"]}#{d["article"]}', "section": ref,
                            "reason": f"{len(missing)}/{len(added)} additions unverifiable",
                            "missing": missing[:2]})
        else:
            via = "current text" if all(present(a.lower(), cur) for a in added) else "later amendment (chained)"
            diffs.append({**d, "verified_via": via})

with open(OUT, "w") as f:
    for d in diffs:
        f.write(json.dumps(d) + "\n")
with open(REJ, "w") as f:
    for r in rejects:
        f.write(json.dumps(r) + "\n")

cov = sorted(set(f'{d["date"]}#{d["article"]}' for d in diffs))
chained = sum(1 for d in diffs if d["verified_via"].startswith("later"))
print(f"raw section diffs: {len(raw)}")
print(f"validated section diffs: {len(diffs)}  ({chained} via version-chaining)")
print(f"amendments covered: {len(cov)}")
print(f"rejected: {len(rejects)}")
print("\ncovered:", ", ".join(cov))
