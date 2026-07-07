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

// Back to nominal view for anomaly-marker checks.
await page.click('#panel1 .chart-toggle button[data-view="nominal"]');
await page.waitForSelector('#panel1-svg circle.chart-anomaly', { timeout: 3000 });
const nominalAnomalies = await page.$$eval('#panel1-svg circle.chart-anomaly', els => els.length);
assert.equal(nominalAnomalies, 2, `expected 2 anomaly circles in nominal view, got ${nominalAnomalies}`);

// Per-pupil view has no anomaly circles.
await page.click('#panel1 .chart-toggle button[data-view="per-pupil"]');
await page.waitForTimeout(200);
const perPupilAnomalies = await page.$$eval('#panel1-svg circle.chart-anomaly', els => els.length);
assert.equal(perPupilAnomalies, 0, `expected 0 anomaly circles in per-pupil view, got ${perPupilAnomalies}`);

// Panel 2 renders 12 rects (2 FYs * 6 buckets)
await page.waitForSelector('#panel2-svg rect', { timeout: 5000 });
const rects = await page.$$eval('#panel2-svg rect', els => els.length);
assert.equal(rects, 12, `expected 12 stacked segments in Panel 2, got ${rects}`);

// Legend has 6 items
const legendItems = await page.$$eval('#panel2 .stack-legend-item', els => els.length);
assert.equal(legendItems, 6, `expected 6 legend items, got ${legendItems}`);

console.log('schools-budget.test.mjs OK');
await browser.close();
