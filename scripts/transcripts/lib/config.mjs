// Boards whose meetings are backfilled by the Vimeo auto-transcript pipeline.
// Lifted from docs/superpowers/specs/2026-06-02-meeting-transcripts-scaling.md.

export const DEFAULT_BOARDS = [
  { slug: 'select-board',     display: 'Select Board',     patterns: [/\bselect board\b/i] },
  { slug: 'school-committee', display: 'School Committee', patterns: [/\bschool committee\b/i] },
  { slug: 'finance-committee', display: 'Finance Committee', patterns: [/\bfinance committee\b/i, /\bfincom\b/i] },
  { slug: 'town-meeting',     display: 'Town Meeting',     patterns: [/\btown meeting\b/i] },
  { slug: 'board-of-health',  display: 'Board of Health',  patterns: [/\bboard of health\b/i] },
];

// Titles that look like board names but are actually member profiles, interviews,
// or one-off content. Reject if these markers are present.
const PROFILE_MARKERS = [
  / - [A-Z][a-z]+ [A-Z][a-z]+$/,          // "Select Board - Jim Full" (anchored to end)
  /^'?Headliner\b/i,                       // "'Headliner - Board of Health Updates" news segments
  /\binterview\b/i,
  /\bprofile\b/i,
  /\bnewest member\b/i,
  /^Voting from /i,
];

export function boardForTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return null;
  for (const marker of PROFILE_MARKERS) {
    if (marker.test(title)) return null;
  }
  for (const board of DEFAULT_BOARDS) {
    if (board.patterns.some(p => p.test(title))) {
      return { slug: board.slug, display: board.display };
    }
  }
  return null;
}
