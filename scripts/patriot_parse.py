#!/usr/bin/env python3
"""Parse one Patriot Properties summary-bottom.asp response into a record.

Pure function, no I/O. The returned dict's keys are the canonical column names
consumed by build_patriot_parcels.py. The owner/mailing fields are captured
here; dropping them from the published CSV is the build step's job.

Source page: https://marblehead.patriotproperties.com/summary-bottom.asp
"""
import re

_SEP = "\x00"


def _cells(html):
    """Flatten the HTML into a list of visible text cells (tag boundaries split)."""
    html = re.sub(r"(?is)<script.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", _SEP, html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    # Collapse whitespace WITHIN cells but keep cell separators.
    text = re.sub(r"[ \t\r\n]+", " ", text.replace(_SEP, "\x01"))
    return [c.strip() for c in text.split("\x01") if c.strip()]


def _norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def _after(cells, label, default=""):
    """First cell following the cell whose normalized text equals `label`."""
    for i in range(len(cells) - 1):
        if _norm(cells[i]) == label:
            return _norm(cells[i + 1])
    return default


def _to_int(s):
    s = re.sub(r"[^0-9-]", "", s or "")
    return int(s) if s not in ("", "-") else None


def _to_float(s):
    m = re.search(r"-?\d+(?:\.\d+)?", (s or "").replace(",", ""))
    return float(m.group()) if m else None


def parse_summary(html):
    cells = _cells(html)
    joined = " ".join(_norm(c) for c in cells)

    def ng(pat):
        m = re.search(pat, joined)
        return m.group(1).strip() if m else ""

    m = re.search(r"Card\s+\d+\s+of\s+(\d+)", joined)
    card_count = int(m.group(1)) if m else 1

    return {
        "parcel_id": _after(cells, "Parcel ID"),
        "old_parcel_id": _after(cells, "Old Parcel ID"),
        "address": _after(cells, "Location"),
        "owner": _after(cells, "Owner"),
        "mailing_address": _after(cells, "Address"),
        "zoning": _after(cells, "Zoning"),
        "sale_date": _after(cells, "Sale Date"),
        "book_page": _after(cells, "Legal Reference"),
        "sale_price": _to_int(ng(r"Sale\s*Price\s*([\d,]+)")),
        "assessment_fy": _to_int(_after(cells, "Year")),
        "building_value": _to_int(ng(r"Building\s*Value\s*([\d,]+)")),
        "extra_features_value": _to_int(ng(r"Xtra Features\s*Value\s*([\d,]+)")),
        "land_area_acres": _to_float(ng(r"Land\s*Area\s*([\d.]+)\s*acres")),
        "land_value": _to_int(ng(r"Land\s*Value\s*([\d,]+)")),
        "total_value": _to_int(ng(r"Total\s*Value\s*([\d,]+)")),
        "land_use": ng(r"classified as\s*([A-Z0-9 ]+?)\s*with a"),
        "style": ng(r"with a\(n\)\s*([A-Z0-9 ]+?)\s*style building"),
        "year_built": _to_int(ng(r"built about\s*(\d{4})")),
        "units": _to_int(ng(r"with\s*(\d+)\s*unit")),
        "rooms": _to_int(ng(r"(\d+)\s*total room")),
        "bedrooms": _to_int(ng(r"(\d+)\s*total bedroom")),
        "bathrooms": _to_int(ng(r"(\d+)\s*total bath")),
        "half_baths": _to_int(ng(r"(\d+)\s*total half bath")),
        "card_count": card_count,
    }
