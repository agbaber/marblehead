#!/usr/bin/env node
/**
 * Watchdog CLI: report recently-published MHTV Vimeo meetings that still have
 * no transcript. Run pull_vimeo.mjs FIRST so data/vimeo_meetings.json reflects
 * the live channel — otherwise a frozen committed index hides the very gap we
 * are trying to detect (the July 2026 failure).
 *
 * Usage:
 *   node scripts/transcripts/pull_vimeo.mjs
 *   node scripts/transcripts/check_stale_meetings.mjs
 *
 * Prints a JSON summary to stdout: { stale_count, stale: [...] }.
 * Also appends `stale_count` and `stale_json` to $GITHUB_OUTPUT when set, so a
 * workflow can branch on the result. Always exits 0 (the workflow decides what
 * a non-zero count means); exits 2 only if the index file is missing.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findStaleMeetings } from './lib/stale_meetings.mjs';

const INDEX = process.env.VIMEO_INDEX ?? 'data/vimeo_meetings.json';
const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR ?? '_transcripts';
const graceDays = process.env.STALE_GRACE_DAYS ? Number(process.env.STALE_GRACE_DAYS) : undefined;
const maxDays = process.env.STALE_MAX_DAYS ? Number(process.env.STALE_MAX_DAYS) : undefined;

if (!existsSync(INDEX)) {
  console.error(`Index ${INDEX} not found. Run pull_vimeo.mjs first.`);
  process.exit(2);
}

const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const hasTranscript = (slug) => existsSync(join(TRANSCRIPTS_DIR, `${slug}.md`));
const stale = findStaleMeetings(index, hasTranscript, { graceDays, maxDays });

const summary = { stale_count: stale.length, stale };
console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `stale_count=${stale.length}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `stale_json=${JSON.stringify(stale)}\n`);
}
