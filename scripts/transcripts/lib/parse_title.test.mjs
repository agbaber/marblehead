import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTitle } from './parse_title.mjs';

test('parses canonical "Marblehead Select Board Meeting: 5-27-26"', () => {
  const m = parseTitle('Marblehead Select Board Meeting: 5-27-26');
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'select-board');
  assert.equal(m.board_display, 'Select Board');
  assert.equal(m.date, '2026-05-27');
});

test('parses dash-separated 4-digit year', () => {
  const m = parseTitle('Marblehead Board of Health Meeting: 1-15-2025');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2025-01-15');
});

test('parses period-separated date', () => {
  const m = parseTitle('Marblehead Select Board Meeting 5.25.22');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2022-05-25');
});

test('parses period-separated 4-digit year', () => {
  const m = parseTitle('Select Board Meeting 6.11.2025');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2025-06-11');
});

test('parses underscore-separated date (corpus has Marblehead Select Board Meeting: 11_13_24)', () => {
  const m = parseTitle('Marblehead Select Board Meeting: 11_13_24');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2024-11-13');
});

test('parses trailing junk after date', () => {
  const m = parseTitle('Select Board Meeting 8.16.23 via Zoom');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2023-08-16');
});

test('parses written-month date', () => {
  const m = parseTitle('SELECT BOARD MEETING July 12, 2023');
  assert.equal(m.valid, true);
  assert.equal(m.date, '2023-07-12');
});

test('parses "Annual Town Meeting" with day-month-year', () => {
  const m = parseTitle('Marblehead Annual Town Meeting 5-8-25');
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'town-meeting');
  assert.equal(m.date, '2025-05-08');
});

test('rejects member profile videos', () => {
  const m = parseTitle('Select Board - Jim Full');
  assert.equal(m.valid, false);
  assert.match(m.reason, /not a board meeting/i);
});

test('rejects videos with no parseable date', () => {
  const m = parseTitle('Marblehead Select Board candidate forum');
  assert.equal(m.valid, false);
  assert.match(m.reason, /no date/i);
});

test('rejects unrelated content', () => {
  const m = parseTitle("'Headliner - The News of Marblehead: 6-5-26");
  assert.equal(m.valid, false);
});

test('rejects two-digit years before 2000 (sanity guard)', () => {
  const m = parseTitle('Select Board Meeting 1-1-95');
  assert.equal(m.valid, false);
});
