import { chromium } from 'playwright';
const PORT = 4011;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Signed-out
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'proof/nav-signedout.png', clip: { x: 0, y: 0, width: 2880, height: 200 } });

// Signed-in (stub localStorage; reload to trigger swap)
await page.evaluate(() => localStorage.setItem('verify_jwt', 'stub.jwt.value'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'proof/nav-signedin.png', clip: { x: 0, y: 0, width: 2880, height: 200 } });

// Footer
await page.goto(`http://localhost:${PORT}/about.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/footer-signedin.png' });

console.log('done');
await browser.close();
