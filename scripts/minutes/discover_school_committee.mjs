#!/usr/bin/env node
import { appendOrUpdate } from './lib/manifest.mjs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const ENTRY_PAGE = 'https://www.marbleheadschools.org/fs/pages/1547';
const SC_HOST = 'marbleheadschools.org';
const FY19_START = '2018-07-01';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function zeroPad(n) {
  return String(n).padStart(2, '0');
}

function normalizeDate(candidate) {
  if (!candidate) return null;
  const s = candidate.trim();

  // ISO: YYYY-MM-DD or YYYY-M-D
  const iso = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${zeroPad(iso[2])}-${zeroPad(iso[3])}`;
  }

  // Named month: January 15, 2026 or January 15 2026
  const named = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (named) {
    const m = MONTHS[named[1].toLowerCase()];
    return `${named[3]}-${zeroPad(m)}-${zeroPad(named[2])}`;
  }

  // Numeric: M/D/YYYY, M.D.YYYY, M-D-YYYY, also M/D/YY
  const numeric = s.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  if (numeric) {
    let year = parseInt(numeric[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${zeroPad(numeric[1])}-${zeroPad(numeric[2])}`;
  }

  // Compact with underscores: M_D_YYYY inside filenames
  const underscore = s.match(/\b(\d{1,2})_(\d{1,2})_(\d{4})\b/);
  if (underscore) {
    return `${underscore[3]}-${zeroPad(underscore[1])}-${zeroPad(underscore[2])}`;
  }

  return null;
}

function extractDateFromHref(href) {
  // Try to pull a date from the filename portion of the URL
  const filename = href.split('/').pop().replace(/\.pdf$/i, '');
  // Patterns like: SchoolCommitteeMinutes1-15-26, 9_20_2018, 12-18-25
  const parts = filename.replace(/-/g, '/').replace(/_/g, '/');
  return normalizeDate(parts) || normalizeDate(filename);
}

async function harvestPage(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    const anchors = await page.$$eval('a', as =>
      as.map(a => ({ text: a.textContent.trim(), href: a.href }))
    );

    const subpageUrls = anchors
      .filter(a => {
        try {
          const u = new URL(a.href);
          return u.hostname.endsWith('marbleheadschools.org') && /\/fs\/pages\/\d+/.test(u.pathname);
        } catch { return false; }
      })
      .map(a => a.href);

    const minutesAnchors = anchors.filter(a => {
      if (!a.href.includes('.pdf')) return false;
      return /minutes/i.test(a.text) || /minutes/i.test(a.href);
    });

    return { minutesAnchors, subpageUrls };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const visited = new Set();
  const queue = [ENTRY_PAGE];
  const allFound = [];
  const seenDates = new Set();
  const visitedPageUrls = [];

  try {
    while (queue.length) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      visitedPageUrls.push(url);
      console.log(`Visiting ${url}`);

      let minutesAnchors, subpageUrls;
      try {
        ({ minutesAnchors, subpageUrls } = await harvestPage(browser, url));
      } catch (err) {
        console.error(`BLOCKED loading ${url}: ${err.message}`);
        continue;
      }

      for (const a of minutesAnchors) {
        const dateFromText = normalizeDate(a.text);
        const dateFromHref = extractDateFromHref(a.href);
        const date = dateFromText || dateFromHref;

        if (!date) {
          console.log(`SKIP no-date: text="${a.text}" href="${a.href}"`);
          continue;
        }

        if (date < FY19_START) continue;

        const key = `school_committee:${date}`;
        if (seenDates.has(key)) continue;
        seenDates.add(key);

        allFound.push({ meeting_date: date, source_url: a.href });
      }

      for (const sub of subpageUrls) {
        if (!visited.has(sub)) queue.push(sub);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nVisited /fs/pages/ URLs:`);
  for (const u of visitedPageUrls) console.log(`  ${u}`);

  console.log(`\nDiscovered ${allFound.length} School Committee minutes (FY19+)`);

  for (const f of allFound) {
    appendOrUpdate(MANIFEST_PATH, {
      body: 'school_committee',
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
