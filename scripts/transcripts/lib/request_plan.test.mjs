import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequests, parseCustomId } from './request_plan.mjs';

const md = (slug, body) => `---\nslug: ${slug}\nsource: vimeo-auto\n---\n${body}`;

const opts = { systemPrompt: 'SYS', model: 'claude-x', maxTokens: 100, maxChars: 300 };

function para(sec, text) {
  return `**[0:00:${String(sec).padStart(2, '0')}](https://vimeo.com/1#t=${sec}s)** ${text}`;
}

test('a small transcript becomes exactly one request keyed by slug', () => {
  const reqs = buildRequests([{ slug: 'sc-2025-01-01', text: md('sc-2025-01-01', 'short body') }], opts);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].custom_id, 'sc-2025-01-01');
  assert.equal(reqs[0].params.model, 'claude-x');
  assert.equal(reqs[0].params.max_tokens, 100);
  assert.equal(reqs[0].params.system[0].text, 'SYS');
  assert.equal(reqs[0].params.messages[0].content, 'short body');
});

test('an oversized transcript fans out into chunk requests with i-of-K custom_ids', () => {
  const body = Array.from({ length: 8 }, (_, i) => para(i, 'w'.repeat(60))).join('\n\n');
  const reqs = buildRequests([{ slug: 'big', text: md('big', body) }], opts);
  assert.ok(reqs.length > 1, 'should fan out');
  const total = reqs.length;
  reqs.forEach((r, i) => {
    assert.equal(r.custom_id, `big__${i + 1}of${total}`);
  });
  // Chunk bodies rejoin to the original body.
  const rejoined = reqs.map((r) => r.params.messages[0].content).join('\n\n');
  assert.equal(rejoined, body);
});

test('mixed batch keeps small ones whole and only fans out the big one', () => {
  const bigBody = Array.from({ length: 8 }, (_, i) => para(i, 'w'.repeat(60))).join('\n\n');
  const reqs = buildRequests([
    { slug: 'small', text: md('small', 'tiny') },
    { slug: 'big', text: md('big', bigBody) },
  ], opts);
  const ids = reqs.map((r) => r.custom_id);
  assert.ok(ids.includes('small'));
  assert.ok(ids.some((id) => id.startsWith('big__')));
  assert.ok(!ids.includes('big'), 'oversized slug must not appear un-chunked');
});

test('every generated custom_id matches the Anthropic batch pattern', () => {
  const bigBody = Array.from({ length: 8 }, (_, i) => para(i, 'w'.repeat(60))).join('\n\n');
  const reqs = buildRequests([
    { slug: 'small', text: md('small', 'tiny') },
    { slug: 'school-committee-2021-01-07', text: md('school-committee-2021-01-07', bigBody) },
  ], opts);
  const pattern = /^[a-zA-Z0-9_-]{1,64}$/;
  for (const r of reqs) {
    assert.match(r.custom_id, pattern, `bad custom_id: ${r.custom_id}`);
  }
});

test('chunk custom_ids round-trip through parseCustomId', () => {
  const bigBody = Array.from({ length: 8 }, (_, i) => para(i, 'w'.repeat(60))).join('\n\n');
  const reqs = buildRequests([{ slug: 'sc-2021-01-07', text: md('sc-2021-01-07', bigBody) }], opts);
  reqs.forEach((r, i) => {
    const p = parseCustomId(r.custom_id);
    assert.equal(p.slug, 'sc-2021-01-07');
    assert.equal(p.index, i);
    assert.equal(p.total, reqs.length);
    assert.equal(p.chunked, true);
  });
});

test('parseCustomId reads a plain slug as a single un-chunked request', () => {
  assert.deepEqual(parseCustomId('sc-2025-01-01'), {
    slug: 'sc-2025-01-01', index: 0, total: 1, chunked: false,
  });
});

test('parseCustomId reads an i-of-K suffix', () => {
  assert.deepEqual(parseCustomId('big__2of4'), {
    slug: 'big', index: 1, total: 4, chunked: true,
  });
});

test('parseCustomId is not fooled by a slug that contains a hash but no i-of-K', () => {
  assert.deepEqual(parseCustomId('weird#name'), {
    slug: 'weird#name', index: 0, total: 1, chunked: false,
  });
});
