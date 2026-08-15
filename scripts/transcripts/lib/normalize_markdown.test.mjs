import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkdownTables, normalizeSummaries } from './normalize_markdown.mjs';

test('inserts a blank line when a table is glued to a bold lead-in', () => {
  const src = '**Key valuation results:**\n| Metric | Value |\n|---|---|\n| Funded ratio | ~3.4% |';
  assert.equal(
    normalizeMarkdownTables(src),
    '**Key valuation results:**\n\n| Metric | Value |\n|---|---|\n| Funded ratio | ~3.4% |'
  );
});

test('inserts a blank line when a table is glued to a heading', () => {
  const src = '## Current User Fee Structure\n| Category | Fee |\n|---|---|\n| Athletics | $325 |';
  assert.equal(
    normalizeMarkdownTables(src),
    '## Current User Fee Structure\n\n| Category | Fee |\n|---|---|\n| Athletics | $325 |'
  );
});

test('inserts a blank line when prose is glued to the last table row', () => {
  const src = '| A | B |\n|---|---|\n| 1 | 2 |\nAnd several smaller items.';
  assert.equal(
    normalizeMarkdownTables(src),
    '| A | B |\n|---|---|\n| 1 | 2 |\n\nAnd several smaller items.'
  );
});

test('closes a table glued on both sides', () => {
  const src = 'Lead:\n| A | B |\n|---|---|\n| 1 | 2 |\nTrailer.';
  assert.equal(
    normalizeMarkdownTables(src),
    'Lead:\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nTrailer.'
  );
});

test('leaves a correctly separated table untouched', () => {
  const src = '**Key figures:**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';
  assert.equal(normalizeMarkdownTables(src), src);
});

test('handles alignment markers and multiple tables', () => {
  const src = 'Lead one:\n| A | B |\n|:--|--:|\n| 1 | 2 |\n\nLead two:\n| C | D |\n| --- | --- |\n| 3 | 4 |';
  const want =
    'Lead one:\n\n| A | B |\n|:--|--:|\n| 1 | 2 |\n\nLead two:\n\n| C | D |\n| --- | --- |\n| 3 | 4 |';
  assert.equal(normalizeMarkdownTables(src), want);
});

test('does not touch prose containing pipes but no delimiter row', () => {
  const src = 'The vote was 3-0 | unanimous.\nNo table here.';
  assert.equal(normalizeMarkdownTables(src), src);
});

test('does not insert a blank line at the start of a summary', () => {
  const src = '| A | B |\n|---|---|\n| 1 | 2 |';
  assert.equal(normalizeMarkdownTables(src), src);
});

test('normalizeSummaries rewrites card and segment summaries in place', () => {
  const payload = {
    summary_card: { summary: 'Totals:\n| A | B |\n|---|---|\n| 1 | 2 |' },
    topic_segments: [
      { summary: 'Detail:\n| C | D |\n|---|---|\n| 3 | 4 |' },
      { summary: 'no table' },
    ],
  };
  normalizeSummaries(payload);
  assert.equal(payload.summary_card.summary, 'Totals:\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.equal(payload.topic_segments[0].summary, 'Detail:\n\n| C | D |\n|---|---|\n| 3 | 4 |');
  assert.equal(payload.topic_segments[1].summary, 'no table');
});
