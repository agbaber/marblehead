#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify } from 'csv-stringify/sync';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass1_extract.md');
const OUTPUT = resolve('data/pilot_candidates_pass1.csv');

const SAMPLE = [
  { body: 'select_board',     date: '2019-01-23' },
  { body: 'select_board',     date: '2020-11-10' },
  { body: 'select_board',     date: '2022-01-12' },
  { body: 'select_board',     date: '2024-04-24' },
  { body: 'select_board',     date: '2025-10-22' },
  { body: 'school_committee', date: '2018-12-13' },
  { body: 'school_committee', date: '2023-02-13' },
  { body: 'school_committee', date: '2024-05-16' },
  { body: 'school_committee', date: '2024-10-17' },
  { body: 'school_committee', date: '2025-10-17' },
];

const COLUMNS = [
  'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
  'attempt_type', 'deliberation', 'what_was_tried', 'outcome',
  'evidence_quote', 'minutes_section', 'confidence',
  'quote_findable'
];

function normalize(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

async function extractOne(client, prompt, body, date) {
  const path = resolve(`data/minutes/${body}/${date}.cleaned.txt`);
  const text = readFileSync(path, 'utf8');
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Meeting: ${body} ${date}\n\n---\n${text}\n---\n\nEmit the JSON array.` }]
  });
  const out = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
  const m = out.match(/\[[\s\S]*\]/);
  if (!m) throw new Error(`No JSON for ${body} ${date}: ${out.slice(0, 200)}`);
  const cands = JSON.parse(m[0]);
  const normText = normalize(text);
  for (const c of cands) {
    c.quote_findable = normText.includes(normalize(c.evidence_quote));
  }
  return cands;
}

async function main() {
  const client = new Anthropic();
  const prompt = readFileSync(PROMPT_PATH, 'utf8');
  const all = [];
  for (const s of SAMPLE) {
    console.log(`Extracting ${s.body} ${s.date}...`);
    const cands = await extractOne(client, prompt, s.body, s.date);
    const verified = cands.filter(c => c.quote_findable === true).length;
    console.log(`  got ${cands.length} candidates, ${verified} quote-verified`);
    all.push(...cands);
  }
  const rows = all.map(c => { const o = {}; for (const k of COLUMNS) o[k] = c[k] ?? ''; return o; });
  writeFileSync(OUTPUT, stringify(rows, { header: true, columns: COLUMNS }));
  console.log(`\nWrote ${rows.length} candidates to ${OUTPUT}`);
  const total = rows.length;
  const verified = rows.filter(r => r.quote_findable === true || r.quote_findable === 'true').length;
  console.log(`Quote-verified: ${verified}/${total} (${Math.round(100*verified/total)}%)`);
}

main().catch(err => { console.error(err); process.exit(1); });
