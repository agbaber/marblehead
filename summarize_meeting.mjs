#!/usr/bin/env node
/**
 * summarize_meeting.mjs
 *
 * Takes a meeting transcript (VTT, SRT, or plain text) and produces a
 * structured JSON summary using the Claude API. Saves summaries into
 * data/meetings.json alongside the video metadata.
 *
 * Usage:
 *   node summarize_meeting.mjs <video_id> <transcript_file>
 *   node summarize_meeting.mjs 1184114075 transcripts/select-board-4-15-26.vtt
 *   node summarize_meeting.mjs --batch transcripts/   # summarize all transcripts in a directory
 *
 * Requires ANTHROPIC_API_KEY in environment or .env file.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

/* ── Config ─────────────────────────────────────────────────────────── */

const MEETINGS_FILE = 'data/meetings.json';
const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 2048;

/* ── Load API key ───────────────────────────────────────────────────── */

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Try .env file
  if (existsSync('.env')) {
    const env = readFileSync('.env', 'utf-8');
    const match = env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  }
  console.error('Error: ANTHROPIC_API_KEY not found in environment or .env file.');
  process.exit(1);
}

/* ── Parse transcript formats ───────────────────────────────────────── */

function parseVtt(text) {
  // Strip VTT header and timing lines, keep only spoken text
  return text
    .replace(/^WEBVTT\s*\n/i, '')
    .replace(/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->.*$/gm, '')
    .replace(/^\d+\s*$/gm, '')      // sequence numbers in SRT
    .replace(/^NOTE\s+.*$/gm, '')    // VTT notes
    .replace(/<[^>]+>/g, '')         // strip HTML tags
    .replace(/\n{3,}/g, '\n\n')     // collapse blank lines
    .trim();
}

function parseSrt(text) {
  return parseVtt(text); // same cleanup works for SRT
}

function loadTranscript(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const ext = filePath.toLowerCase().split('.').pop();

  if (ext === 'vtt')           return parseVtt(raw);
  if (ext === 'srt')           return parseSrt(raw);
  // Plain text or unknown: use as-is
  return raw.trim();
}

/* ── Claude API call ────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a neutral, factual summarizer of municipal government meetings for a civic data website in Marblehead, MA. Your summaries help residents quickly understand what happened at town board meetings.

Rules:
- Be factual and neutral. No editorial language, no "shocking" or "concerning" framing.
- State what was discussed, decided, and voted on.
- Include specific numbers, dates, and names when mentioned.
- Note any public comment themes.
- If the override, budget, or Proposition 2.5 are discussed, capture the specifics.
- Keep the summary concise but complete. Residents should be able to skip the 2-hour video and know what happened.

Output valid JSON with this structure:
{
  "summary": "2-4 sentence overview of the meeting",
  "topics": [
    {
      "title": "Topic name",
      "detail": "What was discussed or decided",
      "vote": "If a vote occurred: motion, result, and tally"
    }
  ],
  "public_comment_themes": ["theme1", "theme2"],
  "key_numbers": [
    { "label": "description", "value": "$X" }
  ],
  "action_items": ["item1", "item2"],
  "override_relevant": true/false,
  "override_details": "If override_relevant, what specifically was said about the override"
}`;

async function summarize(transcript, meetingTitle) {
  const apiKey = getApiKey();

  // Truncate very long transcripts to stay within context limits
  // Claude Sonnet has 200K context; a 3-hour meeting transcript is ~40K words (~50K tokens)
  const maxChars = 400000; // ~100K tokens, well within limits
  const truncated = transcript.length > maxChars
    ? transcript.slice(0, maxChars) + '\n\n[Transcript truncated due to length]'
    : transcript;

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Summarize this ${meetingTitle} meeting transcript:\n\n${truncated}`
      }
    ]
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = data.content[0]?.text || '';

  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response:\n' + text.slice(0, 500));
  }

  return JSON.parse(jsonMatch[0]);
}

/* ── Match transcript file to video ID ──────────────────────────────── */

function guessVideoId(filename, meetings) {
  // Try to match by date and board name in filename
  // Filename patterns: select-board-4-15-26.vtt, fincom-3-28-26.vtt, etc.
  const name = filename.toLowerCase().replace(/\.[^.]+$/, '');

  for (const v of meetings) {
    if (!v.date) continue;
    const titleSlug = v.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-');
    // Check if filename contains the video ID
    if (name.includes(v.id)) return v.id;
    // Check if date parts match
    const [y, m, d] = v.date.split('-');
    const shortYear = y.slice(2);
    const datePatterns = [
      `${parseInt(m)}-${parseInt(d)}-${shortYear}`,
      `${parseInt(m)}.${parseInt(d)}.${shortYear}`,
      `${y}-${m}-${d}`,
    ];
    for (const dp of datePatterns) {
      if (name.includes(dp)) return v.id;
    }
  }
  return null;
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node summarize_meeting.mjs <video_id> <transcript_file>');
    console.log('  node summarize_meeting.mjs --batch <transcripts_directory>');
    process.exit(0);
  }

  // Load existing meetings data
  if (!existsSync(MEETINGS_FILE)) {
    console.error(`Error: ${MEETINGS_FILE} not found. Run pull_meetings.mjs first.`);
    process.exit(1);
  }
  const meetingsData = JSON.parse(readFileSync(MEETINGS_FILE, 'utf-8'));

  if (args[0] === '--batch') {
    // Batch mode: process all transcript files in a directory
    const dir = args[1] || 'transcripts';
    if (!existsSync(dir)) {
      console.error(`Directory not found: ${dir}`);
      process.exit(1);
    }

    const files = readdirSync(dir).filter(f => /\.(vtt|srt|txt)$/i.test(f));
    console.log(`Found ${files.length} transcript files in ${dir}/\n`);

    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const videoId = guessVideoId(file, meetingsData.videos);
      if (!videoId) {
        console.log(`  Skipping ${file}: could not match to a video ID`);
        continue;
      }

      const video = meetingsData.videos.find(v => v.id === videoId);
      console.log(`  Summarizing: ${video.title}...`);

      try {
        const transcript = loadTranscript(filePath);
        const summary = await summarize(transcript, video.title);
        video.summary = summary;
        video.transcript_file = filePath;
        console.log(`    Done: ${summary.topics?.length || 0} topics, override_relevant: ${summary.override_relevant}`);
      } catch (e) {
        console.error(`    Error: ${e.message}`);
      }

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    // Single file mode: video_id transcript_file
    const videoId = args[0];
    const transcriptFile = args[1];

    if (!transcriptFile) {
      console.error('Usage: node summarize_meeting.mjs <video_id> <transcript_file>');
      process.exit(1);
    }

    const video = meetingsData.videos.find(v => v.id === videoId);
    if (!video) {
      console.error(`Video ID ${videoId} not found in ${MEETINGS_FILE}`);
      process.exit(1);
    }

    console.log(`Summarizing: ${video.title}`);
    const transcript = loadTranscript(transcriptFile);
    console.log(`Transcript: ${transcript.length} chars`);

    const summary = await summarize(transcript, video.title);
    video.summary = summary;
    video.transcript_file = transcriptFile;

    console.log(`\nSummary: ${summary.summary}`);
    console.log(`Topics: ${summary.topics?.length || 0}`);
    console.log(`Override relevant: ${summary.override_relevant}`);
    if (summary.override_details) {
      console.log(`Override details: ${summary.override_details}`);
    }
  }

  // Save updated meetings data
  writeFileSync(MEETINGS_FILE, JSON.stringify(meetingsData, null, 2));
  console.log(`\nSaved to ${MEETINGS_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
