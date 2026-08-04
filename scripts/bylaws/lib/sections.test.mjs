import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStore } from './sections.mjs';

const raw = [{
  chapter: '13', chapterTitle: 'Animals',
  sections: [
    { ref: '13-1', heading: 'Keeping of swine prohibited.', body: 'No person shall keep swine.', noteText: '[Adopted 3-11-1954 TM by Art. 73]' },
    { ref: '13-2', heading: 'Violations and penalties.', body: 'Any violation shall be punished.', noteText: '[Amended 3-14-1972 ATM by Art. 30]' },
  ],
}];

test('produces one markdown file per chapter, zero-padded chapter number in filename', () => {
  const { files } = toStore(raw);
  assert.ok(files['013-animals.md'], 'expected 013-animals.md key');
  assert.match(files['013-animals.md'], /# Chapter 13: Animals/);
  assert.match(files['013-animals.md'], /## § 13-1 Keeping of swine prohibited\./);
  assert.match(files['013-animals.md'], /No person shall keep swine\./);
});

test('section index carries chapter, heading, file pointer, and parsed notes', () => {
  const { index } = toStore(raw);
  assert.equal(index['13-1'].chapter, '13');
  assert.equal(index['13-1'].heading, 'Keeping of swine prohibited.');
  assert.equal(index['13-1'].file, '013-animals.md');
  assert.deepEqual(index['13-1'].notes, [
    { action: 'adopted', date: '1954-03-11', type: 'TM', article: 73 },
  ]);
  assert.deepEqual(index['13-2'].notes, [
    { action: 'amended', date: '1972-03-14', type: 'ATM', article: 30 },
  ]);
});

test('a section with no note gets an empty notes array', () => {
  const noNote = [{ chapter: '9', chapterTitle: 'Alcohol', sections: [{ ref: '9-1', heading: 'Hours.', body: 'x', noteText: '' }] }];
  const { index } = toStore(noNote);
  assert.deepEqual(index['9-1'].notes, []);
});
