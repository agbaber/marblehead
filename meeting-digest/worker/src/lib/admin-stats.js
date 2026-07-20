// meeting-digest/worker/src/lib/admin-stats.js
//
// One D1 aggregate query that returns subscriber counts per status with
// a delta count for rows that transitioned into that status in the last
// 7 days. Caller (scheduled.js) runs this once per cron and passes the
// result to the renderer when the recipient matches env.ADMIN_EMAIL.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const ALL_STATUSES = [
  'confirmed',
  'pending_confirmation',
  'unsubscribed',
  'bounced',
  'complained'
];

export async function fetchSubscriberStats(env, nowMs) {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  const { results } = await env.DB.prepare(`
    SELECT
      status,
      COUNT(*) AS n,
      -- bounced and complained have no transition timestamp column, so they fall to ELSE 0 (never new)
      SUM(CASE
        WHEN status = 'confirmed'             AND confirmed_at    > ? THEN 1
        WHEN status = 'pending_confirmation'  AND created_at      > ? THEN 1
        WHEN status = 'unsubscribed'          AND unsubscribed_at > ? THEN 1
        ELSE 0
      END) AS n_new
    FROM subscriber
    GROUP BY status
  `).bind(cutoff, cutoff, cutoff).all();

  // Initialize every status to zero so the renderer can rely on key presence.
  const out = {};
  for (const status of ALL_STATUSES) {
    out[status] = { n: 0, n_new: 0 };
  }
  for (const row of results) {
    if (out[row.status]) {
      out[row.status] = {
        n: Number(row.n) || 0,
        n_new: Number(row.n_new) || 0
      };
    }
  }
  return out;
}
