// Cloudflare Worker for marbleheaddata.org meeting-digest subscriptions.
// See docs/superpowers/specs/2026-06-09-meeting-digest-subscriptions-design.md

import { runScheduled } from './scheduled.js';
import { handleSubscribe } from './handlers/subscribe.js';

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
    const corsHeaders = cors(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env));
  }
};
