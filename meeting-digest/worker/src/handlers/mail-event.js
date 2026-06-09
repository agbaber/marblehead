// Resend webhook format: { type, data: { email_id, ... } }
const BOUNCE_TYPES = new Set(['email.bounced', 'email.complained']);

export async function handleMailEvent(request, env, corsHeaders) {
  let evt;
  try { evt = await request.json(); } catch { return resp(400, { error: 'invalid body' }, corsHeaders); }
  if (!evt || typeof evt.type !== 'string' || !BOUNCE_TYPES.has(evt.type)) {
    return resp(200, { ok: true, ignored: true }, corsHeaders);
  }
  const messageId = evt.data?.email_id;
  if (!messageId) return resp(400, { error: 'missing email_id' }, corsHeaders);

  const dl = await env.DB.prepare('SELECT subscriber_id FROM delivery_log WHERE provider_message_id = ?').bind(messageId).first();
  if (!dl) return resp(200, { ok: true, ignored: true }, corsHeaders);

  const newStatus = evt.type === 'email.complained' ? 'complained' : 'bounced';
  await env.DB.prepare('UPDATE subscriber SET status=? WHERE id=?').bind(newStatus, dl.subscriber_id).run();
  await env.DB.prepare('UPDATE delivery_log SET status=? WHERE provider_message_id=?').bind(newStatus, messageId).run();
  return resp(200, { ok: true }, corsHeaders);
}

function resp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
