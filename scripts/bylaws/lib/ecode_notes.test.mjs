import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmendmentNotes } from './ecode_notes.mjs';

test('parses a single amended note', () => {
  const notes = parseAmendmentNotes('[Amended 5-6-2019 ATM by Art. 14]');
  assert.deepEqual(notes, [
    { action: 'amended', date: '2019-05-06', type: 'ATM', article: 14 },
  ]);
});

test('parses added + amended in one blurb', () => {
  const notes = parseAmendmentNotes(
    'History: [Added 5-1-1995 STM by Art. 3; Amended 5-2-2011 ATM by Art. 22]'
  );
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0], { action: 'added', date: '1995-05-01', type: 'STM', article: 3 });
  assert.deepEqual(notes[1], { action: 'amended', date: '2011-05-02', type: 'ATM', article: 22 });
});

test('normalizes zero-padless dates', () => {
  const [n] = parseAmendmentNotes('[Amended 3-14-1972 ATM by Art. 1]');
  assert.equal(n.date, '1972-03-14');
});

test('splits a semicolon list under one leading keyword (real eCode format)', () => {
  const notes = parseAmendmentNotes(
    '[Amended 3-14-1974 ATM by Art. 67; 5-6-2013 ATM by Art. 38; 5-6-2019 ATM by Art. 38; 5-1-2023 ATM by Art. 38]'
  );
  assert.deepEqual(notes, [
    { action: 'amended', date: '1974-03-14', type: 'ATM', article: 67 },
    { action: 'amended', date: '2013-05-06', type: 'ATM', article: 38 },
    { action: 'amended', date: '2019-05-06', type: 'ATM', article: 38 },
    { action: 'amended', date: '2023-05-01', type: 'ATM', article: 38 },
  ]);
});

test('returns empty array when there is no note', () => {
  assert.deepEqual(parseAmendmentNotes('The dog officer shall...'), []);
});
