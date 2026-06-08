// Topic taxonomy for transcript summarization. Locked to the 11 topics
// already in use across hand-crafted _transcripts/ POCs. New topics
// require a deliberate addition here AND a stub topic page under topics/.

export const KNOWN_TOPICS = Object.freeze([
  'override',
  'school-budget',
  'admin-housekeeping',
  'public-comment',
  'permits-zoning',
  'trash-dpw',
  'recreation-events',
  'bonding-capital',
  'public-safety',
  'labor-personnel',
  '40b-mbta',
]);

export function isKnownTopic(slug) {
  if (typeof slug !== 'string' || !slug) return false;
  return KNOWN_TOPICS.includes(slug);
}
