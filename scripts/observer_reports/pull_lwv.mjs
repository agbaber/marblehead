#!/usr/bin/env node
/**
 * Ingest LWV of Marblehead Observer Corps reports into _observer_reports/.
 *
 * The League of Women Voters posts public PDF summaries of ~15 town boards --
 * including boards that never appear on MHTV video (Rec & Parks, Harbors &
 * Waters, MMLD Light Board, etc.), for which this is the only searchable
 * record. This script enumerates each board's index page, downloads every
 * report PDF, extracts text with `pdftotext -layout`, and writes one markdown
 * file per report with minimal, faithful frontmatter (no LLM enrichment).
 *
 * Usage:
 *   node scripts/observer_reports/pull_lwv.mjs [--out _observer_reports] [--limit N] [--board <slug>]
 *
 * Requires: pdftotext (poppler-utils) on PATH.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const INDEX_BASE =
  'https://my.lwv.org/massachusetts/marblehead/observer-reports';

// canonical slug + display name + the exact index page path (verified 2026-07-10)
const BOARDS = [
  ['abbot-library-trustees',    'Abbot Library Board of Trustees',      'abbot-library-board-trustees-observer-reports'],
  ['board-of-health',           'Board of Health',                      'board-health-observer-reports'],
  ['conservation-commission',   'Conservation Commission',              'conservation-commission-observer-reports'],
  ['disabilities-commission',   'Disabilities Commission',              'disabilities-commission-observer-reports'],
  ['fair-housing-committee',    'Fair Housing Committee',               'fair-housing-committee-observer-reports'],
  ['finance-committee',         'Finance Committee',                    'finance-committee-observer-reports'],
  ['harbors-and-waters',        'Harbors and Waters Board',             'harbors-and-waters-board-observer-reports'],
  ['hpp-implementation',        'Housing Production Plan Implementation Committee', 'hpp-implementation-committee-reports'],
  ['housing-authority',         'Marblehead Housing Authority',         'marblehead-housing-authority-observer-reports'],
  ['housing-committee',         'Marblehead Housing Committee',         'marblehead-housing-committee-observer-reports'],
  ['light-board',               'Marblehead Municipal Light Board',     'marblehead-municipal-light-board-observer-reports'],
  ['planning-board',            'Planning Board',                       'planning-board-observer-reports'],
  ['recreation-and-parks',      'Recreation and Parks Commission',      'recreation-and-parks-commission-observer-reports'],
  ['task-force-discrimination', 'Task Force Against Discrimination',    'task-against-discrimination-observer-reports'],
  ['water-sewer',               'Water & Sewer Commission',             'water-sewer-commission-observer-reports'],
];

const args = process.argv.slice(2);
const getArg = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const OUT = getArg('--out', '_observer_reports');
const LIMIT = parseInt(getArg('--limit', '0'), 10) || 0;
const ONLY_BOARD = getArg('--board', null);

const TMP = join(tmpdir(), 'lwv-obs');
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

async function fetchBuffer(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// Extract report PDF hrefs from a board index page, in document order.
function extractPdfLinks(html) {
  const out = [];
  const re = /href="([^"]+\.pdf)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let u = m[1];
    if (/\/(css|logo)/i.test(u)) continue;         // skip asset pdfs (none expected, defensive)
    if (!/\/leagues\/wysiwyg\//i.test(u)) continue; // report PDFs live under leagues/wysiwyg
    if (u.startsWith('/')) u = 'https://my.lwv.org' + u;
    out.push(u);
  }
  return [...new Set(out)];
}

// Parse a date from the PDF filename (last m-d-y token). Returns YYYY-MM-DD or null.
function dateFromName(name) {
  const base = decodeURIComponent(name).replace(/\.pdf$/i, '').replace(/_\d+$/, '');
  const matches = [...base.matchAll(/(\d{1,2})[-.](\d{1,2})[-.](\d{2,4})/g)];
  if (!matches.length) return null;
  const [, mm, dd, yy] = matches[matches.length - 1];
  let year = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10);
  const M = String(parseInt(mm, 10)).padStart(2, '0');
  const D = String(parseInt(dd, 10)).padStart(2, '0');
  if (parseInt(M) < 1 || parseInt(M) > 12 || parseInt(D) < 1 || parseInt(D) > 31) return null;
  return `${year}-${M}-${D}`;
}

function observerFromText(text) {
  const m = text.match(/LWV[MA]?\s*Observ\w*\s*[:\-–]?\s*([^\n]+)/i);
  if (!m) return null;
  return m[1].trim().replace(/\s{2,}/g, ' ').slice(0, 120) || null;
}

function yamlEscape(s) {
  return String(s).replace(/"/g, '\\"');
}

const seen = new Set();
const manifest = [];
let written = 0, skipped = 0, failed = 0;

for (const [slug, display, indexPath] of BOARDS) {
  if (ONLY_BOARD && slug !== ONLY_BOARD) continue;
  const indexUrl = `${INDEX_BASE}/${indexPath}`;
  let links = [];
  try {
    const html = await fetchText(indexUrl);
    links = extractPdfLinks(html);
  } catch (e) {
    console.error(`  [index fail] ${slug}: ${e.message}`);
    failed++;
    continue;
  }
  console.error(`\n## ${slug} (${display}) — ${links.length} report PDFs`);

  for (const pdfUrl of links) {
    if (LIMIT && written >= LIMIT) break;
    if (seen.has(pdfUrl)) { continue; }
    seen.add(pdfUrl);

    const fname = pdfUrl.split('/').pop();
    let date = dateFromName(fname);
    let buf, text;
    try {
      buf = await fetchBuffer(pdfUrl);
      const tmpPdf = join(TMP, fname.replace(/[^\w.-]/g, '_'));
      writeFileSync(tmpPdf, buf);
      text = execFileSync('pdftotext', ['-layout', tmpPdf, '-'], { encoding: 'utf8' });
    } catch (e) {
      console.error(`  [dl/extract fail] ${fname}: ${e.message}`);
      failed++;
      continue;
    }
    text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    // fall back to a date parsed from the report header if filename had none
    if (!date) {
      const hm = text.match(/([A-Z][a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
      if (hm) {
        const months = { January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12 };
        const mo = months[hm[1]];
        if (mo) date = `${hm[3]}-${String(mo).padStart(2,'0')}-${String(+hm[2]).padStart(2,'0')}`;
      }
    }
    if (!date) { console.error(`  [no date] ${fname} — skipped`); skipped++; continue; }
    if (!text || text.length < 40) { console.error(`  [empty text] ${fname} — skipped`); skipped++; continue; }

    const observer = observerFromText(text);

    // collision-safe filename
    let outName = `${slug}-${date}.md`;
    let n = 2;
    while (existsSync(join(OUT, outName))) { outName = `${slug}-${date}-${n}.md`; n++; }

    const fm = [
      '---',
      `board: ${slug}`,
      `board_display: "${yamlEscape(display)}"`,
      `date: ${date}`,
      `source: lwv-observer-report`,
      `source_index_url: "${indexUrl}"`,
      `source_pdf_url: "${pdfUrl}"`,
      observer ? `observer: "${yamlEscape(observer)}"` : null,
      `ingested: 2026-07-10`,
      '---',
      '',
    ].filter((x) => x !== null).join('\n');

    writeFileSync(join(OUT, outName), fm + text + '\n');
    manifest.push({ board: slug, date, file: outName, observer, pdf: pdfUrl });
    written++;
  }
}

writeFileSync(join(OUT, '_manifest.json'), JSON.stringify(
  { generated: '2026-07-10', source: INDEX_BASE, count: manifest.length, reports: manifest }, null, 2));

console.error(`\n=== DONE: wrote ${written}, skipped ${skipped}, failed ${failed} → ${OUT}/ ===`);
