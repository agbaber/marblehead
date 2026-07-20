import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviousDateMap, resolveFallbackDate } from './fallback_date.mjs';

const prevIndex = {
  meetings: [
    { youtube_id: 'abc', date: '2023-06-23', date_approximate: true },
    { youtube_id: 'def', date: '2024-01-09', date_approximate: false },
  ],
};

test('buildPreviousDateMap indexes by youtube_id', () => {
  const map = buildPreviousDateMap(prevIndex);
  assert.equal(map.get('abc').date, '2023-06-23');
  assert.equal(map.get('def').date_approximate, false);
});

test('buildPreviousDateMap tolerates missing/empty index', () => {
  assert.equal(buildPreviousDateMap(null).size, 0);
  assert.equal(buildPreviousDateMap({}).size, 0);
});

test('resolveFallbackDate prefers previous index and skips fetch', () => {
  const map = buildPreviousDateMap(prevIndex);
  let fetched = false;
  const r = resolveFallbackDate('abc', map, () => { fetched = true; return '2099-01-01'; });
  assert.deepEqual(r, { date: '2023-06-23', date_approximate: true, from_previous_index: true });
  assert.equal(fetched, false);
});

test('resolveFallbackDate falls back to fetch when not in previous index', () => {
  const map = buildPreviousDateMap(prevIndex);
  const r = resolveFallbackDate('zzz', map, () => '2025-03-01');
  assert.deepEqual(r, { date: '2025-03-01', date_approximate: true, from_previous_index: false });
});

test('resolveFallbackDate returns null when fetch fails and no previous entry', () => {
  const map = buildPreviousDateMap(prevIndex);
  assert.equal(resolveFallbackDate('zzz', map, () => null), null);
});

test('previous entry without a date is ignored', () => {
  const map = buildPreviousDateMap({ meetings: [{ youtube_id: 'nodate' }] });
  const r = resolveFallbackDate('nodate', map, () => null);
  assert.equal(r, null);
});
