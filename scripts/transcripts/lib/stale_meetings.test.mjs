import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStaleMeetings } from './stale_meetings.mjs';

// Fixed clock so ages are whole days (index dates are date-only / midnight UTC).
const NOW = Date.parse('2026-08-11T00:00:00Z');
const none = () => false;
const idx = (...dates) => ({
  meetings: dates.map(([board_slug, date]) => ({ board_slug, date, vimeo_id: `id-${date}` })),
});

test('flags a recent meeting with no transcript', () => {
  const stale = findStaleMeetings(idx(['board-of-health', '2026-07-28']), none, { now: NOW });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].slug, 'board-of-health-2026-07-28');
  assert.equal(stale[0].ageDays, 14);
});

test('does not flag a meeting that already has a transcript', () => {
  const has = (slug) => slug === 'board-of-health-2026-07-28';
  const stale = findStaleMeetings(idx(['board-of-health', '2026-07-28']), has, { now: NOW });
  assert.equal(stale.length, 0);
});

test('respects the grace window (fresh meeting, captions may not exist yet)', () => {
  // 3 days old < default grace of 5 -> not stale yet.
  const stale = findStaleMeetings(idx(['select-board', '2026-08-08']), none, { now: NOW });
  assert.equal(stale.length, 0);
});

test('exactly graceDays old is flagged (inclusive lower bound)', () => {
  const stale = findStaleMeetings(idx(['select-board', '2026-08-06']), none, { now: NOW });
  assert.equal(stale.length, 1);
});

test('ignores ancient captionless gaps beyond maxDays (e.g. 2020 meetings)', () => {
  const stale = findStaleMeetings(idx(['board-of-health', '2020-04-07']), none, { now: NOW });
  assert.equal(stale.length, 0);
});

test('exactly maxDays old is still flagged (inclusive upper bound)', () => {
  // 45 days before NOW = 2026-06-27.
  const stale = findStaleMeetings(idx(['select-board', '2026-06-27']), none, { now: NOW });
  assert.equal(stale.length, 1);
});

test('skips malformed entries (missing date/board or unparseable date)', () => {
  const index = {
    meetings: [
      { board_slug: 'select-board' }, // no date
      { date: '2026-07-28' }, // no board
      { board_slug: 'select-board', date: 'not-a-date' },
      { board_slug: 'board-of-health', date: '2026-07-28' }, // the one real stale
    ],
  };
  const stale = findStaleMeetings(index, none, { now: NOW });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].slug, 'board-of-health-2026-07-28');
});

test('returns results sorted oldest-first', () => {
  const stale = findStaleMeetings(
    idx(['select-board', '2026-07-28'], ['board-of-health', '2026-07-08'], ['select-board', '2026-07-15']),
    none,
    { now: NOW },
  );
  assert.deepEqual(stale.map((s) => s.date), ['2026-07-08', '2026-07-15', '2026-07-28']);
});

test('empty / missing index is safe', () => {
  assert.deepEqual(findStaleMeetings({}, none, { now: NOW }), []);
  assert.deepEqual(findStaleMeetings({ meetings: [] }, none, { now: NOW }), []);
});
