export async function handleConfirm(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return new Response('missing token', { status: 400, headers: corsHeaders });

  const row = await env.DB.prepare('SELECT id, status, confirmation_expires, manage_token FROM subscriber WHERE confirmation_token = ?').bind(token).first();
  if (!row) return new Response('not found', { status: 404, headers: corsHeaders });

  const now = Date.now();
  if (!row.confirmation_expires || row.confirmation_expires < now) {
    return new Response('confirmation expired', { status: 400, headers: corsHeaders });
  }

  await env.DB.prepare("UPDATE subscriber SET status='confirmed', confirmed_at=?, confirmation_token=NULL, confirmation_expires=NULL WHERE id=?")
    .bind(now, row.id).run();

  return Response.redirect(`${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(row.manage_token)}&first=1`, 302);
}
