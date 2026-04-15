import { chromium } from 'playwright';

const SITE = 'https://marbleheaddata.org';
const DESKTOP = { width: 1280, height: 800 };

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: DESKTOP });

  // ── Fresh page (clear storage first) ──
  console.log('\n── Explore flow tests ──');

  const page = await context.newPage();
  await page.goto(SITE, { waitUntil: 'networkidle' });

  // Clear all localStorage to start fresh
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 1. Landing page loads with question cards
  const cards = await page.$$('.explore-question-card');
  if (cards.length >= 10) {
    ok(`Landing shows ${cards.length} question cards`);
  } else {
    fail('Landing question cards', `expected >= 10, got ${cards.length}`);
  }

  // 2. Stats strip shows 0 decided
  const decided = await page.$eval('#statDecided', el => el.textContent);
  if (decided === '0') {
    ok('Stats strip starts at 0 decided');
  } else {
    fail('Stats strip initial decided', `expected "0", got "${decided}"`);
  }

  // 3. Progress bar at 0%
  const barWidth = await page.$eval('#statBar', el => el.style.width);
  if (barWidth === '0%') {
    ok('Progress bar starts at 0%');
  } else {
    fail('Progress bar initial', `expected "0%", got "${barWidth}"`);
  }

  // 4. Progress message shows "Pick your first answer"
  const msg = await page.$eval('#statMsg', el => el.textContent);
  if (msg === 'Pick your first answer') {
    ok('Progress message: "Pick your first answer"');
  } else {
    fail('Progress message initial', `expected "Pick your first answer", got "${msg}"`);
  }

  // 5. Click first question card to open it
  await cards[0].click();
  await page.waitForTimeout(300);
  const hasTopicClass = await page.$eval('.explore-stage', el => el.classList.contains('has-topic'));
  if (hasTopicClass) {
    ok('Clicking question card opens question screen');
  } else {
    fail('Question screen open', 'explore-stage missing has-topic class');
  }

  // 6. Question social proof bar is visible
  const socialBar = await page.$('.question-social');
  if (socialBar) {
    ok('Question social proof bar present');
  } else {
    fail('Question social proof bar', 'not found');
  }

  // 7. Share button on question screen exists
  const shareBtn = await page.$('.question-social-share');
  if (shareBtn) {
    ok('Per-question share button present');
  } else {
    fail('Per-question share button', 'not found');
  }

  // 8. Click an answer card to select it
  const answerCards = await page.$$('.answer-card:not(.selected)');
  if (answerCards.length > 0) {
    await answerCards[0].click();
    await page.waitForTimeout(500);
    const selected = await page.$('.answer-card.selected');
    if (selected) {
      ok('Clicking answer card selects it');
    } else {
      fail('Answer selection', 'no card has .selected class');
    }
  } else {
    fail('Answer cards', 'no unselected answer cards found');
  }

  // 9. Tutorial shows on first pick
  const tutorialVisible = await page.$eval('#exploreTutorial', el =>
    el.classList.contains('visible')
  );
  if (tutorialVisible) {
    ok('First-time tutorial shows on first pick');
  } else {
    fail('First-time tutorial', 'not visible after first pick');
  }

  // 10. Dismiss tutorial
  await page.click('#tutorialDismiss');
  await page.waitForTimeout(200);
  const tutorialHidden = await page.$eval('#exploreTutorial', el =>
    !el.classList.contains('visible')
  );
  if (tutorialHidden) {
    ok('Tutorial dismisses on click');
  } else {
    fail('Tutorial dismiss', 'still visible after click');
  }

  // 11. Browse hint shows after tutorial
  const hintVisible = await page.$eval('#browseHint', el =>
    el.classList.contains('visible')
  );
  if (hintVisible) {
    ok('Browse hint shows after tutorial dismissed');
  } else {
    fail('Browse hint', 'not visible');
  }

  // 12. Navigate back to landing
  await page.click('#navBack');
  await page.waitForTimeout(300);

  // 13. Stats strip now shows 1 decided
  const decided2 = await page.$eval('#statDecided', el => el.textContent);
  if (decided2 === '1') {
    ok('Stats strip shows 1 decided after first pick');
  } else {
    fail('Stats strip after pick', `expected "1", got "${decided2}"`);
  }

  // 14. Progress bar no longer 0%
  const barWidth2 = await page.$eval('#statBar', el => el.style.width);
  if (barWidth2 !== '0%' && parseInt(barWidth2) > 0) {
    ok(`Progress bar filled to ${barWidth2}`);
  } else {
    fail('Progress bar after pick', `still at ${barWidth2}`);
  }

  // 15. First question card shows "has-pick" class
  await page.waitForTimeout(200);
  const firstCard = await page.$('.explore-question-card.has-pick');
  if (firstCard) {
    ok('Landing card shows has-pick after selection');
  } else {
    fail('Landing card has-pick', 'class not present');
  }

  // 16. Selections persist in localStorage
  const stored = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('explore-selections')); }
    catch { return null; }
  });
  if (stored && Object.keys(stored).length === 1) {
    ok('Selection persisted to localStorage');
  } else {
    fail('localStorage persistence', `got ${JSON.stringify(stored)}`);
  }

  // 17. Personal view count incremented
  const views = await page.evaluate(() =>
    parseInt(localStorage.getItem('explore-your-views'), 10) || 0
  );
  if (views >= 1) {
    ok(`Personal view counter: ${views}`);
  } else {
    fail('Personal view counter', `expected >= 1, got ${views}`);
  }

  // 18. Share positions and check share counter
  // First need to have the share strip visible
  const shareStripVisible = await page.$eval('#shareStrip', el =>
    el.classList.contains('visible')
  );
  if (shareStripVisible) {
    // Mock clipboard to avoid permission errors
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        window.__lastClipboard = text;
      };
    });
    await page.click('#shareBtn');
    await page.waitForTimeout(500);
    const shares = await page.evaluate(() =>
      parseInt(localStorage.getItem('explore-your-shares'), 10) || 0
    );
    if (shares >= 1) {
      ok(`Share counter incremented: ${shares}`);
    } else {
      fail('Share counter', `expected >= 1, got ${shares}`);
    }

    // 19. Share URL contains positions param
    const clipUrl = await page.evaluate(() => window.__lastClipboard || '');
    if (clipUrl.includes('positions=')) {
      ok('Share URL includes positions param');
    } else {
      fail('Share URL format', `got "${clipUrl}"`);
    }
  } else {
    fail('Share strip', 'not visible with 1 pick');
  }

  // 20. Shared link loads correctly
  const shareUrl = await page.evaluate(() => window.__lastClipboard || '');
  if (shareUrl) {
    const page2 = await context.newPage();
    await page2.goto(shareUrl, { waitUntil: 'networkidle' });
    const banner = await page2.$eval('#sharedBanner', el =>
      el.classList.contains('visible')
    );
    if (banner) {
      ok('Shared link shows "someone shared" banner');
    } else {
      fail('Shared link banner', 'not visible');
    }

    // 21. "Start fresh" restores own picks (not blank)
    await page2.click('#sharedFresh');
    await page2.waitForTimeout(300);
    const bannerGone = await page2.$eval('#sharedBanner', el =>
      !el.classList.contains('visible')
    );
    if (bannerGone) {
      ok('"Start fresh" hides shared banner');
    } else {
      fail('Start fresh', 'banner still visible');
    }
    await page2.close();
  }

  // 22. Reset clears everything
  // Override confirm to auto-accept
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#statsReset');
  await page.waitForTimeout(300);
  const decidedAfterReset = await page.$eval('#statDecided', el => el.textContent);
  if (decidedAfterReset === '0') {
    ok('Reset clears decided count to 0');
  } else {
    fail('Reset decided', `expected "0", got "${decidedAfterReset}"`);
  }

  const selectionsAfterReset = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('explore-selections')); }
    catch { return null; }
  });
  const isEmpty = !selectionsAfterReset || Object.keys(selectionsAfterReset).length === 0;
  if (isEmpty) {
    ok('Reset clears localStorage selections');
  } else {
    fail('Reset localStorage', `still has: ${JSON.stringify(selectionsAfterReset)}`);
  }

  // 23. Tutorial flag cleared (will show again on next pick)
  const tutorialFlag = await page.evaluate(() =>
    localStorage.getItem('explore-tutorial-seen')
  );
  if (!tutorialFlag) {
    ok('Reset clears tutorial flag');
  } else {
    fail('Reset tutorial flag', `still set: ${tutorialFlag}`);
  }

  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
