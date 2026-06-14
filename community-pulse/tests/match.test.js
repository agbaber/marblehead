import { describe, it, expect } from 'vitest';
import { tokenize } from '../worker/src/match.js';

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('John Smith')).toEqual(['john', 'smith']);
  });

  it('strips trailing/leading punctuation per token', () => {
    expect(tokenize('J. Smith')).toEqual(['j', 'smith']);
    expect(tokenize('Smith, John')).toEqual(['smith', 'john']);
  });

  it('treats & and / as separators (co-owner joins)', () => {
    expect(tokenize('SMITH JOHN A & SMITH JANE M'))
      .toEqual(['smith', 'john', 'a', 'smith', 'jane', 'm']);
    expect(tokenize('SMITH/JONES')).toEqual(['smith', 'jones']);
  });

  it('drops the connector word "AND"', () => {
    expect(tokenize('SMITH JOHN AND SMITH JANE'))
      .toEqual(['smith', 'john', 'smith', 'jane']);
  });

  it('returns empty on empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

import { normalizeAddress } from '../worker/src/match.js';

describe('normalizeAddress', () => {
  it('uppercases and collapses whitespace', () => {
    expect(normalizeAddress('12 State St')).toBe('12 STATE STREET');
    expect(normalizeAddress('  12   state   st  ')).toBe('12 STATE STREET');
  });

  it('expands common abbreviations', () => {
    expect(normalizeAddress('5 Beacon Ave')).toBe('5 BEACON AVENUE');
    expect(normalizeAddress('77 Pleasant Rd')).toBe('77 PLEASANT ROAD');
    expect(normalizeAddress('3 Harbor Dr')).toBe('3 HARBOR DRIVE');
    expect(normalizeAddress('9 Maple Ln')).toBe('9 MAPLE LANE');
    expect(normalizeAddress('1 Court Pl')).toBe('1 COURT PLACE');
    expect(normalizeAddress('22 Foster Ct')).toBe('22 FOSTER COURT');
    expect(normalizeAddress('14 Memorial Blvd')).toBe('14 MEMORIAL BOULEVARD');
    expect(normalizeAddress('8 Sunset Ter')).toBe('8 SUNSET TERRACE');
    expect(normalizeAddress('100 Atlantic Hwy')).toBe('100 ATLANTIC HIGHWAY');
  });

  it('strips trailing unit suffixes', () => {
    expect(normalizeAddress('12 State St Unit 3')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St Apt 2')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St #5')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St, #5')).toBe('12 STATE STREET');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeAddress('12 State St.')).toBe('12 STATE STREET');
  });

  it('is idempotent', () => {
    const once = normalizeAddress('12 State St');
    expect(normalizeAddress(once)).toBe(once);
  });
});
