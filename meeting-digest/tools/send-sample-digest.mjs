#!/usr/bin/env node
// Send a sample Friday digest to a single email, using real transcripts from
// _transcripts/. Bypasses D1, the 7-AM-ET guard, and the 7-day window so you
// can preview what subscribers will receive without waiting for a real Friday.
//
// Usage (from repo root):
//   RESEND_API_KEY=re_... node meeting-digest/tools/send-sample-digest.mjs you@example.com
//
// Optional second arg picks how many of the most recent matching transcripts
// to include (default: 3).

import { readFile, readdir } from 'node:fs/promises';
import { parseTranscript, extractDateFromFilename } from '../worker/src/lib/transcripts.js';
import { matchTranscripts } from '../worker/src/lib/matcher.js';
import { renderHtml, renderText, renderSubject } from '../worker/src/lib/render.js';
import { DEFAULT_BOARDS_ON_SIGNUP, TOPICS } from '../worker/src/lib/topics.js';

const [, , toArg, countArg] = process.argv;
const TO = toArg || 'agbaber@gmail.com';
const COUNT = Number(countArg) || 3;
const API_KEY = process.env.RESEND_API_KEY;
if (!API_KEY) {
  console.error('Set RESEND_API_KEY in env.');
  process.exit(1);
}

const TRANSCRIPT_DIR = new URL('../../_transcripts/', import.meta.url);
const all = (await readdir(TRANSCRIPT_DIR))
  .filter(f => f.endsWith('.md'))
  .map(f => ({ f, date: extractDateFromFilename(f) }))
  .filter(x => x.date)
  .sort((a, b) => b.date.localeCompare(a.date))
  .map(x => x.f);

const subscription = {
  boards: DEFAULT_BOARDS_ON_SIGNUP,
  topics: TOPICS.map(t => t.slug)
};

const matches = [];
for (const f of all) {
  const text = await readFile(new URL(f, TRANSCRIPT_DIR), 'utf-8');
  const t = parseTranscript(f, text);
  if (!t) continue;
  const oneMatch = matchTranscripts([t], subscription);
  if (oneMatch.length > 0) matches.push(oneMatch[0]);
  if (matches.length >= COUNT) break;
}

if (matches.length === 0) {
  console.error('No matching transcripts found.');
  process.exit(1);
}

const subscriber = {
  email: TO,
  manage_token: 'SAMPLE-PREVIEW-TOKEN'
};
const env = { SITE_BASE_URL: 'https://marbleheaddata.org' };
const weekEnding = new Date().toISOString().slice(0, 10);

const subject = '[PREVIEW] ' + renderSubject(matches);
const html = renderHtml(matches, subscriber, env, weekEnding);
const text = renderText(matches, subscriber, env, weekEnding);

const resp = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'Marblehead Data <digest@meetings.marbleheaddata.org>',
    to: [TO],
    subject,
    html,
    text,
    reply_to: 'agbaber@gmail.com'
  })
});

const result = await resp.json();
if (!resp.ok) {
  console.error('Resend error:', resp.status, result);
  process.exit(1);
}
console.log(`Sent ${matches.length}-meeting sample digest to ${TO} (resend id: ${result.id})`);
console.log('Meetings:');
for (const m of matches) {
  console.log(`  - ${m.transcript.board_display}: ${m.transcript.summary_card?.headline || m.transcript.title}`);
}
