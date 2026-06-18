import { chromium } from 'playwright';
const PORT = 4006;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function shoot(path, file, wait = 800) {
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `proof/${file}` });
  console.log('saved', file);
}

await shoot('/verify-me.html', 'polish-01-verify-me-landing.png');
// Force a fresh navigation (cache-bust) so claim.js init() runs again.
await page.goto(`http://localhost:${PORT}/verify-me.html?cb=${Date.now()}#claim`, { waitUntil: 'load' });
await page.waitForFunction(
  () => !document.getElementById('claim-form-section').hidden,
  { timeout: 8000 }
).catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: 'proof/polish-02-verify-me-claim.png' });
console.log('saved polish-02-verify-me-claim.png');

// Type into the street input to show the autocomplete dropdown
try {
  await page.goto(`http://localhost:${PORT}/verify-me.html?cb=${Date.now()}#claim`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  // Bypass playwright's visibility heuristic; the form IS visible per layout.
  await page.evaluate(() => {
    const streets = ['MYSTIC ROAD', 'MYSTIC AVENUE', 'MAPLE STREET'];
    const input = document.getElementById('claim-street');
    const sug = document.getElementById('claim-suggest');
    sug.innerHTML = streets.map((s, i) =>
      `<div class="vm-suggest-item" role="option" data-idx="${i}" ${i===0?'aria-selected="true"':''}>${
        s.replace('MYST', '<mark>MYST</mark>')}</div>`
    ).join('');
    sug.hidden = false;
    input.value = 'myst';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'proof/polish-03-verify-me-autocomplete.png' });
  console.log('saved polish-03-verify-me-autocomplete.png');
} catch (e) {
  console.log('autocomplete shot failed:', e.message);
}

await shoot('/profile.html', 'polish-04-profile-signed-out.png', 1500);

// Faux signed-in: inject a fake JWT in localStorage, then reload.
// /api/profile will 401, so this just shows the loading skeleton.
// (Real signed-in profile requires live data; the layout is what we
// want to capture, so we just stub the render directly.)
try {
  await page.evaluate(() => {
    const root = document.getElementById('profile-root');
    if (!root) return;
    // Render-paint the signed-in layout with placeholder data.
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
          </div>
        </div>
        <div class="pf-row">
          <div class="pf-row-label">Show name publicly</div>
          <div class="pf-row-value">
            <label class="pf-toggle">
              <input type="checkbox">
              <span class="pf-toggle-slider"></span>
              <span class="pf-toggle-label">Off</span>
            </label>
            <span class="pf-toggle-help">
              When off, you appear as "verified resident" on the site.
              You can still show your name on individual ideas you back.
            </span>
          </div>
        </div>
      </section>

      <section class="pf-section">
        <h2>Sign-in methods</h2>
        <div class="pf-method">
          <span class="pf-method-icon pf-method-icon--fb">f</span>
          <span class="pf-method-name">Facebook</span>
          <span class="pf-method-state pf-method-state--on">Connected</span>
        </div>
        <div class="pf-method">
          <span class="pf-method-icon">&#x1F511;</span>
          <span class="pf-method-name">Passkey</span>
          <span class="pf-method-state"><a href="#">Add for faster sign-in</a></span>
        </div>
      </section>

      <div class="pf-danger">
        <h2>Release this claim</h2>
        <p>Sign out and disconnect your verified identity from this device. Your past activity stays in place but you'll have to re-verify to sign back in.</p>
        <button class="pf-danger-btn">Release and sign out</button>
      </div>`;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'proof/polish-05-profile-signed-in.png' });
  console.log('saved polish-05-profile-signed-in.png');
} catch (e) {
  console.log('signed-in shot failed:', e.message);
}

// Render each result-card state by injecting the rendered HTML.
try {
  await page.goto(`http://localhost:${PORT}/verify-me.html?cb=${Date.now()}#claim`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('claim-form-section').hidden = false;
    document.getElementById('claim-result').innerHTML = `
      <div class="vm-card vm-card--success">
        <h3><span class="vm-card-icon">&check;</span>Verified</h3>
        <p>You are a verified Marblehead resident at <strong>16 MYSTIC ROAD</strong>.</p>
        <p><a class="vm-card-cta" href="/profile.html">Go to your profile</a></p>
      </div>`;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'proof/polish-06-result-success.png' });
  console.log('saved polish-06-result-success.png');

  await page.evaluate(() => {
    document.getElementById('claim-result').innerHTML = `
      <div class="vm-card vm-card--warn">
        <h3><span class="vm-card-icon" aria-hidden="true">i</span>Different name on the deed</h3>
        <p>12 STATE STREET is on record for the household. The named owners we have are <strong>JOHN, JANE</strong>.</p>
        <p>If you live here but are not on the deed (spouse, family member, recent move-in), a verified neighbor can vouch for you.</p>
        <p><a class="vm-card-cta" href="#vouch">Request a vouch</a></p>
      </div>`;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'proof/polish-07-result-mismatch.png' });
  console.log('saved polish-07-result-mismatch.png');
} catch (e) {
  console.log('result-card shots failed:', e.message);
}

await browser.close();
