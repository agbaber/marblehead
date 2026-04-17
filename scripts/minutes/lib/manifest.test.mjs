import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, appendOrUpdate, MANIFEST_COLUMNS } from './manifest.mjs';

function tempPath() {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-test-'));
  return { path: join(dir, 'manifest.csv'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('readManifest returns empty array when file is missing', () => {
  const { path, cleanup } = tempPath();
  try {
    assert.deepEqual(readManifest(path), []);
  } finally {
    cleanup();
  }
});

test('writeManifest then readManifest round-trips a row', () => {
  const { path, cleanup } = tempPath();
  try {
    const row = {
      body: 'fincom',
      meeting_date: '2024-02-13',
      source_url: 'https://example.com/file.pdf',
      local_pdf: '',
      local_txt: '',
      extraction_method: 'none',
      text_quality: '',
      status: 'pending',
      notes: ''
    };
    writeManifest(path, [row]);
    assert.deepEqual(readManifest(path), [row]);
  } finally {
    cleanup();
  }
});

test('appendOrUpdate inserts a new row when no match', () => {
  const { path, cleanup } = tempPath();
  try {
    const row = { body: 'fincom', meeting_date: '2024-02-13', source_url: 'u', local_pdf: '', local_txt: '', extraction_method: 'none', text_quality: '', status: 'pending', notes: '' };
    appendOrUpdate(path, row);
    assert.equal(readManifest(path).length, 1);
  } finally {
    cleanup();
  }
});

test('appendOrUpdate updates existing row matched by (body, meeting_date)', () => {
  const { path, cleanup } = tempPath();
  try {
    const initial = { body: 'fincom', meeting_date: '2024-02-13', source_url: 'u', local_pdf: '', local_txt: '', extraction_method: 'none', text_quality: '', status: 'pending', notes: '' };
    appendOrUpdate(path, initial);
    appendOrUpdate(path, { ...initial, status: 'downloaded', local_pdf: 'data/minutes/fincom/2024-02-13.pdf' });
    const rows = readManifest(path);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'downloaded');
    assert.equal(rows[0].local_pdf, 'data/minutes/fincom/2024-02-13.pdf');
  } finally {
    cleanup();
  }
});

test('MANIFEST_COLUMNS matches spec', () => {
  assert.deepEqual(MANIFEST_COLUMNS, [
    'body', 'meeting_date', 'source_url', 'local_pdf', 'local_txt',
    'extraction_method', 'text_quality', 'status', 'notes'
  ]);
});
