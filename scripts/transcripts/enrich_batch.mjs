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

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');
const STATE_FILE = 'data/.transcripts_enrich_state.json';
const FAIL_LOG = 'data/.transcripts_enrich_failures.log';
const TRANSCRIPTS_DIR = '_transcripts';

const subcommand = process.argv[2];
if (!['submit', 'poll', 'collect'].includes(subcommand)) {
  console.error('Usage: enrich_batch.mjs submit|poll|collect');
  process.exit(2);
}

function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter');
  return m[1].trim();
}

function listCandidates() {
  return readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(f => ({ slug: f.replace(/\.md$/, ''), path: resolve(TRANSCRIPTS_DIR, f) }))
    .filter(({ path }) => {
      const text = readFileSync(path, 'utf8');
      // Skip files that already have a summary_card (LLM-enriched or hand-crafted POCs).
      return !/^summary_card:/m.test(text);
    });
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
        max_tokens: 8192,
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
  for await (const result of client.messages.batches.results(state.batch_id)) {
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

if (subcommand === 'submit') await submit();
else if (subcommand === 'poll') await poll();
else if (subcommand === 'collect') await collect();
