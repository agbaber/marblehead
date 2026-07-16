import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './reconcile.mjs';

const records = [
  { meeting: { date: '2019-05-06' }, article: 7, affects: ['63-9'], sponsor: 'Recreation and Parks Department' },
  { meeting: { date: '2019-05-06' }, article: 99, affects: ['90-1'], sponsor: 'Town Meeting' }, // not in report
  { meeting: { date: '2019-05-06' }, article: 17, affects: ['30-15'], sponsor: 'Town Meeting' }, // in report, no sponsor
  { meeting: { date: '1989-05-01' }, article: 3, affects: ['20-1'], sponsor: 'Town Meeting' },   // pre-cutoff
];
const reportArticles = { 2019: new Set([7, 17, 33]) };

test('flags an eCode amendment whose article is absent from that year report', () => {
  const { discrepancies } = reconcile(records, reportArticles, { cutoff: 2006 });
  assert.deepEqual(discrepancies, [{ date: '2019-05-06', article: 99, affects: ['90-1'] }]);
});

test('does not flag pre-cutoff records (no digitized report expected)', () => {
  const { discrepancies } = reconcile(records, reportArticles, { cutoff: 2006 });
  assert.ok(!discrepancies.some(d => d.date.startsWith('1989')));
});

test('counts enriched vs unenriched post-cutoff records', () => {
  const { stats } = reconcile(records, reportArticles, { cutoff: 2006 });
  assert.equal(stats.postCutoff, 3);
  assert.equal(stats.enriched, 1);   // Art 7
  assert.equal(stats.unenriched, 1); // Art 17 (in report, no sponsor)
});
