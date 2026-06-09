// meeting-digest/worker/src/lib/render.js
import { TOPICS } from './topics.js';

const TOPIC_LABEL = new Map(TOPICS.map(t => [t.slug, t.label]));

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTimecode(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function renderSubject(matches) {
  if (matches.length === 1) {
    const m = matches[0];
    return `[MHD Data] ${m.transcript.board_display}: ${m.transcript.summary_card?.headline || m.transcript.title}`;
  }
  const heads = matches.slice(0, 3).map(m => m.transcript.summary_card?.headline || m.transcript.title);
  if (matches.length <= 3) {
    return `[MHD Data] ${matches.length} meetings this week: ${heads.join(' · ')}`;
  }
  return `[MHD Data] ${matches.length} meetings this week: ${heads.join(' · ')}...`;
}

function meetingCardHtml(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  const segs = m.matched_segments;
  const segHtml = segs.length === 0 ? '' : `
        <p style="margin: 14px 0 6px; font-weight: 600;">Matching segments</p>
        <ul style="margin: 0 0 14px 0; padding-left: 20px;">
          ${segs.map(s => `
            <li><strong>${escapeHtml(TOPIC_LABEL.get(s.topic) || s.topic)}</strong> (${formatTimecode(s.start_seconds)}) — ${escapeHtml(s.headline || '')}${s.dek ? ` <span style="color: #666;">${escapeHtml(s.dek)}</span>` : ''}</li>
          `).join('')}
        </ul>`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
      <tr><td style="padding: 18px 4px;">
        <p style="margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #666;">${escapeHtml(t.board_display)} · ${escapeHtml(t.date)}</p>
        <h2 style="margin: 0 0 8px; font-size: 18px;">${escapeHtml(t.summary_card?.headline || t.title)}</h2>
        <p style="margin: 0 0 10px; color: #333;">${escapeHtml(t.summary_card?.summary || '')}</p>
        ${segHtml}
        <p style="margin: 14px 0 0; font-size: 14px;"><a href="${meetingUrl}" style="color: #1a3a5c;">Read on marbleheaddata.org →</a> &nbsp; <a href="${escapeHtml(t.vimeo_url)}" style="color: #1a3a5c;">▶ Watch on MHTV</a></p>
      </td></tr>
    </table>`;
}

function meetingCardText(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  const segs = m.matched_segments;
  let segText = '';
  if (segs.length > 0) {
    segText = '\nMatching segments:\n' + segs.map(s =>
      ` • ${TOPIC_LABEL.get(s.topic) || s.topic} (${formatTimecode(s.start_seconds)}) — ${s.headline || ''}${s.dek ? `. ${s.dek}` : ''}`
    ).join('\n') + '\n';
  }
  return `
${t.board_display.toUpperCase()} · ${t.date}
${t.summary_card?.headline || t.title}
${'─'.repeat(40)}
${t.summary_card?.summary || ''}
${segText}
Read: ${meetingUrl}
Watch: ${t.vimeo_url}
`;
}

export function renderHtml(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(subscriber.manage_token)}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(subscriber.manage_token)}`;
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p style="font-size: 12px; color: #666; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.06em;">Marblehead Data — Friday digest</p>
  <p style="margin: 0 0 24px; color: #666;">Week ending ${escapeHtml(weekEndingIso)} · ${matches.length} meeting${matches.length === 1 ? '' : 's'} matched.</p>

  ${matches.map(m => meetingCardHtml(m, env)).join('')}

  <p style="margin: 32px 0 8px; font-size: 13px; color: #666;">
    <a href="${manageUrl}" style="color: #1a3a5c;">Manage your subscription</a>
    &nbsp;·&nbsp;
    <a href="${unsubUrl}" style="color: #1a3a5c;">Unsubscribe (one click)</a>
  </p>
  <p style="margin: 4px 0; font-size: 12px; color: #999;">AI-generated summaries · may contain errors · verify with the source video.</p>
</body></html>`;
}

export function renderText(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${subscriber.manage_token}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${subscriber.manage_token}`;
  return `Marblehead Data — Friday digest
Week ending ${weekEndingIso} · ${matches.length} meeting${matches.length === 1 ? '' : 's'} matched.

${matches.map(m => meetingCardText(m, env)).join('\n')}

Manage your subscription: ${manageUrl}
Unsubscribe (one click): ${unsubUrl}

AI-generated summaries · may contain errors · verify with the source video.
`;
}
