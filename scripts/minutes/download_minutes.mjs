#!/usr/bin/env node
import { readManifest, appendOrUpdate } from './lib/manifest.mjs';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import pLimit from 'p-limit';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const CONCURRENCY = 4;
const TIMEOUT_MS = 60_000;

async function downloadOne(row) {
  const localPdf = `data/minutes/${row.body}/${row.meeting_date}.pdf`;
  const absPath = resolve(localPdf);
  if (existsSync(absPath)) {
    return { ...row, local_pdf: localPdf, status: 'downloaded' };
  }
  mkdirSync(dirname(absPath), { recursive: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(row.source_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'marblehead-data-research/1.0' }
    });
    if (!res.ok) {
      return { ...row, status: 'missing', notes: `HTTP ${res.status} (${row.source_url})` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(absPath, buf);
    return { ...row, local_pdf: localPdf, status: 'downloaded', notes: '' };
  } catch (err) {
    return { ...row, status: 'missing', notes: `Fetch error: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const rows = readManifest(MANIFEST_PATH);
  const pending = rows.filter(r => r.status === 'pending' || (r.status === 'downloaded' && !existsSync(resolve(r.local_pdf))));
  console.log(`Downloading ${pending.length} of ${rows.length} manifest rows`);

  const limit = pLimit(CONCURRENCY);
  let done = 0;
  await Promise.all(pending.map(row => limit(async () => {
    const updated = await downloadOne(row);
    appendOrUpdate(MANIFEST_PATH, updated);
    done++;
    if (done % 10 === 0 || done === pending.length) {
      console.log(`  ${done}/${pending.length}`);
    }
  })));

  const after = readManifest(MANIFEST_PATH);
  const downloaded = after.filter(r => r.status === 'downloaded').length;
  const missing = after.filter(r => r.status === 'missing').length;
  console.log(`Final: ${downloaded} downloaded, ${missing} missing`);
}

main().catch(err => { console.error(err); process.exit(1); });
