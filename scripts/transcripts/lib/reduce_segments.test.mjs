import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concatSegments } from './reduce_segments.mjs';

const seg = (start, end, extra = {}) => ({
  topic: 'admin-housekeeping',
  start_seconds: start,
  end_seconds: end,
  headline: `h${start}`,
  summary: `s${start}`,
  ...extra,
});

test('concatenates per-chunk segment arrays in order', () => {
  const out = concatSegments([
    [seg(0, 100), seg(100, 200)],
    [seg(200, 300)],
  ]);
  assert.deepEqual(out.map((s) => s.start_seconds), [0, 100, 200]);
});

test('keeps at most one featured segment, first occurrence wins', () => {
  const out = concatSegments([
    [seg(0, 100, { featured: true })],
    [seg(100, 200, { featured: true }), seg(200, 300)],
  ]);
  const featured = out.filter((s) => s.featured === true);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].start_seconds, 0);
});

test('output start_seconds is non-decreasing even if a chunk is locally out of order', () => {
  const out = concatSegments([
    [seg(0, 100), seg(200, 300), seg(100, 200)], // model emitted a local inversion
  ]);
  const starts = out.map((s) => s.start_seconds);
  const sorted = [...starts].sort((a, b) => a - b);
  assert.deepEqual(starts, sorted);
});

test('returns an empty array when every chunk is empty', () => {
  assert.deepEqual(concatSegments([[], []]), []);
});

test('does not mutate the input segment objects', () => {
  const s = seg(0, 100, { featured: true });
  const s2 = seg(100, 200, { featured: true });
  concatSegments([[s], [s2]]);
  assert.equal(s.featured, true);
  assert.equal(s2.featured, true);
});
