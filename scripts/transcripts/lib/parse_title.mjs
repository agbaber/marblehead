import { boardForTitle } from './config.mjs';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function normalizeYear(y) {
  const n = Number(y);
  if (Number.isNaN(n)) return null;
  if (n >= 1000) return n;
  if (n < 0 || n > 99) return null;
  // MHTV started in ~2018. Only accept two-digit years 18-49 (2018-2049).
  // Anything outside that range (e.g. 95) is implausible and rejected.
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
// Supports separators: '-', '.', '/', '_'
function extractDate(title) {
  // Written month: "July 12, 2023" or "July 12 2023"
  const m1 = title.match(/\b([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/);
  if (m1) {
    const mon = MONTHS[m1[1].toLowerCase()];
    if (mon) {
      return isoDate(normalizeYear(m1[3]), mon, Number(m1[2]));
    }
  }
  // Numeric: "5-27-26" or "5.25.22" or "5-8-2025" or "11_13_24"
  const m2 = title.match(/\b(\d{1,2})[-./_](\d{1,2})[-./_](\d{2,4})\b/);
  if (m2) {
    return isoDate(normalizeYear(m2[3]), Number(m2[1]), Number(m2[2]));
  }
  return null;
}

export function parseTitle(title) {
  const board = boardForTitle(title);
  if (!board) {
    return { valid: false, reason: 'not a board meeting' };
  }
  const date = extractDate(title);
  if (!date) {
    return { valid: false, reason: 'no date in title' };
  }
  return {
    valid: true,
    board_slug: board.slug,
    board_display: board.display,
    date,
  };
}
