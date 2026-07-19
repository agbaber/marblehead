import { describe, it, expect } from 'vitest';
import {
  ALIASES, parseCsv, normalizeTitle, slugify, deriveKind, buildSeries
} from '../../scripts/warrant_lib.mjs';

describe('parseCsv', () => {
  it('handles quoted fields containing commas and escaped quotes', () => {
    const rows = parseCsv('a,b\n"x, y","he said ""hi"""\nplain,2\n');
    expect(rows).toEqual([
      { a: 'x, y', b: 'he said "hi"' },
      { a: 'plain', b: '2' },
    ]);
  });
});

describe('normalizeTitle', () => {
  it('lowercases, strips stray punctuation, collapses spaces', () => {
    expect(normalizeTitle('  Walls  and Fences ')).toBe('walls and fences');
  });
  it('canonicalizes known year-to-year renames', () => {
    expect(normalizeTitle('Expense of Several Departments'))
      .toBe('expenses of several departments');
    expect(normalizeTitle('Stormwater Construction'))
      .toBe('storm drainage construction');
    expect(normalizeTitle('Storm Drain Construction'))
      .toBe('storm drainage construction');
    expect(normalizeTitle('Revolving Fund'))
      .toBe('departmental revolving funds');
    expect(normalizeTitle('Reclassification and Pay Schedule (Administrative)'))
      .toBe('proposed reclassification and pay schedule (administrative)');
    expect(normalizeTitle('Financial Assistance Conservation'))
      .toBe('financial assistance for conservation');
    expect(normalizeTitle('Supplemental Appropriation and Expenses for the Schools'))
      .toBe('supplemental appropriation for the schools');
  });
  it('keeps genuinely different proposals separate', () => {
    expect(normalizeTitle('Ban use of gas-powered Leaf Blowers'))
      .not.toBe(normalizeTitle('Summer Break from Gas-Powered Leaf Blowers'));
  });
});

describe('slugify', () => {
  it('drops parens and apostrophes, hyphenates spaces', () => {
    expect(slugify('proposed reclassification and pay schedule (administrative)'))
      .toBe('proposed-reclassification-and-pay-schedule-administrative');
  });
});

describe('deriveKind', () => {
  it('classifies known slugs', () => {
    expect(deriveKind('expenses-of-several-departments')).toBe('money_article');
    expect(deriveKind('consent-articles')).toBe('consent');
    expect(deriveKind('assume-liability')).toBe('consent');
    expect(deriveKind('land-acknowledgement')).toBe('other_article');
  });
});

describe('buildSeries', () => {
  it('groups renamed instances into one series with year range', () => {
    const rows = [
      { meeting_year: '2022', title: 'Expense of Several Departments' },
      { meeting_year: '2024', title: 'Expenses of Several Departments' },
    ];
    const { series, map } = buildSeries(rows);
    expect(series).toHaveLength(1);
    expect(series[0].slug).toBe('expenses-of-several-departments');
    expect(series[0].kind).toBe('money_article');
    expect(series[0].first_year).toBe(2022);
    expect(series[0].last_year).toBe(2024);
    expect(series[0].title).toBe('Expenses of Several Departments');
    expect(map).toContainEqual({
      normalized_title: 'expense of several departments',
      slug: 'expenses-of-several-departments',
    });
  });
});

describe('ALIASES hygiene', () => {
  it('every alias key is in stripped form so lookups can actually fire', () => {
    for (const [key, canonical] of Object.entries(ALIASES)) {
      expect(normalizeTitle(key)).toBe(canonical);
    }
  });
  it('every alias canonical is itself canonical (a normalization fixed point)', () => {
    for (const canonical of new Set(Object.values(ALIASES))) {
      expect(normalizeTitle(canonical)).toBe(canonical);
    }
  });
});
