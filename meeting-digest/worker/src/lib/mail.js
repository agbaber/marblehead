// meeting-digest/worker/src/lib/mail.js
// Resend HTTP API wrapper.
// Env requires: MAIL_PROVIDER_API_KEY (Resend), MAIL_FROM, optional MAIL_REPLY_TO.

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendMail(env, { to, subject, html, text, headers }) {
  if (!env.MAIL_PROVIDER_API_KEY) {
    throw new Error('MAIL_PROVIDER_API_KEY is not set');
  }
  const body = {
    from: env.MAIL_FROM,
    to: [to],
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': headers?.listUnsubscribe || '',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(headers?.extra || {})
    }
  };
  if (env.MAIL_REPLY_TO) body.reply_to = env.MAIL_REPLY_TO;

  const resp = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Resend send failed: ${resp.status} ${detail.slice(0, 500)}`);
  }
  return resp.json();  // shape: { id: "..." }
}
