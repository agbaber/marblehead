// Topic taxonomy for transcript summarization. Must match the set of topic
// pages under /topics/ — adding a slug here without a page leaves a dead
// link; adding a page without a slug here leaves a permanently empty page.

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
  'health-insurance',
  'elections-procedural',
]);

export function isKnownTopic(slug) {
  if (typeof slug !== 'string' || !slug) return false;
  return KNOWN_TOPICS.includes(slug);
}
