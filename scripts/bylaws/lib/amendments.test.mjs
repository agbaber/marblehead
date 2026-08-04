import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupEvents } from './amendments.mjs';

const index = {
  '13-2': { notes: [{ action: 'amended', date: '1972-03-14', type: 'ATM', article: 30 }] },
  '13-3': { notes: [{ action: 'amended', date: '1972-03-14', type: 'ATM', article: 30 }] },
  '174-1': { notes: [
    { action: 'amended', date: '2019-05-06', type: 'ATM', article: 38 },
    { action: 'amended', date: '2023-05-01', type: 'ATM', article: 38 },
  ] },
  '97-1': { notes: [{ action: 'added', date: '2019-05-06', type: 'ATM', article: 33 }] },
};

test('collapses one meeting-article touching multiple sections into a single record', () => {
  const recs = groupEvents(index);
  const r = recs.find(x => x.meeting.date === '1972-03-14' && x.article === 30);
  assert.deepEqual(r.affects, ['13-2', '13-3']);
  assert.deepEqual(r.actions, ['amended']);
});

test('separates two articles at the same meeting', () => {
  const recs = groupEvents(index);
  const may2019 = recs.filter(x => x.meeting.date === '2019-05-06');
  assert.deepEqual(may2019.map(r => r.article).sort(), [33, 38]);
});

test('orders records oldest-first then by article', () => {
  const recs = groupEvents(index);
  assert.deepEqual(
    recs.map(r => `${r.meeting.date}#${r.article}`),
    ['1972-03-14#30', '2019-05-06#33', '2019-05-06#38', '2023-05-01#38']
  );
});
