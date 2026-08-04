import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdit, invertEdit } from './diffengine.mjs';

const edit = { kind: 'edit', section: '074-3', before: 'a leash of 6 feet', after: 'a leash of 8 feet' };
const doc = { '074-3': 'Dogs shall be on a leash of 6 feet at all times.' };

test('applyEdit replaces before with after in the target section', () => {
  const out = applyEdit(doc, edit);
  assert.equal(out['074-3'], 'Dogs shall be on a leash of 8 feet at all times.');
});

test('applyEdit throws if before text is absent (guards a bad patch)', () => {
  assert.throws(() => applyEdit(doc, { ...edit, before: 'nonexistent' }), /before text not found/);
});

test('invertEdit swaps before and after', () => {
  const inv = invertEdit(edit);
  assert.equal(inv.before, 'a leash of 8 feet');
  assert.equal(inv.after, 'a leash of 6 feet');
});

test('applying an edit then its inverse round-trips the document', () => {
  const forward = applyEdit(doc, edit);
  const back = applyEdit(forward, invertEdit(edit));
  assert.deepEqual(back, doc);
});
