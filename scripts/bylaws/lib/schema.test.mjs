import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAmendment, DISPOSITIONS, FIDELITIES } from './schema.mjs';

const valid = {
  meeting: { date: '2019-05-06', type: 'ATM' },
  article: 14,
  sponsor: 'Planning Board',
  vote: { yes: 611, no: 204, threshold: 'majority', met: true },
  disposition: 'passed',
  affects: ['074-3'],
  change: { kind: 'touched' },
  source: { doc: 'Annual-Report-2019.txt', page: 187 },
  fidelity: 'blame',
};

test('accepts a well-formed record', () => {
  assert.deepEqual(validateAmendment(valid), []);
});

test('rejects missing source (citation discipline)', () => {
  const bad = { ...valid, source: undefined };
  const errs = validateAmendment(bad);
  assert.ok(errs.some(e => e.includes('source')));
});

test('rejects unknown disposition', () => {
  const bad = { ...valid, disposition: 'maybe' };
  assert.ok(validateAmendment(bad).some(e => e.includes('disposition')));
});

test('verbatim record requires a before/after change body', () => {
  const bad = { ...valid, fidelity: 'verbatim', change: { kind: 'touched' } };
  assert.ok(validateAmendment(bad).some(e => e.includes('verbatim')));
});

test('exposes the closed vocabularies', () => {
  assert.deepEqual(DISPOSITIONS, ['passed', 'defeated', 'withdrawn', 'referred']);
  assert.deepEqual(FIDELITIES, ['verbatim', 'blame']);
});
