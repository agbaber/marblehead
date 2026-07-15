// Turn structured chapters (from print_parse) into the canonical store:
//  - files:  one markdown file per chapter (the current codified text = HEAD)
//  - index:  { sectionRef -> { chapter, heading, file, notes[] } }
// Amendment notes are parsed here so the blame backbone is available downstream.

import { parseAmendmentNotes } from './ecode_notes.mjs';

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function toStore(raw) {
  const files = {};
  const index = {};
  for (const ch of raw) {
    const filename = `${String(ch.chapter).padStart(3, '0')}-${slug(ch.chapterTitle)}.md`;
    const parts = [`# Chapter ${ch.chapter}: ${ch.chapterTitle}`, ''];
    for (const s of ch.sections) {
      parts.push(`## § ${s.ref} ${s.heading}`, '');
      if (s.body) parts.push(s.body, '');
      index[s.ref] = {
        chapter: ch.chapter,
        heading: s.heading,
        file: filename,
        notes: parseAmendmentNotes(s.noteText || ''),
      };
    }
    files[filename] = parts.join('\n');
  }
  return { files, index };
}
