// Cloudflare Worker for marbleheaddata.org meeting-digest subscriptions.
// See docs/superpowers/specs/2026-06-09-meeting-digest-subscriptions-design.md

import { runScheduled } from './scheduled.js';

function cors(env, origin) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN === '*' ? (origin || '*') : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, origin) });
    }

    // Routes will be wired up in Tasks 8-12.
    return new Response(JSON.stringify({ ok: true, path: url.pathname }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors(env, origin) }
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env));
  }
};
