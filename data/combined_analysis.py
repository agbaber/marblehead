"""Combine MassDEP MSW + DLS Schedule A Public Works to estimate per-household
trash cost across all 351 MA municipalities.

Three signals per town:
  (A) Direct annual fee from MSW survey  -- floor; what HH writes a check for
  (B) Public Works ÷ households           -- upper bound; lumps trash with
                                            snow/ice/streets/engineering
  (C) tip_fee × tons ÷ households         -- pure disposal cost (excl labor),
                                            useful as a sanity check
"""
import csv, openpyxl

# === MSW survey ===
wb = openpyxl.load_workbook('data/trash_analysis/2024_MSW_survey.xlsx', data_only=True)
ws = wb['Final']
COL = {
    'muni':1,'total_hh':3,'hh_trash':4,'trash_type':6,
    'fund_pt':19,'fund_fee':20,'fund_xfer':21,'fund_pv':22,'fund_payt':23,
    'annual_fee':24,'xfer_fee':25,'pv_fee':26,'payt':27,
    'trash_tons':56,'tip_fee':64,
}
def yes(v):
    if v is None: return False
    return str(v).strip().lower() in ('y','yes','true','1')
def num(v):
    if v is None or v == '': return None
    if isinstance(v,(int,float)): return float(v)
    s = str(v).replace(',','').replace('$','').strip()
    try: return float(s)
    except: return None

msw = {}
for r in range(5, ws.max_row+1):
    name = ws.cell(r, COL['muni']).value
    if not name: continue
    msw[name.strip()] = {
        'total_hh': num(ws.cell(r, COL['total_hh']).value),
        'hh_trash': num(ws.cell(r, COL['hh_trash']).value),
        'trash_type': ws.cell(r, COL['trash_type']).value,
        'fund_pt': yes(ws.cell(r, COL['fund_pt']).value),
        'fund_fee': yes(ws.cell(r, COL['fund_fee']).value),
        'fund_xfer': yes(ws.cell(r, COL['fund_xfer']).value),
        'fund_pv': yes(ws.cell(r, COL['fund_pv']).value),
        'fund_payt': yes(ws.cell(r, COL['fund_payt']).value),
        'annual_fee': num(ws.cell(r, COL['annual_fee']).value) or 0,
        'xfer_fee': num(ws.cell(r, COL['xfer_fee']).value) or 0,
        'pv_fee': num(ws.cell(r, COL['pv_fee']).value) or 0,
        'payt': ws.cell(r, COL['payt']).value,
        'trash_tons': num(ws.cell(r, COL['trash_tons']).value) or 0,
        'tip_fee': num(ws.cell(r, COL['tip_fee']).value) or 0,
    }
print('MSW towns:', len(msw))

# === DLS Schedule A ===
wb2 = openpyxl.load_workbook('data/trash_analysis/schedA_FY2024_expenditures.xlsx', data_only=True)
ws2 = wb2['Sheet1']
dls = {}
for r in range(2, ws2.max_row+1):
    name = ws2.cell(r, 2).value
    if not name: continue
    dls[name.strip()] = {
        'gen_govt': ws2.cell(r, 4).value or 0,
        'pub_safety': ws2.cell(r, 5).value or 0,
        'education': ws2.cell(r, 6).value or 0,
        'pub_works': ws2.cell(r, 7).value or 0,
        'human_svc': ws2.cell(r, 8).value or 0,
        'culture': ws2.cell(r, 9).value or 0,
        'fixed_costs': ws2.cell(r, 10).value or 0,
        'intergov': ws2.cell(r, 11).value or 0,
        'other': ws2.cell(r, 12).value or 0,
        'debt': ws2.cell(r, 13).value or 0,
        'total': ws2.cell(r, 14).value or 0,
    }
print('DLS towns:', len(dls))
print('Overlap (MSW & DLS):', len(set(msw) & set(dls)))
# Show mismatches
only_msw = set(msw) - set(dls)
only_dls = set(dls) - set(msw)
print('Only in MSW:', sorted(only_msw)[:10])
print('Only in DLS:', sorted(only_dls)[:10])

# === Combined per-household calculation ===
rows = []
for name in sorted(set(msw) | set(dls)):
    m = msw.get(name, {})
    d = dls.get(name, {})
    hh = m.get('total_hh') or 0
    pw = d.get('pub_works') or 0
    tons = m.get('trash_tons') or 0
    tip = m.get('tip_fee') or 0

    fee_total = (m.get('annual_fee') or 0) + (m.get('xfer_fee') or 0)
    pw_per_hh = pw / hh if hh else None
    disposal_per_hh = (tip * tons) / hh if hh else None  # raw disposal $ per HH

    rows.append({
        'municipality': name,
        'total_hh': hh,
        'pub_works': pw,
        'pub_works_per_hh': pw_per_hh,
        'trash_type': m.get('trash_type', ''),
        'annual_fee': m.get('annual_fee', 0),
        'xfer_fee': m.get('xfer_fee', 0),
        'payt_flag': 'Y' if m.get('fund_payt') else 'N',
        'tip_fee': tip,
        'trash_tons': tons,
        'disposal_cost_per_hh': disposal_per_hh,
        'fund_property_tax': 'Y' if m.get('fund_pt') else 'N',
    })

# Save full table
with open('data/trash_analysis/combined.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

# === ANSWER SECTION ===
import statistics

print('\n#### MAX ANNUAL TRASH FEE (direct billed) ####')
fee_rows = sorted([r for r in rows if r['annual_fee'] > 0], key=lambda r: -r['annual_fee'])
print(f'{"Rank":<5} {"Town":<25} {"AnnualFee":>10} {"XferFee":>8} {"PAYT":>5} {"Tons":>8} {"TipFee":>7}')
for i, r in enumerate(fee_rows[:25], 1):
    print(f'{i:<5} {r["municipality"]:<25} ${r["annual_fee"]:>8,.0f} ${r["xfer_fee"]:>6,.0f}   {r["payt_flag"]:>5} {r["trash_tons"]:>8,.0f} ${r["tip_fee"]:>5,.0f}')

print('\n#### MAX PUBLIC WORKS PER HOUSEHOLD (upper bound for trash share) ####')
pwh = sorted([r for r in rows if r['pub_works_per_hh']], key=lambda r: -r['pub_works_per_hh'])
print(f'{"Rank":<5} {"Town":<25} {"PW/HH":>10} {"PW":>14} {"HH":>10} {"Type":<12} {"PAYT":>5}')
for i, r in enumerate(pwh[:25], 1):
    print(f'{i:<5} {r["municipality"]:<25} ${r["pub_works_per_hh"]:>8,.0f}  ${r["pub_works"]:>12,.0f} {r["total_hh"]:>10,.0f}  {(r["trash_type"] or "")[:12]:<12}  {r["payt_flag"]:>5}')

print('\n#### DISTRIBUTION OF PW/HH ####')
vals = [r['pub_works_per_hh'] for r in rows if r['pub_works_per_hh']]
print(f'  N={len(vals)}, median=${statistics.median(vals):,.0f}, mean=${statistics.mean(vals):,.0f}')
print(f'  10th pct = ${statistics.quantiles(vals, n=10)[0]:,.0f}')
print(f'  25th pct = ${statistics.quantiles(vals, n=4)[0]:,.0f}')
print(f'  75th pct = ${statistics.quantiles(vals, n=4)[2]:,.0f}')
print(f'  90th pct = ${statistics.quantiles(vals, n=10)[8]:,.0f}')

print('\n#### DISTRIBUTION OF ANNUAL FEES (only towns with a fee > 0) ####')
fees = [r['annual_fee'] for r in rows if r['annual_fee'] > 0]
print(f'  N={len(fees)}, median=${statistics.median(fees):,.0f}, mean=${statistics.mean(fees):,.0f}, max=${max(fees):,.0f}')

print('\n#### BOTTOM 20 BY PW/HH ####')
print(f'{"Rank":<5} {"Town":<25} {"PW/HH":>10} {"Type":<12}')
for i, r in enumerate(reversed(pwh[-20:]), 1):
    print(f'{i:<5} {r["municipality"]:<25} ${r["pub_works_per_hh"]:>8,.0f}  {(r["trash_type"] or "")[:12]:<12}')

# Marblehead position
def rank(rows_sorted, key):
    for i, r in enumerate(rows_sorted, 1):
        if r['municipality'] == 'Marblehead':
            return i, r
    return None, None

print('\n#### MARBLEHEAD ####')
r_pwh, mh = rank(pwh, 'pub_works_per_hh')
print(f'  Marblehead PW/HH rank: {r_pwh}/{len(pwh)}')
if mh:
    print(f'    Public Works total: ${mh["pub_works"]:,.0f}')
    print(f'    Households (MSW):   {mh["total_hh"]:,.0f}')
    print(f'    PW/HH:              ${mh["pub_works_per_hh"]:,.0f}')
    print(f'    Annual fee:         ${mh["annual_fee"]:,.0f}')
    print(f'    Tip fee:            ${mh["tip_fee"]:,.0f}')
    print(f'    Trash tons:         {mh["trash_tons"]:,.0f}')
    print(f'    PAYT?               {mh["payt_flag"]}')
    print(f'    Trash type:         {mh["trash_type"]}')
    print(f'    Funded by property tax? {mh["fund_property_tax"]}')

print('\nWrote data/trash_analysis/combined.csv ({} rows)'.format(len(rows)))
