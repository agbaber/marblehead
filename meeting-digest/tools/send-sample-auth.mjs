#!/usr/bin/env node
// Send sample copies of the subscribe-flow auth emails (confirm + manage) to
// a single recipient. Uses the same templates the live Worker uses, so what
// you see in the inbox is exactly what subscribers will see.
//
// Usage (from meeting-digest/):
//   RESEND_API_KEY=re_... node tools/send-sample-auth.mjs [you@example.com]
//
// Defaults: agbaber@gmail.com.

import {
  confirmEmailSubject, renderConfirmEmailHtml, renderConfirmEmailText,
  manageEmailSubject,  renderManageEmailHtml,  renderManageEmailText
} from '../worker/src/lib/auth-emails.js';

const TO = process.argv[2] || 'agbaber@gmail.com';
const API_KEY = process.env.RESEND_API_KEY;
if (!API_KEY) {
  console.error('Set RESEND_API_KEY in env.');
  process.exit(1);
}

const env = { SITE_BASE_URL: 'https://marbleheaddata.org' };
const FAKE_CONFIRM_TOKEN = 'SAMPLE-CONFIRM-TOKEN-DO-NOT-USE';
const FAKE_MANAGE_TOKEN  = 'SAMPLE-MANAGE-TOKEN-DO-NOT-USE';

async function send(label, subject, html, text) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Marblehead Data <digest@meetings.marbleheaddata.org>',
      to: [TO],
      subject: `[PREVIEW] ${subject}`,
      html, text,
      reply_to: 'agbaber@gmail.com'
    })
  });
  const result = await resp.json();
  if (!resp.ok) {
    console.error(`${label} failed:`, resp.status, result);
    return false;
  }
  console.log(`${label}: sent (resend id ${result.id})`);
  return true;
}

const ok1 = await send(
  'confirm',
  confirmEmailSubject(),
  renderConfirmEmailHtml(env, FAKE_CONFIRM_TOKEN),
  renderConfirmEmailText(env, FAKE_CONFIRM_TOKEN)
);
const ok2 = await send(
  'manage',
  manageEmailSubject(),
  renderManageEmailHtml(env, FAKE_MANAGE_TOKEN),
  renderManageEmailText(env, FAKE_MANAGE_TOKEN)
);
process.exit(ok1 && ok2 ? 0 : 1);
