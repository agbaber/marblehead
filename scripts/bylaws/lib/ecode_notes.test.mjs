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

test('parses an Adopted note with bare TM meeting type', () => {
  const notes = parseAmendmentNotes('[Adopted 3-11-1954 TM by Art. 73]');
  assert.deepEqual(notes, [
    { action: 'adopted', date: '1954-03-11', type: 'TM', article: 73 },
  ]);
});

test('parses a mixed-case semicolon list with plural Arts. and carry-forward action', () => {
  const notes = parseAmendmentNotes(
    '[Added 3-10-1971 ATM by Art. 74; amended 3-12-1973 ATM by Arts. 26 and 27; 6-27-1977 STM by Art. 21]'
  );
  assert.equal(notes.length, 3);
  assert.deepEqual(notes[0], { action: 'added', date: '1971-03-10', type: 'ATM', article: 74 });
  assert.deepEqual(notes[1], { action: 'amended', date: '1973-03-12', type: 'ATM', article: 26, articles: [26, 27] });
  assert.deepEqual(notes[2], { action: 'amended', date: '1977-06-27', type: 'STM', article: 21 });
});

test('parses a dotless "by Art 5"', () => {
  const [n] = parseAmendmentNotes('[Amended 5-1-1990 ATM by Art 5]');
  assert.equal(n.article, 5);
});

test('tolerates a missing space after the action word (eCode typo)', () => {
  const [n] = parseAmendmentNotes('[Amended5-3-2021 ATM by Art. 46]');
  assert.deepEqual(n, { action: 'amended', date: '2021-05-03', type: 'ATM', article: 46 });
});

test('returns empty array when there is no note', () => {
  assert.deepEqual(parseAmendmentNotes('The dog officer shall...'), []);
});
