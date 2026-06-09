// meeting-digest/worker/src/lib/render.js

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatShortDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return iso || '';
  const mi = parseInt(iso.slice(5, 7), 10) - 1;
  const d = parseInt(iso.slice(8, 10), 10);
  if (Number.isNaN(mi) || Number.isNaN(d) || mi < 0 || mi > 11) return iso;
  return `${MONTHS[mi]} ${d}`;
}

export function renderSubject(matches) {
  if (matches.length === 1) {
    const m = matches[0];
    return `${m.transcript.board_display}: ${m.transcript.summary_card?.headline || m.transcript.title}`;
  }
  return `${matches.length} Marblehead meetings this week`;
}

function meetingHtml(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  return `
  <div style="margin: 0 0 32px;">
    <p style="margin: 0 0 6px; font-size: 13px; color: #666;">${escapeHtml(t.board_display)} · ${escapeHtml(formatShortDate(t.date))}</p>
    <h2 style="margin: 0 0 10px; font-size: 19px; line-height: 1.3; color: #1a1a1a; font-weight: 600;">${escapeHtml(t.summary_card?.headline || t.title)}</h2>
    <p style="margin: 0 0 12px; color: #333; line-height: 1.55;">${escapeHtml(t.summary_card?.summary || '')}</p>
    <p style="margin: 0; font-size: 14px;"><a href="${meetingUrl}" style="color: #1B3A57; text-decoration: none; font-weight: 500;">Read &amp; watch on marbleheaddata.org &rarr;</a></p>
  </div>`;
}

function meetingText(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  return `${t.board_display} · ${formatShortDate(t.date)}
${t.summary_card?.headline || t.title}

${t.summary_card?.summary || ''}

  ${meetingUrl}`;
}

export function renderHtml(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(subscriber.manage_token)}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(subscriber.manage_token)}`;
  const count = matches.length;
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1a1a1a; line-height: 1.5;">
  <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Marblehead Data</p>
  <h1 style="margin: 0 0 28px; font-size: 22px; font-weight: 600; color: #1a1a1a;">${count} ${count === 1 ? 'meeting' : 'meetings'} this week</h1>

  ${matches.map(m => meetingHtml(m, env)).join('')}

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 8px 0 16px;">
  <p style="margin: 0 0 6px; font-size: 13px; color: #666;">
    <a href="${manageUrl}" style="color: #1B3A57; text-decoration: none;">Manage subscription</a>
    &nbsp;·&nbsp;
    <a href="${unsubUrl}" style="color: #1B3A57; text-decoration: none;">Unsubscribe</a>
  </p>
  <p style="margin: 0; font-size: 12px; color: #999;">Summaries are AI-generated. Verify with the source video.</p>
</body></html>`;
}

export function renderText(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${subscriber.manage_token}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${subscriber.manage_token}`;
  const count = matches.length;
  const body = matches.map(m => meetingText(m, env)).join('\n\n');
  return `Marblehead Data
${count} ${count === 1 ? 'meeting' : 'meetings'} this week

${body}

---
Manage subscription: ${manageUrl}
Unsubscribe: ${unsubUrl}

Summaries are AI-generated. Verify with the source video.
`;
}
