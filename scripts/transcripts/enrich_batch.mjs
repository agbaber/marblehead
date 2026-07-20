#!/usr/bin/env node
/**
 * Bulk-enrich every Vimeo/YouTube-auto transcript via the Anthropic Messages
 * Batch API.
 *
 * Subcommands:
 *   submit  — read _transcripts/*.md, skip files already enriched, submit batches
 *   poll    — print current batch status
 *   collect — fetch results, validate, merge, write files
 *   run     — submit + poll-to-ended + collect in one process (used by CI)
 *
 * Oversized transcripts (body over MAX_CHARS_PER_REQUEST, i.e. bigger than the
 * model context window) are split into time-ordered chunks, each enriched as
 * its own batch request keyed `<slug>#<i>of<K>`. On collect the chunk outputs
 * are recombined: topic_segments concatenate in order; the per-chunk summary
 * cards are reduced into one whole-meeting card by a second Messages call. This
 * stops one giant transcript from failing the whole batch with `400 terminated`.
 *
 * Requests are also packed into byte-bounded sub-batches so the aggregate POST
 * body per batches.create() call stays modest.
 *
 * State persisted at data/.transcripts_enrich_state.json (gitignored).
 *
 * Requires: ANTHROPIC_API_KEY in env.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseResponse } from './lib/parse_response.mjs';
import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';
import { selectCandidates } from './lib/select_candidates.mjs';
import { buildRequests, parseCustomId } from './lib/request_plan.mjs';
import { packRequests } from './lib/pack_batches.mjs';
import { concatSegments } from './lib/reduce_segments.mjs';

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');
const REDUCE_PROMPT_PATH = resolve('scripts/transcripts/prompts/reduce_card.md');
const STATE_FILE = 'data/.transcripts_enrich_state.json';
const FAIL_LOG = 'data/.transcripts_enrich_failures.log';
const TRANSCRIPTS_DIR = '_transcripts';
const MAX_TOKENS = 16384;
// ~112K tokens of body; safe under the 200K window after MAX_TOKENS output +
// the system prompt. Bodies over this fan out into chunks.
const MAX_CHARS_PER_REQUEST = 450_000;
// Cap the serialized size of a single batches.create() POST.
const MAX_BATCH_BYTES = 4_000_000;

const subcommand = process.argv[2];
const force = process.argv.includes('--force');
const skipBoards = (() => {
  const i = process.argv.indexOf('--skip-boards');
  return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null;
})();
const onlySource = (() => {
  const i = process.argv.indexOf('--source');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
})();
if (!['submit', 'poll', 'collect', 'run'].includes(subcommand)) {
  console.error('Usage: enrich_batch.mjs submit|poll|collect|run [--force] [--skip-boards a,b] [--source S] [--max-batch N] [--max-wait-sec N] [--dry-run]');
  console.error('  (--max-batch, --max-wait-sec, --dry-run apply to `run` only)');
  process.exit(2);
}

const maxBatch = (() => {
  const i = process.argv.indexOf('--max-batch');
  if (i < 0 || !process.argv[i + 1]) return 0;
  const n = Number(process.argv[i + 1]);
  if (!Number.isFinite(n) || n < 0) { console.error(`Invalid --max-batch: ${process.argv[i + 1]}`); process.exit(2); }
  return n;
})();
const maxWaitSec = (() => {
  const i = process.argv.indexOf('--max-wait-sec');
  if (i < 0 || !process.argv[i + 1]) return 2400;
  const n = Number(process.argv[i + 1]);
  if (!Number.isFinite(n) || n <= 0) { console.error(`Invalid --max-wait-sec: ${process.argv[i + 1]}`); process.exit(2); }
  return n;
})();
const dryRun = process.argv.includes('--dry-run');

function listCandidates({ maxBatch = 0 } = {}) {
  const items = readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== '.gitkeep')
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const path = resolve(TRANSCRIPTS_DIR, f);
      return { slug, path, text: readFileSync(path, 'utf8') };
    });
  return selectCandidates(items, { force, skipBoards, source: onlySource, maxBatch });
}

function planRequests(candidates) {
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const requests = buildRequests(candidates, {
    systemPrompt, model: MODEL, maxTokens: MAX_TOKENS, maxChars: MAX_CHARS_PER_REQUEST,
  });
  return packRequests(requests, MAX_BATCH_BYTES);
}

async function submitBatches(client, candidates) {
  const batches = planRequests(candidates);
  const ids = [];
  for (const [i, requests] of batches.entries()) {
    const batch = await client.messages.batches.create({ requests });
    ids.push(batch.id);
    console.error(`  batch ${i + 1}/${batches.length}: ${batch.id} (${requests.length} requests)`);
  }
  writeFileSync(STATE_FILE, JSON.stringify({
    batch_ids: ids, submitted_at: new Date().toISOString(), count: ids.length,
  }, null, 2) + '\n');
  return ids;
}

// Synthesize one whole-meeting summary_card from the per-chunk cards.
async function reduceCard(client, partialCards) {
  const system = readFileSync(REDUCE_PROMPT_PATH, 'utf8');
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: JSON.stringify(partialCards) }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseResponse(text); // reduce prompt emits {summary_card, topic_segments:[]}
}

// Gather results from every batch, grouped by base slug.
async function gatherResults(client, batchIds) {
  const bySlug = new Map();
  for (const batchId of batchIds) {
    for await (const result of await client.messages.batches.results(batchId)) {
      const { slug, index, total } = parseCustomId(result.custom_id);
      if (!bySlug.has(slug)) bySlug.set(slug, { total, parts: [] });
      bySlug.get(slug).parts.push({ index, result });
    }
  }
  return bySlug;
}

function logFail(slug, kind, detail) {
  console.error(`  ${slug}: ${kind}: ${detail}`); // surface in CI logs, not just FAIL_LOG
  appendFileSync(FAIL_LOG, `${slug}\t${kind}\t${detail}\n`);
}

// Parse every chunk result for a slug; returns { cards, segments } or null on
// any missing/errored/invalid part (slug skipped, retried next run).
function parseParts(slug, entry) {
  if (entry.parts.length !== entry.total) {
    logFail(slug, 'incomplete', `${entry.parts.length}/${entry.total} chunks returned`);
    return null;
  }
  const ordered = [...entry.parts].sort((a, b) => a.index - b.index);
  const cards = [];
  const segments = [];
  for (const { result } of ordered) {
    if (result.result.type !== 'succeeded') {
      logFail(slug, result.result.type, JSON.stringify(result.result.error || {}));
      return null;
    }
    const msg = result.result.message;
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseResponse(text);
    if (!parsed.valid) {
      logFail(slug, 'validation', parsed.errors.join('; '));
      return null;
    }
    cards.push(parsed.summary_card);
    segments.push(parsed.topic_segments);
  }
  return { cards, segments };
}

async function collectResults(client, batchIds) {
  const bySlug = await gatherResults(client, batchIds);
  let written = 0, failed = 0;
  for (const [slug, entry] of bySlug) {
    const path = resolve(TRANSCRIPTS_DIR, `${slug}.md`);
    if (!existsSync(path)) {
      console.error(`${slug}: source file disappeared, skipping`);
      failed += 1;
      continue;
    }
    const parsed = parseParts(slug, entry);
    if (!parsed) { failed += 1; continue; }

    let card, segments;
    if (entry.total === 1) {
      card = parsed.cards[0];
      segments = parsed.segments[0];
    } else {
      segments = concatSegments(parsed.segments);
      const reduced = await reduceCard(client, parsed.cards);
      if (!reduced.valid) {
        logFail(slug, 'reduce', reduced.errors.join('; '));
        failed += 1;
        continue;
      }
      card = reduced.summary_card;
      console.error(`${slug}: reduced ${entry.total} chunks into one card`);
    }
    writeFileSync(path, mergeFrontmatter(readFileSync(path, 'utf8'), card, segments));
    written += 1;
    if (written % 25 === 0) console.error(`  written: ${written}`);
  }
  console.error(`Done. written=${written} failed=${failed}`);
  if (failed > 0) console.error(`Failures logged to ${FAIL_LOG}`);
  return { written, failed };
}

async function pollUntilAllEnded(client, batchIds, maxWaitSecs) {
  const deadline = Date.now() + maxWaitSecs * 1000;
  const intervalMs = 30_000;
  while (Date.now() < deadline) {
    const statuses = [];
    for (const id of batchIds) {
      try {
        const batch = await client.messages.batches.retrieve(id);
        statuses.push(batch.processing_status);
        console.error(`  batch ${id}: ${batch.processing_status} ${JSON.stringify(batch.request_counts)}`);
      } catch (err) {
        console.error(`  batch ${id}: poll error (will retry): ${err.message}`);
        statuses.push('errored-poll');
      }
    }
    if (statuses.every((s) => s === 'ended')) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function submit() {
  const candidates = listCandidates();
  console.error(`Found ${candidates.length} candidate transcripts.`);
  if (candidates.length === 0) { console.error('Nothing to do.'); return; }
  const client = new Anthropic();
  const ids = await submitBatches(client, candidates);
  console.error(`Submitted ${ids.length} batch(es). Poll with: node scripts/transcripts/enrich_batch.mjs poll`);
}

async function poll() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  let allEnded = true;
  for (const id of state.batch_ids) {
    const batch = await client.messages.batches.retrieve(id);
    console.error(`Batch ${id}: ${batch.processing_status} ${JSON.stringify(batch.request_counts)}`);
    if (batch.processing_status !== 'ended') allEnded = false;
  }
  if (allEnded) console.error('Ready to collect: node scripts/transcripts/enrich_batch.mjs collect');
}

async function collect() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  await collectResults(client, state.batch_ids);
}

async function run() {
  const all = listCandidates({});
  const candidates = maxBatch ? all.slice(0, maxBatch) : all;
  const total = all.length;
  if (candidates.length === 0) { console.error('No unenriched transcripts. Nothing to do.'); return; }
  console.error(`Enriching ${candidates.length} transcript(s) via batch` +
    (maxBatch && total > maxBatch ? ` (${total - maxBatch} deferred past --max-batch=${maxBatch}, will run next time)` : ''));
  if (dryRun) {
    for (const c of candidates) console.error(`  would enrich: ${c.slug}`);
    return;
  }

  const client = new Anthropic();
  const ids = await submitBatches(client, candidates);
  console.error(`Submitted ${ids.length} batch(es). Polling up to ${maxWaitSec}s...`);

  const ended = await pollUntilAllEnded(client, ids, maxWaitSec);
  if (!ended) {
    console.error(`Batches did not all finish within ${maxWaitSec}s. Leaving them; a later run resubmits fresh.`);
    process.exit(1);
  }
  await collectResults(client, ids);
}

if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
else if (subcommand === 'run') await run();
