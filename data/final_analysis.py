"""Best estimate of trash spending per occupied housing unit.

For each town, sum:
  - Direct annual fee to resident (MSW)
  - Plus transfer-station access fee (MSW)
  - For property-tax-funded towns with curbside, ESTIMATE the trash share of
    Public Works using tip_fee × tons × 2.5 (industry rule of thumb that
    full curbside total cost is ~2-3x raw disposal cost). This is a STAFF
    estimate not a primary source -- flagged as such.
"""
import csv, statistics

rows = []
with open('data/trash_analysis/combined.csv') as f:
    for r in csv.DictReader(f):
        for k in ('total_hh','pub_works','pub_works_per_hh','annual_fee','xfer_fee','tip_fee','trash_tons','disposal_cost_per_hh'):
            try: r[k] = float(r[k]) if r[k] else 0
            except: r[k] = 0
        rows.append(r)

# Best-estimate: direct billed fee for fee/PAYT towns,
# OR raw disposal cost (tip × tons / HH) as a floor for GF-funded towns.
for r in rows:
    hh = r['total_hh']
    direct = r['annual_fee'] + r['xfer_fee']
    disposal_per_hh = (r['tip_fee'] * r['trash_tons'] / hh) if hh and r['tip_fee'] > 0 else 0
    # Estimate full curbside cost at 2.5x disposal (a rough industry mult)
    est_curb_per_hh = disposal_per_hh * 2.5 if disposal_per_hh > 0 and 'urb' in (r['trash_type'] or '') else 0
    r['direct_billed_per_hh'] = direct
    r['disposal_only_per_hh'] = disposal_per_hh
    r['est_curb_total_per_hh'] = est_curb_per_hh
    # Composite: max of (direct billed) and (estimated curbside total)
    r['composite_per_hh'] = max(direct, est_curb_per_hh)

# === Top by direct billed ===
print('=== TOP 20 BY DIRECT BILLED FEE (annual+xfer) ===')
print(f'{"Rk":<3} {"Town":<25} {"Total":>8} {"Annual":>8} {"Xfer":>7} {"PAYT":>5} {"Type":<10}')
top_direct = sorted([r for r in rows if r['direct_billed_per_hh'] > 0], key=lambda r: -r['direct_billed_per_hh'])
for i, r in enumerate(top_direct[:20], 1):
    print(f'{i:<3} {r["municipality"]:<25} ${r["direct_billed_per_hh"]:>6,.0f}  ${r["annual_fee"]:>6,.0f}  ${r["xfer_fee"]:>5,.0f}   {r["payt_flag"]:>5} {(r["trash_type"] or "")[:10]:<10}')

# === Top by estimated curbside total ===
print('\n=== TOP 20 BY ESTIMATED CURBSIDE TOTAL (tip*tons*2.5 / HH; curbside towns only) ===')
top_curb = sorted([r for r in rows if r['est_curb_total_per_hh'] > 0], key=lambda r: -r['est_curb_total_per_hh'])
for i, r in enumerate(top_curb[:20], 1):
    print(f'{i:<3} {r["municipality"]:<25} ${r["est_curb_total_per_hh"]:>6,.0f}  TipFee=${r["tip_fee"]:>5,.0f}  Tons={r["trash_tons"]:>7,.0f}  HH={r["total_hh"]:>7,.0f}')

print('\n=== Distributions ===')
direct = [r['direct_billed_per_hh'] for r in rows if r['direct_billed_per_hh'] > 0]
print(f'Direct billed fees: N={len(direct)}, min=${min(direct):.0f}, median=${statistics.median(direct):.0f}, mean=${statistics.mean(direct):.0f}, max=${max(direct):.0f}')

curb = [r['est_curb_total_per_hh'] for r in rows if r['est_curb_total_per_hh'] > 0]
print(f'Est curb total per HH: N={len(curb)}, median=${statistics.median(curb):.0f}, mean=${statistics.mean(curb):.0f}, max=${max(curb):.0f}')

# Marblehead
mh = next((r for r in rows if r['municipality'] == 'Marblehead'), None)
if mh:
    print('\n=== MARBLEHEAD ===')
    print(f'  Direct billed: ${mh["direct_billed_per_hh"]:.0f}  (no annual or xfer fee)')
    print(f'  Disposal-only per HH (tip × tons / HH): ${mh["disposal_only_per_hh"]:.0f}')
    print(f'  Est curb total per HH (×2.5 mult): ${mh["est_curb_total_per_hh"]:.0f}')
    print(f'  Marblehead trash funded via property tax (general fund).')
    # Rank in est curb total
    rank = sum(1 for r in curb if r > mh['est_curb_total_per_hh']) + 1
    print(f'  Rank among est-curb-total estimate: {rank}/{len(curb)}')

print('\nWrote data/trash_analysis/combined.csv earlier; final analysis printed above.')
