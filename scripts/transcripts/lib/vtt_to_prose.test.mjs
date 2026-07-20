import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVtt, coalesceCues, vttToProse } from './vtt_to_prose.mjs';

const SAMPLE = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
Hello and welcome.

2
00:00:02.500 --> 00:00:05.000
Tonight's meeting will come to order.

3
00:01:00.000 --> 00:01:03.000
Moving on to old business.
`;

test('parseVtt extracts cues with start_seconds and text', () => {
  const cues = parseVtt(SAMPLE);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].start_seconds, 0);
  assert.equal(cues[0].text, 'Hello and welcome.');
  assert.equal(cues[2].start_seconds, 60);
});

test('parseVtt strips entity references like &amp;', () => {
  const cues = parseVtt('WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nA &amp; B\n');
  assert.equal(cues[0].text, 'A & B');
});

test('coalesceCues breaks on long pauses', () => {
  const cues = parseVtt(SAMPLE);
  const paragraphs = coalesceCues(cues, { pauseBreakSeconds: 2.0, targetSeconds: 600 });
  // 55-second gap between cue 2 (ends at 5s) and cue 3 (starts at 60s) -> two paragraphs.
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].start_seconds, 0);
  assert.equal(paragraphs[1].start_seconds, 60);
  assert.match(paragraphs[0].text, /Hello and welcome\. Tonight's meeting/);
  assert.match(paragraphs[1].text, /Moving on to old business/);
});

test('coalesceCues breaks on paragraph target', () => {
  const cues = [
    { start_seconds: 0, end_seconds: 1, text: 'A.' },
    { start_seconds: 1, end_seconds: 2, text: 'B.' },
    { start_seconds: 2, end_seconds: 3, text: 'C.' },
  ];
  const paragraphs = coalesceCues(cues, { pauseBreakSeconds: 5, targetSeconds: 1.5 });
  // First cue starts at 0, third cue starts at 2 > 1.5 -> break after second cue.
  assert.equal(paragraphs.length, 2);
});

test('coalesceCues defaults: 90s paragraphs, 4s pause break', () => {
  // 3s gap (under the 4s default) must NOT break; 60s of speech must not
  // break either (under the 90s target).
  const cues = [
    { start_seconds: 0, end_seconds: 30, text: 'A.' },
    { start_seconds: 33, end_seconds: 60, text: 'B.' },
    { start_seconds: 61, end_seconds: 95, text: 'C.' },
    // 96s from paragraph start exceeds the 90s target -> new paragraph.
    { start_seconds: 96, end_seconds: 100, text: 'D.' },
  ];
  const paragraphs = coalesceCues(cues);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[1].text, 'D.');
});

test('vttToProse formats each paragraph with a Vimeo deep-link anchor', () => {
  const md = vttToProse(SAMPLE, 'https://vimeo.com/1234567890');
  assert.match(md, /\[0:00\]\(https:\/\/vimeo\.com\/1234567890#t=0s\)/);
  assert.match(md, /\[1:00\]\(https:\/\/vimeo\.com\/1234567890#t=60s\)/);
});

test('vttToProse on empty input returns empty string', () => {
  assert.equal(vttToProse('WEBVTT\n', 'https://vimeo.com/x'), '');
});

test('vttToProse uses YouTube ?t/&t fragment syntax for youtube.com URLs', () => {
  const md = vttToProse(SAMPLE, 'https://www.youtube.com/watch?v=UMABNnY3zeQ');
  assert.match(md, /\[0:00\]\(https:\/\/www\.youtube\.com\/watch\?v=UMABNnY3zeQ&t=0s\)/);
  assert.match(md, /\[1:00\]\(https:\/\/www\.youtube\.com\/watch\?v=UMABNnY3zeQ&t=60s\)/);
});

test('vttToProse uses YouTube ?t fragment syntax for youtu.be short URLs', () => {
  const md = vttToProse(SAMPLE, 'https://youtu.be/UMABNnY3zeQ');
  assert.match(md, /\[0:00\]\(https:\/\/youtu\.be\/UMABNnY3zeQ\?t=0s\)/);
});
