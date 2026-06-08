#!/usr/bin/env node
/**
 * Backfill _transcripts/<slug>.md for every meeting in data/vimeo_meetings.json
 * that has an en-x-autogen track and no existing transcript file.
 *
 * Usage:
 *   node scripts/transcripts/backfill_auto.mjs [--limit N] [--board <slug>] [--dry-run]
 *
 * Caches downloaded VTTs in /tmp/vtt-cache/ to make re-runs cheap.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSlug, renderTranscript } from './lib/render_transcript.mjs';
import { vttToProse } from './lib/vtt_to_prose.mjs';

const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;
const TRANSCRIPTS_DIR = '_transcripts';
const CACHE_DIR = '/tmp/vtt-cache';
const INDEX_FILE = 'data/vimeo_meetings.json';

mkdirSync(CACHE_DIR, { recursive: true });

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
const dryRun = args.includes('--dry-run');

function downloadVtt(vimeoId) {
  const cachePath = join(CACHE_DIR, `${vimeoId}.en-x-autogen.vtt`);
  if (existsSync(cachePath)) {
    console.error(`  - cache hit: ${cachePath}`);
    return cachePath;
  }
  const res = spawnSync(YT_DLP, [
    '--write-subs',
    '--sub-langs', 'en-x-autogen',
    '--skip-download',
    '--sub-format', 'vtt',
    '-o', join(CACHE_DIR, `${vimeoId}.%(ext)s`),
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  if (!existsSync(cachePath)) {
    return null;
  }
  return cachePath;
}

function getDurationSeconds(vimeoId) {
  const res = spawnSync(YT_DLP, [
    '--print', '%(duration)s',
    '--skip-download',
    `https://vimeo.com/${vimeoId}`,
  ], { encoding: 'utf8' });
  const n = Number(res.stdout.trim());
  return Number.isFinite(n) ? n : 0;
}

function main() {
  const idx = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of idx.meetings) {
    if (processed >= limit) break;
    if (boardFilter && m.board_slug !== boardFilter) continue;
    const slug = buildSlug(m.board_slug, m.date);
    const outPath = join(TRANSCRIPTS_DIR, `${slug}.md`);
    if (existsSync(outPath)) { skipped += 1; continue; }

    console.error(`[${processed + 1}] ${slug} ...`);
    if (dryRun) { processed += 1; continue; }

    const vttPath = downloadVtt(m.vimeo_id);
    if (!vttPath) {
      console.error(`  - no en-x-autogen track, skipping`);
      failed += 1;
      continue;
    }
    const vtt = readFileSync(vttPath, 'utf8');
    const body = vttToProse(vtt, `https://vimeo.com/${m.vimeo_id}`);
    if (!body) {
      console.error(`  - empty VTT, skipping`);
      failed += 1;
      continue;
    }
    const duration = getDurationSeconds(m.vimeo_id);
    const md = renderTranscript({
      board_slug: m.board_slug,
      board_display: m.board_display,
      date: m.date,
      vimeo_id: m.vimeo_id,
      duration_seconds: duration,
      body,
    });
    writeFileSync(outPath, md);
    console.error(`  - wrote ${outPath} (${md.length} bytes)`);
    processed += 1;
  }

  console.error(`Done. processed=${processed} skipped_existing=${skipped} failed=${failed}`);
}

main();
