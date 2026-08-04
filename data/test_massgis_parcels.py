import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from massgis_parcels import FULL_COLS, PUBLIC_COLS, map_feature  # noqa: E402

# A real Marblehead feature (parcel 112-14-0, 5 Harbor View), with owner fields
# added to exercise de-identification.
SAMPLE = {
    "LOC_ID": "F_771234_3081234", "MAP_PAR_ID": "112-14-0", "PROP_ID": "641",
    "SITE_ADDR": "5  HARBOR VIEW", "CITY": "MARBLEHEAD", "ZIP": "01945",
    "USE_CODE": "101", "ZONING": "SR", "TOTAL_VAL": 1644100, "BLDG_VAL": 579800,
    "LAND_VAL": 1062800, "OTHER_VAL": 1500, "FY": 2025, "LOT_SIZE": 0.29,
    "LOT_UNITS": "A", "YEAR_BUILT": 1900, "STYLE": "OLD STYLE", "STORIES": "2",
    "NUM_ROOMS": 8, "UNITS": 1, "BLD_AREA": 2400, "RES_AREA": 2400,
    "LS_DATE": "20231130", "LS_PRICE": 3010000, "LS_BOOK": "41882", "LS_PAGE": "279",
    "OWNER1": "OWNER REDACTED", "OWN_ADDR": "5 HARBOR VIEW",
    "OWN_CITY": "MARBLEHEAD", "OWN_STATE": "MA", "OWN_ZIP": "01945",
}


def test_value_and_characteristic_mapping():
    r = map_feature(SAMPLE)
    assert r["map_par_id"] == "112-14-0"
    assert r["site_addr"] == "5 HARBOR VIEW"   # double space collapsed
    assert r["total_val"] == 1644100
    assert r["land_val"] == 1062800
    assert r["fy"] == 2025
    assert r["year_built"] == 1900
    assert r["style"] == "OLD STYLE"
    assert r["num_rooms"] == 8
    assert r["lot_size"] == 0.29
    assert r["zoning"] == "SR"
    assert r["use_code"] == "101"


def test_sale_date_normalized():
    r = map_feature(SAMPLE)
    assert r["ls_date"] == "2023-11-30"
    assert r["ls_price"] == 3010000


def test_owner_columns_excluded_from_public_schema():
    # The committed schema must not carry any owner/mailing field.
    for col in ("owner1", "own_addr", "own_city", "own_state", "own_zip"):
        assert col not in PUBLIC_COLS
        assert col in FULL_COLS
    r = map_feature(SAMPLE)
    assert r["owner1"] == "OWNER REDACTED"  # present in the parsed record


def test_missing_fields_become_blank_not_error():
    r = map_feature({"MAP_PAR_ID": "1-1-0"})
    assert r["map_par_id"] == "1-1-0"
    assert r["total_val"] == ""
    assert r["style"] == ""
    assert r["ls_date"] == ""
