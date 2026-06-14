export async function handleUnsubscribe(request, env, corsHeaders) {
  let token = '';
  if (request.method === 'GET') {
    const url = new URL(request.url);
    token = url.searchParams.get('token') || '';
  } else {
    try {
      const body = await request.json();
      token = typeof body.token === 'string' ? body.token : '';
    } catch { /* fallthrough */ }
  }
  if (!token) return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const row = await env.DB.prepare('SELECT id, status FROM subscriber WHERE manage_token = ?').bind(token).first();
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  await env.DB.prepare("UPDATE subscriber SET status='unsubscribed', unsubscribed_at=? WHERE id=?")
    .bind(Date.now(), row.id).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
