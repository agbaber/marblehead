// Watchdog logic: which recently-published meetings still have no transcript?
//
// This is the guard against the failure that froze ingest at July 8 2026 while
// CI stayed green: the caption fetch silently returned "no caption track" for
// every new meeting, nothing was added, and the daily job exited 0. Comparing
// a FRESHLY ENUMERATED channel index against the transcripts we actually have
// surfaces that gap loudly.
//
// Pure and fs-free so it is unit-testable: the caller injects `hasTranscript`
// and `now`.
//
// A meeting is "stale" when it has no transcript AND its age is inside
// [graceDays, maxDays]:
//   - graceDays (default 5) skips the normal window where Vimeo's en-x-autogen
//     track has not been generated yet (observed lag: 2-4 days).
//   - maxDays (default 45) ignores ancient gaps we are never going to fill
//     (e.g. the 2020 board meetings that genuinely have no caption track), so
//     the alarm converges instead of screaming about known holes forever.

export const DEFAULT_GRACE_DAYS = 5;
export const DEFAULT_MAX_DAYS = 45;
const DAY_MS = 86_400_000;

/**
 * @param {{meetings?: Array<{board_slug: string, date: string, vimeo_id?: string, raw_title?: string, title?: string}>}} index
 * @param {(slug: string) => boolean} hasTranscript  slug is `${board_slug}-${date}`
 * @param {{now?: number, graceDays?: number, maxDays?: number}} [opts]
 * @returns {Array<{slug: string, date: string, vimeo_id?: string, ageDays: number, title?: string}>}
 */
export function findStaleMeetings(index, hasTranscript, opts = {}) {
  const now = opts.now ?? Date.now();
  const graceDays = opts.graceDays ?? DEFAULT_GRACE_DAYS;
  const maxDays = opts.maxDays ?? DEFAULT_MAX_DAYS;

  const stale = [];
  for (const m of index?.meetings ?? []) {
    if (!m?.board_slug || !m?.date) continue;
    const slug = `${m.board_slug}-${m.date}`;
    if (hasTranscript(slug)) continue;
    const parsed = Date.parse(m.date);
    if (Number.isNaN(parsed)) continue;
    const ageDays = (now - parsed) / DAY_MS;
    if (ageDays >= graceDays && ageDays <= maxDays) {
      stale.push({
        slug,
        date: m.date,
        vimeo_id: m.vimeo_id,
        ageDays: Math.round(ageDays),
        title: m.raw_title ?? m.title,
      });
    }
  }
  stale.sort((a, b) => a.date.localeCompare(b.date));
  return stale;
}
