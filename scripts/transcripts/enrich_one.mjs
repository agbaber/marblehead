#!/usr/bin/env node
/**
 * Enrich a single _transcripts/<slug>.md file with LLM-generated
 * summary_card and topic_segments.
 *
 * Usage:
 *   node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md
 *   node scripts/transcripts/enrich_one.mjs _transcripts/select-board-2026-05-27.md --dry-run
 *
 * Requires: ANTHROPIC_API_KEY in env.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseResponse } from './lib/parse_response.mjs';
import { mergeFrontmatter } from './lib/merge_frontmatter.mjs';

const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = resolve('scripts/transcripts/prompts/summary.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filePath = args.find(a => !a.startsWith('--'));
if (!filePath) {
  console.error('Usage: enrich_one.mjs <_transcripts/<slug>.md> [--dry-run]');
  process.exit(2);
}

function extractBody(file) {
  const m = file.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no frontmatter found');
  return m[1].trim();
}

async function main() {
  const file = readFileSync(filePath, 'utf8');
  if (/^summary_card:/m.test(file)) {
    console.error(`${filePath} already has summary_card; skipping. Pass --force to override.`);
    if (!args.includes('--force')) return;
  }
  const body = extractBody(file);
  console.error(`Body length: ${body.length} chars, ~${Math.round(body.length / 4)} tokens`);

  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: body }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  console.error(`Response: ${text.length} chars, usage: ${JSON.stringify(res.usage)}`);

  const parsed = parseResponse(text);
  if (!parsed.valid) {
    console.error('VALIDATION FAILED:');
    for (const err of parsed.errors) console.error(`  - ${err}`);
    console.error('\nRaw response:\n' + text);
    process.exit(1);
  }

  const merged = mergeFrontmatter(file, parsed.summary_card, parsed.topic_segments);
  if (dryRun) {
    console.error('--dry-run set; would write:');
    console.log(merged.slice(0, 2000));
    return;
  }
  writeFileSync(filePath, merged);
  console.error(`Wrote ${filePath} (${merged.length} bytes).`);
}

main().catch(err => { console.error(err); process.exit(1); });
