#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL = 'claude-opus-4-7';
const PROMPT_PATH = resolve('scripts/minutes/prompts/pass2_score.md');
const INPUT = resolve('data/pilot_candidates_pass1.csv');
const OUTPUT = resolve('data/pilot_candidates_pass2.csv');

const CONTEXT_LINES_BEFORE = 40;
const CONTEXT_LINES_AFTER = 40;

// The Pass 1 LLM inferred an internal meeting date (2019-01-10) from a document
// that was catalogued under 2018-12-13. Map any missing date to an alternate file.
const DATE_FALLBACK = {
  'school_committee/2019-01-10': 'school_committee/2018-12-13',
};

function resolveTxtPath(body, date) {
  const key = `${body}/${date}`;
  const canonical = resolve(`data/minutes/${key}.cleaned.txt`);
  if (existsSync(canonical)) return canonical;
  const fallback = DATE_FALLBACK[key];
  if (fallback) {
    const alt = resolve(`data/minutes/${fallback}.cleaned.txt`);
    if (existsSync(alt)) {
      console.log(`  [date-fallback] ${key} -> ${fallback}`);
      return alt;
    }
  }
  throw new Error(`Cleaned text not found: ${canonical}`);
}

function extractContext(cand) {
  const txtPath = resolveTxtPath(cand.body, cand.meeting_date);
  const full = readFileSync(txtPath, 'utf8');
  const probe = (cand.evidence_quote || '').slice(0, 60);
  const idx = probe ? full.indexOf(probe) : -1;
  if (idx === -1) {
    // If no direct match, try first 30 chars
    const shortProbe = (cand.evidence_quote || '').slice(0, 30);
    const altIdx = shortProbe ? full.indexOf(shortProbe) : -1;
    if (altIdx === -1) return full.slice(0, 8000);
    return computeWindow(full, altIdx);
  }
  return computeWindow(full, idx);
}

function computeWindow(full, charIdx) {
  const lines = full.split('\n');
  let charCount = 0, lineIdx = 0;
  while (charCount < charIdx && lineIdx < lines.length) { charCount += lines[lineIdx].length + 1; lineIdx++; }
  const start = Math.max(0, lineIdx - CONTEXT_LINES_BEFORE);
  const end = Math.min(lines.length, lineIdx + CONTEXT_LINES_AFTER);
  return lines.slice(start, end).join('\n');
}

const COLUMNS = [
  'entry_id', 'meeting_date', 'body', 'topic', 'topic_other_label',
  'attempt_type', 'deliberation', 'importance', 'what_was_tried', 'outcome',
  'evidence_quote', 'minutes_section', 'confidence',
  'quote_verified', 'promote', 'pass2_notes'
];

async function main() {
  const client = new Anthropic();
  const prompt = readFileSync(PROMPT_PATH, 'utf8');
  const candidates = parse(readFileSync(INPUT, 'utf8'), { columns: true });
  console.log(`Scoring ${candidates.length} pilot candidates`);
  const rows = [];
  let i = 0;
  for (const cand of candidates) {
    i++;
    try {
      const ctx = extractContext(cand);
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: JSON.stringify({ candidate: cand, context: ctx }) }],
      });
      const out = resp.content.map(b => b.type === 'text' ? b.text : '').join('');
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) { console.warn(`  [${i}] no JSON for ${cand.entry_id}`); continue; }
      const p2 = JSON.parse(m[0]);
      const merged = {
        ...cand,
        topic: p2.topic_revised || cand.topic,
        attempt_type: p2.attempt_type_revised || cand.attempt_type,
        deliberation: p2.deliberation_revised || cand.deliberation,
        evidence_quote: p2.verified_quote || cand.evidence_quote,
        importance: p2.importance,
        quote_verified: p2.quote_verified,
        promote: p2.promote,
        pass2_notes: p2.pass2_notes,
      };
      rows.push(merged);
      if (i % 10 === 0 || i === candidates.length) console.log(`  ${i}/${candidates.length}`);
    } catch (err) {
      console.warn(`  [${i}] error on ${cand.entry_id}: ${err.message}`);
    }
  }
  const out = rows.map(r => { const o = {}; for (const c of COLUMNS) o[c] = r[c] ?? ''; return o; });
  writeFileSync(OUTPUT, stringify(out, { header: true, columns: COLUMNS }));
  const promoted = rows.filter(r => r.promote === true).length;
  console.log(`\nScored ${rows.length}; ${promoted} promoted (quote OK + importance>=3)`);
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) dist[r.importance] = (dist[r.importance] || 0) + 1;
  console.log(`Importance distribution: ${JSON.stringify(dist)}`);
  const verified = rows.filter(r => r.quote_verified === true).length;
  const repaired = rows.filter(r => r.quote_verified === false && r.evidence_quote).length;
  console.log(`Quote verified: ${verified}; Quote repaired: ${repaired}`);
}

main().catch(err => { console.error(err); process.exit(1); });
