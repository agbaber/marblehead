#!/usr/bin/env node
// Extract top-line schools budget category totals from Marblehead SC Feb
// meeting packets. Output: data/mps_proposed_budget_by_category.csv
//
// Columns: FY, bucket, amount, source_packet_slug, source_lines, extraction_confidence
//
// Extraction source: the anchor doc at
// docs/superpowers/plans/schools-budget-panel2-anchors.md maps packet TOTAL
// lines to the 6 target buckets. The mapping is manually verified per year;
// this script is a codification of that mapping, not a PDF parser. Later years
// (FY18-FY25) will add PACKETS entries with their own anchor rows.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('data/mps_proposed_budget_by_category.csv');

// Each PACKETS entry: one Feb budget packet supplying one or more FY columns.
const PACKETS = [
  {
    slug: 'agenda-and-materials-2-5-2026-fy27-budget-packet',
    fys_covered: [2026, 2027],
    rows: [
      // FY26 rows (level-funded pre-reduction, from anchor doc)
      { fy: 2026, bucket: 'Regular instruction', amount: 32074012, source_lines: '513,610,712,830,960', confidence: 'high' },
      { fy: 2026, bucket: 'Special education',   amount: 6604709,  source_lines: '1000,1178,1256',        confidence: 'high' },
      { fy: 2026, bucket: 'Student services',    amount: 2834375,  source_lines: '529,627,728,836,987,1038,1201', confidence: 'high' },
      { fy: 2026, bucket: 'Operations',          amount: 5342717,  source_lines: '536,633,734,842,996,1235',      confidence: 'high' },
      { fy: 2026, bucket: 'Administration',      amount: 1704489,  source_lines: '1098',                          confidence: 'high' },
      { fy: 2026, bucket: 'Capital',             amount: 50900,    source_lines: '1248',                          confidence: 'high' },
      // FY27 rows (level-funded pre-reduction, from anchor doc)
      { fy: 2027, bucket: 'Regular instruction', amount: 33303548, source_lines: '513,610,712,830,960', confidence: 'high' },
      { fy: 2027, bucket: 'Special education',   amount: 6361889,  source_lines: '1000,1178,1256',        confidence: 'high' },
      { fy: 2027, bucket: 'Student services',    amount: 2979030,  source_lines: '529,627,728,836,987,1038,1201', confidence: 'high' },
      { fy: 2027, bucket: 'Operations',          amount: 5571271,  source_lines: '536,633,734,842,996,1235',      confidence: 'high' },
      { fy: 2027, bucket: 'Administration',      amount: 1748279,  source_lines: '1098',                          confidence: 'high' },
      { fy: 2027, bucket: 'Capital',             amount: 51918,    source_lines: '1248',                          confidence: 'high' },
    ],
  },
];

function main() {
  const allRows = [];
  const perFyBucketSums = new Map();
  for (const packet of PACKETS) {
    for (const r of packet.rows) {
      allRows.push({
        FY: r.fy,
        bucket: r.bucket,
        amount: r.amount,
        source_packet_slug: packet.slug,
        source_lines: r.source_lines,
        extraction_confidence: r.confidence,
      });
      const key = r.fy;
      perFyBucketSums.set(key, (perFyBucketSums.get(key) ?? 0) + r.amount);
    }
  }

  // Sort by FY, then by bucket, for deterministic CSV diffs.
  const bucketOrder = ['Regular instruction', 'Special education', 'Student services',
                       'Operations', 'Administration', 'Capital'];
  allRows.sort((a, b) => a.FY - b.FY || bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket));

  const header = 'FY,bucket,amount,source_packet_slug,source_lines,extraction_confidence\n';
  const body = allRows.map(r =>
    `${r.FY},${r.bucket},${r.amount},${r.source_packet_slug},"${r.source_lines}",${r.extraction_confidence}`
  ).join('\n');
  writeFileSync(OUT, header + body + '\n');

  console.log(`Wrote ${allRows.length} rows to ${OUT}`);
  console.log('Per-FY bucket sums (level-funded, pre-reduction, Fixed Charges excluded):');
  for (const [fy, sum] of [...perFyBucketSums.entries()].sort()) {
    console.log(`  FY${fy}: $${sum.toLocaleString()}`);
  }
}

main();
