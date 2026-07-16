// Cross-check the eCode amendment skeleton against the Annual Town Reports and
// write data/bylaws-history/reconcile-report.md. Advisory only (exit 0).
// Run after extract_amendments.mjs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extractArticleMeta } from './lib/report_extract.mjs';
import { reconcile } from './lib/reconcile.mjs';

const AMEND = 'data/bylaws-history/amendments.jsonl';
const REPORT_DIR = 'data/town_docs/annual_reports';
const OUT = 'data/bylaws-history/reconcile-report.md';
const CUTOFF = 2006;

const records = readFileSync(AMEND, 'utf8').trim().split('\n').map(l => JSON.parse(l));

const reportArticlesByYear = {};
for (let year = CUTOFF; year <= 2025; year++) {
  const f = `${REPORT_DIR}/Annual-Report-${year}.txt`;
  if (existsSync(f)) reportArticlesByYear[year] = new Set(extractArticleMeta(readFileSync(f, 'utf8')).keys());
}

const { discrepancies, stats } = reconcile(records, reportArticlesByYear, { cutoff: CUTOFF });

const lines = [
  '# Bylaws history — reconciliation report',
  '',
  `eCode amendment skeleton vs Annual Town Reports (cutoff ${CUTOFF}).`,
  '',
  '## Enrichment coverage (post-2006)',
  '',
  `- eCode amendments since ${CUTOFF}: **${stats.postCutoff}**`,
  `- enriched with a sponsor from the report: **${stats.enriched}**`,
  `- article found in report but no sponsor stated: **${stats.unenriched}**`,
  '',
  '## Discrepancies: eCode amendment with no matching report article',
  '',
  discrepancies.length
    ? 'These eCode-dated amendments have no article of that number in the year’s report '
      + '(likely ATM/STM article-number overlap or an eCode date on the adjacent year). '
      + 'Worth a spot check:\n'
    : 'None — every post-2006 eCode amendment matched an article number in its year’s report.\n',
];
for (const d of discrepancies) {
  lines.push(`- ${d.date} Art. ${d.article} → § ${d.affects.join(', ')}`);
}
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`wrote ${OUT}`);
console.log(`  post-2006: ${stats.postCutoff} eCode amendments, ${stats.enriched} sponsor-enriched, ${stats.unenriched} in-report-no-sponsor`);
console.log(`  discrepancies (eCode article absent from report): ${discrepancies.length}`);
