#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { readManifest } from './lib/manifest.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify } from 'csv-stringify/sync';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass1_extract.md');
const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const RAW_CSV = resolve('data/catalog_raw.csv');
const BATCH_STATE = resolve('data/.pass1_batch_state.json');

const CANDIDATE_COLUMNS = [
  'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
  'attempt_type', 'deliberation', 'what_was_tried', 'outcome',
  'evidence_quote', 'minutes_section', 'confidence'
];

async function submitBatch() {
  const client = new Anthropic();
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
  const rows = readManifest(MANIFEST_PATH).filter(r => r.status === 'downloaded' && r.local_txt);
  console.log(`Preparing batch: ${rows.length} meetings`);

  const requests = rows.map(row => {
    const cleanedPath = resolve(row.local_txt.replace(/\.txt$/, '.cleaned.txt'));
    const meetingText = readFileSync(cleanedPath, 'utf8');
    return {
      custom_id: `${row.body}__${row.meeting_date}`,
      params: {
        model: MODEL,
        max_tokens: 8192,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: `Meeting: ${row.body} ${row.meeting_date}\n\n---\n${meetingText}\n---\n\nEmit the JSON array.`
        }],
      }
    };
  });

  const batch = await client.messages.batches.create({ requests });
  const state = { batch_id: batch.id, submitted_at: new Date().toISOString(), count: requests.length };
  writeFileSync(BATCH_STATE, JSON.stringify(state, null, 2));
  console.log(`Batch submitted: ${batch.id}`);
  console.log(`Poll with: node scripts/minutes/extract_candidates.mjs --poll`);
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
  const allCandidates = [];
  let errors = 0;

  for await (const result of await client.messages.batches.results(state.batch_id)) {
    const id = result.custom_id;
    if (result.result.type !== 'succeeded') {
      console.warn(`ERROR ${id}: ${result.result.type}`);
      errors++;
      continue;
    }
    const text = result.result.message.content.map(b => b.type === 'text' ? b.text : '').join('');
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) { console.warn(`NO_JSON ${id}`); errors++; continue; }
    try {
      const arr = JSON.parse(m[0]);
      // Preserve meeting_date/body from custom_id for reliability
      const [body, meeting_date] = id.split('__');
      for (const c of arr) {
        c.body = body;
        c.meeting_date = meeting_date;
        allCandidates.push(c);
      }
    } catch (e) {
      console.warn(`BAD_JSON ${id}: ${e.message}`);
      errors++;
    }
  }

  const rows = allCandidates.map(c => { const o = {}; for (const k of CANDIDATE_COLUMNS) o[k] = c[k] ?? ''; return o; });
  writeFileSync(RAW_CSV, stringify(rows, { header: true, columns: CANDIDATE_COLUMNS }));
  console.log(`Wrote ${rows.length} candidates to ${RAW_CSV} (errors=${errors})`);
}

async function main() {
  const mode = process.argv[2] || '--submit';
  if (mode === '--submit') await submitBatch();
  else if (mode === '--poll') { const ready = await pollBatch(); if (ready) await collectResults(); }
  else if (mode === '--collect') await collectResults();
  else console.error('Usage: --submit | --poll | --collect');
}

main().catch(err => { console.error(err); process.exit(1); });
