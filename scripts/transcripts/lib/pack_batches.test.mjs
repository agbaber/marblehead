import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packRequests } from './pack_batches.mjs';

// Build a request whose JSON.stringify length is approximately `bytes`.
function reqOfSize(id, bytes) {
  const overhead = JSON.stringify({ custom_id: id, params: { body: '' } }).length;
  return { custom_id: id, params: { body: 'x'.repeat(Math.max(0, bytes - overhead)) } };
}

test('keeps everything in one batch when total is under the cap', () => {
  const reqs = [reqOfSize('a', 100), reqOfSize('b', 100)];
  const batches = packRequests(reqs, 10_000);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
});

test('splits into multiple batches so each stays under the byte cap', () => {
  const reqs = Array.from({ length: 6 }, (_, i) => reqOfSize(`r${i}`, 400));
  const batches = packRequests(reqs, 1000); // ~2 requests per batch
  assert.ok(batches.length >= 3, `expected >=3 batches, got ${batches.length}`);
  for (const b of batches) {
    const total = b.reduce((n, r) => n + JSON.stringify(r).length, 0);
    assert.ok(total <= 1000, `batch over cap: ${total}`);
  }
});

test('every request lands in exactly one batch, order preserved', () => {
  const reqs = Array.from({ length: 5 }, (_, i) => reqOfSize(`r${i}`, 400));
  const batches = packRequests(reqs, 1000);
  const flat = batches.flat();
  assert.deepEqual(flat.map((r) => r.custom_id), reqs.map((r) => r.custom_id));
});

test('a single request larger than the cap gets its own batch', () => {
  const reqs = [reqOfSize('small', 100), reqOfSize('huge', 5000), reqOfSize('small2', 100)];
  const batches = packRequests(reqs, 1000);
  const huge = batches.find((b) => b.length === 1 && b[0].custom_id === 'huge');
  assert.ok(huge, 'oversized request must be isolated in its own batch');
});

test('returns no batches for an empty request list', () => {
  assert.deepEqual(packRequests([], 1000), []);
});
