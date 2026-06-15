// meeting-digest/worker/src/scheduled.js
import { fetchRecentTranscripts } from './lib/transcripts.js';
import { matchTranscripts } from './lib/matcher.js';
import { renderHtml, renderText, renderSubject } from './lib/render.js';
import { sendMail } from './lib/mail.js';
import { randomToken } from './lib/email.js';
import { fetchPrimers, pickPrimer } from './lib/primer.js';

// Backup crons fire 30 minutes after the primary slot, so we never want to
// re-send within the same morning. Five days is well past that and well
// short of next Monday's primary fire (7 days), so the next legitimate
// digest still goes out.
const IDEMPOTENCY_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

function getEtHour(nowMs) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit'
  });
  return parseInt(fmt.format(new Date(nowMs)), 10);
}

// Only run on the cron firing whose ET hour equals 7.
// EST (Nov–Mar): 12 UTC == 7 AM ET (and 12:30 UTC == 7:30 AM ET)
// EDT (Mar–Nov): 11 UTC == 7 AM ET (and 11:30 UTC == 7:30 AM ET)
function isSevenAmEasternTime(nowMs = Date.now()) {
  return getEtHour(nowMs) === 7;
}

export async function runScheduled(event, env, opts = {}) {
  const now = opts.now ?? Date.now();
  const scheduledTime = event && event.scheduledTime ? event.scheduledTime : now;
  const cron = event && event.cron ? event.cron : 'manual';
  console.log(`[digest] cron fire: cron=${cron} scheduledTime=${new Date(scheduledTime).toISOString()} now=${new Date(now).toISOString()}`);

  const skipGuard = opts.skipTimeGuard === true;
  if (!skipGuard && !isSevenAmEasternTime(now)) {
    console.log(`[digest] skip: not 7am ET (et_hour=${getEtHour(now)})`);
    return { ok: true, ran: false, reason: 'not 7 AM ET' };
  }

  // 1. Pick confirmed subscribers who haven't been emailed in IDEMPOTENCY_WINDOW_MS.
  //    A backup cron landing 30 min after the primary therefore sees zero rows
  //    for anyone already sent and the loop is a fast no-op — and we skip the
  //    GitHub round trip entirely in that case.
  const idempotencyCutoff = now - IDEMPOTENCY_WINDOW_MS;
  const { results: subs } = await env.DB.prepare(
    'SELECT id, email, manage_token, boards, topics, drip_week_index FROM subscriber WHERE status = ? AND (last_sent_at IS NULL OR last_sent_at < ?)'
  ).bind('confirmed', idempotencyCutoff).all();
  console.log(`[digest] eligible subscribers (confirmed, not sent in last 5d): count=${subs.length}`);

  if (subs.length === 0) {
    return { ok: true, ran: true, sent: 0, skipped: 0, errored: 0, transcripts: 0 };
  }

  // 2. Fetch recent transcripts (one network read, shared across subscribers).
  let transcripts;
  try {
    transcripts = await fetchRecentTranscripts(env, now);
  } catch (e) {
    console.log(`[digest] transcript fetch failed: ${e.message}`);
    return { ok: false, error: `transcript fetch failed: ${e.message}` };
  }
  console.log(`[digest] fetched transcripts in last 7 days: count=${transcripts.length}`);

  let primers = [];
  let maxPrimerIndex = 0;
  try {
    primers = await fetchPrimers(env);
    maxPrimerIndex = primers.length > 0 ? primers[primers.length - 1].week_index : 0;
    console.log(`[digest] fetched primers: count=${primers.length} max_week_index=${maxPrimerIndex}`);
  } catch (e) {
    console.log(`[digest] primers fetch failed (continuing without primer block): ${e.message}`);
    primers = [];
    maxPrimerIndex = 0;
  }

  const weekEnding = new Date(now).toISOString().slice(0, 10);
  let sent = 0, skipped = 0, errored = 0;

  for (const s of subs) {
    const subscription = {
      boards: JSON.parse(s.boards),
      topics: JSON.parse(s.topics)
    };
    const matches = matchTranscripts(transcripts, subscription);
    if (matches.length === 0) { skipped += 1; continue; }

    const primer = pickPrimer(primers, s.drip_week_index || 0);

    const subject = renderSubject(matches);
    const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
    const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
    const unsubMailto = `mailto:unsub@marbleheaddata.org?subject=unsubscribe`;
    const unsubHttp = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(s.manage_token)}`;

    try {
      const result = await sendMail(env, {
        to: s.email, subject, html, text,
        headers: { listUnsubscribe: `<${unsubHttp}>, <${unsubMailto}>` }
      });
      if (primer) {
        await env.DB.prepare(
          'UPDATE subscriber SET last_sent_at = ?, drip_week_index = drip_week_index + 1 WHERE id = ?'
        ).bind(now, s.id).run();
      } else {
        await env.DB.prepare(
          'UPDATE subscriber SET last_sent_at = ? WHERE id = ?'
        ).bind(now, s.id).run();
      }
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, result.id || null, 'queued').run();
      sent += 1;
    } catch (e) {
      errored += 1;
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, null, 'failed').run();
    }
  }

  console.log(`[digest] done: sent=${sent} skipped=${skipped} errored=${errored} transcripts=${transcripts.length}`);
  return { ok: true, ran: true, sent, skipped, errored, transcripts: transcripts.length };
}
