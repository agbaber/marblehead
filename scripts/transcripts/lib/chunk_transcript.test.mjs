import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBody } from './chunk_transcript.mjs';

// A transcript body is blank-line-separated timecoded paragraphs.
function para(sec, text) {
  const h = Math.floor(sec / 3600);
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `**[${h}:${m}:${s}](https://vimeo.com/123#t=${sec}s)** ${text}`;
}

test('returns a single chunk when the body is under the limit', () => {
  const body = [para(0, 'alpha'), para(10, 'beta')].join('\n\n');
  const chunks = chunkBody(body, 1000);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], { text: body, index: 0, total: 1 });
});

test('splits an oversized body into ordered chunks under the limit', () => {
  const paras = Array.from({ length: 10 }, (_, i) => para(i * 10, 'x'.repeat(80)));
  const body = paras.join('\n\n');
  // Each paragraph is ~120 chars; a 300-char limit forces multiple chunks.
  const chunks = chunkBody(body, 300);
  assert.ok(chunks.length > 1, 'should produce more than one chunk');
  for (const c of chunks) {
    assert.ok(c.text.length <= 300, `chunk ${c.index} over limit: ${c.text.length}`);
  }
  // index/total metadata is coherent.
  chunks.forEach((c, i) => {
    assert.equal(c.index, i);
    assert.equal(c.total, chunks.length);
  });
});

test('rejoining chunks reproduces every paragraph in order', () => {
  const paras = Array.from({ length: 12 }, (_, i) => para(i * 10, `line ${i}`));
  const body = paras.join('\n\n');
  const chunks = chunkBody(body, 60);
  const rejoined = chunks.map((c) => c.text).join('\n\n');
  assert.deepEqual(rejoined.split('\n\n'), paras);
});

test('never splits a single paragraph, even if it exceeds the limit', () => {
  const big = para(0, 'y'.repeat(500));
  const small = para(30, 'z');
  const body = [big, small].join('\n\n');
  const chunks = chunkBody(body, 200);
  // The oversized paragraph stays intact in its own chunk.
  assert.ok(chunks.some((c) => c.text === big), 'oversized paragraph must remain whole');
  // And no chunk ever cuts inside a timecode link.
  for (const c of chunks) {
    const opens = (c.text.match(/\*\*\[/g) || []).length;
    const closes = (c.text.match(/\)\*\* /g) || []).length;
    assert.equal(opens, closes, `chunk ${c.index} split a paragraph`);
  }
});

test('treats a body with no blank-line separators as one chunk', () => {
  const body = para(0, 'only one paragraph, no separators');
  const chunks = chunkBody(body, 5);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, body);
});
