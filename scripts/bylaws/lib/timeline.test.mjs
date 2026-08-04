import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTimeline } from './timeline.mjs';

const recs = [
  { meeting: { date: '2011-05-02', type: 'ATM' }, article: 22, disposition: 'passed', affects: ['074-3'] },
  { meeting: { date: '2019-05-06', type: 'ATM' }, article: 14, disposition: 'passed', affects: ['074-3'] },
  { meeting: { date: '2011-05-02', type: 'ATM' }, article: 5, disposition: 'defeated', affects: [] },
];

test('orders oldest-first, then by article number within a meeting', () => {
  const t = orderTimeline(recs);
  assert.deepEqual(
    t.map(r => `${r.meeting.date}#${r.article}`),
    ['2011-05-02#5', '2011-05-02#22', '2019-05-06#14']
  );
});

test('flags whether each record changes the bylaw text', () => {
  const t = orderTimeline(recs);
  assert.equal(t.find(r => r.article === 22).changesText, true);
  assert.equal(t.find(r => r.article === 5).changesText, false);
});
