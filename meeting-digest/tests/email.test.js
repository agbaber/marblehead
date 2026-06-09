import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, randomToken } from '../worker/src/lib/email.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Hi@Example.COM ')).toBe('hi@example.com');
  });
  it('returns null for non-strings', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts a basic local@domain', () => {
    expect(isValidEmail('hi@example.com')).toBe(true);
    expect(isValidEmail('alice.b+tag@sub.example.co.uk')).toBe(true);
  });
  it('rejects missing @, leading dot, trailing dot, spaces', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('.dot@example.com')).toBe(false);
    expect(isValidEmail('dot.@example.com')).toBe(false);
    expect(isValidEmail('has space@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('rejects unreasonably long inputs', () => {
    const huge = 'a'.repeat(300) + '@b.com';
    expect(isValidEmail(huge)).toBe(false);
  });
});

describe('randomToken', () => {
  it('returns a 43-44 char URL-safe base64 string', () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43,44}$/);
  });
  it('returns a fresh value each call', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
