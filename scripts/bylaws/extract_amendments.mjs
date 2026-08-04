// Build data/bylaws-history/amendments.jsonl (deterministic, no LLM).
//
// Skeleton: eCode section-index blame events grouped by (meeting, article) —
// authoritative, section-attributed, back to 1954, every record "passed".
// Enrichment: sponsor / disposition / numeric tally from the Annual Town Reports
// (2006–2025), joined on (year, article). Pre-2006 records carry no sponsor/tally.
// Run after parse_bylaws.mjs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { groupEvents } from './lib/amendments.mjs';
import { extractArticleMeta } from './lib/report_extract.mjs';
import { toIdentity } from './lib/identity.mjs';
import { validateAmendment } from './lib/schema.mjs';

const INDEX = 'data/bylaws-history/section-index.json';
const REPORT_DIR = 'data/town_docs/annual_reports';
const OUT = 'data/bylaws-history/amendments.jsonl';
const REJECTS = 'data/bylaws-history/amendments.rejects.jsonl';
const SPONSOR_MAP = 'data/bylaws-history/sponsor-map.json';

const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const sponsorMap = JSON.parse(readFileSync(SPONSOR_MAP, 'utf8'));
const base = groupEvents(index);

// Build report enrichment map: { year -> Map(article -> meta) }.
const reportMeta = {};
for (let year = 2006; year <= 2025; year++) {
  const f = `${REPORT_DIR}/Annual-Report-${year}.txt`;
  if (existsSync(f)) reportMeta[year] = extractArticleMeta(readFileSync(f, 'utf8'));
}

const valid = [];
const rejects = [];
let enrichedSponsor = 0, withTally = 0;

for (const rec of base) {
  const year = Number(rec.meeting.date.slice(0, 4));
  const meta = reportMeta[year]?.get(rec.article) || null;

  const sponsor = meta?.sponsor || 'Town Meeting';
  if (meta?.sponsor) enrichedSponsor++;

  const source = { doc: 'eCode360 MA1991 Part I' };
  if (meta) source.report = `Annual-Report-${year}.txt`;

  const out = {
    meeting: rec.meeting,
    article: rec.article,
    sponsor,
    identity: toIdentity(sponsor, sponsorMap),
    disposition: 'passed', // eCode only records enacted (passed) amendments
    affects: rec.affects,
    actions: rec.actions,
    change: { kind: 'touched' }, // verbatim before/after text is phase 2
    source,
    fidelity: 'blame',
  };
  if (meta?.title) out.title = meta.title;
  if (meta?.tally) { out.vote = meta.tally; withTally++; }

  const errs = validateAmendment(out);
  if (errs.length) rejects.push({ record: out, errors: errs });
  else valid.push(out);
}

writeFileSync(OUT, valid.map(r => JSON.stringify(r)).join('\n') + '\n');
if (rejects.length) writeFileSync(REJECTS, rejects.map(r => JSON.stringify(r)).join('\n') + '\n');

const byDecade = {};
for (const r of valid) { const d = r.meeting.date.slice(0, 3) + '0s'; byDecade[d] = (byDecade[d] || 0) + 1; }
console.log(`amendments.jsonl: ${valid.length} records (${rejects.length} rejected)`);
console.log(`  sponsor enriched from reports: ${enrichedSponsor}`);
console.log(`  numeric vote tally attached:   ${withTally}`);
console.log(`  by decade: ${JSON.stringify(byDecade)}`);
