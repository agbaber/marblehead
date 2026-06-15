import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4002/privacy.html#facebook-sign-in', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'proof/spec-self-serve-verification-privacy-fb.png', fullPage: false });
await browser.close();
console.log('done');
