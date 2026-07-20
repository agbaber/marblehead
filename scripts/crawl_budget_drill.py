#!/usr/bin/env python3
"""
Pre-fetch budget-portal cross-tab queries so the checkbook page can drill
into any Fund or Department without making live cross-origin API calls.

Source: https://townofmarblehead-ma-ob.budget.socrata.com/api/opex/chart_data.json
Fields: org1=Fund Group, org2=Fund, org3=Department, org4=Division,
        org5=Category, org6=Object.

For each Fund in the Budgeted Annual envelope: pull dept/category/object
breakdown.  For each Department: pull category/object/division breakdown.
Reads data/budget_actual_FY<N>.json (build_budget_actual.py) for the
rollup scaffolding and writes data/budget_drill_FY<N>.json.

Usage:
  scripts/crawl_budget_drill.py              # current fiscal year
  scripts/crawl_budget_drill.py --year 2026  # recrawl a prior FY
"""
import argparse, json, urllib.request, urllib.parse, time, sys, os, ssl
from datetime import UTC, datetime

import fylib

# macOS bundled Python often can't validate Socrata's chain via the system store.
# Build a context backed by certifi if available, otherwise fall back to unverified.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

BASE = 'https://townofmarblehead-ma-ob.budget.socrata.com/api/opex/chart_data.json'
ENVELOPE = 'BUDGETED ANNUAL FUNDS'

def fetch(year, child_entity, filters=None, retries=3):
    # `limit=100` forces the API to return all rows rather than truncating to 15.
    # Verified against Police x Professional Salary: 41 line items returned, summing
    # to the published $4.88M total.
    params = {'year': year, 'child_entity': child_entity, 'limit': 100}
    if filters:
        params.update(filters)
    url = BASE + '?' + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=15, context=SSL_CTX) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.0)
    return None

def norm(entities):
    return sorted(
        [{
            'name': r['key'],
            'revised_budget': round(r.get('total', 0) or 0, 2),
            'actual': round(r.get('secondary_total', 0) or 0, 2),
            'original_budget': round(r.get('tertiary_total', 0) or 0, 2),
        } for r in entities],
        key=lambda x: -x['revised_budget']
    )

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument('--year', type=int, default=fylib.current_fiscal_year(),
                    help='fiscal year to crawl (default: current fiscal year)')
    args = ap.parse_args()
    year = args.year
    label = fylib.fy_label(year)

    os.chdir(os.path.join(os.path.dirname(__file__), '..'))
    b = json.load(open(f'data/budget_actual_{label}.json'))

    drill = {
        'as_of': datetime.now(UTC).date().isoformat(),
        'fiscal_year': label,
        'envelope': ENVELOPE,
        'envelope_totals': b['totals']['budgeted_annual'],
        'by_fund': {},
        'by_department': {},
        'by_category': {},
        'by_division': {},
        # Line items: (Department, Category) -> list of object rows
        # Keyed as "DEPT||CATEGORY" since these are inherently two-axis.
        'by_dept_category': {},
        'by_fund_category': {},
    }

    DIMS_FROM_FUND = [
        ('by_department', 'org3'),
        ('by_category',   'org5'),
    ]
    DIMS_FROM_DEPT = [
        ('by_category',   'org5'),
        ('by_division',   'org4'),
    ]
    DIMS_FROM_CATEGORY = [
        ('by_fund',       'org2'),
        ('by_department', 'org3'),
    ]
    DIMS_FROM_DIVISION = [
        ('by_fund',       'org2'),
        ('by_department', 'org3'),
    ]

    # Line-item crawl scope: every (dept, category) and (fund, category) combo.
    # Only keep combos where both rollups have non-zero budget.
    dept_cat_combos = []
    fund_cat_combos = []
    for dept in b['by_department']:
        if (dept['revised_budget'] or 0) == 0: continue
        for cat in b['by_category']:
            if (cat['revised_budget'] or 0) == 0: continue
            dept_cat_combos.append((dept['name'], cat['name']))
    for fund in b['by_fund']:
        if (fund['revised_budget'] or 0) == 0: continue
        for cat in b['by_category']:
            if (cat['revised_budget'] or 0) == 0: continue
            fund_cat_combos.append((fund['name'], cat['name']))

    total_calls = (len(b['by_fund'])       * len(DIMS_FROM_FUND) +
                   len(b['by_department']) * len(DIMS_FROM_DEPT) +
                   len(b['by_category'])   * len(DIMS_FROM_CATEGORY) +
                   len(b['by_division'])   * len(DIMS_FROM_DIVISION) +
                   len(dept_cat_combos) +
                   len(fund_cat_combos))
    done = 0
    print(f'Will make {total_calls} API calls. ETA ~{total_calls * 0.4:.0f}s.')

    for fund in b['by_fund']:
        name = fund['name']
        drill['by_fund'][name] = {
            'rollup': {
                'revised_budget': fund['revised_budget'],
                'actual': fund['actual'],
                'original_budget': fund['original_budget'],
            },
        }
        for dim, child in DIMS_FROM_FUND:
            try:
                data = fetch(year, child, {'org1': ENVELOPE, 'org2': name})
                drill['by_fund'][name][dim] = norm(data.get('entities', []))
            except Exception as e:
                print(f'  ERR fund={name} dim={dim}: {e}', file=sys.stderr)
                drill['by_fund'][name][dim] = []
            done += 1
            if done % 5 == 0:
                print(f'  {done}/{total_calls} ...')
            time.sleep(0.25)

    for dept in b['by_department']:
        name = dept['name']
        drill['by_department'][name] = {
            'rollup': {
                'revised_budget': dept['revised_budget'],
                'actual': dept['actual'],
                'original_budget': dept['original_budget'],
            },
        }
        for dim, child in DIMS_FROM_DEPT:
            try:
                data = fetch(year, child, {'org1': ENVELOPE, 'org3': name})
                drill['by_department'][name][dim] = norm(data.get('entities', []))
            except Exception as e:
                print(f'  ERR dept={name} dim={dim}: {e}', file=sys.stderr)
                drill['by_department'][name][dim] = []
            done += 1
            if done % 10 == 0:
                print(f'  {done}/{total_calls} ...')
            time.sleep(0.25)

    for cat in b['by_category']:
        name = cat['name']
        drill['by_category'][name] = {
            'rollup': {
                'revised_budget': cat['revised_budget'],
                'actual': cat['actual'],
                'original_budget': cat['original_budget'],
            },
        }
        for dim, child in DIMS_FROM_CATEGORY:
            try:
                data = fetch(year, child, {'org1': ENVELOPE, 'org5': name})
                drill['by_category'][name][dim] = norm(data.get('entities', []))
            except Exception as e:
                print(f'  ERR cat={name} dim={dim}: {e}', file=sys.stderr)
                drill['by_category'][name][dim] = []
            done += 1
            if done % 10 == 0:
                print(f'  {done}/{total_calls} ...')
            time.sleep(0.25)

    for div in b['by_division']:
        name = div['name']
        drill['by_division'][name] = {
            'rollup': {
                'revised_budget': div['revised_budget'],
                'actual': div['actual'],
                'original_budget': div['original_budget'],
            },
        }
        for dim, child in DIMS_FROM_DIVISION:
            try:
                data = fetch(year, child, {'org1': ENVELOPE, 'org4': name})
                drill['by_division'][name][dim] = norm(data.get('entities', []))
            except Exception as e:
                print(f'  ERR div={name} dim={dim}: {e}', file=sys.stderr)
                drill['by_division'][name][dim] = []
            done += 1
            if done % 10 == 0:
                print(f'  {done}/{total_calls} ...')
            time.sleep(0.25)

    # Line items: Department x Category -> positions/object detail
    for dept, cat in dept_cat_combos:
        try:
            data = fetch(year, 'org6', {'org1': ENVELOPE, 'org3': dept, 'org5': cat})
            items = norm(data.get('entities', []))
            if items:  # only store non-empty combos
                drill['by_dept_category'][dept + '||' + cat] = items
        except Exception as e:
            print(f'  ERR dept_cat=({dept},{cat}): {e}', file=sys.stderr)
        done += 1
        if done % 25 == 0:
            print(f'  {done}/{total_calls} ...')
        time.sleep(0.15)

    # Line items: Fund x Category -> positions/object detail
    for fund, cat in fund_cat_combos:
        try:
            data = fetch(year, 'org6', {'org1': ENVELOPE, 'org2': fund, 'org5': cat})
            items = norm(data.get('entities', []))
            if items:
                drill['by_fund_category'][fund + '||' + cat] = items
        except Exception as e:
            print(f'  ERR fund_cat=({fund},{cat}): {e}', file=sys.stderr)
        done += 1
        if done % 25 == 0:
            print(f'  {done}/{total_calls} ...')
        time.sleep(0.15)

    out = f'data/budget_drill_{label}.json'
    with open(out, 'w') as f:
        json.dump(drill, f, indent=1)
    size_kb = os.path.getsize(out) / 1024
    print(f'\nWrote {out} ({size_kb:.0f} KB)')
    print(f'  {len(drill["by_fund"])} funds, {len(drill["by_department"])} departments, '
          f'{len(drill["by_category"])} categories, {len(drill["by_division"])} divisions, '
          f'{len(drill["by_dept_category"])} dept-cat combos, {len(drill["by_fund_category"])} fund-cat combos')

if __name__ == '__main__':
    main()
