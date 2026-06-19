import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4016/profile.html', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const root = document.getElementById('profile-root');
  root.innerHTML = `
    <p class="pf-eye"><span class="pf-eye-check" aria-hidden="true">&check;</span>Verified resident</p>
    <h1 class="pf-name">Andrew Baber</h1>
    <p class="pf-source">Matched to FY2025 assessor record</p>
    <section class="pf-section">
      <h2>Identity</h2>
      <div class="pf-row">
        <div class="pf-row-label"><label>Display name</label></div>
        <div class="pf-row-value">
          <input class="pf-input" value="Andrew Baber">
          <button class="pf-btn">Save</button>
          <span class="pf-saved show">Saved</span>
        </div>
      </div>
    </section>`;
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/profile-save-gap.png' });
console.log('saved');
await browser.close();
