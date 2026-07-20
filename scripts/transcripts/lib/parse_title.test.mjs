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

// --- MPS YouTube channel corpus ---------------------------------------------
// The Marblehead Public Schools YouTube channel posts SC and subcommittee
// content with messier titles than MHTV's Vimeo channel. Verified against the
// live channel.

test('parses canonical MPS YouTube SC title', () => {
  const m = parseTitle('Marblehead School Committee Meeting 2/26/26');
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'school-committee');
  assert.equal(m.date, '2026-02-26');
});

test('parses double-space "S C  Meeting M/D/YY" form', () => {
  const m = parseTitle('S C  Meeting 2/27/25', { boardHint: 'school-committee' });
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'school-committee');
  assert.equal(m.date, '2025-02-27');
});

test('parses space-separated date "S C  Meeting 06 23 2022"', () => {
  const m = parseTitle('S C  Meeting 06 23 2022', { boardHint: 'school-committee' });
  assert.equal(m.valid, true);
  assert.equal(m.date, '2022-06-23');
});

test('parses lowercase "SC meeting" with leading date', () => {
  const m = parseTitle('9/21/2023 SC meeting', { boardHint: 'school-committee' });
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'school-committee');
  assert.equal(m.date, '2023-09-21');
});

test('classifies SC subcommittees under school-committee with boardHint', () => {
  for (const title of [
    'Marblehead SC Policy Subcommittee 10/23/25',
    'Facilities Sub-Committee 7/24/25',
    'Policy Subcommittee meeting on 3/7/25',
    'SC Policy Subcommittee 8.4.2023',
    'MHS Roof Subcommittee meeting 9/23/25',
  ]) {
    const m = parseTitle(title, { boardHint: 'school-committee' });
    assert.equal(m.valid, true, `expected valid for: ${title}`);
    assert.equal(m.board_slug, 'school-committee');
  }
});

test('classifies remaining MPS-channel title shapes with boardHint', () => {
  for (const [title, date] of [
    ['Policy Sub Committee Oct 27, 2023', '2023-10-27'],   // space variant
    ['2/13/2023 Facilities Submcommittee', '2023-02-13'],  // uploader typo
    ['3.16.2023 Budget Sub-Joint', '2023-03-16'],
    ['3/10/23 Budget Sub Joint', '2023-03-10'],
    ['2/9/2023 Budget Sub Joint with Liaisons', '2023-02-09'],
    ['1/30/2023 Budget Workshop', '2023-01-30'],
    ['Budget Vote Apr 8, 2021', '2021-04-08'],
    ['3.27.2023 Budget Vote', '2023-03-27'],
    ['3.21.2023 Budget Public Hearing', '2023-03-21'],
  ]) {
    const m = parseTitle(title, { boardHint: 'school-committee' });
    assert.equal(m.valid, true, `expected valid for: ${title}`);
    assert.equal(m.board_slug, 'school-committee', title);
    assert.equal(m.date, date, title);
  }
});

test('boardHint still rejects forums and press conferences', () => {
  for (const title of [
    'Question 2 Forum   5-24-22',
    '11.10.2022 Finance and Budget Forum',
    'Statement at 11-15-24 press conference',
  ]) {
    const m = parseTitle(title, { boardHint: 'school-committee' });
    assert.equal(m.valid, false, `expected invalid for: ${title}`);
  }
});

test('returns partial board info when title has board but no date', () => {
  // "Marblehead School Committee Meeting" with no date (the user's example
  // video gYE7TlHvW9o). pull_youtube falls back to upload_date.
  const m = parseTitle('Marblehead School Committee Meeting');
  assert.equal(m.valid, false);
  assert.match(m.reason, /no date/i);
  assert.equal(m.board_slug, 'school-committee');
  assert.equal(m.board_display, 'School Committee');
});

test('boardHint applies only when title has a meeting-like signal', () => {
  // A junk title from the SC channel: "Statement at 11-15-24 press conference".
  // The date parses, but this isn't a meeting — should not become SC.
  const m = parseTitle('Statement at 11-15-24 press conference', { boardHint: 'school-committee' });
  assert.equal(m.valid, false);
});

test('boardHint does not override a real board match', () => {
  // If the title clearly says Select Board, boardHint must not override.
  const m = parseTitle('Marblehead Select Board Meeting: 5-27-26', { boardHint: 'school-committee' });
  assert.equal(m.valid, true);
  assert.equal(m.board_slug, 'select-board');
});
