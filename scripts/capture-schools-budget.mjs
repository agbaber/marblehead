#!/usr/bin/env node
// Capture proof screenshots for schools-budget.html.
// Assumes dev server is running on http://localhost:4000/.

import { chromium } from 'playwright';

const URL = 'http://localhost:4000/schools-budget.html';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

await page.screenshot({ path: 'proof/schools-budget-page.png', fullPage: false });
await page.screenshot({ path: 'proof/schools-budget-page-full.png', fullPage: true });

await browser.close();
console.log('Captured proof/schools-budget-page.png and proof/schools-budget-page-full.png');
