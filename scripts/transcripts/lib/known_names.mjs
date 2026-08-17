// Loads and compiles data/known_names.json once per process.
//
// Kept separate from normalize_names.mjs so that module stays pure and easy to
// test with fixture dictionaries, while ingest scripts get a one-line import.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileDictionary, normalizeNames } from './normalize_names.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DICT_PATH = join(REPO_ROOT, 'data', 'known_names.json');

let cached = null;

export function loadKnownNames() {
  if (!cached) {
    const raw = JSON.parse(readFileSync(DICT_PATH, 'utf8'));
    cached = { raw, compiled: compileDictionary(raw) };
  }
  return cached;
}

/**
 * Correct known mishearings in transcript prose, logging what changed so a CI
 * run leaves a record of every rewrite it made.
 */
export function correctKnownNames(text, { label = '', log = console.error } = {}) {
  const { compiled } = loadKnownNames();
  const { text: next, hits } = normalizeNames(text, compiled);
  if (hits.length > 0 && log) {
    const summary = hits.map(h => `${h.wrong}->${h.right} x${h.count}`).join(', ');
    log(`  - known-name corrections${label ? ` in ${label}` : ''}: ${summary}`);
  }
  return next;
}

/**
 * The correct spellings, for seeding an ASR decoder prompt or an LLM prompt.
 * Sorted for stable output so a regenerated prompt does not churn.
 */
export function knownNameList() {
  const { raw } = loadKnownNames();
  return [...new Set(raw.replace.map(e => e.right))].sort();
}
