import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidates } from './select_candidates.mjs';

const fm = (o) => [
  '---',
  o.board ? `board: ${o.board}` : '',
  o.source ? `source: ${o.source}` : '',
  o.ingest ? 'ingest: true' : '',
  o.enriched ? 'summary_card:\n  headline: x' : '',
  '---',
  'body',
].filter(Boolean).join('\n');

test('skips already-enriched files by default', () => {
  const items = [
    { slug: 'a', text: fm({ source: 'whisper-local' }) },
    { slug: 'b', text: fm({ source: 'whisper-local', enriched: true }) },
  ];
  const out = selectCandidates(items, {});
  assert.deepEqual(out.map((i) => i.slug), ['a']);
});

test('force re-includes enriched files', () => {
  const items = [{ slug: 'b', text: fm({ enriched: true }) }];
  assert.equal(selectCandidates(items, { force: true }).length, 1);
});

test('always skips hand-crafted ingest: POCs even with force', () => {
  const items = [{ slug: 'p', text: fm({ ingest: true }) }];
  assert.equal(selectCandidates(items, { force: true }).length, 0);
});

test('source filter keeps only the matching source', () => {
  const items = [
    { slug: 'a', text: fm({ source: 'whisper-local' }) },
    { slug: 'b', text: fm({ source: 'youtube-auto' }) },
  ];
  const out = selectCandidates(items, { source: 'whisper-local' });
  assert.deepEqual(out.map((i) => i.slug), ['a']);
});

test('skipBoards drops matching boards', () => {
  const items = [
    { slug: 'a', text: fm({ board: 'board-of-health' }) },
    { slug: 'b', text: fm({ board: 'select-board' }) },
  ];
  const out = selectCandidates(items, { skipBoards: new Set(['board-of-health']) });
  assert.deepEqual(out.map((i) => i.slug), ['b']);
});

test('maxBatch caps the returned count', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ slug: `s${i}`, text: fm({}) }));
  assert.equal(selectCandidates(items, { maxBatch: 3 }).length, 3);
});

test('maxBatch of 0 or undefined means no cap', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ slug: `s${i}`, text: fm({}) }));
  assert.equal(selectCandidates(items, {}).length, 5);
});
