/**
 * Smoke tests for marbleheaddata.org
 *
 * Validates the product contract: pages load, questions render correctly,
 * interactions work, nav links resolve. Run with:
 *
 *   node tests/smoke-test.mjs
 *
 * Uses Playwright (Chromium only). No test framework -- matches the
 * convention in tests/nav-test.mjs.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://marbleheaddata.org';

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

// ── Structure tests (read-only, no state changes) ──────────────────────

async function testHomepageLoads(page) {
  console.log('\n── Homepage ──');
  const explore = await page.$('.explore-stage');
  explore ? ok('Homepage renders .explore-stage') : fail('Homepage', '.explore-stage missing');
}

async function testQuestionScreens(page) {
  console.log('\n── Question screens ──');
  const screens = await page.$$('.question-screen');
  screens.length >= 10
    ? ok(`${screens.length} question screens`)
    : fail('Question count', `expected >= 10, got ${screens.length}`);

  // Each screen should have exactly 3 answer cards inside .answers
  const cardCounts = await page.$$eval('.question-screen', nodes =>
    nodes.map(s => ({
      topic: s.dataset.topic,
      cards: s.querySelectorAll('.answers > .answer-card').length
    }))
  );
  for (const { topic, cards } of cardCounts) {
    cards === 3
      ? ok(`${topic}: 3 answer cards`)
      : fail(`${topic}: answer cards`, `expected 3, got ${cards}`);
  }
}

async function testUnsureButtons(page) {
  console.log('\n── "Not sure yet" buttons ──');
  const results = await page.evaluate(() => {
    var screens = document.querySelectorAll('.question-screen');
    var problems = [];
    screens.forEach(function (s) {
      var topic = s.dataset.topic;
      var btn = s.querySelector('.unsure-btn');
      if (!btn) {
        problems.push(topic + ': no .unsure-btn found');
        return;
      }
      // Must NOT be inside .answers
      if (btn.closest('.answers')) {
        problems.push(topic + ': .unsure-btn is inside .answers (should be outside)');
      }
    });
    return { total: screens.length, problems: problems };
  });

  results.problems.length === 0
    ? ok(`All ${results.total} questions have .unsure-btn outside .answers`)
    : results.problems.forEach(p => fail('Unsure button', p));
}

async function testNavLinks(page) {
  console.log('\n── Nav links ──');
  const hrefs = await page.$$eval('nav.site-nav a[href]', els =>
    [...new Set(els.map(a => a.href).filter(h => h.startsWith('http')))]
  );
  hrefs.length > 0
    ? ok(`${hrefs.length} nav links found`)
    : fail('Nav links', 'none found');

  // Check each link resolves (filter to same-origin only)
  const origin = new URL(SITE).origin;
  const internal = hrefs.filter(h => h.startsWith(origin));
  for (const url of internal) {
    try {
      const res = await page.request.get(url);
      res.status() === 200
        ? ok(`${new URL(url).pathname} → 200`)
        : fail(`Nav link ${new URL(url).pathname}`, `status ${res.status()}`);
    } catch (e) {
      fail(`Nav link ${url}`, e.message);
    }
  }
}

// ── Interaction tests (modify local state via clicks) ──────────────────

async function testAnswerOpensEvidence(page) {
  console.log('\n── Answer → evidence ──');
  // Close any auto-opened evidence first
  await page.evaluate(() => {
    document.querySelectorAll('.evidence.open').forEach(e => e.classList.remove('open'));
  });

  const card = page.locator('.answer-card[data-question="override"][data-answer="a"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();

  try {
    const panel = page.locator('.evidence[data-evidence="override-a"].open');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const text = await panel.innerText();
    text.length > 50
      ? ok('Evidence panel opens with content')
      : fail('Evidence panel', `content too short (${text.length} chars)`);
  } catch {
    fail('Evidence panel', 'did not open after clicking answer card');
  }
}

async function testPickCommit(page) {
  console.log('\n── Pick commit → distribution bar ──');
  // Click "This resonates" to commit the pick
  const resonates = page.locator('.evidence.open .evidence-action--yes');
  try {
    await resonates.waitFor({ state: 'visible', timeout: 3000 });
    await resonates.click();

    const dist = page.locator('.question-screen[data-topic="override"] .pick-distribution');
    await dist.waitFor({ state: 'attached', timeout: 5000 });
    ok('Pick distribution bar appeared after committing');
  } catch {
    // API might be slow or have no data -- warn, don't hard-fail
    console.log('  WARN: pick distribution did not appear (API may be down)');
  }
}

async function testStatsStrip(page) {
  console.log('\n── Stats strip ──');
  // Navigate to landing to see stats
  await page.goto(SITE, { waitUntil: 'networkidle' });
  try {
    const stats = page.locator('#exploreStats');
    await stats.waitFor({ state: 'visible', timeout: 5000 });
    ok('Stats strip visible');
  } catch {
    // Stats only show after a pick + if API returns data
    console.log('  WARN: stats strip not visible (may need API data)');
  }
}

// ── Run ────────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch();
  try {
    // Read-only structural tests
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await ctx1.newPage();
    await page1.goto(SITE, { waitUntil: 'networkidle' });
    await testHomepageLoads(page1);
    await testQuestionScreens(page1);
    await testUnsureButtons(page1);
    await testNavLinks(page1);
    await ctx1.close();

    // Interactive tests (fresh context so localStorage is clean)
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    await page2.goto(SITE + '/?q=override', { waitUntil: 'networkidle' });
    await testAnswerOpensEvidence(page2);
    await testPickCommit(page2);
    await testStatsStrip(page2);
    await ctx2.close();
  } finally {
    await browser.close();
  }
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
