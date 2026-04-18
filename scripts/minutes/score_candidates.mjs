#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass2_score.md');
const RAW_CSV = resolve('data/catalog_raw.csv');
const CATALOG_CSV = resolve('data/catalog.csv');
const LOG_PATH = resolve('data/catalog_pass2_log.md');
const BATCH_STATE = resolve('data/.pass2_batch_state.json');

const CONTEXT_LINES_BEFORE = 60;
const CONTEXT_LINES_AFTER = 60;

function extractContext(cand) {
  const txtPath = resolve(`data/minutes/${cand.body}/${cand.meeting_date}.cleaned.txt`);
  if (!existsSync(txtPath)) {
    console.warn(`  Missing text file for ${cand.body} ${cand.meeting_date}`);
    return '';
  }
  const full = readFileSync(txtPath, 'utf8');
  const probe = (cand.evidence_quote || '').slice(0, 60);
  let idx = probe ? full.indexOf(probe) : -1;
  if (idx === -1) {
    const shortProbe = (cand.evidence_quote || '').slice(0, 30);
    idx = shortProbe ? full.indexOf(shortProbe) : -1;
  }
  if (idx === -1) return full.slice(0, 12000);
  const lines = full.split('\n');
  let charCount = 0, lineIdx = 0;
  while (charCount < idx && lineIdx < lines.length) { charCount += lines[lineIdx].length + 1; lineIdx++; }
  const start = Math.max(0, lineIdx - CONTEXT_LINES_BEFORE);
  const end = Math.min(lines.length, lineIdx + CONTEXT_LINES_AFTER);
  return lines.slice(start, end).join('\n');
}

async function submitBatch() {
  const client = new Anthropic();
  const prompt = readFileSync(PROMPT_PATH, 'utf8');
  const candidates = parse(readFileSync(RAW_CSV, 'utf8'), { columns: true });
  console.log(`Preparing Pass 2 batch: ${candidates.length} candidates`);

  // Ensure each candidate has a unique custom_id. Use the entry_id from Pass 1 if
  // present, but it may collide (same meeting/seq from different model runs).
  // Safer: index-based custom IDs that we can map back on collect.
  const requests = candidates.map((cand, i) => {
    const ctx = extractContext(cand);
    return {
      custom_id: `row_${i.toString().padStart(5, '0')}`,
      params: {
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: JSON.stringify({ candidate: cand, context: ctx }) }],
      }
    };
  });

  const batch = await client.messages.batches.create({ requests });
  const state = {
    batch_id: batch.id,
    submitted_at: new Date().toISOString(),
    count: requests.length,
  };
  writeFileSync(BATCH_STATE, JSON.stringify(state, null, 2));
  console.log(`Batch submitted: ${batch.id}`);
}

async function pollBatch() {
  const client = new Anthropic();
  const state = JSON.parse(readFileSync(BATCH_STATE, 'utf8'));
  const batch = await client.messages.batches.retrieve(state.batch_id);
  console.log(`Batch ${batch.id}: ${batch.processing_status}`);
  console.log(`  request_counts: ${JSON.stringify(batch.request_counts)}`);
  return batch.processing_status === 'ended';
}

async function collectResults() {
  const client = new Anthropic();
  const state = JSON.parse(readFileSync(BATCH_STATE, 'utf8'));
  const candidates = parse(readFileSync(RAW_CSV, 'utf8'), { columns: true });

  const promoted = [];
  const logLines = ['# Pass 2 audit log', ''];
  let errors = 0;

  for await (const result of await client.messages.batches.results(state.batch_id)) {
    const id = result.custom_id; // row_NNNNN
    const idx = parseInt(id.replace('row_', ''), 10);
    const base = candidates[idx];
    if (!base) { errors++; continue; }

    if (result.result.type !== 'succeeded') {
      logLines.push(`- ${id} ERROR ${result.result.type}`);
      errors++;
      continue;
    }
    const text = result.result.message.content.map(b => b.type === 'text' ? b.text : '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { logLines.push(`- ${id} NO_JSON`); errors++; continue; }

    let p2;
    try { p2 = JSON.parse(m[0]); } catch (e) { logLines.push(`- ${id} BAD_JSON ${e.message}`); errors++; continue; }

    const merged = {
      ...base,
      topic: p2.topic_revised || base.topic,
      attempt_type: p2.attempt_type_revised || base.attempt_type,
      deliberation: p2.deliberation_revised || base.deliberation,
      evidence_quote: p2.verified_quote || base.evidence_quote,
      importance: p2.importance,
      quote_verified: p2.quote_verified,
      promote: p2.promote,
      pass2_notes: p2.pass2_notes,
    };
    logLines.push(`- ${base.entry_id} importance=${p2.importance} verified=${p2.quote_verified} promote=${p2.promote} | ${p2.pass2_notes || ''}`);
    if (p2.promote === true) promoted.push(merged);
  }

  const columns = [
    'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
    'attempt_type', 'deliberation', 'importance', 'what_was_tried',
    'outcome', 'evidence_quote', 'minutes_section', 'confidence',
    'pass2_notes', 'quote_verified'
  ];
  const out = promoted.map(r => { const o = {}; for (const c of columns) o[c] = r[c] ?? ''; return o; });
  writeFileSync(CATALOG_CSV, stringify(out, { header: true, columns }));
  writeFileSync(LOG_PATH, logLines.join('\n'));
  console.log(`Promoted ${promoted.length} of ${candidates.length}; errors=${errors}`);
}

async function main() {
  const mode = process.argv[2] || '--submit';
  if (mode === '--submit') await submitBatch();
  else if (mode === '--poll') { const ready = await pollBatch(); if (ready) await collectResults(); }
  else if (mode === '--collect') await collectResults();
  else console.error('Usage: --submit | --poll | --collect');
}

main().catch(err => { console.error(err); process.exit(1); });
