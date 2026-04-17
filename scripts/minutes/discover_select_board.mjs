#!/usr/bin/env node
import { appendOrUpdate } from './lib/manifest.mjs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const BASE = 'https://marbleheadma.gov/category/select-board/';

// Captures any Select Board PDF whose filename starts with a date and contains "-Minutes"
// Handles: YYYY-MM-DD and YYYY-M-D date forms; Meeting-Minutes, RETREAT-Minutes, 7PM-Minutes, etc.
const PDF_RE = /href="(https:\/\/marbleheadma\.gov\/wp-content\/uploads\/\d{4}\/\d{2}\/(\d{4})-(\d{1,2})-(\d{1,2})-Select-Board[^"]*-Minutes[^"]*\.pdf)"/gi;

const PAGINATION_RE = /href="(https:\/\/marbleheadma\.gov\/category\/select-board\/page\/(\d+)\/)"/gi;

// FY19 starts 2018-07-01; accept any meeting_date >= this
const FY19_START = '2018-07-01';

function zeroPad(n) {
  return String(n).padStart(2, '0');
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'marblehead-data-research/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

async function discoverPage(url, seen) {
  const html = await fetchPage(url);
  const found = [];

  for (const match of html.matchAll(PDF_RE)) {
    const sourceUrl = match[1];
    const year = match[2];
    const month = zeroPad(match[3]);
    const day = zeroPad(match[4]);
    const date = `${year}-${month}-${day}`;

    if (date < FY19_START) continue;

    // Key on normalized date; later AMENDED/numbered variants overwrite earlier rows (acceptable)
    const key = `select_board:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({ source_url: sourceUrl, meeting_date: date });
  }

  const pagination = new Set();
  for (const match of html.matchAll(PAGINATION_RE)) {
    pagination.add(match[1]);
  }

  return { found, pagination };
}

async function main() {
  const seen = new Set();
  const queue = [BASE];
  const visited = new Set();
  const allFound = [];

  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    console.log(`Fetching ${url}`);
    const { found, pagination } = await discoverPage(url, seen);
    allFound.push(...found);
    for (const p of pagination) {
      if (!visited.has(p)) queue.push(p);
    }
  }

  console.log(`Discovered ${allFound.length} Select Board minutes (FY19+)`);

  for (const f of allFound) {
    appendOrUpdate(MANIFEST_PATH, {
      body: 'select_board',
      meeting_date: f.meeting_date,
      source_url: f.source_url,
      local_pdf: '',
      local_txt: '',
      extraction_method: 'none',
      text_quality: '',
      status: 'pending',
      notes: ''
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
