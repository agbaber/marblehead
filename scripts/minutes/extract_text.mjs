#!/usr/bin/env node
import { readManifest, appendOrUpdate } from './lib/manifest.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const MANIFEST_PATH = resolve('data/minutes_manifest.csv');
const MIN_PDFTOTEXT_CHARS = 200;

function runPdfToText(pdfPath) {
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
  } catch {
    return '';
  }
}

function runOcr(pdfPath) {
  const dir = mkdtempSync(join(tmpdir(), 'ocr-'));
  try {
    execFileSync('pdftoppm', ['-r', '300', '-png', pdfPath, join(dir, 'page')], { stdio: ['ignore', 'pipe', 'pipe'] });
    const pages = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    const chunks = [];
    for (const p of pages) {
      const out = execFileSync('tesseract', [join(dir, p), 'stdout', '-l', 'eng'], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      chunks.push(out);
    }
    return chunks.join('\n\n--- page break ---\n\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function classifyQuality(text) {
  if (!text || text.trim().length < 100) return 'unreadable';
  const tokens = text.split(/\s+/).filter(Boolean);
  const shortRatio = tokens.filter(t => t.length <= 2).length / Math.max(tokens.length, 1);
  if (shortRatio > 0.4) return 'degraded';
  return 'clean';
}

function extractOne(row) {
  const localPdf = resolve(row.local_pdf);
  if (!existsSync(localPdf)) {
    return { ...row, status: 'missing', notes: `${row.notes || ''} PDF disappeared from cache`.trim() };
  }
  const localTxt = row.local_pdf.replace(/\.pdf$/, '.txt');
  const absTxt = resolve(localTxt);

  let text = runPdfToText(localPdf);
  let method = 'pdftotext';
  if (text.trim().length < MIN_PDFTOTEXT_CHARS) {
    console.log(`  OCR fallback: ${row.local_pdf}`);
    text = runOcr(localPdf);
    method = 'ocr';
  }
  const quality = classifyQuality(text);
  writeFileSync(absTxt, text);
  return { ...row, local_txt: localTxt, extraction_method: method, text_quality: quality };
}

async function main() {
  const rows = readManifest(MANIFEST_PATH);
  const todo = rows.filter(r => r.status === 'downloaded' && !r.local_txt);
  console.log(`Extracting text for ${todo.length} of ${rows.length} manifest rows`);

  let i = 0;
  for (const row of todo) {
    i++;
    console.log(`[${i}/${todo.length}] ${row.body} ${row.meeting_date}`);
    const updated = extractOne(row);
    appendOrUpdate(MANIFEST_PATH, updated);
  }

  const after = readManifest(MANIFEST_PATH);
  const counts = { clean: 0, degraded: 0, unreadable: 0 };
  for (const r of after) {
    if (counts[r.text_quality] !== undefined) counts[r.text_quality]++;
  }
  console.log(`Final quality: clean=${counts.clean}, degraded=${counts.degraded}, unreadable=${counts.unreadable}`);
}

main().catch(err => { console.error(err); process.exit(1); });
