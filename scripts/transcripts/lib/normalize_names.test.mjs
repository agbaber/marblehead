import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeNames, findFlagged, compileDictionary } from './normalize_names.mjs';

const SHIPPED = JSON.parse(readFileSync('data/known_names.json', 'utf8'));

const DICT = {
  replace: [
    { wrong: ['Coughlin'], right: 'Coffin', kind: 'school' },
    { wrong: ['Mary Ellis'], right: 'Mary Alley', kind: 'building' },
    { wrong: ['Coffin School House'], right: 'Coffin School', kind: 'school' },
    { wrong: ['Abbott'], right: 'Abbot', kind: 'building' },
  ],
  flag_only: [
    { term: 'Gerry', why: 'Gerry School vs a resident named Jerry' },
  ],
};

test('replaces a whole-word misheard name and counts the hit', () => {
  const out = normalizeNames('We discussed the Coughlin parcel at length.', DICT);
  assert.equal(out.text, 'We discussed the Coffin parcel at length.');
  assert.deepEqual(out.hits, [{ wrong: 'Coughlin', right: 'Coffin', count: 1 }]);
});

test('counts repeated hits of the same term once, with the total', () => {
  const out = normalizeNames('Coughlin and Coughlin and Coughlin.', DICT);
  assert.equal(out.text, 'Coffin and Coffin and Coffin.');
  assert.deepEqual(out.hits, [{ wrong: 'Coughlin', right: 'Coffin', count: 3 }]);
});

test('does not replace inside a longer word', () => {
  const src = 'The Coughlinsville annex and Mccoughlin Road are unrelated.';
  const out = normalizeNames(src, DICT);
  assert.equal(out.text, src);
  assert.deepEqual(out.hits, []);
});

test('is case-sensitive so lowercase common words are never touched', () => {
  const src = 'a coughlin is not a proper noun here';
  const out = normalizeNames(src, DICT);
  assert.equal(out.text, src);
  assert.deepEqual(out.hits, []);
});

test('replaces multi-word names', () => {
  const out = normalizeNames('Meeting held at Mary Ellis House.', DICT);
  assert.equal(out.text, 'Meeting held at Mary Alley House.');
  assert.deepEqual(out.hits, [{ wrong: 'Mary Ellis', right: 'Mary Alley', count: 1 }]);
});

test('tolerates collapsed and irregular whitespace inside a multi-word name', () => {
  const out = normalizeNames('at Mary   Ellis House', DICT);
  assert.equal(out.text, 'at Mary Alley House');
});

test('prefers the longest matching entry so specific beats general', () => {
  const out = normalizeNames('the Coffin School House on Pleasant', DICT);
  assert.equal(out.text, 'the Coffin School on Pleasant');
  assert.deepEqual(out.hits, [
    { wrong: 'Coffin School House', right: 'Coffin School', count: 1 },
  ]);
});

test('never rewrites text inside a URL', () => {
  const src = '**[1:02](https://vimeo.com/1/Coughlin#t=62s)** The Coughlin lot.';
  const out = normalizeNames(src, DICT);
  assert.equal(out.text, '**[1:02](https://vimeo.com/1/Coughlin#t=62s)** The Coffin lot.');
  assert.deepEqual(out.hits, [{ wrong: 'Coughlin', right: 'Coffin', count: 1 }]);
});

test('never rewrites inside a bare domain name', () => {
  // Speakers read URLs aloud and the ASR writes them without a scheme. A name
  // substitution inside one invents a domain that does not exist.
  const dict = { replace: [{ wrong: ['Guazda'], right: 'Gwazda', kind: 'person' }] };
  const src = "it's Guazda-test.com with a capital A, and Henry Guazda said so";
  const out = normalizeNames(src, dict);
  assert.equal(out.text, "it's Guazda-test.com with a capital A, and Henry Gwazda said so");
  assert.deepEqual(out.hits, [{ wrong: 'Guazda', right: 'Gwazda', count: 1 }]);
});

test('never rewrites inside an email address', () => {
  const dict = { replace: [{ wrong: ['Abbott'], right: 'Abbot', kind: 'building' }] };
  const src = 'write to Abbott@example.org about Abbott Hall';
  assert.equal(normalizeNames(src, dict).text, 'write to Abbott@example.org about Abbot Hall');
});

test('still corrects a name ending a sentence, despite the period', () => {
  // Guard against over-broad domain protection swallowing ordinary punctuation.
  const dict = { replace: [{ wrong: ['Greater'], right: 'Grader', kind: 'person' }] };
  assert.equal(normalizeNames('seconded by Mr. Greater.', dict).text, 'seconded by Mr. Grader.');
});

test('does not re-scan its own output, so replacements never chain', () => {
  // "Mary Ellis House" -> "Mary Alley House" produces text that the second
  // entry would match if the output were scanned again. It must not be.
  const chain = {
    replace: [
      { wrong: ['Mary Ellis House'], right: 'Mary Alley House', kind: 'building' },
      { wrong: ['Alley House'], right: 'Alley Building', kind: 'building' },
    ],
  };
  const out = normalizeNames('Meeting at Mary Ellis House tonight.', chain);
  assert.equal(out.text, 'Meeting at Mary Alley House tonight.');
  assert.deepEqual(out.hits, [
    { wrong: 'Mary Ellis House', right: 'Mary Alley House', count: 1 },
  ]);
});

test('escapes regex metacharacters in the misheard form', () => {
  const dict = { replace: [{ wrong: ["St. Michael's (old)"], right: 'St. Michael', kind: 'building' }] };
  const out = normalizeNames("St. Michael's (old) vestry", dict);
  assert.equal(out.text, 'St. Michael vestry');
});

test('supports several misheard forms mapping to one correct name', () => {
  const dict = { replace: [{ wrong: ['Coughlin', 'Coughlan', 'Cough Lin'], right: 'Coffin', kind: 'school' }] };
  const out = normalizeNames('Coughlin, Coughlan, and Cough Lin.', dict);
  assert.equal(out.text, 'Coffin, Coffin, and Coffin.');
  const total = out.hits.reduce((n, h) => n + h.count, 0);
  assert.equal(total, 3);
});

test('leaves text untouched and reports no hits when nothing matches', () => {
  const src = 'Routine votes on the consent agenda.';
  const out = normalizeNames(src, DICT);
  assert.equal(out.text, src);
  assert.deepEqual(out.hits, []);
});

test('findFlagged reports ambiguous terms without changing the text', () => {
  const out = normalizeNames('The Gerry School roof and Gerry Playground.', DICT);
  assert.equal(out.text, 'The Gerry School roof and Gerry Playground.');
  assert.deepEqual(findFlagged('The Gerry School roof and Gerry Playground.', DICT), [
    { term: 'Gerry', count: 2, why: 'Gerry School vs a resident named Jerry' },
  ]);
});

test('compileDictionary rejects an entry whose correct form is also a misheard form', () => {
  const bad = {
    replace: [
      { wrong: ['Coughlin'], right: 'Coffin', kind: 'school' },
      { wrong: ['Coffin'], right: 'Coughlin', kind: 'school' },
    ],
  };
  assert.throws(() => compileDictionary(bad), /both a correct and a misheard form/i);
});

test('compileDictionary rejects a misheard form claimed by two entries', () => {
  const bad = {
    replace: [
      { wrong: ['Ellis'], right: 'Alley', kind: 'building' },
      { wrong: ['Ellis'], right: 'Eveleth', kind: 'school' },
    ],
  };
  assert.throws(() => compileDictionary(bad), /claimed by more than one entry/i);
});

test('compileDictionary rejects an empty or whitespace misheard form', () => {
  assert.throws(
    () => compileDictionary({ replace: [{ wrong: ['  '], right: 'Coffin', kind: 'school' }] }),
    /empty/i,
  );
});

test('handles a dictionary with no entries at all', () => {
  const out = normalizeNames('Anything at all.', { replace: [] });
  assert.equal(out.text, 'Anything at all.');
  assert.deepEqual(out.hits, []);
  assert.deepEqual(findFlagged('Anything at all.', { replace: [] }), []);
});

// --- guards on the shipped dictionary itself ---------------------------------

test('the shipped dictionary compiles', () => {
  assert.doesNotThrow(() => compileDictionary(SHIPPED));
});

test('every shipped entry cites ground truth and observed evidence', () => {
  for (const entry of SHIPPED.replace) {
    assert.ok(entry.ground_truth, `${entry.right} is missing ground_truth`);
    assert.ok(entry.observed, `${entry.right} is missing observed`);
    assert.ok(entry.kind, `${entry.right} is missing kind`);
    assert.ok(Array.isArray(entry.wrong) && entry.wrong.length > 0,
      `${entry.right} has no misheard forms`);
  }
});

test('every person entry records the era its misheard forms were checked against', () => {
  // Office-holders change. A surname correction that is right for one period
  // can corrupt an older meeting, so the date-range check must be written down,
  // not just promised.
  for (const entry of SHIPPED.replace.filter(e => e.kind === 'person')) {
    assert.ok(entry.era, `person entry "${entry.right}" is missing era`);
    assert.match(entry.era, /\d{4}/,
      `person entry "${entry.right}" era must cite at least one year`);
  }
});

test('every flag_only term explains why it is not auto-corrected', () => {
  for (const flag of SHIPPED.flag_only) {
    assert.ok(flag.why, `${flag.term} is missing why`);
  }
});

test('no shipped term is both corrected and flagged', () => {
  const flagged = new Set(SHIPPED.flag_only.map(f => f.term));
  for (const entry of SHIPPED.replace) {
    assert.ok(!flagged.has(entry.right),
      `${entry.right} is both a correction target and flag_only`);
    for (const w of entry.wrong) {
      assert.ok(!flagged.has(w), `${w} is both corrected and flag_only`);
    }
  }
});

test('the shipped dictionary fixes the Coffin School error that prompted it', () => {
  const out = normalizeNames('the Coughlin/Coffin parcel', SHIPPED);
  assert.equal(out.text, 'the Coffin parcel');
});

test('the shipped dictionary collapses split-then-repeated town names', () => {
  // Correcting each token separately would leave "Marblehead Marblehead".
  assert.equal(
    normalizeNames('here in Marble Marblehead tonight', SHIPPED).text,
    'here in Marblehead tonight',
  );
});

test('the shipped dictionary keeps genuine speaker stutters verbatim', () => {
  const src = 'the Marblehead Marblehead school committee';
  assert.equal(normalizeNames(src, SHIPPED).text, src);
});

test('the shipped dictionary corrects split forms of the town name first', () => {
  const out = normalizeNames('Marvel head Public Schools and Marble Head and Marvel.', SHIPPED);
  assert.equal(out.text, 'Marblehead Public Schools and Marblehead and Marblehead.');
});

test('the shipped dictionary leaves Evelyn and Gerry alone', () => {
  const src = 'Evelyn spoke about the Gerry School roof.';
  assert.equal(normalizeNames(src, SHIPPED).text, src);
});
