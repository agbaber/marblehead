import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripFooters } from './clean.mjs';

test('strips month-day-year-pagenum footer lines', () => {
  const input = [
    'Motion made and seconded to approve',
    '',
    'June 17, 2020                              61',
    '',
    '$650,396.00 for Salaries,'
  ].join('\n');
  const out = stripFooters(input);
  assert.equal(out.includes('June 17, 2020'), false);
  assert.equal(out.includes('Motion made and seconded to approve'), true);
  assert.equal(out.includes('$650,396.00 for Salaries'), true);
});

test('strips Page N of M', () => {
  const input = 'some text\nPage 3 of 12\nmore text';
  assert.equal(stripFooters(input).includes('Page 3 of 12'), false);
});

test('strips bare page number on its own line', () => {
  const input = 'ending of sentence\n\n61\n\nnext section';
  const out = stripFooters(input);
  assert.equal(out.includes('\n61\n'), false);
  assert.equal(out.includes('ending of sentence'), true);
  assert.equal(out.includes('next section'), true);
});

test('does not strip standalone numbers inside prose', () => {
  const input = 'approved $650,396.00 for Salaries';
  assert.equal(stripFooters(input), input);
});

test('does not strip months mentioned in body', () => {
  const input = 'The meeting held on June 17, 2020 discussed...';
  const out = stripFooters(input);
  assert.equal(out.includes('June 17, 2020'), true);
});

test('collapses multiple blank lines introduced by stripping', () => {
  const input = 'a\n\n\nJune 17, 2020    61\n\n\n\nb';
  const out = stripFooters(input);
  assert.match(out, /a\n\n+b/);
  assert.doesNotMatch(out, /\n\n\n\n/);
});
