import { describe, it, expect } from 'vitest';
import { buildSeriesRow, buildInstanceRow } from '../../scripts/sync_warrant_corpus.mjs';

const MAP = new Map([
  ['expenses of several departments', 'expenses-of-several-departments'],
  ['expense of several departments', 'expenses-of-several-departments'],
  ['amend zoning bylaw 3a multi family overlay district', 'amend-zoning-bylaw-3a-multi-family-overlay-district'],
]);

describe('buildSeriesRow', () => {
  it('coerces years to numbers and passes fields through', () => {
    const row = buildSeriesRow({
      slug: 'walls-and-fences', title: 'Walls and Fences',
      kind: 'money_article', first_year: '2019', last_year: '2025', notes: '',
    });
    expect(row).toEqual({
      slug: 'walls-and-fences', title: 'Walls and Fences',
      kind: 'money_article', first_year: 2019, last_year: 2025, notes: null,
    });
  });
});

describe('buildInstanceRow', () => {
  it('maps a normal adopted row', () => {
    const row = buildInstanceRow({
      meeting_year: '2022', meeting_date: '2022-05-02', meeting_type: 'annual',
      article_number: '30', title: 'Expense of Several Departments',
      disposition: 'adopted', vote_yes: '', vote_no: '',
      notes: 'omnibus FY23 operating budget',
      source_doc: 'Annual-Report-2022.pdf', source_url: 'https://example.com/ar2022.pdf',
    }, MAP);
    expect(row).toEqual({
      series_slug: 'expenses-of-several-departments',
      meeting_year: 2022, meeting_type: 'annual', meeting_date: '2022-05-02',
      article_number: 30, title: 'Expense of Several Departments',
      amount: null, fincom_recommendation: null,
      tm_result: 'adopted', tm_vote_yes: null, tm_vote_no: null,
      in_effect: null, notes: 'omnibus FY23 operating budget',
      source_doc: 'Annual-Report-2022.pdf', source_url: 'https://example.com/ar2022.pdf',
    });
  });

  it('parses tallies and flags the overturned 3A row as not in effect', () => {
    const row = buildInstanceRow({
      meeting_year: '2025', meeting_date: '2025-05-06', meeting_type: 'annual',
      article_number: '23', title: 'Amend Zoning Bylaw - 3A Multi-Family Overlay District',
      disposition: 'adopted', vote_yes: '951', vote_no: '759',
      notes: 'overturned by town-wide special referendum 2025-07-08',
      source_doc: 'x.pdf', source_url: 'https://example.com/x.pdf',
    }, MAP);
    expect(row.tm_vote_yes).toBe(951);
    expect(row.tm_vote_no).toBe(759);
    expect(row.in_effect).toBe(0);
  });

  it('throws on a title missing from the series map', () => {
    expect(() => buildInstanceRow({
      meeting_year: '2024', meeting_date: '2024-05-06', meeting_type: 'annual',
      article_number: '1', title: 'Completely Unknown Article',
      disposition: 'adopted', vote_yes: '', vote_no: '', notes: '',
      source_doc: 'x.pdf', source_url: 'https://example.com/x.pdf',
    }, MAP)).toThrow(/no series mapping/i);
  });
});
