import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrintText } from './print_parse.mjs';

// A faithful excerpt of the real Chapter 13 print text.
const SAMPLE = [
  'Chapter 13. Animals',
  '[HISTORY: Adopted by the Town Meeting of the Town of Marblehead as indicated in article histories. Amendments noted where applicable.]',
  'Article I. Swine',
  '[Adopted 3-11-1954 TM by Art. 73]',
  '§ 13-1. Keeping of swine prohibited.',
  'No person, firm or corporation shall keep swine within the limits of the Town of Marblehead.',
  '§ 13-2. Violations and penalties.',
  '[Amended 3-14-1972 ATM by Art. 30]',
  'Any violation of this regulation shall be punished by a fine of not more than $50.',
  'Article II. Horses',
  '[Adopted 3-10-1965 TM by Art. 62]',
  '§ 13-3. Horses on public sidewalks.',
  'A.',
  'Prohibition. No person shall ride a horse on any public sidewalk.',
  '[Amended 3-14-1972 ATM by Art. 30]',
].join('\n');

test('extracts the chapter number and title', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.equal(ch.chapter, '13');
  assert.equal(ch.chapterTitle, 'Animals');
});

test('extracts every section with ref and heading', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.deepEqual(ch.sections.map(s => s.ref), ['13-1', '13-2', '13-3']);
  assert.equal(ch.sections[0].heading, 'Keeping of swine prohibited.');
});

test('captures section body text', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.match(ch.sections[0].body, /No person, firm or corporation shall keep swine/);
});

test('attaches a note that immediately follows the section heading', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.match(ch.sections[1].noteText, /Amended 3-14-1972 ATM by Art\. 30/);
});

test('attaches a note that trails the section body', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.match(ch.sections[2].noteText, /Amended 3-14-1972 ATM by Art\. 30/);
});

test('prepends an article-level adoption note to the first section under it', () => {
  const [ch] = parsePrintText(SAMPLE);
  // § 13-1 is first section under "Article I. Swine [Adopted 3-11-1954 TM ...]"
  assert.match(ch.sections[0].noteText, /Adopted 3-11-1954 TM by Art\. 73/);
  // § 13-3 is first section under "Article II. Horses [Adopted 3-10-1965 TM ...]"
  assert.match(ch.sections[2].noteText, /Adopted 3-10-1965 TM by Art\. 62/);
});

test('does not leak an article note onto a later section', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.doesNotMatch(ch.sections[1].noteText || '', /Adopted 3-11-1954/);
});

test('subsection letters stay in the body', () => {
  const [ch] = parsePrintText(SAMPLE);
  assert.match(ch.sections[2].body, /A\.\nProhibition/);
});
