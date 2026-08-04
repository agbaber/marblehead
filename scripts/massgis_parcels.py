#!/usr/bin/env python3
"""Map a MassGIS Standardized Assessors' Parcel feature to a flat record.

Pure functions, no I/O. PUBLIC_COLS is the committed, de-identified schema;
FULL_COLS adds owner/mailing columns kept only in the gitignored full CSV.

Source layer: Massachusetts_Property_Tax_Parcels FeatureServer/0 (MassGIS).
"""
import re

# Committed, de-identified columns (no owner / mailing).
PUBLIC_COLS = [
    "loc_id", "map_par_id", "prop_id", "site_addr", "city", "zip",
    "use_code", "zoning", "total_val", "bldg_val", "land_val", "other_val",
    "fy", "lot_size", "lot_units", "year_built", "style", "stories",
    "num_rooms", "units", "bld_area", "res_area",
    "ls_date", "ls_price", "ls_book", "ls_page",
]

# Owner/mailing columns: gitignored full CSV only (public record, kept local).
OWNER_COLS = ["owner1", "own_addr", "own_city", "own_state", "own_zip"]
FULL_COLS = PUBLIC_COLS + OWNER_COLS

# MassGIS attribute name -> our column name.
_FIELD_MAP = {
    "LOC_ID": "loc_id", "MAP_PAR_ID": "map_par_id", "PROP_ID": "prop_id",
    "SITE_ADDR": "site_addr", "CITY": "city", "ZIP": "zip",
    "USE_CODE": "use_code", "ZONING": "zoning", "TOTAL_VAL": "total_val",
    "BLDG_VAL": "bldg_val", "LAND_VAL": "land_val", "OTHER_VAL": "other_val",
    "FY": "fy", "LOT_SIZE": "lot_size", "LOT_UNITS": "lot_units",
    "YEAR_BUILT": "year_built", "STYLE": "style", "STORIES": "stories",
    "NUM_ROOMS": "num_rooms", "UNITS": "units", "BLD_AREA": "bld_area",
    "RES_AREA": "res_area", "LS_DATE": "ls_date", "LS_PRICE": "ls_price",
    "LS_BOOK": "ls_book", "LS_PAGE": "ls_page",
    "OWNER1": "owner1", "OWN_ADDR": "own_addr", "OWN_CITY": "own_city",
    "OWN_STATE": "own_state", "OWN_ZIP": "own_zip",
}

# Query exactly these attributes (keeps the payload small; excludes geometry).
OUT_FIELDS = ",".join(_FIELD_MAP.keys())


def _clean_str(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def _norm_date(v):
    """MassGIS LS_DATE is YYYYMMDD; emit YYYY-MM-DD (blank if not parseable)."""
    s = _clean_str(v)
    m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else s


def map_feature(attrs):
    """Map one ArcGIS feature's `attributes` dict to a FULL_COLS record."""
    row = {}
    for src, dst in _FIELD_MAP.items():
        v = attrs.get(src)
        if dst == "ls_date":
            row[dst] = _norm_date(v)
        elif dst == "site_addr":
            row[dst] = _clean_str(v)
        else:
            row[dst] = "" if v is None else (v if not isinstance(v, str) else _clean_str(v))
    return row
