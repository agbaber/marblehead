#!/usr/bin/env node
/**
 * Bulk-enrich every Vimeo-auto transcript via the Anthropic Messages Batch API.
 *
 * Subcommands:
 *   submit  — read _transcripts/*.md, skip files already enriched, submit batch
 *   poll    — print current batch status
 *   collect — fetch results, validate, merge, write files
 *
 * State persisted at data/.transcripts_enrich_state.json (gitignored).
 *
 * Requires: ANTHROPIC_API_KEY in env.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { parseResponse } from './lib/parse_response.mjs';
import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';
import { selectCandidates } from './lib/select_candidates.mjs';

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');
const STATE_FILE = 'data/.transcripts_enrich_state.json';
const FAIL_LOG = 'data/.transcripts_enrich_failures.log';
const TRANSCRIPTS_DIR = '_transcripts';

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

function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  return m[1].trim();
}

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

async function submit() {
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const candidates = listCandidates();
  console.error(`Found ${candidates.length} candidate transcripts.`);
  if (candidates.length === 0) {
    console.error('Nothing to do.');
    return;
  }

  const requests = candidates.map(({ slug, path }) => {
    const file = readFileSync(path, 'utf8');
    const body = extractBody(file);
    return {
      custom_id: slug,
      params: {
        model: MODEL,
        max_tokens: 16384,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: body }],
      },
    };
  });

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  const state = {
    batch_id: batch.id,
    submitted_at: new Date().toISOString(),
    count: requests.length,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.error(`Batch submitted: ${batch.id} (${requests.length} requests).`);
  console.error('Poll with: node scripts/transcripts/enrich_batch.mjs poll');
}

async function poll() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(state.batch_id);
  console.error(`Batch ${batch.id}: ${batch.processing_status}`);
  console.error(`  request_counts: ${JSON.stringify(batch.request_counts)}`);
  if (batch.processing_status === 'ended') {
    console.error('Ready to collect: node scripts/transcripts/enrich_batch.mjs collect');
  }
}

async function collect() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(state.batch_id);
  if (batch.processing_status !== 'ended') {
    console.error(`Batch not done yet: ${batch.processing_status}`);
    process.exit(1);
  }
  let written = 0, failed = 0;
  for await (const result of await client.messages.batches.results(state.batch_id)) {
    const slug = result.custom_id;
    const path = resolve(TRANSCRIPTS_DIR, `${slug}.md`);
    if (!existsSync(path)) {
      console.error(`${slug}: source file disappeared, skipping`);
      failed += 1;
      continue;
    }
    if (result.result.type !== 'succeeded') {
      console.error(`${slug}: batch result type=${result.result.type}`);
      appendFileSync(FAIL_LOG, `${slug}\t${result.result.type}\t${JSON.stringify(result.result.error || {})}\n`);
      failed += 1;
      continue;
    }
    const msg = result.result.message;
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = parseResponse(text);
    if (!parsed.valid) {
      console.error(`${slug}: validation failed: ${parsed.errors.join('; ')}`);
      appendFileSync(FAIL_LOG, `${slug}\tvalidation\t${parsed.errors.join('; ')}\n`);
      failed += 1;
      continue;
    }
    const file = readFileSync(path, 'utf8');
    const merged = mergeFrontmatter(file, parsed.summary_card, parsed.topic_segments);
    writeFileSync(path, merged);
    written += 1;
    if (written % 25 === 0) console.error(`  written: ${written}`);
  }
  console.error(`Done. written=${written} failed=${failed}`);
  if (failed > 0) console.error(`Failures logged to ${FAIL_LOG}`);
}

async function pollUntilEnded(client, batchId, maxWaitSecs) {
  const deadline = Date.now() + maxWaitSecs * 1000;
  const intervalMs = 30_000;
  while (Date.now() < deadline) {
    try {
      const batch = await client.messages.batches.retrieve(batchId);
      console.error(`  batch ${batchId}: ${batch.processing_status} ${JSON.stringify(batch.request_counts)}`);
      if (batch.processing_status === 'ended') return true;
    } catch (err) {
      console.error(`  batch ${batchId}: poll error (will retry): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function run() {
  const all = listCandidates({});
  const candidates = maxBatch ? all.slice(0, maxBatch) : all;
  const total = all.length;
  if (candidates.length === 0) {
    console.error('No unenriched transcripts. Nothing to do.');
    return;
  }
  console.error(`Enriching ${candidates.length} transcript(s) via batch` +
    (maxBatch && total > maxBatch ? ` (${total - maxBatch} deferred past --max-batch=${maxBatch}, will run next time)` : ''));
  if (dryRun) {
    for (const c of candidates) console.error(`  would enrich: ${c.slug}`);
    return;
  }

  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const requests = candidates.map(({ slug, text }) => ({
    custom_id: slug,
    params: {
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: extractBody(text) }],
    },
  }));

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(STATE_FILE, JSON.stringify({ batch_id: batch.id, submitted_at: new Date().toISOString(), count: requests.length }, null, 2) + '\n');
  console.error(`Batch submitted: ${batch.id} (${requests.length} requests). Polling up to ${maxWaitSec}s...`);

  const ended = await pollUntilEnded(client, batch.id, maxWaitSec);
  if (!ended) {
    console.error(`Batch did not finish within ${maxWaitSec}s. Leaving it; a later run will resubmit fresh.`);
    process.exit(1);
  }

  let written = 0, failed = 0;
  for await (const result of await client.messages.batches.results(batch.id)) {
    const slug = result.custom_id;
    const path = resolve(TRANSCRIPTS_DIR, `${slug}.md`);
    if (!existsSync(path)) { console.error(`${slug}: source gone, skipping`); failed += 1; continue; }
    if (result.result.type !== 'succeeded') {
      console.error(`${slug}: batch result type=${result.result.type}`);
      appendFileSync(FAIL_LOG, `${slug}\t${result.result.type}\t${JSON.stringify(result.result.error || {})}\n`);
      failed += 1; continue;
    }
    const msg = result.result.message;
    const textOut = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseResponse(textOut);
    if (!parsed.valid) {
      console.error(`${slug}: validation failed: ${parsed.errors.join('; ')}`);
      appendFileSync(FAIL_LOG, `${slug}\tvalidation\t${parsed.errors.join('; ')}\n`);
      failed += 1; continue;
    }
    writeFileSync(path, mergeFrontmatter(readFileSync(path, 'utf8'), parsed.summary_card, parsed.topic_segments));
    written += 1;
  }
  console.error(`Done. written=${written} failed=${failed}`);
}

if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
else if (subcommand === 'run') await run();
