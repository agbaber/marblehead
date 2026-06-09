// meeting-digest/worker/src/lib/auth-emails.js
//
// Templates for the two account-lifecycle emails:
//   - confirm:  sent on signup or pending-resignup
//   - manage:   sent when an already-confirmed address tries to subscribe again
//
// Both share the chrome from email-shell.js (navy hero bar, light/dark-aware
// background, lighthouse mark). Keep copy short, no em-dashes, navy buttons.

import { emailShell } from './email-shell.js';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function button(href, label) {
  return `<a class="mhd-button" href="${href}" style="display: inline-block; background-color: #1B3A57; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 15px;">${escapeHtml(label)}</a>`;
}

export function confirmEmailSubject() {
  return 'Confirm your Marblehead Data subscription';
}

export function renderConfirmEmailHtml(env, token) {
  const url = `${env.SITE_BASE_URL}/subscribe/confirm/?token=${encodeURIComponent(token)}`;
  return emailShell({ body: `
  <h1 style="margin: 0 0 14px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Confirm your subscription</h1>
  <p style="margin: 0 0 18px;">You'll get a short summary of meetings of the Select Board, School Committee, and Finance Committee each Friday morning. You can add Board of Health and Town Meeting after you confirm.</p>
  <p style="margin: 0 0 28px;">${button(url, 'Confirm subscription')}</p>
  <p class="mhd-muted" style="margin: 0 0 4px; font-size: 13px; color: #6c757d;">This link expires in 24 hours.</p>
  <p class="mhd-muted" style="margin: 0; font-size: 13px; color: #6c757d;">If this wasn't you, ignore this email. Nothing happens until you click.</p>
` });
}

export function renderConfirmEmailText(env, token) {
  const url = `${env.SITE_BASE_URL}/subscribe/confirm/?token=${token}`;
  return `Marblehead Data
Confirm your subscription

You'll get a short summary of meetings of the Select Board, School
Committee, and Finance Committee each Friday morning. You can add
Board of Health and Town Meeting after you confirm.

Confirm: ${url}

This link expires in 24 hours.
If this wasn't you, ignore this email. Nothing happens until you click.

marbleheaddata.org
`;
}

export function manageEmailSubject() {
  return 'Your Marblehead Data subscription';
}

export function renderManageEmailHtml(env, manageToken) {
  const url = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(manageToken)}`;
  return emailShell({ body: `
  <h1 style="margin: 0 0 14px; font-size: 22px; font-weight: 600; color: #1a1a1a;">You're already subscribed</h1>
  <p style="margin: 0 0 28px;">Use the button below to update which boards and topics you hear about, or to unsubscribe.</p>
  <p style="margin: 0 0 22px;">${button(url, 'Manage subscription')}</p>
  <p class="mhd-muted" style="margin: 0; font-size: 13px; color: #6c757d;">If you didn't try to subscribe again, you can ignore this email.</p>
` });
}

export function renderManageEmailText(env, manageToken) {
  const url = `${env.SITE_BASE_URL}/me/subscription/?token=${manageToken}`;
  return `Marblehead Data
You're already subscribed

Use the link below to update which boards and topics you hear about,
or to unsubscribe.

Manage: ${url}

If you didn't try to subscribe again, you can ignore this email.

marbleheaddata.org
`;
}
