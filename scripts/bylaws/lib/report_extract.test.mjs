import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleMeta } from './report_extract.mjs';

// Faithful to the real 2019 report shape (sponsor stated, no numeric tally).
const REPORT_2019 = [
  'Article 7 Amend Recreation and Parks Revolving Fund',
  'To see if the Town will amend Chapter 63-9 ... as follows:',
  '(b) ... $10.00 15.00 of out of town parking fees ...',
  'Sponsored by the Recreation and Parks Department.',
  '',
  'Article 8 Departmental Revolving Funds',
  'To see if the Town will vote to fix the maximum amount ...',
].join('\n');

// 2024-style: numeric tally present.
const REPORT_2024 = [
  'Article 12 Amend General Bylaw Dogs',
  'To see if the Town will amend section 13-5 ...',
  'Voted Yes 638 No 97 2/3rd vote achieved',
].join('\n');

test('extracts sponsor for an article that states one', () => {
  const meta = extractArticleMeta(REPORT_2019);
  assert.equal(meta.get(7).sponsor, 'Recreation and Parks Department');
});

test('leaves sponsor null when not stated', () => {
  const meta = extractArticleMeta(REPORT_2019);
  assert.equal(meta.get(8).sponsor, null);
});

test('parses a numeric tally and marks disposition passed', () => {
  const meta = extractArticleMeta(REPORT_2024);
  assert.deepEqual(meta.get(12).tally, { yes: 638, no: 97, threshold: 'two-thirds', met: true });
  assert.equal(meta.get(12).disposition, 'passed');
});

test('no numeric tally in older reports leaves tally null', () => {
  const meta = extractArticleMeta(REPORT_2019);
  assert.equal(meta.get(7).tally, null);
});

test('rejoins a sponsor name wrapped across report columns', () => {
  const wrapped = [
    'Article 5 Water and Sewer Rules',
    'To see if the Town will amend section 155-1 ...',
    'Sponsored by the Board of Water and Sewer',
    'Commissioners.',
  ].join('\n');
  assert.equal(extractArticleMeta(wrapped).get(5).sponsor, 'Board of Water and Sewer Commissioners');
});

test('keeps a middle initial instead of truncating at it', () => {
  const petition = 'Article 9 Citizen Petition\nSponsored by Walter W. Smith.';
  assert.equal(extractArticleMeta(petition).get(9).sponsor, 'Walter W. Smith');
});

test('captures an "and others" citizen petitioner', () => {
  const petition = 'Article 3 Citizen Petition\nSponsored by Megan Sweeney and others.';
  assert.equal(extractArticleMeta(petition).get(3).sponsor, 'Megan Sweeney and others');
});

test('parses an indented / colon-style article header', () => {
  const indented = '    Article 31 Amend Bylaw to Increase Building Fees\nSponsored by the Building Department.';
  const meta = extractArticleMeta(indented);
  assert.equal(meta.get(31).sponsor, 'Building Department');
});

test('on a duplicate article number keeps the richer occurrence', () => {
  const dup = [
    'Article 7 Amend Recreation and Parks Revolving Fund',
    'To see if ...',              // warrant copy, no sponsor line
    'Article 7 Amend Recreation and Parks Revolving Fund',
    'Sponsored by the Recreation and Parks Department.',
  ].join('\n');
  const meta = extractArticleMeta(dup);
  assert.equal(meta.get(7).sponsor, 'Recreation and Parks Department');
});
