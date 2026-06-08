#!/usr/bin/env node
/**
 * Enumerate the MHTV Vimeo channel via yt-dlp --flat-playlist, filter to
 * the five default boards, and write data/vimeo_meetings.json.
 *
 * Usage:
 *   node scripts/transcripts/pull_vimeo.mjs [--out data/vimeo_meetings.json]
 *
 * Output schema:
 *   {
 *     "last_updated": "2026-06-08T12:34:56.000Z",
 *     "channel_url": "https://vimeo.com/marbleheadtv",
 *     "total_videos": 2791,
 *     "meetings": [
 *       { "vimeo_id": "1196731483", "title": "...", "board_slug": "select-board",
 *         "board_display": "Select Board", "date": "2026-05-27", "raw_title": "..." }
 *     ]
 *   }
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseTitle } from './lib/parse_title.mjs';

const CHANNEL_URL = 'https://vimeo.com/marbleheadtv';
const YT_DLP = process.env.YT_DLP ?? `${process.env.HOME}/.local/bin/yt-dlp`;

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : 'data/vimeo_meetings.json';

function enumerateChannel() {
  return new Promise((resolve, reject) => {
    // Using '|' as separator; verified against the live channel during plan
    // research. yt-dlp's --print does not interpret backslash escapes like \t.
    const proc = spawn(YT_DLP, [
      '--flat-playlist',
      '--print', '%(id)s|%(title)s',
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

async function main() {
  console.error(`Enumerating ${CHANNEL_URL} via yt-dlp ...`);
  const raw = await enumerateChannel();
  const lines = raw.split('\n').filter(l => l.includes('|'));
  console.error(`Got ${lines.length} videos from channel.`);

  const meetings = [];
  for (const line of lines) {
    const sep = line.indexOf('|');
    const vimeo_id = line.slice(0, sep).trim();
    const raw_title = decode(line.slice(sep + 1).trim());
    const parsed = parseTitle(raw_title);
    if (parsed.valid) {
      meetings.push({
        vimeo_id,
        title: raw_title,
        board_slug: parsed.board_slug,
        board_display: parsed.board_display,
        date: parsed.date,
        raw_title,
      });
    }
  }
  meetings.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const output = {
    last_updated: new Date().toISOString(),
    channel_url: CHANNEL_URL,
    total_videos: lines.length,
    meetings,
  };
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.error(`Wrote ${meetings.length} in-scope meetings to ${outPath}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
