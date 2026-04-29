// Probe: open the site, click the search button, try a few queries, screenshot.
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://localhost:36451';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[browser ${msg.type()}]`, msg.text());
});
page.on('pageerror', err => console.log('[pageerror]', err.message));

await page.goto(SITE, { waitUntil: 'networkidle' });

// Send Ctrl+K to open the search modal (avoids any z-index/overlay click issues)
await page.keyboard.press('Control+k');

// Wait for the Pagefind UI input to appear (it's lazy-loaded on first open)
const input = await page.waitForSelector('.pagefind-ui__search-input', { timeout: 5000 });

// Run a few queries and dump top results to console
const queries = ['OPEB', 'Essex Tech', 'override', 'GLP-1', 'trash', 'Robidoux'];
for (const q of queries) {
  await input.fill('');
  await input.type(q, { delay: 20 });
  // Pagefind debounces ~300ms; wait for results to appear or "no results"
  await page.waitForTimeout(800);
  const results = await page.$$eval('.pagefind-ui__result', rows =>
    rows.slice(0, 5).map(r => {
      const title = r.querySelector('.pagefind-ui__result-title')?.textContent?.trim();
      const excerpt = r.querySelector('.pagefind-ui__result-excerpt')?.textContent?.trim().slice(0, 140);
      return { title, excerpt };
    })
  );
  console.log(`\n=== "${q}" (${results.length} results) ===`);
  for (const r of results) console.log(`  - ${r.title}: ${r.excerpt || '(no excerpt)'}`);
}

// Screenshot the modal in its current state
await input.fill('');
await input.type('OPEB', { delay: 20 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'proof/search-modal.png' });

await browser.close();
