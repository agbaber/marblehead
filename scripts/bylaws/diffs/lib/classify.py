"""Classify a stream of PDF characters into an amendment diff.

The Annual Town Reports mark changes as "underline and bold new, strikethrough
removed". So at the character level:
  - bold font              -> added (new) text
  - struck (not bold)      -> removed text
  - otherwise              -> unchanged
Adjacent characters with the same op are merged into tokens. Proven against the
2024 Section 13-10 fee change (see the phase-2 spec).
"""


def classify(chars):
    """chars: list of {text, bold, struck}. Returns {tokens, before, after}."""
    tokens = []
    for c in chars:
        if c["bold"]:
            op = "+"
        elif c["struck"]:
            op = "-"
        else:
            op = " "
        if tokens and tokens[-1]["op"] == op:
            tokens[-1]["text"] += c["text"]
        else:
            tokens.append({"op": op, "text": c["text"]})

    before = "".join(t["text"] for t in tokens if t["op"] in (" ", "-"))
    after = "".join(t["text"] for t in tokens if t["op"] in (" ", "+"))
    return {"tokens": tokens, "before": before, "after": after}
