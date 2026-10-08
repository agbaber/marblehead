from classify import classify


def ch(text, bold=False, struck=False):
    return [{"text": t, "bold": bold, "struck": struck} for t in text]


def stream(*parts):
    out = []
    for text, bold, struck in parts:
        out += ch(text, bold, struck)
    return out


def test_fee_change_matches_ground_truth():
    # "license fee of $15 $20" — $15 struck (old), $20 bold (new)
    chars = stream(
        ("license fee of ", False, False),
        ("$15", False, True),
        ("$20", True, False),
    )
    r = classify(chars)
    assert r["tokens"] == [
        {"op": " ", "text": "license fee of "},
        {"op": "-", "text": "$15"},
        {"op": "+", "text": "$20"},
    ]
    assert r["before"] == "license fee of $15"
    assert r["after"] == "license fee of $20"


def test_bold_wins_over_strike():
    # new text is bold AND underlined; underline can read as a strike — bold wins.
    r = classify(stream(("$25", True, True)))
    assert r["tokens"] == [{"op": "+", "text": "$25"}]
    assert r["before"] == ""
    assert r["after"] == "$25"


def test_unchanged_only():
    r = classify(stream(("no changes here", False, False)))
    assert r["tokens"] == [{"op": " ", "text": "no changes here"}]
    assert r["before"] == r["after"] == "no changes here"
