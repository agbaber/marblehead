// Read the acquired eCode Part I snapshot and write the canonical store:
//   data/bylaws-history/bylaws/*.md   (current codified text = HEAD)
//   data/bylaws-history/section-index.json
// Run after acquire_ecode.mjs.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { toStore } from './lib/sections.mjs';

const RAW = 'data/bylaws-history/raw/ecode-part1.json';
const OUTDIR = 'data/bylaws-history/bylaws';
const INDEX = 'data/bylaws-history/section-index.json';

const raw = JSON.parse(readFileSync(RAW, 'utf8'));
const { files, index } = toStore(raw);

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });
for (const [name, body] of Object.entries(files)) {
  writeFileSync(`${OUTDIR}/${name}`, body.endsWith('\n') ? body : body + '\n');
}
writeFileSync(INDEX, JSON.stringify(index, null, 2));

const withNotes = Object.values(index).filter(s => s.notes.length).length;
console.log(`wrote ${Object.keys(files).length} chapter files to ${OUTDIR}`);
console.log(`wrote ${INDEX}: ${Object.keys(index).length} sections, ${withNotes} with amendment notes`);
