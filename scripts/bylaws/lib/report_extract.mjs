// Deterministically extract per-article metadata from one Annual Town Report:
// sponsor, disposition, and (2024+) numeric vote tally. Keyed by article number.
//
// Findings that shape this (see spec Revisions 2026-07-16):
//  - "Sponsored by the X." is stated in the warrant text (2006+).
//  - Numeric "Voted Yes N No M" tallies appear only in 2024–25 reports; earlier
//    reports say "Voted: ..." (passed, no count).
//  - Article numbers reset per meeting (ATM vs STM), so the same number can
//    appear twice in a report; we keep the occurrence carrying the most info.

import { parseVoteLine } from './voteline.mjs';

function scoreOf(meta) {
  return (meta.sponsor ? 2 : 0) + (meta.tally ? 1 : 0);
}

export function extractArticleMeta(text) {
  const out = new Map();
  const blocks = text.split(/\n(?=Article\s+\d+\b)/);
  for (const block of blocks) {
    const head = /^Article\s+(\d+)\s+(.*)/.exec(block);
    if (!head) continue;
    const article = Number(head[1]);
    const title = head[2].trim();

    const sponsorMatch = /Sponsored by (?:the )?([^.\n]+?)\s*\./i.exec(block);
    const sponsor = sponsorMatch ? sponsorMatch[1].trim() : null;

    let tally = null;
    let disposition = null;
    for (const line of block.split('\n')) {
      const v = parseVoteLine(line);
      if (v) { tally = { yes: v.yes, no: v.no, threshold: v.threshold, met: v.met }; break; }
    }
    if (tally) disposition = tally.met && tally.yes > tally.no ? 'passed' : 'defeated';
    else if (/^\s*Voted:/im.test(block)) disposition = 'passed';

    const meta = { article, title, sponsor, tally, disposition };
    const prev = out.get(article);
    if (!prev || scoreOf(meta) > scoreOf(prev)) out.set(article, meta);
  }
  return out;
}
