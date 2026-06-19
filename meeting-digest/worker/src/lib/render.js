// meeting-digest/worker/src/lib/render.js

import { emailShell } from './email-shell.js';

// Apply to editorial outbound links only (meeting pages). Skips the
// manage/unsubscribe links: those go to internal Worker routes that
// don't render as $pageview events on marbleheaddata.org, so the UTM
// would be noise, not signal.
const UTM_QUERY = 'utm_source=digest&utm_medium=email&utm_campaign=weekly';
function withUtm(url) {
  return url.includes('?') ? `${url}&${UTM_QUERY}` : `${url}?${UTM_QUERY}`;
}

function withPrimerUtm(url, weekIndex, env) {
  const PRIMER_QUERY = `utm_source=digest&utm_medium=email&utm_campaign=primer-week-${weekIndex}`;
  // Primer link_url may be a path (/about/) or full URL. Resolve against SITE_BASE_URL.
  const absolute = url.startsWith('http') ? url : `${env.SITE_BASE_URL}${url}`;
  return absolute.includes('?') ? `${absolute}&${PRIMER_QUERY}` : `${absolute}?${PRIMER_QUERY}`;
}

function primerHtml(primer, maxPrimerIndex, env) {
  const linkUrl = withPrimerUtm(primer.link_url, primer.week_index, env);
  const bodyHtml = primer.body_paragraphs.map(p =>
    `<p class="mhd-body" style="margin: 0 0 12px; color: #2a3036; line-height: 1.55;">${escapeHtml(p)}</p>`
  ).join('');
  return `
  <hr class="mhd-hr" style="border: 0; border-top: 1px solid #e3e8ee; margin: 8px 0 24px;">
  <div style="margin: 0 0 8px;">
    <p class="mhd-muted" style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">Site primer · ${primer.week_index} of ${maxPrimerIndex}</p>
    <h2 style="margin: 0 0 10px; font-size: 19px; line-height: 1.3; color: #1a1a1a; font-weight: 600;">${escapeHtml(primer.title)}</h2>
    ${bodyHtml}
    <p style="margin: 0; font-size: 14px;"><a class="mhd-link" href="${linkUrl}" style="color: #1B3A57; text-decoration: none; font-weight: 500;">${escapeHtml(primer.link_label)} &rarr;</a></p>
  </div>`;
}

function primerText(primer, maxPrimerIndex, env) {
  const linkUrl = withPrimerUtm(primer.link_url, primer.week_index, env);
  const body = primer.body_paragraphs.join('\n\n');
  // Returns a block that begins with `---\n\n` and ends with `\n\n` so the
  // existing renderText footer's `---` separator stays one blank line below.
  return `---\n\nSITE PRIMER · ${primer.week_index} of ${maxPrimerIndex}\n\n${primer.title}\n\n${body}\n\n${primer.link_label}: ${linkUrl}\n\n`;
}

// Format a week-ending ISO date (YYYY-MM-DD) as "Jun 22" — no year, no comma.
// Used for the admin stats label so it matches the digest's existing week framing.
function weekOfLabel(weekEndingIso) {
  if (typeof weekEndingIso !== 'string' || weekEndingIso.length < 10) return '';
  const mi = parseInt(weekEndingIso.slice(5, 7), 10) - 1;
  const d = parseInt(weekEndingIso.slice(8, 10), 10);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (Number.isNaN(mi) || Number.isNaN(d) || mi < 0 || mi > 11) return '';
  return `${MONTHS[mi]} ${d}`;
}

// Status display name + whether the line shows a delta. Bounced and Complained
// have no transition timestamp, so they're count-only.
const ADMIN_STATUS_LINES = [
  { key: 'confirmed',            label: 'Confirmed',    withDelta: true,  alwaysRender: true  },
  { key: 'pending_confirmation', label: 'Pending',      withDelta: true,  alwaysRender: true  },
  { key: 'unsubscribed',         label: 'Unsubscribed', withDelta: true,  alwaysRender: true  },
  { key: 'bounced',              label: 'Bounced',      withDelta: false, alwaysRender: true  },
  { key: 'complained',           label: 'Complained',   withDelta: false, alwaysRender: false }
];

function adminStatsLines(stats) {
  const lines = [];
  for (const cfg of ADMIN_STATUS_LINES) {
    const entry = stats[cfg.key] || { n: 0, n_new: 0 };
    if (!cfg.alwaysRender && entry.n <= 0) continue;
    if (cfg.withDelta) {
      lines.push(`${cfg.label}: ${entry.n} (+${entry.n_new})`);
    } else {
      lines.push(`${cfg.label}: ${entry.n}`);
    }
  }
  return lines;
}

function adminStatsHtml(stats, weekEndingIso) {
  const label = weekOfLabel(weekEndingIso);
  const header = label ? `Admin · subscriber snapshot (week of ${label})` : 'Admin · subscriber snapshot';
  const lines = adminStatsLines(stats);
  const lineHtml = lines.map(line =>
    `<p class="mhd-body" style="margin: 0 0 4px; color: #2a3036; line-height: 1.55; font-variant-numeric: tabular-nums;">${escapeHtml(line)}</p>`
  ).join('');
  return `
  <hr class="mhd-hr" style="border: 0; border-top: 1px solid #e3e8ee; margin: 8px 0 24px;">
  <div style="margin: 0 0 8px;">
    <p class="mhd-muted" style="margin: 0 0 8px; font-size: 13px; color: #6c757d;">${escapeHtml(header)}</p>
    ${lineHtml}
  </div>`;
}

function adminStatsText(stats, weekEndingIso) {
  const label = weekOfLabel(weekEndingIso);
  const header = label ? `Admin · subscriber snapshot (week of ${label})` : 'Admin · subscriber snapshot';
  const lines = adminStatsLines(stats);
  // Block opens with `---\n\n` and ends with `\n\n` for the same reason
  // primerText does: keeps the existing footer `---` separator clean below.
  return `---\n\n${header}\n${lines.join('\n')}\n\n`;
}

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
  const meetingUrl = withUtm(`${env.SITE_BASE_URL}/meetings/${t.slug}/`);
  return `
  <div style="margin: 0 0 28px;">
    <p class="mhd-muted" style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">${escapeHtml(t.board_display)} · ${escapeHtml(formatShortDate(t.date))}</p>
    <h2 style="margin: 0 0 10px; font-size: 19px; line-height: 1.3; color: #1a1a1a; font-weight: 600;">${escapeHtml(t.summary_card?.headline || t.title)}</h2>
    <p class="mhd-body" style="margin: 0 0 12px; color: #2a3036; line-height: 1.55;">${escapeHtml(t.summary_card?.summary || '')}</p>
    <p style="margin: 0; font-size: 14px;"><a class="mhd-link" href="${meetingUrl}" style="color: #1B3A57; text-decoration: none; font-weight: 500;">Read &amp; watch on marbleheaddata.org &rarr;</a></p>
  </div>`;
}

function meetingText(m, env) {
  const t = m.transcript;
  const meetingUrl = withUtm(`${env.SITE_BASE_URL}/meetings/${t.slug}/`);
  return `${t.board_display} · ${formatShortDate(t.date)}
${t.summary_card?.headline || t.title}

${t.summary_card?.summary || ''}

  ${meetingUrl}`;
}

export function renderHtml(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0, adminStats = null) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(subscriber.manage_token)}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(subscriber.manage_token)}`;
  const count = matches.length;
  return emailShell({ body: `
  <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a; line-height: 1.25;">${count} ${count === 1 ? 'meeting' : 'meetings'} this week</h1>

  ${matches.map(m => meetingHtml(m, env)).join('')}
  ${primer ? primerHtml(primer, maxPrimerIndex, env) : ''}
  ${adminStats ? adminStatsHtml(adminStats, weekEndingIso) : ''}

  <hr class="mhd-hr" style="border: none; border-top: 1px solid #e5e5e5; margin: 8px 0 16px;">
  <p style="margin: 0 0 8px; font-size: 13px; color: #6c757d;">Got a question or correction? Just reply to this email.</p>
  <p style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">
    <a class="mhd-link" href="${manageUrl}" style="color: #1B3A57; text-decoration: none;">Manage subscription</a>
    &nbsp;·&nbsp;
    <a class="mhd-link" href="${unsubUrl}" style="color: #1B3A57; text-decoration: none;">Unsubscribe</a>
  </p>
  <p class="mhd-muted" style="margin: 0; font-size: 12px; color: #8a949c;">Summaries are AI-generated. Verify with the source video.</p>
` });
}

export function renderText(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0, adminStats = null) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${subscriber.manage_token}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${subscriber.manage_token}`;
  const count = matches.length;
  const body = matches.map(m => meetingText(m, env)).join('\n\n');
  return `Marblehead Data
${count} ${count === 1 ? 'meeting' : 'meetings'} this week

${body}

${primer ? primerText(primer, maxPrimerIndex, env) : ''}${adminStats ? adminStatsText(adminStats, weekEndingIso) : ''}---
Got a question or correction? Just reply to this email.

Manage subscription: ${manageUrl}
Unsubscribe: ${unsubUrl}

Summaries are AI-generated. Verify with the source video.
`;
}
