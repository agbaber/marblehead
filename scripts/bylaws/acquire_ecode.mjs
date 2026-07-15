// Acquire the current codified General Bylaws (Part I) from eCode360.
//
// eCode's interactive pages are a Cloudflare-protected SPA that lazy-loads
// section bodies. Its *print* view, however, renders an entire container as one
// static document with section bodies and bracketed amendment notes inline:
//   https://ecode360.com/print/MA1991?guid=<containerId>
// guid 11769479 is "Part I General Bylaws" and returns all 44 chapters at once.
//
// Output: data/bylaws-history/raw/ecode-part1.txt (raw snapshot; the parser in
// parse_bylaws.mjs consumes this). Run: node scripts/bylaws/acquire_ecode.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const PART_I_PRINT = 'https://ecode360.com/print/MA1991?guid=11769479';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT = 'data/bylaws-history/raw/ecode-part1.txt';

async function fetchPartI() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  try {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await page.goto(PART_I_PRINT, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(6000);
      const text = await page.evaluate(() => document.body.innerText);
      const challenged = /just a moment|verify you are human|cf-chl/i.test(text.slice(0, 3000));
      if (!challenged && text.length > 100000) return text;
      console.error(`attempt ${attempt}: challenged=${challenged} len=${text.length}; retrying`);
      await page.waitForTimeout(6000);
    }
    throw new Error('Could not clear Cloudflare / load full Part I after 4 attempts');
  } finally {
    await browser.close();
  }
}

const text = await fetchPartI();
mkdirSync('data/bylaws-history/raw', { recursive: true });
writeFileSync(OUT, text);
const chapters = (text.match(/^Chapter\s+[\dA-Z]+\.\s+/gm) || []).length;
const sections = (text.match(/§\s*[\dA-Z]+-\d+/g) || []).length;
const notes = (text.match(/\[(Adopted|Added|Amended|Repealed)[^\]]{0,120}\]/gi) || []).length;
console.log(`wrote ${OUT}: ${text.length} chars, ${chapters} chapters, ${sections} section markers, ${notes} notes`);
