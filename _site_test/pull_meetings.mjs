#!/usr/bin/env node
/**
 * pull_meetings.mjs
 *
 * Indexes Marblehead town board meeting videos from the MHTV Vimeo channel
 * and PDF minutes from marbleheadma.gov. Outputs data/meetings.json.
 *
 * Usage:
 *   node pull_meetings.mjs                  # index recent ~60 videos (API limit)
 *   node pull_meetings.mjs --pdfs           # also scrape PDF minutes from town site
 *   node pull_meetings.mjs --deep           # use Playwright to scroll past API's 60-video cap
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';

/* ── Config ─────────────────────────────────────────────────────────── */

const SIMPLE_API  = 'https://vimeo.com/api/v2/marbleheadtv/videos.json';
const OEMBED_URL  = 'https://vimeo.com/api/oembed.json?url=https://vimeo.com/';
const OUTPUT_FILE = 'data/meetings.json';

// Town website PDF minutes listing pages (board slug -> display name)
const TOWN_BOARDS = {
  'select-board':              'Select Board',
  'planning-board':            'Planning Board',
  'zoning-board-of-appeals':   'Zoning Board of Appeals',
  'board-of-health':           'Board of Health',
  'board-of-assessors':        'Board of Assessors',
  'finance-committee':         'Finance Committee',
  'conservation-commission':   'Conservation Commission',
  'recreation-and-parks':      'Recreation & Parks',
  'harbors-and-waters-board':  'Harbors & Waters Board',
};

// Board name patterns in Vimeo titles (order matters: longer matches first)
const BOARD_PATTERNS = [
  { pattern: /zoning\s+board\s+of\s+appeals/i,   board: 'Zoning Board of Appeals' },
  { pattern: /board\s+of\s+health/i,              board: 'Board of Health' },
  { pattern: /board\s+of\s+selectmen/i,           board: 'Select Board' },
  { pattern: /board\s+of\s+assessors/i,           board: 'Board of Assessors' },
  { pattern: /select\s+board/i,                   board: 'Select Board' },
  { pattern: /school\s+committee/i,               board: 'School Committee' },
  { pattern: /finance\s+committee/i,              board: 'Finance Committee' },
  { pattern: /planning\s+board/i,                 board: 'Planning Board' },
  { pattern: /conservation/i,                     board: 'Conservation Commission' },
  { pattern: /harbors?\s+(?:and|&)\s+waters?/i,   board: 'Harbors & Waters Board' },
  { pattern: /recreation/i,                       board: 'Recreation & Parks' },
  { pattern: /town\s+meeting/i,                   board: 'Town Meeting' },
  { pattern: /warrant\s+hearing/i,                board: 'Finance Committee' },
  { pattern: /budget\s+hearing/i,                 board: 'Finance Committee' },
  { pattern: /capital\s+planning/i,               board: 'Capital Planning' },
];

/* ── CLI args ───────────────────────────────────────────────────────── */

const args    = process.argv.slice(2);
const DO_PDFS = args.includes('--pdfs');
const DO_DEEP = args.includes('--deep');

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Parse board name from a Vimeo video title */
function parseBoard(title) {
  for (const { pattern, board } of BOARD_PATTERNS) {
    if (pattern.test(title)) return board;
  }
  return 'Other';
}

/** Parse meeting date from title. Handles M-D-YY, M.D.YY, Month D YYYY, etc. */
function parseDate(title) {
  // Try M-D-YY or M/D/YY or M.D.YY
  let m = title.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\s*$/);
  if (!m) m = title.match(/:\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (!m) m = title.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (m) {
    const month = parseInt(m[1]);
    const day   = parseInt(m[2]);
    let year    = parseInt(m[3]);
    if (year < 100) year += 2000;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // Try "Month D, YYYY" or "Month D YYYY"
  const months = { january:1, february:2, march:3, april:4, may:5, june:6,
                   july:7, august:8, september:9, october:10, november:11, december:12 };
  const m2 = title.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m2 && months[m2[1].toLowerCase()]) {
    const mon = months[m2[1].toLowerCase()];
    return `${m2[3]}-${String(mon).padStart(2,'0')}-${String(m2[2]).padStart(2,'0')}`;
  }

  return null;
}

/** Format a Vimeo Simple API video object into our schema */
function formatVideo(v) {
  const title = v.title || '';
  const board = parseBoard(title);
  const date  = parseDate(title);
  const durationMin = Math.round((v.duration || 0) / 60);

  return {
    id:           String(v.id),
    title:        title,
    board:        board,
    date:         date,
    duration_min: durationMin,
    description:  v.description || '',
    url:          v.url || `https://vimeo.com/${v.id}`,
    thumbnail:    v.thumbnail_large || v.thumbnail_medium || null,
    upload_date:  v.upload_date || null,
    plays:        v.stats_number_of_plays || 0,
  };
}

/* ── Vimeo Simple API fetcher (no auth, max ~60 recent videos) ────── */

async function fetchVimeoApi() {
  console.log('\n=== Fetching from Vimeo Simple API ===\n');
  const allVideos = [];

  for (let page = 1; page <= 3; page++) {
    const url = `${SIMPLE_API}?page=${page}`;
    console.log(`  Page ${page}...`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.log(`    HTTP ${resp.status}, stopping.`);
        break;
      }
      const data = await resp.json();
      if (!data || data.length === 0) break;
      console.log(`    Got ${data.length} videos`);
      for (const v of data) allVideos.push(formatVideo(v));
    } catch (e) {
      console.log(`    Error: ${e.message}`);
      break;
    }
  }

  console.log(`\nTotal from API: ${allVideos.length} videos`);
  return allVideos;
}

/* ── Deep scrape: Playwright scroll for full catalog ─────────────── */

async function deepScrapeVimeo(browser) {
  console.log('\n=== Deep scraping Vimeo channel with Playwright ===\n');

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  await page.goto('https://vimeo.com/marbleheadtv/videos', {
    waitUntil: 'networkidle', timeout: 60000
  });
  await page.waitForTimeout(3000);

  const videoIds = new Set();
  let staleRounds = 0;

  while (staleRounds < 10) {
    const ids = await page.evaluate(() => {
      const found = new Set();
      // Look for video links in various selectors
      for (const a of document.querySelectorAll('a[href]')) {
        const m = a.href.match(/vimeo\.com\/(\d{7,})/);
        if (m) found.add(m[1]);
      }
      return [...found];
    });

    const before = videoIds.size;
    for (const id of ids) videoIds.add(id);

    if (videoIds.size === before) {
      staleRounds++;
    } else {
      staleRounds = 0;
      console.log(`  Found ${videoIds.size} video IDs...`);
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Click any "show more" / "load more" buttons
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('button, a')) {
        if (/load more|show more/i.test(el.textContent)) {
          el.click();
          return;
        }
      }
    }).catch(() => {});
  }

  console.log(`\nDeep scrape found ${videoIds.size} video IDs. Fetching metadata via oEmbed...`);

  // Enrich with oEmbed
  const videos = [];
  const idList = [...videoIds];

  for (let i = 0; i < idList.length; i++) {
    try {
      const resp = await fetch(`${OEMBED_URL}${idList[i]}`);
      if (resp.ok) {
        const oembed = await resp.json();
        const title = oembed.title || '';
        videos.push({
          id:           idList[i],
          title:        title,
          board:        parseBoard(title),
          date:         parseDate(title),
          duration_min: Math.round((oembed.duration || 0) / 60),
          description:  oembed.description || '',
          url:          `https://vimeo.com/${idList[i]}`,
          thumbnail:    oembed.thumbnail_url || null,
          upload_date:  oembed.upload_date || null,
          plays:        0,
        });
      }
    } catch { /* skip */ }

    if ((i + 1) % 25 === 0) {
      console.log(`  Enriched ${videos.length}/${idList.length}`);
      // Rate limit: small delay every 25 requests
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await context.close();
  return videos;
}

/* ── PDF minutes scraper ────────────────────────────────────────────── */

async function scrapePdfMinutes(browser) {
  console.log('\n=== Scraping PDF minutes from marbleheadma.gov ===\n');

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  const allPdfs = [];
  const currentYear = new Date().getFullYear();

  for (const [slug, boardName] of Object.entries(TOWN_BOARDS)) {
    for (let year = currentYear; year >= currentYear - 2; year--) {
      // Try several URL patterns the town site uses
      const urls = [
        `https://marbleheadma.gov/document/${slug}-minutes-agendas-${year}/`,
        `https://marbleheadma.gov/document/${slug}-minutes-${year}/`,
        `https://marbleheadma.gov/document/${slug}-${year}/`,
      ];

      let found = false;
      for (const url of urls) {
        if (found) break;
        try {
          const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          if (!resp || resp.status() >= 400) continue;
          await page.waitForTimeout(1500);

          const pdfs = await page.evaluate((board) => {
            const links = document.querySelectorAll('a[href*=".pdf"]');
            return Array.from(links).map(a => ({
              board,
              title: a.textContent.trim(),
              url:   a.href,
            })).filter(p => p.title && p.url);
          }, boardName);

          if (pdfs.length > 0) {
            console.log(`  ${boardName} ${year}: ${pdfs.length} PDFs`);
            allPdfs.push(...pdfs);
            found = true;
          }
        } catch { /* try next URL pattern */ }
      }

      if (!found) {
        console.log(`  ${boardName} ${year}: no PDFs found`);
      }
    }
  }

  await context.close();
  return allPdfs;
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Load existing data if any (for incremental updates)
  let existing = { videos: [], pdfs: [], last_updated: null };
  if (existsSync(OUTPUT_FILE)) {
    try {
      existing = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
      console.log(`Loaded existing data: ${existing.videos?.length || 0} videos, ${existing.pdfs?.length || 0} PDFs`);
    } catch { /* start fresh */ }
  }

  // Fetch videos
  let videos;
  if (DO_DEEP) {
    videos = await deepScrapeVimeo(browser);
  } else {
    videos = await fetchVimeoApi();
  }

  // Merge with existing (keep new, update existing by ID)
  const videoMap = new Map();
  for (const v of (existing.videos || [])) videoMap.set(v.id, v);
  for (const v of videos) videoMap.set(v.id, v);
  const allVideos = Array.from(videoMap.values())
    .sort((a, b) => (b.date || b.upload_date || '').localeCompare(a.date || a.upload_date || ''));

  // Scrape PDFs if requested
  let pdfs = existing.pdfs || [];
  if (DO_PDFS) {
    const newPdfs = await scrapePdfMinutes(browser);
    const pdfMap = new Map();
    for (const p of pdfs) pdfMap.set(p.url, p);
    for (const p of newPdfs) pdfMap.set(p.url, p);
    pdfs = Array.from(pdfMap.values());
  }

  // Separate meetings from community content
  // Exclude short clips (<15 min) that are Headliner previews, not actual meetings
  const meetings = allVideos.filter(v => v.board !== 'Other' && v.duration_min >= 15);
  const community = allVideos.filter(v => v.board === 'Other' || v.duration_min < 15);

  // Stats
  const boardCounts = {};
  for (const v of meetings) {
    boardCounts[v.board] = (boardCounts[v.board] || 0) + 1;
  }

  const output = {
    last_updated:    new Date().toISOString(),
    video_count:     allVideos.length,
    meeting_count:   meetings.length,
    community_count: community.length,
    pdf_count:       pdfs.length,
    boards:          boardCounts,
    videos:          allVideos,
    pdfs:            pdfs,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n=== Done ===`);
  console.log(`Videos: ${allVideos.length}`);
  console.log(`PDFs: ${pdfs.length}`);
  console.log(`Boards: ${JSON.stringify(boardCounts, null, 2)}`);
  console.log(`Output: ${OUTPUT_FILE}`);

  await browser.close();
}

main().catch(console.error);
