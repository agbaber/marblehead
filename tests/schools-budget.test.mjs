import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';

const BASE = process.env.SITE_BASE_URL || 'http://localhost:4000';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/schools-budget.html`);

// Panel 1 SVG has at least one <path> after JS runs.
await page.waitForSelector('#panel1-svg path.chart-line', { timeout: 5000 });
const paths = await page.$$eval('#panel1-svg path.chart-line', els => els.length);
assert.equal(paths, 1, `expected 1 chart-line path in Panel 1, got ${paths}`);

// Three toggle buttons present with the right labels.
const toggles = await page.$$eval('#panel1 .chart-toggle button', els => els.map(e => e.textContent.trim()));
assert.deepEqual(toggles, ['Nominal dollars', 'Per pupil', 'Real dollars (fiscal year 2024 basis)']);

// Clicking "Per pupil" changes the aria-selected state.
await page.click('#panel1 .chart-toggle button[data-view="per-pupil"]');
const selected = await page.$eval('#panel1 .chart-toggle button[aria-selected="true"]', el => el.dataset.view);
assert.equal(selected, 'per-pupil');

console.log('schools-budget.test.mjs OK');
await browser.close();
