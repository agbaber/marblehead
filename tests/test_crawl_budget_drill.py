import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import crawl_budget_drill as cbd


def actuals(as_of="2026-10-04", police_actual=4880000.0):
    # Shape of data/budget_actual_FY<N>.json, trimmed to what matters.
    return {
        "as_of": as_of,
        "fiscal_year": "FY26",
        "totals": {"budgeted_annual": {"revised_budget": 127338097.88, "actual": 132757136.98}},
        "by_department": [{"name": "POLICE", "revised_budget": 5000000.0, "actual": police_actual}],
    }


def test_fingerprint_ignores_the_as_of_stamp():
    assert cbd.actuals_fingerprint(actuals(as_of="2026-10-04")) == cbd.actuals_fingerprint(actuals(as_of="2026-10-25"))


def test_fingerprint_changes_when_a_number_moves():
    assert cbd.actuals_fingerprint(actuals(police_actual=4880000.0)) != cbd.actuals_fingerprint(actuals(police_actual=4883000.0))


def test_fingerprint_is_a_sha256_hex_digest():
    fp = cbd.actuals_fingerprint(actuals())
    assert len(fp) == 64 and int(fp, 16) >= 0


def test_skip_only_when_the_existing_drill_recorded_the_same_fingerprint():
    fp = cbd.actuals_fingerprint(actuals())
    assert cbd.should_skip_crawl({"as_of": "2026-10-04", "actuals_sha256": fp}, fp) is True
    assert cbd.should_skip_crawl({"as_of": "2026-10-04", "actuals_sha256": "0" * 64}, fp) is False
    assert cbd.should_skip_crawl({"as_of": "2026-10-04"}, fp) is False  # drill from before fingerprints existed
    assert cbd.should_skip_crawl(None, fp) is False  # no drill file yet
