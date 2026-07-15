import { chunkBody } from './chunk_transcript.mjs';

// Extract the transcript body (everything after the YAML frontmatter).
export function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  return m[1].trim();
}

function makeRequest(customId, content, { systemPrompt, model, maxTokens }) {
  return {
    custom_id: customId,
    params: {
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    },
  };
}

// Turn selected candidates ({ slug, text }) into batch requests. A body within
// maxChars is one request keyed by the bare slug (unchanged wire shape). An
// oversized body fans out into chunk requests keyed `<slug>#<i>of<K>` (1-indexed).
export function buildRequests(candidates, opts) {
  const requests = [];
  for (const { slug, text } of candidates) {
    const body = extractBody(text);
    if (body.length <= opts.maxChars) {
      requests.push(makeRequest(slug, body, opts));
      continue;
    }
    const chunks = chunkBody(body, opts.maxChars);
    for (const c of chunks) {
      requests.push(makeRequest(`${slug}#${c.index + 1}of${c.total}`, c.text, opts));
    }
  }
  return requests;
}

// Inverse of the custom_id scheme. `<slug>#<i>of<K>` → chunked; anything else is
// treated as a single un-chunked request keyed by the whole string.
export function parseCustomId(id) {
  const m = id.match(/^(.*)#(\d+)of(\d+)$/);
  if (!m) return { slug: id, index: 0, total: 1, chunked: false };
  return { slug: m[1], index: Number(m[2]) - 1, total: Number(m[3]), chunked: true };
}
