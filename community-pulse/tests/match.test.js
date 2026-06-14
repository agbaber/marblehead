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
