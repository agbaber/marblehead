#!/usr/bin/env node
/**
 * Backfill _transcripts/<slug>.md for every meeting in either
 * data/vimeo_meetings.json or data/youtube_meetings.json that has an
 * en-x-autogen track and no existing transcript file.
 *
 * Source precedence on conflict: when the same (board_slug, date) exists in
 * both indexes, Vimeo wins (MHTV's professional captioning is generally
 * cleaner than YouTube auto-captions). YouTube fills the gaps where MHTV
 * didn't post the meeting — pre-2024 School Committee content, MPS
 * subcommittees, etc.
 *
 * Usage:
 *   node scripts/transcripts/backfill_auto.mjs [--limit N] [--board <slug>] [--source vimeo|youtube] [--dry-run]
 *
 * Caches downloaded VTTs in /tmp/vtt-cache/ to make re-runs cheap.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { YOUTUBE_YTDLP_ARGS } from './lib/config.mjs';
import { buildSlug, renderTranscript } from './lib/render_transcript.mjs';
import { vttToProse } from './lib/vtt_to_prose.mjs';

const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;
const TRANSCRIPTS_DIR = '_transcripts';
const CACHE_DIR = '/tmp/vtt-cache';
const VIMEO_INDEX = 'data/vimeo_meetings.json';
const YOUTUBE_INDEX = 'data/youtube_meetings.json';

mkdirSync(CACHE_DIR, { recursive: true });

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
const sourceFilter = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
const dryRun = args.includes('--dry-run');

function downloadVimeoVtt(vimeoId) {
  const cachePath = join(CACHE_DIR, `vimeo-${vimeoId}.en-x-autogen.vtt`);
  if (existsSync(cachePath)) {
    console.error(`  - cache hit: ${cachePath}`);
    return cachePath;
  }
  spawnSync(YT_DLP, [
    '--write-subs',
    '--sub-langs', 'en-x-autogen',
    '--skip-download',
    '--sub-format', 'vtt',
    '-o', join(CACHE_DIR, `vimeo-${vimeoId}.%(ext)s`),
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  return existsSync(cachePath) ? cachePath : null;
}

function downloadYouTubeVtt(youtubeId) {
  const cachePath = join(CACHE_DIR, `youtube-${youtubeId}.en.vtt`);
  if (existsSync(cachePath)) {
    console.error(`  - cache hit: ${cachePath}`);
    return cachePath;
  }
  // YouTube auto-caption lang code is `en` (sometimes `en-orig`). Take the
  // first match across both. yt-dlp downloads to a file pattern with the
  // detected lang in the name; we glob-match after the fact.
  spawnSync(YT_DLP, [
    ...YOUTUBE_YTDLP_ARGS,
    '--write-auto-subs',
    '--sub-langs', 'en.*,en',
    '--skip-download',
    '--sub-format', 'vtt',
    '-o', join(CACHE_DIR, `youtube-${youtubeId}.%(ext)s`),
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ], { encoding: 'utf8' });
  // Find whichever variant landed.
  for (const lang of ['en', 'en-orig', 'en-US']) {
    const p = join(CACHE_DIR, `youtube-${youtubeId}.${lang}.vtt`);
    if (existsSync(p)) return p;
  }
  return existsSync(cachePath) ? cachePath : null;
}

function getVimeoDurationSeconds(vimeoId) {
  const res = spawnSync(YT_DLP, [
    '--print', '%(duration)s',
    '--skip-download',
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  const n = Number(res.stdout.trim());
  return Number.isFinite(n) ? n : 0;
}

function loadIndex(path) {
  if (!existsSync(path)) {
    console.error(`  - ${path} not found, skipping that source.`);
    return { meetings: [] };
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Merge Vimeo + YouTube meeting indexes into a single ordered list.
// Dedupe by (board_slug, date): Vimeo wins on conflict.
function mergeIndexes(vimeo, youtube) {
  const seen = new Set();
  const out = [];
  for (const m of vimeo.meetings ?? []) {
    seen.add(`${m.board_slug}:${m.date}`);
    out.push({ source: 'vimeo', ...m });
  }
  for (const m of youtube.meetings ?? []) {
    const key = `${m.board_slug}:${m.date}`;
    // For approximate-date YouTube entries, also block if any Vimeo entry
    // exists for the same board within a 14-day window — likely the same
    // meeting under MHTV's correct date.
    if (m.date_approximate) {
      const collision = (vimeo.meetings ?? []).some(v => {
        if (v.board_slug !== m.board_slug) return false;
        const diff = Math.abs(new Date(v.date) - new Date(m.date));
        return diff <= 14 * 24 * 3600 * 1000;
      });
      if (collision) continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source: 'youtube', ...m });
  }
  return out;
}

function processMeeting(m) {
  const slug = buildSlug(m.board_slug, m.date);
  const outPath = join(TRANSCRIPTS_DIR, `${slug}.md`);
  if (existsSync(outPath)) return { status: 'skipped' };

  console.error(`  ${slug} [${m.source}] ...`);
  if (dryRun) return { status: 'would-process' };

  let vttPath, videoUrl, vidId, duration, source;
  if (m.source === 'vimeo') {
    vttPath = downloadVimeoVtt(m.vimeo_id);
    videoUrl = `https://vimeo.com/${m.vimeo_id}`;
    vidId = m.vimeo_id;
    duration = getVimeoDurationSeconds(m.vimeo_id);
    source = 'vimeo-auto';
  } else {
    vttPath = downloadYouTubeVtt(m.youtube_id);
    videoUrl = `https://www.youtube.com/watch?v=${m.youtube_id}`;
    vidId = m.youtube_id;
    duration = Number.isFinite(m.duration_seconds) ? Math.round(m.duration_seconds) : 0;
    source = 'youtube-auto';
  }
  if (!vttPath) {
    console.error('  - no caption track, skipping');
    return { status: 'failed', reason: 'no captions' };
  }
  const vtt = readFileSync(vttPath, 'utf8');
  const body = vttToProse(vtt, videoUrl);
  if (!body) {
    console.error('  - empty VTT, skipping');
    return { status: 'failed', reason: 'empty vtt' };
  }
  const md = renderTranscript({
    board_slug: m.board_slug,
    board_display: m.board_display,
    date: m.date,
    vimeo_id: m.source === 'vimeo' ? vidId : undefined,
    youtube_id: m.source === 'youtube' ? vidId : undefined,
    duration_seconds: duration,
    body,
    source,
    date_approximate: m.date_approximate === true,
  });
  writeFileSync(outPath, md);
  console.error(`  - wrote ${outPath} (${md.length} bytes)`);
  return { status: 'processed' };
}

function main() {
  const vimeo = loadIndex(VIMEO_INDEX);
  const youtube = loadIndex(YOUTUBE_INDEX);
  const merged = mergeIndexes(vimeo, youtube);
  console.error(`Loaded ${vimeo.meetings?.length ?? 0} Vimeo + ${youtube.meetings?.length ?? 0} YouTube = ${merged.length} meetings after dedupe.`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of merged) {
    if (processed >= limit) break;
    if (boardFilter && m.board_slug !== boardFilter) continue;
    if (sourceFilter && m.source !== sourceFilter) continue;

    const result = processMeeting(m);
    if (result.status === 'processed' || result.status === 'would-process') processed += 1;
    else if (result.status === 'skipped') skipped += 1;
    else failed += 1;
  }

  console.error(`Done. processed=${processed} skipped_existing=${skipped} failed=${failed}`);
}

main();
