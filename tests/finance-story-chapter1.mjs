/**
 * Smoke test for finance-story Chapter 1.
 * Run against a built site (local or preview URL).
 *   SITE=http://localhost:4322 node tests/finance-story-chapter1.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://localhost:4322';
const URL = `${SITE}/finance-story/01-four-buckets`;
let passed = 0, failed = 0;
function ok(n) { passed++; console.log(`  PASS: ${n}`); }
function fail(n, d) { failed++; console.log(`  FAIL: ${n} - ${d}`); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const resp = await page.goto(URL + '.html', { waitUntil: 'networkidle' });

resp && resp.status() === 200 ? ok('page returns 200') : fail('page status', `${resp ? resp.status() : 'no response'}`);

const h1 = await page.textContent('h1');
h1 && h1.includes('four') ? ok(`h1 has "four": "${h1}"`) : fail('h1', `got "${h1}"`);

const sections = await page.$$('.fs-section');
sections.length >= 5 ? ok(`${sections.length} .fs-section panels`) : fail('section count', `got ${sections.length}, want >= 5`);

const headings = await page.$$eval('.fs-section h2', els => els.map(e => e.textContent.trim()));
const expected = ['General Fund', 'Enterprise', 'Capital', 'Special', 'mix'];
const allFound = expected.every(t => headings.some(h => h.toLowerCase().includes(t.toLowerCase())));
allFound ? ok('all 5 section headings present') : fail('headings', `got ${JSON.stringify(headings)}, missing one of: ${JSON.stringify(expected)}`);

const buckets = await page.$('#fs-buckets');
buckets ? ok('#fs-buckets diagram present') : fail('#fs-buckets', 'missing');

const cites = await page.$$('sup.cite');
cites.length >= 4 ? ok(`${cites.length} citation markers (>= 4)`) : fail('citations', `got ${cites.length}, want >= 4`);

const cta = await page.$('.fs-progress-cta');
cta ? ok('sticky progress CTA present') : fail('CTA', 'missing');

// Mobile viewport: no horizontal scroll
await ctx.close();
const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobPage = await mobCtx.newPage();
await mobPage.goto(URL + '.html', { waitUntil: 'networkidle' });
const overflow = await mobPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
overflow ? fail('mobile horizontal scroll', `scrollWidth > innerWidth`) : ok('no horizontal scroll on mobile');

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
