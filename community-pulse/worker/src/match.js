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

const ABBREVIATIONS = {
  ST: 'STREET',
  AVE: 'AVENUE',
  RD: 'ROAD',
  DR: 'DRIVE',
  LN: 'LANE',
  CT: 'COURT',
  PL: 'PLACE',
  BLVD: 'BOULEVARD',
  TER: 'TERRACE',
  HWY: 'HIGHWAY',
  PKWY: 'PARKWAY',
  CIR: 'CIRCLE',
  SQ: 'SQUARE',
};

/**
 * Normalize a Marblehead address into a canonical form used for
 * parcel_owners lookups. Uppercases, expands standard street-type
 * abbreviations, and strips trailing unit suffixes.
 *
 * Examples:
 *   '12 State St'        -> '12 STATE STREET'
 *   '12 State St Unit 3' -> '12 STATE STREET'
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeAddress(s) {
  if (!s) return '';
  let out = s.toUpperCase().trim();
  // Strip trailing unit suffixes: ", #5" / "UNIT 3" / "APT 2" / "#5"
  out = out.replace(/[,\s]+(?:UNIT|APT|#)\s*\S+\s*$/u, '');
  // Strip trailing punctuation on the whole string.
  out = out.replace(/[^\p{L}\p{N}]+$/u, '');
  // Collapse whitespace.
  out = out.replace(/\s+/g, ' ');
  // Expand abbreviations as whole tokens.
  out = out
    .split(' ')
    .map(tok => {
      const bare = tok.replace(/[^\p{L}\p{N}]/gu, '');
      return ABBREVIATIONS[bare] || tok;
    })
    .join(' ');
  return out;
}
