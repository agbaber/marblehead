#!/usr/bin/env node
import { readManifest } from './lib/manifest.mjs';
import { stripFooters } from './lib/clean.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');

function main() {
  const rows = readManifest(MANIFEST_PATH);
  const todo = rows.filter(r => r.status === 'downloaded' && r.local_txt);
  console.log(`Cleaning text for ${todo.length} rows`);
  let i = 0;
  for (const row of todo) {
    i++;
    const src = resolve(row.local_txt);
    if (!existsSync(src)) continue;
    const dest = src.replace(/\.txt$/, '.cleaned.txt');
    const raw = readFileSync(src, 'utf8');
    const cleaned = stripFooters(raw);
    writeFileSync(dest, cleaned);
    if (i % 25 === 0 || i === todo.length) console.log(`  ${i}/${todo.length}`);
  }
}

main();
