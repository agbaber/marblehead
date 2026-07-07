#!/usr/bin/env node
/**
 * Render locally-Whisper-transcribed VTTs into _transcripts/<slug>.md.
 *
 * Companion to whisper_worker.py, which transcribes meetings that have no
 * en-x-autogen caption track on Vimeo and caches one VTT per vimeo_id.
 * This script matches those VTTs against data/vimeo_meetings.json and
 * writes the markdown files the same way backfill_auto.mjs does, but with
 * source: whisper-local.
 *
 * Usage:
 *   node scripts/transcripts/backfill_whisper.mjs [--cache ~/.cache/whisper-backfill] [--dry-run]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildSlug, renderTranscript } from './lib/render_transcript.mjs';
import { vttToProse } from './lib/vtt_to_prose.mjs';

const TRANSCRIPTS_DIR = '_transcripts';
const INDEX_FILE = 'data/vimeo_meetings.json';

const args = process.argv.slice(2);
const cacheDir = args.includes('--cache')
  ? args[args.indexOf('--cache') + 1]
  : join(homedir(), '.cache/whisper-backfill');
const dryRun = args.includes('--dry-run');

// Durations were captured at queue-build time (queue.tsv), so no per-video
// yt-dlp round trip is needed here.
function loadDurations() {
  const queuePath = join(cacheDir, 'queue.tsv');
  const map = new Map();
  if (!existsSync(queuePath)) return map;
  for (const line of readFileSync(queuePath, 'utf8').split('\n')) {
    const [id, , dur] = line.split('\t');
    if (id && dur) map.set(id, Math.round(Number(dur)));
  }
  return map;
}

function main() {
  const idx = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const durations = loadDurations();
  let written = 0;
  let skipped = 0;
  let pending = 0;

  for (const m of idx.meetings) {
    const slug = buildSlug(m.board_slug, m.date);
    const outPath = join(TRANSCRIPTS_DIR, `${slug}.md`);
    if (existsSync(outPath)) { skipped += 1; continue; }
    const vttPath = join(cacheDir, 'vtt', `${m.vimeo_id}.vtt`);
    if (!existsSync(vttPath)) { pending += 1; continue; }

    const body = vttToProse(readFileSync(vttPath, 'utf8'), `https://vimeo.com/${m.vimeo_id}`);
    if (!body) {
      console.error(`- ${slug}: empty VTT, skipping`);
      continue;
    }
    if (dryRun) {
      console.error(`- would write ${outPath}`);
      written += 1;
      continue;
    }
    const md = renderTranscript({
      board_slug: m.board_slug,
      board_display: m.board_display,
      date: m.date,
      vimeo_id: m.vimeo_id,
      duration_seconds: durations.get(m.vimeo_id) ?? 0,
      body,
      source: 'whisper-local',
    });
    writeFileSync(outPath, md);
    console.error(`- wrote ${outPath} (${md.length} bytes)`);
    written += 1;
  }

  console.error(`Done. written=${written} already_present=${skipped} no_vtt_yet=${pending}`);
}

main();
