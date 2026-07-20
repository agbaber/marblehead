import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTranscript, buildSlug, buildTitle } from './render_transcript.mjs';

test('buildSlug joins board-slug and ISO date', () => {
  assert.equal(buildSlug('select-board', '2026-04-22'), 'select-board-2026-04-22');
});

test('buildTitle produces "Select Board: April 22, 2026"', () => {
  assert.equal(buildTitle('Select Board', '2026-04-22'), 'Select Board: April 22, 2026');
});

test('buildTitle handles January and December correctly', () => {
  assert.equal(buildTitle('Board of Health', '2024-01-03'), 'Board of Health: January 3, 2024');
  assert.equal(buildTitle('Town Meeting', '2025-12-31'), 'Town Meeting: December 31, 2025');
});

test('renderTranscript emits Jekyll frontmatter with required fields', () => {
  const md = renderTranscript({
    board_slug: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    vimeo_id: '1185906675',
    duration_seconds: 2969,
    body: '**[0:00](https://vimeo.com/1185906675#t=0s)** Hello.',
  });
  assert.match(md, /^---\n/);
  assert.match(md, /\nslug: select-board-2026-04-22\n/);
  assert.match(md, /\nboard: select-board\n/);
  assert.match(md, /\nboard_display: "Select Board"\n/);
  assert.match(md, /\ndate: 2026-04-22\n/);
  assert.match(md, /\ntitle: "Select Board: April 22, 2026"\n/);
  assert.match(md, /\nvimeo_id: 1185906675\n/);
  assert.match(md, /\nvimeo_url: "https:\/\/vimeo\.com\/1185906675"\n/);
  assert.match(md, /\nduration_seconds: 2969\n/);
  assert.match(md, /\nai_generated: true\n/);
  assert.match(md, /\nstatus: published\n/);
  assert.match(md, /\nsource: vimeo-auto\n/);
  assert.match(md, /---\n\n> /); // disclaimer follows frontmatter
});

test('renderTranscript includes a clear no-speaker-labels disclaimer', () => {
  const md = renderTranscript({
    board_slug: 'school-committee',
    board_display: 'School Committee',
    date: '2025-10-30',
    vimeo_id: '1029384756',
    duration_seconds: 7200,
    body: '**[0:00](https://vimeo.com/1029384756#t=0s)** Hello.',
  });
  assert.match(md, /Vimeo.*auto-?captioning/i);
  assert.match(md, /no speaker labels/i);
});

test('renderTranscript places body after disclaimer', () => {
  const md = renderTranscript({
    board_slug: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    vimeo_id: '1185906675',
    duration_seconds: 2969,
    body: '**[0:00](https://vimeo.com/1185906675#t=0s)** Sample body.',
  });
  const bodyIndex = md.indexOf('Sample body');
  const disclaimerIndex = md.indexOf('Vimeo');
  assert.ok(disclaimerIndex >= 0 && bodyIndex > disclaimerIndex);
});

// --- YouTube source ----------------------------------------------------------
// Transcripts rendered from the MPS YouTube channel get a YouTube-flavoured
// disclaimer and a youtube.com watch link. The site layouts read `video_url`
// (with `vimeo_url` as fallback) so both sources render uniformly.

test('renderTranscript emits youtube-auto source and disclaimer for YouTube', () => {
  const md = renderTranscript({
    board_slug: 'school-committee',
    board_display: 'School Committee',
    date: '2026-04-09',
    youtube_id: 'UMABNnY3zeQ',
    duration_seconds: 10800,
    body: '**[0:00](https://www.youtube.com/watch?v=UMABNnY3zeQ&t=0s)** Hello.',
    source: 'youtube-auto',
  });
  assert.match(md, /\nsource: youtube-auto\n/);
  assert.match(md, /\nyoutube_id: UMABNnY3zeQ\n/);
  assert.match(md, /\nvideo_url: "https:\/\/www\.youtube\.com\/watch\?v=UMABNnY3zeQ"\n/);
  assert.match(md, /YouTube.*auto-?captioning/i);
  assert.doesNotMatch(md, /MHTV/);
  assert.doesNotMatch(md, /\nvimeo_id:/);
  assert.doesNotMatch(md, /\nvimeo_url:/);
});

test('renderTranscript emits both video_url and vimeo_url for Vimeo (back-compat)', () => {
  const md = renderTranscript({
    board_slug: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    vimeo_id: '1185906675',
    duration_seconds: 2969,
    body: 'x',
  });
  assert.match(md, /\nvimeo_url: "https:\/\/vimeo\.com\/1185906675"\n/);
  assert.match(md, /\nvideo_url: "https:\/\/vimeo\.com\/1185906675"\n/);
});

test('renderTranscript marks date_approximate when set', () => {
  // A dateless MPS YouTube title (like gYE7TlHvW9o) gets dated from
  // upload_date, with a flag the layout can surface.
  const md = renderTranscript({
    board_slug: 'school-committee',
    board_display: 'School Committee',
    date: '2024-03-15',
    youtube_id: 'gYE7TlHvW9o',
    duration_seconds: 7200,
    body: 'x',
    source: 'youtube-auto',
    date_approximate: true,
  });
  assert.match(md, /\ndate_approximate: true\n/);
});
