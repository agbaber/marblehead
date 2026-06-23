import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFrontmatter } from './merge_frontmatter.mjs';

const EXISTING = `---
slug: select-board-2026-05-27
board: select-board
board_display: "Select Board"
date: 2026-05-27
title: "Select Board: May 27, 2026"
vimeo_id: 1196731483
vimeo_url: "https://vimeo.com/1196731483"
duration_seconds: 3000
ai_generated: true
status: published
source: vimeo-auto
---

> Transcript captured from MHTV's Vimeo auto-captioning. No speaker labels;
> proper names and dollar figures occasionally misheard.

**[0:00](https://vimeo.com/1196731483#t=0s)** First paragraph.

**[0:45](https://vimeo.com/1196731483#t=45s)** Second paragraph.
`;

const SUMMARY_CARD = {
  headline: 'Sample headline',
  summary: 'Sample summary text.',
  decisions: ['Decided X', 'Decided Y'],
  votes: [{ motion: 'Approve X', result: 'in favor (unanimous)' }],
};

const TOPIC_SEGMENTS = [
  {
    topic: 'override',
    topic_confidence: 0.9,
    start_seconds: 0,
    end_seconds: 300,
    featured: true,
    headline: 'Override headline',
    dek: 'Override dek.',
    summary: 'Override summary text.',
    key_speakers: ['Chair Fox'],
  },
];

test('mergeFrontmatter inserts new YAML keys before closing ---', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.match(out, /\nsummary_card:\n  headline: "Sample headline"\n/);
  assert.match(out, /\ntopic_segments:\n  - topic: override\n/);
});

test('mergeFrontmatter upgrades source to vimeo-auto+llm', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.match(out, /\nsource: vimeo-auto\+llm\n/);
  assert.doesNotMatch(out, /\nsource: vimeo-auto\n/);
});

test('mergeFrontmatter preserves the body verbatim', () => {
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.ok(out.includes('**[0:00](https://vimeo.com/1196731483#t=0s)** First paragraph.'));
  assert.ok(out.includes('**[0:45](https://vimeo.com/1196731483#t=45s)** Second paragraph.'));
  assert.ok(out.includes('> Transcript captured from MHTV'));
});

test('mergeFrontmatter is idempotent: second call replaces the previous summary block', () => {
  const once = mergeFrontmatter(EXISTING, SUMMARY_CARD, TOPIC_SEGMENTS);
  const twice = mergeFrontmatter(once, { ...SUMMARY_CARD, headline: 'Replaced' }, TOPIC_SEGMENTS);
  assert.match(twice, /headline: "Replaced"/);
  // Only one summary_card block in the output.
  assert.equal((twice.match(/^summary_card:/gm) || []).length, 1);
});

test('mergeFrontmatter escapes double quotes in headline and summary', () => {
  const out = mergeFrontmatter(EXISTING, { ...SUMMARY_CARD, headline: 'He said "yes"' }, TOPIC_SEGMENTS);
  assert.match(out, /\n  headline: "He said \\"yes\\""\n/);
});

test('mergeFrontmatter uses YAML block scalar (|) for multi-line topic summaries', () => {
  const segs = [{ ...TOPIC_SEGMENTS[0], summary: 'Line one.\n\nLine two with **bold**.' }];
  const out = mergeFrontmatter(EXISTING, SUMMARY_CARD, segs);
  assert.match(out, /summary: \|/);
  assert.ok(out.includes('Line two with **bold**.'));
});

test('mergeFrontmatter upgrades source to youtube-auto+llm for YouTube transcripts', () => {
  const yt = EXISTING
    .replace(/^vimeo_id:.*$/m, 'youtube_id: UMABNnY3zeQ')
    .replace(/^vimeo_url:.*$/m, 'video_url: "https://www.youtube.com/watch?v=UMABNnY3zeQ"')
    .replace(/^source: vimeo-auto$/m, 'source: youtube-auto');
  const out = mergeFrontmatter(yt, SUMMARY_CARD, TOPIC_SEGMENTS);
  assert.match(out, /\nsource: youtube-auto\+llm\n/);
  assert.doesNotMatch(out, /\nsource: youtube-auto\n/);
});
