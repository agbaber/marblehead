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

const TRUST_MARKERS = new Set([
  'tr', 'trs', 'trust', 'trustee', 'trustees',
  'llc', 'lp', 'inc', 'corp', 'est', 'estate',
]);

/**
 * Match a Facebook display name against a Marblehead assessor owner string.
 *
 * Returns one of:
 *   { status: 'match' }
 *   { status: 'first_initial_mismatch', alternatives: string[] }
 *   { status: 'name_mismatch' }
 *
 * "first_initial_mismatch" means the surname matched but the first name did
 * not — the alternatives list contains the deed's other given-name tokens,
 * uppercased.
 *
 * @param {string} fbDisplayName
 * @param {string} ownerName
 * @returns {{status: string, alternatives?: string[]}}
 */
export function matchOwner(fbDisplayName, ownerName) {
  const fb = tokenize(fbDisplayName);
  const own = tokenize(ownerName);

  if (fb.length < 2 || own.length < 2) {
    return { status: 'name_mismatch' };
  }

  // Reject any trust/LLC/estate record.
  if (own.some(t => TRUST_MARKERS.has(t))) {
    return { status: 'name_mismatch' };
  }

  const fbFirst = fb[0];
  const fbLast = fb[fb.length - 1];

  if (!own.includes(fbLast)) {
    return { status: 'name_mismatch' };
  }

  // Given-name tokens are the tokens immediately following each occurrence
  // of the surname token on the deed.
  const givens = [];
  for (let i = 0; i < own.length; i++) {
    if (own[i] === fbLast && i + 1 < own.length) {
      givens.push(own[i + 1]);
    }
  }

  for (const gt of givens) {
    if (gt === fbFirst) return { status: 'match' };
    if (gt.length === 1 && gt === fbFirst[0]) return { status: 'match' };
    if (fbFirst.length === 1 && gt.startsWith(fbFirst)) return { status: 'match' };
  }

  return {
    status: 'first_initial_mismatch',
    alternatives: givens.map(g => g.toUpperCase()),
  };
}
