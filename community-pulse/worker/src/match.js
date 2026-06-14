// Pure match module. No I/O, no globals. Used by /api/claim/address.

/**
 * Lowercase and split a name string into clean tokens.
 * Treats &, /, and the literal "AND" as separators (co-owner joins).
 * Strips leading/trailing punctuation per token.
 *
 * @param {string} s
 * @returns {string[]}
 */
export function tokenize(s) {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(/[\s&/,]+/)
    .map(t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(t => t.length > 0 && t !== 'and');
}
