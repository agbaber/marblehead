#!/usr/bin/env node
/**
 * Enumerate the Marblehead Public Schools YouTube channel via yt-dlp
 * --flat-playlist, classify each video by board (defaulting to
 * school-committee via parseTitle's boardHint), and write
 * data/youtube_meetings.json.
 *
 * For videos whose title contains the board but no date (the channel has
 * many of these, e.g. "Marblehead School Committee Meeting" with no date
 * appended), this script does a per-video yt-dlp call to fetch upload_date
 * and tags the entry with `date_approximate: true`. That per-video call
 * requires un-bot-detected access to youtube.com — works from GitHub
 * Actions, may not work from random VPS IPs.
 *
 * Usage:
 *   node scripts/transcripts/pull_youtube.mjs [--out data/youtube_meetings.json]
 *
 * Output schema mirrors data/vimeo_meetings.json but with:
 *   - `youtube_id` instead of `vimeo_id`
 *   - `date_approximate: true` on entries that fell back to upload_date
 *   - a top-level `failed` array for titles that could not be classified
 *     (no date in title, no upload_date available, or no board match)
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseTitle } from './lib/parse_title.mjs';

const CHANNEL_URL = 'https://www.youtube.com/channel/UC3mmZuBmhKUJsXeWbqwFQJQ';
const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;
const BOARD_HINT = 'school-committee';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : 'data/youtube_meetings.json';

function enumerateChannel() {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, [
      '--flat-playlist',
      '--print', '%(id)s|%(title)s|%(duration)s',
      '--no-warnings',
      CHANNEL_URL,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`yt-dlp exited ${code}: ${stderr}`));
      resolve(stdout);
    });
  });
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// upload_date arrives as YYYYMMDD; convert to ISO YYYY-MM-DD.
function fetchUploadDate(youtubeId) {
  const res = spawnSync(YT_DLP, [
    '--print', '%(upload_date)s',
    '--skip-download',
    '--no-warnings',
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ], { encoding: 'utf8' });
  const raw = (res.stdout ?? '').trim();
  if (!/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

async function main() {
  console.error(`Enumerating ${CHANNEL_URL} via yt-dlp ...`);
  const raw = await enumerateChannel();
  const lines = raw.split('\n').filter(l => l.includes('|'));
  console.error(`Got ${lines.length} videos from channel.`);

  const meetings = [];
  const failed = [];
  for (const line of lines) {
    const parts = line.split('|');
    const youtube_id = parts[0]?.trim();
    const raw_title = decode((parts[1] ?? '').trim());
    const durationSeconds = Number(parts[2]?.trim());
    if (!youtube_id || !raw_title) continue;

    const parsed = parseTitle(raw_title, { boardHint: BOARD_HINT });

    if (parsed.valid) {
      meetings.push({
        youtube_id,
        title: raw_title,
        board_slug: parsed.board_slug,
        board_display: parsed.board_display,
        date: parsed.date,
        date_approximate: false,
        duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
        raw_title,
      });
      continue;
    }

    // Recoverable: we know the board, just not the date — try upload_date.
    if (parsed.reason === 'no date in title' && parsed.board_slug) {
      const uploadDate = fetchUploadDate(youtube_id);
      if (uploadDate) {
        meetings.push({
          youtube_id,
          title: raw_title,
          board_slug: parsed.board_slug,
          board_display: parsed.board_display,
          date: uploadDate,
          date_approximate: true,
          duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
          raw_title,
        });
        continue;
      }
      failed.push({ youtube_id, raw_title, reason: 'no date in title; upload_date fetch failed' });
      continue;
    }

    // Unrecoverable: not classifiable.
    failed.push({ youtube_id, raw_title, reason: parsed.reason ?? 'unclassified' });
  }

  meetings.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const output = {
    last_updated: new Date().toISOString(),
    channel_url: CHANNEL_URL,
    total_videos: lines.length,
    meetings,
    failed,
  };
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.error(`Wrote ${meetings.length} in-scope meetings (${failed.length} unclassified) to ${outPath}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
