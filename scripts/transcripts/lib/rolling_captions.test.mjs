import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripCueTags, collapseRepeatedRuns, cleanRollingCaptions } from './rolling_captions.mjs';

// --- stripCueTags -----------------------------------------------------------

test('strips inline cue timestamps and <c> spans, keeping the words', () => {
  const src = 'All<00:01:51.880><c> right,</c><00:01:52.280><c> um</c> next';
  assert.equal(stripCueTags(src), 'All right, um next');
});

test('strips <c> spans that carry a class', () => {
  assert.equal(stripCueTags('a<c.colorE5E5E5> b</c> c'), 'a b c');
});

test('leaves text with no cue markup untouched', () => {
  const src = 'The Select Board voted 5-0 to approve.';
  assert.equal(stripCueTags(src), src);
});

test('does not damage a markdown timecode link', () => {
  const src = '**[1:51](https://www.youtube.com/watch?v=abc&t=111s)** Any other interested?';
  assert.equal(stripCueTags(src), src);
});

test('collapses the whitespace left behind by removed tags', () => {
  assert.equal(stripCueTags('one<00:00:01.000> two'), 'one two');
});

// --- collapseRepeatedRuns ---------------------------------------------------

test('collapses a phrase repeated three times', () => {
  const src = 'Melissa made a motion for Kate Melissa made a motion for Kate Melissa made a motion for Kate';
  assert.equal(collapseRepeatedRuns(src), 'Melissa made a motion for Kate');
});

test('collapses a phrase repeated twice', () => {
  const src = 'will second it right now will second it right now';
  assert.equal(collapseRepeatedRuns(src), 'will second it right now');
});

test('collapses a repeated run that sits between other text', () => {
  const src = 'Okay. the new chair of the committee the new chair of the committee I will second.';
  assert.equal(
    collapseRepeatedRuns(src),
    'Okay. the new chair of the committee I will second.',
  );
});

test('preserves short genuine speech repeats', () => {
  // Below the minimum run length: a speaker really did say these twice.
  for (const src of ['No, no.', 'I think I think so', 'very very close']) {
    assert.equal(collapseRepeatedRuns(src), src);
  }
});

test('preserves a repeated phrase that is not immediately adjacent', () => {
  const src = 'we approved the budget last year and then we approved the budget again today';
  assert.equal(collapseRepeatedRuns(src), src);
});

test('is idempotent', () => {
  const src = 'any further discussions on this any further discussions on this';
  const once = collapseRepeatedRuns(src);
  assert.equal(collapseRepeatedRuns(once), once);
});

test('handles a run repeated four times', () => {
  const p = 'all those in favor of the motion';
  assert.equal(collapseRepeatedRuns(`${p} ${p} ${p} ${p}`), p);
});

test('leaves ordinary prose alone', () => {
  const src = 'The committee approved $731,000 in budget transfers for out-of-district tuitions.';
  assert.equal(collapseRepeatedRuns(src), src);
});

// --- cleanRollingCaptions (composed) ---------------------------------------

test('cleans a real YouTube rolling-caption paragraph', () => {
  const src =
    '**[1:51](https://www.youtube.com/watch?v=wAD-P3mGpq8&t=111s)** Any other interested? ' +
    'Any other interested? All<00:01:51.880><c> right,</c><00:01:52.280><c> um</c> ' +
    'All right, um All right, um Melissa<00:01:54.320><c> made</c><00:01:54.480><c> a</c>' +
    '<00:01:54.520><c> motion</c> Melissa made a motion Melissa made a motion';
  const out = cleanRollingCaptions(src);
  assert.equal(
    out,
    '**[1:51](https://www.youtube.com/watch?v=wAD-P3mGpq8&t=111s)** Any other interested? ' +
    'All right, um Melissa made a motion',
  );
});

test('leaves a clean Vimeo-sourced paragraph byte-identical', () => {
  // The Vimeo path does not use rolling captions; this must be a no-op.
  const src =
    '**[55:04](https://vimeo.com/1208465301#t=3304s)** All right. Thank you. ' +
    'Next up, Recreation and Parks. I am Karen Ernst, Chair of Recreation and Parks.';
  assert.equal(cleanRollingCaptions(src), src);
});

test('reports whether it changed anything', () => {
  assert.equal(cleanRollingCaptions('nothing to do here'), 'nothing to do here');
});

// --- short runs: three repeats is the format's signature ---------------------

test('collapses a single word repeated three times', () => {
  assert.equal(collapseRepeatedRuns('are now back back back in place'), 'are now back in place');
  assert.equal(collapseRepeatedRuns('our stuff. stuff. stuff. Great.'), 'our stuff. Great.');
});

test('collapses a two-word run repeated three times', () => {
  assert.equal(
    collapseRepeatedRuns('so next so next so next on the agenda'),
    'so next on the agenda',
  );
});

test('keeps a single word repeated only twice', () => {
  // Ambiguous with a genuine stutter, so it must survive.
  for (const src of ['No, no.', 'very very close', 'that that is right']) {
    assert.equal(collapseRepeatedRuns(src), src);
  }
});

test('keeps a two-word run repeated only twice', () => {
  assert.equal(collapseRepeatedRuns('I think I think so'), 'I think I think so');
});
