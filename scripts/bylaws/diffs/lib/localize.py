"""Trim an article block to the quoted bylaw change region and validate the diff.

The warrant block wraps the actual amended text in chrome we must exclude:
  Article 33 Amend Town Bylaw 13-10 ...              <- title (bold)
  To see if the Town will amend ... (underline and bold new, strikethrough removed).
  <<< the quoted bylaw passage with the real markup >>>
  Or take any action relative thereto. Sponsored by the Town Clerk.
  Voted Yes 556 No 144

The change region starts after the convention-marker parenthetical and ends at
the first tail sentinel.
"""
import re
from difflib import SequenceMatcher

# a parenthetical naming both an addition cue (new/underline/bold) and a removal
# cue (removed/omitted/cross/strike), in either order.
_ADD_CUE = r"(new|underlin|bold)"
_DEL_CUE = r"(remov|omit|cross|strike|struck)"
MARKER = re.compile(
    r"\([^()]*(?:" + _ADD_CUE + r"[^()]*" + _DEL_CUE + r"|" + _DEL_CUE + r"[^()]*" + _ADD_CUE + r")[^()]*\)",
    re.I | re.S)
END = re.compile(r"Or take any action|Sponsored by|Voted\s+Yes|^\s*Voted:", re.I | re.M)


def change_region(chars):
    """Return the char sublist between the convention marker and the tail sentinel."""
    text = "".join(c["text"] for c in chars)
    m = MARKER.search(text)
    start = m.end() if m else 0
    tail = END.search(text, start)
    end = tail.start() if tail else len(text)
    region = chars[start:end]
    # strip leading/trailing whitespace chars
    while region and region[0]["text"].isspace():
        region = region[1:]
    while region and region[-1]["text"].isspace():
        region = region[:-1]
    return region


def _norm(s):
    return re.sub(r"\s+", " ", s).strip()


# tokens that are page furniture / cross-references, not real added language.
FURNITURE_TOK = re.compile(
    r"^(TABLE OF CONTENTS|Select Board|Town Clerk|Town Meeting|Annual Town Meeting|"
    r"Finance Committee|Article \d+|\d{1,4})$", re.I)  # NB: no length catch-all — it ate "$20"


def _substantive_adds(tokens):
    out = []
    for t in tokens:
        if t["op"] != "+":
            continue
        a = _norm(t["text"])
        if len(a.replace("$", "").strip()) < 2:
            continue
        if FURNITURE_TOK.match(a):   # drop leaked headers / page numbers / bare years
            continue
        out.append(a)
    return out


def validate(tokens, section_body):
    """A diff is trustworthy when every *substantive* ADDED token (excluding leaked
    page furniture) appears in the current codified section text — i.e. the new
    wording really is today's law. Robust to reassembly noise in the unchanged run,
    which we don't rely on."""
    body = _norm(section_body).lower()
    added = _substantive_adds(tokens)
    if not added:
        return False, "no substantive additions to verify"
    missing = [a for a in added if a.lower() not in body]
    if missing:
        return False, f"{len(missing)}/{len(added)} additions not in current text: {missing[:2]}"
    return True, f"all {len(added)} additions present in current § text"
