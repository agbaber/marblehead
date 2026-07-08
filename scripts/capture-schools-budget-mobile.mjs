#!/usr/bin/env node
// Mobile capture for schools-budget.html at 375x812 (iPhone-ish).
import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto('http://localhost:4000/schools-budget.html', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'proof/schools-budget-mobile.png', fullPage: true });
await browser.close();
console.log('done');
