// meeting-digest/worker/src/scheduled.js
import { fetchRecentTranscripts } from './lib/transcripts.js';
import { matchTranscripts } from './lib/matcher.js';
import { renderHtml, renderText, renderSubject } from './lib/render.js';
import { sendMail } from './lib/mail.js';
import { randomToken } from './lib/email.js';

// Only run on the cron hour that corresponds to 7 AM ET.
// EST (Nov–Mar): UTC = ET + 5  ⇒  11 UTC == 6 AM ET, 12 UTC == 7 AM ET
// EDT (Mar–Nov): UTC = ET + 4  ⇒  11 UTC == 7 AM ET, 12 UTC == 8 AM ET
// We schedule both 11 and 12 UTC, and run when the ET hour equals 7.
function isSevenAmEasternTime(nowMs = Date.now()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit'
  });
  const hour = parseInt(fmt.format(new Date(nowMs)), 10);
  return hour === 7;
}

export async function runScheduled(event, env, opts = {}) {
  const now = opts.now ?? Date.now();
  const skipGuard = opts.skipTimeGuard === true;
  if (!skipGuard && !isSevenAmEasternTime(now)) {
    return { ok: true, ran: false, reason: 'not 7 AM ET' };
  }

  // 1. Fetch recent transcripts (one network read, shared across subscribers).
  let transcripts;
  try {
    transcripts = await fetchRecentTranscripts(env, now);
  } catch (e) {
    return { ok: false, error: `transcript fetch failed: ${e.message}` };
  }

  // 2. For each confirmed subscriber, filter and send.
  const { results: subs } = await env.DB.prepare('SELECT id, email, manage_token, boards, topics FROM subscriber WHERE status = ?').bind('confirmed').all();

  const weekEnding = new Date(now).toISOString().slice(0, 10);
  let sent = 0, skipped = 0, errored = 0;

  for (const s of subs) {
    const subscription = {
      boards: JSON.parse(s.boards),
      topics: JSON.parse(s.topics)
    };
    const matches = matchTranscripts(transcripts, subscription);
    if (matches.length === 0) { skipped += 1; continue; }

    const subject = renderSubject(matches);
    const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding);
    const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding);
    const unsubMailto = `mailto:unsub@marbleheaddata.org?subject=unsubscribe`;
    const unsubHttp = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(s.manage_token)}`;

    try {
      const result = await sendMail(env, {
        to: s.email, subject, html, text,
        headers: { listUnsubscribe: `<${unsubHttp}>, <${unsubMailto}>` }
      });
      await env.DB.prepare('UPDATE subscriber SET last_sent_at = ? WHERE id = ?').bind(now, s.id).run();
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, result.id || null, 'queued').run();
      sent += 1;
    } catch (e) {
      errored += 1;
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, null, 'failed').run();
    }
  }

  return { ok: true, ran: true, sent, skipped, errored, transcripts: transcripts.length };
}
