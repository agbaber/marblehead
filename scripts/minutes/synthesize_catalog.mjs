#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL = 'claude-opus-4-7';

async function synthesize(promptPath, outPath, catalogPath) {
  const client = new Anthropic();
  const prompt = readFileSync(promptPath, 'utf8');
  const catalog = parse(readFileSync(catalogPath, 'utf8'), { columns: true });
  console.log(`Synthesizing ${catalog.length} catalog rows with ${promptPath}`);
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(catalog) }],
  });
  const md = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
  writeFileSync(outPath, md);
  console.log(`  Wrote ${md.length} chars to ${outPath}`);
}

async function main() {
  const catalog = resolve('data/catalog_normalized.csv');
  await synthesize(resolve('scripts/minutes/prompts/pass3_synthesize_trying.md'), resolve('is-the-board-trying.md'), catalog);
  await synthesize(resolve('scripts/minutes/prompts/pass3_synthesize_tried.md'), resolve('what-have-we-tried.md'), catalog);
}

main().catch(err => { console.error(err); process.exit(1); });
