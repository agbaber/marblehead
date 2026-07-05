import { boardForTitle, DEFAULT_BOARDS } from './config.mjs';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Titles from the MPS YouTube channel that *should* be classified as
// school-committee even though they don't say "School Committee" — meetings,
// "S C  Meeting" shorthand, the SC's subcommittees (including the observed
// "Sub Committee" spacing and "Submcommittee" uploader typo), Budget
// Sub-Joint sessions, and budget workshops/votes/public hearings. Forums
// and press conferences intentionally do not match.
const MEETING_LIKE = /\b(meeting|subm?committee|sub[-\s]committee|sub[-\s]joint|budget\s+(workshop|vote|public\s+hearing)|s\s+c\b|\bsc\b)/i;

function normalizeYear(y) {
  const n = Number(y);
  if (Number.isNaN(n)) return null;
  if (n >= 1000) return n;
  if (n < 0 || n > 99) return null;
  // MHTV started in ~2018 and the MPS YT channel goes back a bit further;
  // accept two-digit years 18-49 (2018-2049). Earlier two-digit years are
  // implausible and rejected to guard against false positives.
  if (n < 18 || n > 49) return null;
  return 2000 + n;
}

function pad(n) { return String(n).padStart(2, '0'); }

function isoDate(y, m, d) {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 2000) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Try to extract a date in M/D/Y or written-month form.
// Supports separators: '-', '.', '/', '_', and whitespace (MPS uses "06 23 2022").
function extractDate(title) {
  // Written month: "July 12, 2023" or "July 12 2023" or "April 9, 2026"
  const m1 = title.match(/\b([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/);
  if (m1) {
    const mon = MONTHS[m1[1].toLowerCase()];
    if (mon) {
      return isoDate(normalizeYear(m1[3]), mon, Number(m1[2]));
    }
  }
  // Numeric with punctuation: "5-27-26" or "5.25.22" or "5-8-2025" or "11_13_24"
  const m2 = title.match(/\b(\d{1,2})[-./_](\d{1,2})[-./_](\d{2,4})\b/);
  if (m2) {
    return isoDate(normalizeYear(m2[3]), Number(m2[1]), Number(m2[2]));
  }
  // Space-separated numeric: "06 23 2022". Guard against single-digit
  // ambiguity by requiring the year to be two- or four-digit and the title
  // segment to look date-shaped (no surrounding alpha tokens).
  const m3 = title.match(/(?:^|[^\w/.-])(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})(?:[^\w/.-]|$)/);
  if (m3) {
    return isoDate(normalizeYear(m3[3]), Number(m3[1]), Number(m3[2]));
  }
  return null;
}

function boardByHint(slug) {
  const b = DEFAULT_BOARDS.find(d => d.slug === slug);
  return b ? { slug: b.slug, display: b.display } : null;
}

/**
 * Parse a channel video title into board + date.
 *
 * @param {string} title
 * @param {{ boardHint?: string }} [opts]
 *   boardHint: if set, classify the title as this board when (a) no other
 *   board regex matches AND (b) the title contains a meeting-like signal.
 *   Used by the MPS YouTube pipeline where the channel context itself
 *   implies school-committee for titles like "Policy Subcommittee 1/15/25".
 *
 * @returns {{
 *   valid: boolean,
 *   board_slug?: string,
 *   board_display?: string,
 *   date?: string,
 *   reason?: string,
 * }}
 *   On `valid: false`, board_slug/board_display may still be set when the
 *   board could be determined but the date could not — callers can recover
 *   by sourcing the date elsewhere (e.g. YouTube upload_date).
 */
export function parseTitle(title, opts = {}) {
  const { boardHint } = opts;
  let board = boardForTitle(title);
  if (!board && boardHint && MEETING_LIKE.test(title)) {
    board = boardByHint(boardHint);
  }
  if (!board) {
    return { valid: false, reason: 'not a board meeting' };
  }
  const date = extractDate(title);
  if (!date) {
    return {
      valid: false,
      reason: 'no date in title',
      board_slug: board.slug,
      board_display: board.display,
    };
  }
  return {
    valid: true,
    board_slug: board.slug,
    board_display: board.display,
    date,
  };
}
