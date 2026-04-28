// Cloudflare Pages Function for the private feedback form on
// /feedback.html. POST a JSON body, we verify the Turnstile token
// with Cloudflare's siteverify endpoint and forward the message to
// a Slack incoming webhook. No persistence; Slack is the inbox.
//
// Required secrets (Cloudflare Pages → Settings → Variables and Secrets):
//   SLACK_WEBHOOK_URL  — incoming-webhook URL for the destination channel
//   TURNSTILE_SECRET   — server-side Turnstile secret key

const MAX_MESSAGE = 2000;
const MAX_NAME = 100;
const MAX_PAGE = 500;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const page = typeof body.page === 'string' ? body.page.trim() : '';
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';

  if (!message) return json({ error: 'Message is required' }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: `Message too long (max ${MAX_MESSAGE} characters)` }, 400);
  if (name.length > MAX_NAME) return json({ error: 'Name too long' }, 400);
  if (page.length > MAX_PAGE) return json({ error: 'Page reference too long' }, 400);
  if (!token) return json({ error: 'Captcha token missing' }, 400);

  if (!env.TURNSTILE_SECRET || !env.SLACK_WEBHOOK_URL) {
    return json({ error: 'Server is not configured' }, 500);
  }

  const ip = request.headers.get('cf-connecting-ip') || '';

  const verifyResp = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    }
  );

  if (!verifyResp.ok) {
    return json({ error: 'Captcha verification unavailable' }, 502);
  }

  const verifyData = await verifyResp.json().catch(() => ({}));
  if (!verifyData.success) {
    return json({ error: 'Captcha failed; please try again' }, 400);
  }

  const country = request.headers.get('cf-ipcountry') || 'unknown';
  const ua = (request.headers.get('user-agent') || 'unknown').slice(0, 200);

  const safeMessage = message.replace(/```/g, "'''");
  const slackPayload = {
    text: `Feedback from marbleheaddata.org${name ? ` — ${name}` : ''}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Feedback from marbleheaddata.org' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*From:*\n${name || '_anonymous_'}` },
          { type: 'mrkdwn', text: `*Page:*\n${page || '_unknown_'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Message:*\n```' + safeMessage + '```' },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `IP: ${ip} • Country: ${country} • UA: ${ua}` },
        ],
      },
    ],
  };

  const slackResp = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload),
  });

  if (!slackResp.ok) {
    return json({ error: 'Could not deliver message' }, 502);
  }

  return json({ ok: true });
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
