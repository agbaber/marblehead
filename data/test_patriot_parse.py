import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from patriot_parse import parse_summary  # noqa: E402

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "patriot_summary_sample.html"


def _rec():
    return parse_summary(FIXTURE.read_text(encoding="latin-1"))


def test_identifiers_and_location():
    r = _rec()
    assert r["parcel_id"] == "112 14 0"
    assert r["address"] == "5 HARBOR VIEW"
    assert r["zoning"] == "SR"
    assert r["card_count"] == 1


def test_assessment_values_are_numeric():
    r = _rec()
    assert r["assessment_fy"] == 2026
    assert r["building_value"] == 811300
    assert r["extra_features_value"] == 1500
    assert r["land_value"] == 1190400
    assert r["total_value"] == 2003200
    assert r["land_area_acres"] == 0.290


def test_characteristics_and_sale():
    r = _rec()
    assert r["land_use"] == "ONE FAM"
    assert r["style"] == "OLD STYLE"
    assert r["year_built"] == 1900
    assert r["units"] == 1
    assert r["rooms"] == 8
    assert r["bedrooms"] == 4
    assert r["bathrooms"] == 2
    assert r["half_baths"] == 1
    assert r["sale_date"] == "11/30/2023"
    assert r["sale_price"] == 3010000
    assert r["book_page"] == "41882-279"


def test_owner_present_in_full_record_only():
    # parse_summary captures owner/mailing; the BUILD step drops them from the
    # committed CSV. Here we only assert they are present in the parsed record.
    r = _rec()
    assert "owner" in r
    assert "mailing_address" in r
