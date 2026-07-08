"""Data-integrity tests for scripts/extract_mps_proposed_budget.mjs output."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CSV_PATH = REPO / 'data' / 'mps_proposed_budget_by_category.csv'

BUCKETS = {
    'Regular instruction', 'Special education', 'Student services',
    'Operations', 'Administration', 'Capital',
}

FY26_EXPECTED = {
    'Regular instruction': 32_074_012,
    'Special education': 6_604_709,
    'Student services': 2_834_375,
    'Operations': 5_342_717,
    'Administration': 1_704_489,
    'Capital': 50_900,
}

FY27_EXPECTED = {
    'Regular instruction': 33_303_548,
    'Special education': 6_361_889,
    'Student services': 2_979_030,
    'Operations': 5_571_271,
    'Administration': 1_748_279,
    'Capital': 51_918,
}


def load_rows():
    with CSV_PATH.open() as f:
        return list(csv.DictReader(f))


def test_csv_exists():
    assert CSV_PATH.exists(), (
        f"Run `node scripts/extract_mps_proposed_budget.mjs` before running tests. "
        f"Expected {CSV_PATH} to exist."
    )


def test_fy26_bucket_amounts_match_anchor_doc():
    rows = {(r['FY'], r['bucket']): int(r['amount']) for r in load_rows() if r['FY'] == '2026'}
    for bucket, expected in FY26_EXPECTED.items():
        assert ('2026', bucket) in rows, f"Missing FY26 bucket: {bucket}"
        assert rows[('2026', bucket)] == expected, (
            f"FY26 {bucket}: expected ${expected:,}, got ${rows[('2026', bucket)]:,}"
        )


def test_fy27_bucket_amounts_match_anchor_doc():
    rows = {(r['FY'], r['bucket']): int(r['amount']) for r in load_rows() if r['FY'] == '2027'}
    for bucket, expected in FY27_EXPECTED.items():
        assert ('2027', bucket) in rows, f"Missing FY27 bucket: {bucket}"
        assert rows[('2027', bucket)] == expected, (
            f"FY27 {bucket}: expected ${expected:,}, got ${rows[('2027', bucket)]:,}"
        )


def test_all_rows_have_valid_source_citation():
    for row in load_rows():
        assert row['source_packet_slug'], f"Row missing source_packet_slug: {row}"
        assert row['bucket'] in BUCKETS, f"Unknown bucket: {row['bucket']}"
        assert row['extraction_confidence'] in {'high', 'medium', 'low'}, (
            f"Bad confidence: {row['extraction_confidence']}"
        )


def test_bucket_sums_equal_pre_reduction_totals():
    """FY26 6-bucket sum = $48,611,202; FY27 = $50,015,935 (pre-reduction, per anchor doc)."""
    rows = load_rows()
    fy26_sum = sum(int(r['amount']) for r in rows if r['FY'] == '2026')
    fy27_sum = sum(int(r['amount']) for r in rows if r['FY'] == '2027')
    assert fy26_sum == 48_611_202, f"FY26 sum = ${fy26_sum:,}, expected $48,611,202"
    assert fy27_sum == 50_015_935, f"FY27 sum = ${fy27_sum:,}, expected $50,015,935"
