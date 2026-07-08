#!/usr/bin/env node
// Capture Panel 1 in a specific view. Usage:
//   node scripts/capture-schools-budget-view.mjs <view> <outfile>
// view is one of nominal|per-pupil|real.
import { chromium } from 'playwright';
const view = process.argv[2] || 'real';
const out = process.argv[3] || `proof/schools-budget-${view}.png`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4000/schools-budget.html', { waitUntil: 'networkidle' });
if (view !== 'nominal') {
  await page.click(`#panel1 .chart-toggle button[data-view="${view}"]`);
  await page.waitForTimeout(300);
}
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
