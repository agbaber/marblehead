import { chromium, devices } from 'playwright';
const b = await chromium.launch();

// Mid-page shot: scroll past hero to see budget-vs-actual + vendors
const ctx1 = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const p1 = await ctx1.newPage();
await p1.goto('https://marbleheaddata.org/checkbook/', { waitUntil: 'networkidle', timeout: 60000 });
await p1.waitForTimeout(2000);
await p1.evaluate(() => window.scrollTo(0, 900));
await p1.waitForTimeout(700);
await p1.screenshot({ path: 'proof/checkbook-rethink/live-vendors.png' });

// Even further down: the raw payments table
await p1.evaluate(() => window.scrollTo(0, 2400));
await p1.waitForTimeout(700);
await p1.screenshot({ path: 'proof/checkbook-rethink/live-table.png' });
await ctx1.close();

// Mobile
const ctx2 = await b.newContext({ ...devices['iPhone 14'] });
const p2 = await ctx2.newPage();
await p2.goto('https://marbleheaddata.org/checkbook/', { waitUntil: 'networkidle', timeout: 60000 });
await p2.waitForTimeout(2000);
await p2.screenshot({ path: 'proof/checkbook-rethink/live-mobile-top.png' });
await p2.screenshot({ path: 'proof/checkbook-rethink/live-mobile-full.png', fullPage: true });
await b.close();
console.log('done');
