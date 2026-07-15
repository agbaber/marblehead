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
  const hero = await page.$('.home-hero');
  hero ? ok('Homepage renders .home-hero') : fail('Homepage', '.home-hero missing');

  const big = await page.$('.home-big');
  if (big) {
    const bigText = (await big.textContent()).trim();
    bigText.length > 0
      ? ok(`Hero number visible: ${bigText}`)
      : fail('Hero number', 'home-big text empty');
  } else {
    fail('Hero number', '.home-big missing');
  }

  const tiles = await page.$$('.home-tile');
  tiles.length === 13
    ? ok(`13 pillar tiles on homepage (incl. override-tracker, schools-budget, legal-fees, departments)`)
    : fail('Homepage tiles', `expected 13 .home-tile, got ${tiles.length}`);

  const deeper = await page.$('.home-deeper');
  deeper ? ok('Homepage has Checkbook CTA') : fail('Homepage CTA', '.home-deeper missing');
}

async function testCheckbookPageLoads(page) {
  console.log('\n── Checkbook page ──');
  const resp = await page.goto(`${SITE}/checkbook/`, { waitUntil: 'domcontentloaded' });
  resp && resp.status() === 200
    ? ok('Checkbook page returns 200')
    : fail('Checkbook', `status ${resp ? resp.status() : 'no response'}`);
  const h1 = await page.$('h1');
  h1 ? ok('Checkbook page has an h1') : fail('Checkbook h1', 'missing');
}

async function testCheckbookFY26PageLoads(page) {
  console.log('\n── Checkbook FY26 archive page ──');
  const resp = await page.goto(`${SITE}/checkbook/fy26/`, { waitUntil: 'domcontentloaded' });
  resp && resp.status() === 200
    ? ok('Checkbook FY26 page returns 200')
    : fail('Checkbook FY26', `status ${resp ? resp.status() : 'no response'}`);
  const h1 = await page.$('h1');
  h1 ? ok('Checkbook FY26 page has an h1') : fail('Checkbook FY26 h1', 'missing');
  // The archive banner is unique to this page and confirms it rendered as the FY26 variant.
  const banner = await page.$('.archive-banner');
  banner
    ? ok('Checkbook FY26 page shows the archive banner')
    : fail('Checkbook FY26 banner', '.archive-banner missing');
  // Confirm it is the FY26 build, not FY27: the subtitle carries the fiscal year label.
  const body = await page.textContent('body');
  body && body.includes('FY26')
    ? ok('Checkbook FY26 page renders FY26 label')
    : fail('Checkbook FY26 label', 'no FY26 text found on page');
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

async function testSchoolAgeVsEnrollment(page) {
  console.log('\n── School-age vs MPS enrollment section ──');
  await page.goto(SITE + '/charts/enrollment_vs_staffing/', { waitUntil: 'domcontentloaded' });

  const heading = await page.$('h2#school-age-vs-enrollment');
  heading
    ? ok('Section <h2 id="school-age-vs-enrollment"> present')
    : fail('School-age section', 'expected <h2 id="school-age-vs-enrollment"> not found');

  // Page started with 4 SVG charts; new section adds 2 (headline 3-line, long-arc 2-line) = 6.
  const charts = (await page.$$('svg.chart')).length;
  charts >= 6
    ? ok(`${charts} SVG charts on enrollment_vs_staffing`)
    : fail('Enrollment chart count', `expected >= 6, got ${charts}`);

  // Decomposition table should be present with at least 8 data rows.
  const tableRows = await page.$$('section table.data tbody tr, table.data tbody tr');
  tableRows.length >= 8
    ? ok(`${tableRows.length} rows in decomposition table`)
    : fail('Decomposition table', `expected >= 8 rows, got ${tableRows.length}`);
}

async function testTownBudgetPageLoads(page) {
  console.log('\n── Town Budget page ──');
  const resp = await page.goto(`${SITE}/town-budget.html`);
  resp && resp.status() === 200
    ? ok('Town Budget page returns 200')
    : fail('Town Budget page', `status ${resp ? resp.status() : 'no response'}`);
  const h1 = await page.$('h1');
  h1 ? ok('Town Budget has an h1') : fail('Town Budget h1', 'missing');
  const stats = await page.$$('.tb-stat-tile');
  stats.length === 4
    ? ok('Town Budget shows 4 anchor stat tiles')
    : fail('Town Budget anchor stats', `expected 4 tiles, got ${stats.length}`);

  // Wait for the table to render (it's filled via fetch, may not be present immediately).
  await page.waitForSelector('.tb-row--function', { timeout: 5000 }).catch(() => null);

  const functionRows = await page.$$('.tb-row--function');
  functionRows.length >= 7
    ? ok(`Town Budget shows ${functionRows.length} function rows`)
    : fail('Town Budget function rows', `expected >=7, got ${functionRows.length}`);

  const totalRows = await page.$$('.tb-row--total');
  totalRows.length === 2
    ? ok('Town Budget shows 2 grand-total rows (GF, +Enterprise)')
    : fail('Town Budget grand totals', `expected 2, got ${totalRows.length}`);

  // Click Public Safety, expect dept rows to appear underneath.
  const psRow = await page.$('.tb-row[data-id="public_safety"]');
  if (psRow) {
    await psRow.click();
    await page.waitForTimeout(80);
    const psDepts = await page.$$('.tb-row--department[data-parent="public_safety"]');
    psDepts.length >= 4
      ? ok(`Public Safety expands to ${psDepts.length} dept rows`)
      : fail('Public Safety expand', `expected >=4 dept rows, got ${psDepts.length}`);
  } else {
    fail('Public Safety expand', 'public_safety row not found');
  }

  // Click Police, expect line items to appear.
  const policeRow = await page.$('.tb-row[data-id="police"]');
  if (policeRow) {
    await policeRow.click();
    await page.waitForTimeout(80);
    const policeLines = await page.$$('.tb-row--line[data-parent="police"]');
    policeLines.length >= 2
      ? ok(`Police expands to ${policeLines.length} line items`)
      : fail('Police expand', `expected >=2 line items, got ${policeLines.length}`);

    // Click the first line item — expect detail panel below it.
    if (policeLines.length > 0) {
      const lineId = await policeLines[0].getAttribute('data-id');
      await policeLines[0].click();
      await page.waitForTimeout(80);
      const panel = await page.$('.tb-detail-panel[data-for="' + lineId + '"]');
      panel
        ? ok('Line item click opens detail panel')
        : fail('Line item detail panel', 'panel did not open');
    }
  }

  // Sparkline appears for at least the function-level rows that have history.
  const sparklines = await page.$$('.tb-sparkline');
  sparklines.length > 0
    ? ok(`Town Budget renders ${sparklines.length} sparklines`)
    : fail('Sparklines', 'expected > 0, got 0');

  // Expand-all toggle reveals all line items.
  const expandAll = await page.$('#tb-expand-all');
  if (expandAll) {
    await expandAll.click();
    await page.waitForTimeout(120);
    const lineRows = await page.$$('.tb-row--line');
    lineRows.length >= 80
      ? ok(`Expand-all reveals ${lineRows.length} line items`)
      : fail('Expand-all', `expected >=80 lines, got ${lineRows.length}`);
  } else {
    fail('Expand-all', '#tb-expand-all button not found');
  }

  // Open filters, narrow to schools only, expect just 1 function row visible.
  const filterToggle = await page.$('#tb-filter-bar > summary');
  if (filterToggle) {
    await filterToggle.click();
    await page.waitForTimeout(60);
    const noneBtn = await page.$('[data-action="filter-functions-none"]');
    if (noneBtn) {
      await noneBtn.click();
      await page.waitForTimeout(60);
      const schoolsChip = await page.$('.tb-chip[data-function="schools"]');
      if (schoolsChip) {
        await schoolsChip.click();
        await page.waitForTimeout(60);
        const visibleFunctions = await page.$$('.tb-row--function');
        visibleFunctions.length === 1
          ? ok('Function chip filter narrows to 1 function row')
          : fail('Function chip filter', `expected 1 function row, got ${visibleFunctions.length}`);
      }
    }
  }

  // Direction filter: turn off "increased", "flat", "cut" — leave only "decreased".
  // Reset filters first by clicking "all" function chips so we have a known state.
  const fnAllBtn = await page.$('[data-action="filter-functions-all"]');
  if (fnAllBtn) await fnAllBtn.click();
  await page.waitForTimeout(60);

  // Search "insurance" — every visible line row should contain "insurance".
  // Requires all functions to be active so the "other_general_government" function is included.
  const search = await page.$('#tb-search');
  if (search) {
    await search.fill('insurance');
    await page.waitForTimeout(120);
    const allMatch = await page.evaluate(() => {
      const lines = [...document.querySelectorAll('.tb-row--line')];
      if (lines.length === 0) return false;
      return lines.every(r => r.textContent.toLowerCase().includes('insurance'));
    });
    allMatch
      ? ok('Search: all visible line rows contain "insurance"')
      : fail('Search', 'non-matching line rows visible');
    await search.fill('');
    await page.waitForTimeout(60);
  }

  const dirChips = ['increased', 'flat', 'cut'];
  for (const dir of dirChips) {
    const c = await page.$('.tb-chip[data-direction="' + dir + '"]');
    if (c) await c.click();
  }
  await page.waitForTimeout(80);
  const allNeg = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tb-row--function')];
    if (rows.length === 0) return false;
    return rows.every(row => row.querySelector('.tb-pct--neg'));
  });
  allNeg
    ? ok('Direction filter: visible function rows are all negative')
    : fail('Direction filter', 'some non-negative rows visible');
  // Reset for downstream tests.
  for (const dir of dirChips) {
    const c = await page.$('.tb-chip[data-direction="' + dir + '"]');
    if (c) await c.click();
  }
  await page.waitForTimeout(60);

  // Sort by % change desc -- top function row should have positive change.
  const sortDropdown = await page.$('#tb-sort');
  if (sortDropdown) {
    await sortDropdown.selectOption('change_pct');
    await page.waitForTimeout(80);
    // Sort within parents -- top-level rows still in ORDER. The smoke test just
    // confirms the dropdown exists and the page didn't blow up.
    const stillRendered = await page.$$('.tb-row--function');
    stillRendered.length > 0
      ? ok('Sort dropdown changes selection without breaking render')
      : fail('Sort dropdown', 'render broken after sort change');
  }

  // Reset button restores defaults.
  const resetBtn = await page.$('#tb-reset');
  if (resetBtn) {
    await resetBtn.click();
    await page.waitForTimeout(80);
    const fnRows = await page.$$('.tb-row--function');
    fnRows.length === 7
      ? ok('Reset restores 7 default GF function rows')
      : fail('Reset', `expected 7 function rows, got ${fnRows.length}`);
  }

  // Click "Cuts only" preset, expect all visible function rows to be negative.
  const cutsPreset = await page.$('[data-preset="cuts-only"]');
  if (cutsPreset) {
    await cutsPreset.click();
    await page.waitForTimeout(80);
    const allCuts = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.tb-row--function')];
      if (rows.length === 0) return false;
      return rows.every(r => r.querySelector('.tb-pct--neg'));
    });
    allCuts ? ok('Preset "Cuts only" hides non-decreasing rows')
            : fail('Preset cuts-only', 'non-cut rows still visible');
    // Reset for downstream tests.
    const resetBtn2 = await page.$('#tb-reset');
    if (resetBtn2) await resetBtn2.click();
    await page.waitForTimeout(60);
  }

  // Deep link: ?fn=schools should pre-filter to schools only on load.
  // Use clean URL (no .html) so npx-serve's clean-URL redirect doesn't strip the query string.
  await page.goto(`${SITE}/town-budget?fn=schools`);
  await page.waitForSelector('.tb-row--function', { timeout: 5000 }).catch(() => null);
  const visibleFns = await page.$$('.tb-row--function');
  visibleFns.length === 1
    ? ok('Deep link ?fn=schools narrows to 1 function')
    : fail('Deep link ?fn=schools', `expected 1 function, got ${visibleFns.length}`);

  // Click a preset, expect URL to update.
  const preset = await page.$('[data-preset="cuts-only"]');
  if (preset) {
    await preset.click();
    await page.waitForTimeout(80);
    const url = page.url();
    url.includes('dirfilter=')
      ? ok('State change updates URL params')
      : fail('URL serialization', `URL did not include dirfilter=, got ${url}`);
  }

  // Reset to known state before empty-state test.
  await page.goto(`${SITE}/town-budget.html`);
  await page.waitForSelector('.tb-row--function', { timeout: 5000 }).catch(() => null);

  // Open the filter bar so direction chips are reachable.
  const filterToggle2 = await page.$('#tb-filter-bar > summary');
  if (filterToggle2) {
    await filterToggle2.click();
    await page.waitForTimeout(60);
  }

  // Empty state: clear all directions to produce zero visible rows, expect .tb-empty.
  // Use page.click() with selector strings so each click re-finds the element after
  // renderAll() re-renders the chips.
  for (const dir of ['increased', 'decreased', 'flat', 'cut']) {
    await page.click(`.tb-chip[data-direction="${dir}"]`).catch(() => {});
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(60);
  const emptyState = await page.$('.tb-empty');
  emptyState
    ? ok('Empty-state appears when filters match nothing')
    : fail('Empty state', 'no .tb-empty element when filters match nothing');
  // Clear filters via the empty-state link.
  if (emptyState) {
    const clearLink = await page.$('#tb-empty-clear');
    if (clearLink) {
      await clearLink.click();
      await page.waitForTimeout(60);
      const afterReset = await page.$$('.tb-row--function');
      afterReset.length >= 7
        ? ok('Empty-state "Clear filters" link restores rows')
        : fail('Empty-state clear link', `expected >=7 function rows after clear, got ${afterReset.length}`);
    }
  } else {
    // Still reset for downstream tests.
    const resetBtn3 = await page.$('#tb-reset');
    if (resetBtn3) await resetBtn3.click();
    await page.waitForTimeout(60);
  }

  // Source citation: detail panel shows a Source: line.
  const fnAllBtn2 = await page.$('[data-action="filter-functions-all"]');
  if (fnAllBtn2) await fnAllBtn2.click();
  await page.waitForTimeout(60);
  const psRow2 = await page.$('.tb-row[data-id="public_safety"]');
  if (psRow2) {
    await psRow2.click();
    await page.waitForTimeout(80);
    const policeRow2 = await page.$('.tb-row[data-id="police"]');
    if (policeRow2) {
      await policeRow2.click();
      await page.waitForTimeout(80);
      const lineRow = await page.$('.tb-row--line[data-parent="police"]');
      if (lineRow) {
        await lineRow.click();
        await page.waitForTimeout(60);
        const srcText = await page.evaluate(() => {
          const el = document.querySelector('.tb-detail-panel .tb-source');
          return el ? el.textContent : '';
        });
        srcText.includes('Budget Book')
          ? ok('Detail panel cites a source')
          : fail('Source citation', `no Budget Book reference in: ${srcText}`);
      }
    }
  }
}

async function testDepartmentsExplorerPageLoads(page) {
  console.log('\n── Department Explorer ──');
  const resp = await page.goto(`${SITE}/departments.html`, { waitUntil: 'domcontentloaded' });
  resp && resp.ok()
    ? ok('Departments page loads')
    : fail('Departments page loads', `status ${resp ? resp.status() : 'no response'}`);

  await page.waitForSelector('.dx-card', { timeout: 5000 }).catch(() => null);
  const cards = await page.$$eval('.dx-card', els => els.length);
  cards === 40
    ? ok('Departments index card count')
    : fail('Departments index card count', `expected 40, got ${cards}`);

  const funcs = await page.$$eval('.dx-func', els => els.length);
  funcs === 10
    ? ok('Departments function groups')
    : fail('Departments function groups', `expected 10, got ${funcs}`);

  // Cards must show human names, not raw slugs (regression guard).
  const cardNames = await page.$$eval('.dx-card-name', els => els.map(e => e.textContent));
  const hasSlug = cardNames.some(n => n.includes('_'));
  const hasSelectBoard = cardNames.includes('Select Board');
  !hasSlug && hasSelectBoard
    ? ok('Departments cards show human names')
    : fail('Departments cards show human names', `slug seen: ${hasSlug}, "Select Board" present: ${hasSelectBoard}`);

  await page.goto(`${SITE}/departments.html#police`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.dx-money', { timeout: 5000 }).catch(() => null);

  const hasRole = await page.$eval('body', el => el.textContent.includes('Chief of Police'));
  hasRole
    ? ok('Police profile shows cited role')
    : fail('Police profile shows cited role', '"Chief of Police" text missing');

  const moneyTable = await page.$('.dx-money');
  moneyTable
    ? ok('Police profile budget table present')
    : fail('Police profile budget table', '.dx-money missing');
}

async function testWhatIsActuallyFlexiblePageLoads(page) {
  console.log('\n── What is Actually Flexible page ──');
  const resp = await page.goto(`${SITE}/what-is-actually-flexible.html`, { waitUntil: 'domcontentloaded' });
  resp && resp.status() === 200
    ? ok('Page returns 200')
    : fail('what-is-actually-flexible', `status ${resp ? resp.status() : 'no response'}`);

  const h1 = await page.$('h1');
  h1 ? ok('Page has an h1') : fail('h1', 'missing');

  // Lead claim renders with all three Liquid-computed dollar values
  const claimStats = await page.$$('.waf-claim-stat');
  claimStats.length === 3
    ? ok('Lead claim renders three computed dollar values')
    : fail('Lead claim stats', `expected 3 .waf-claim-stat spans, got ${claimStats.length}`);

  // Three tier cards
  const tierCards = await page.$$('.waf-tier-card');
  tierCards.length === 3
    ? ok('Three tier cards present')
    : fail('Tier cards', `expected 3 .waf-tier-card, got ${tierCards.length}`);

  // Two FTE archetype columns
  const fteCols = await page.$$('.waf-fte-col');
  fteCols.length === 2
    ? ok('Two FTE archetype columns present')
    : fail('FTE columns', `expected 2 .waf-fte-col, got ${fteCols.length}`);

  // Translator math
  await page.fill('#waf-cut-amount', '1000000');
  // Default selection is the first archetype (teacher: total $115,540)
  const resultText = await page.$eval('#waf-translator-result', el => el.textContent);
  const m = resultText.match(/(\d+)/);
  const positions = m ? parseInt(m[1], 10) : 0;
  (positions >= 5 && positions <= 15)
    ? ok(`Translator reports ≈ ${positions} positions for $1M teacher cut`)
    : fail('Translator math', `expected 5-15 positions for $1M, got "${resultText}"`);
}

async function testGeneralGovernmentPeerChart(page) {
  console.log('\n── General Government peer chart (in where-has-money-gone) ──');
  await page.goto(SITE + '/where-has-the-money-gone.html', { waitUntil: 'domcontentloaded' });

  const cardHeading = await page.$('h3:has-text("General government did not grow faster")');
  cardHeading
    ? ok('Salvaged GG card present')
    : fail('GG card', 'missing "General government did not grow faster" H3');

  const bars = (await page.$$('svg rect.data-bar.s-marblehead, svg rect.data-bar.s-neutral')).length;
  bars === 9
    ? ok(`${bars} peer bars`)
    : fail('GG peer bar count', `expected 9, got ${bars}`);
}

// ── Marblehead 101 ──────────────────────────────────────────

async function testM101Landing(page) {
  console.log('\n── Marblehead 101 landing ──');
  const resp = await page.goto(SITE + '/marblehead-101/');
  resp.status() === 200
    ? ok('Landing returns 200')
    : fail('Landing', 'expected 200, got ' + resp.status());

  const h1 = await page.$eval('.m101-hero h1', el => el.textContent.trim());
  h1 === 'Marblehead 101'
    ? ok('Landing h1 reads "Marblehead 101"')
    : fail('Landing h1', `got "${h1}"`);

  const cards = await page.$$('.m101-ch');
  cards.length === 8
    ? ok('Landing has 8 chapter cards')
    : fail('Landing chapter cards', `expected 8, got ${cards.length}`);

  const parts = await page.$$('.m101-group');
  parts.length === 3
    ? ok('Landing has 3 thematic parts')
    : fail('Landing parts', `expected 3, got ${parts.length}`);
}

async function testM101ChapterPages(page) {
  console.log('\n── Marblehead 101 chapters ──');
  const slugs = [
    ['01', '01-how-the-town-is-run'],
    ['02', '02-town-side-school-side'],
    ['03', '03-where-money-comes-from'],
    ['04', '04-where-money-goes'],
    ['05', '05-how-the-budget-gets-made'],
    ['06', '06-why-the-gap-keeps-coming-back'],
    ['07', '07-overrides'],
    ['08', '08-how-to-take-part'],
  ];
  for (const [num, slug] of slugs) {
    const resp = await page.goto(`${SITE}/marblehead-101/${slug}.html`);
    if (resp.status() !== 200) {
      fail(`Chapter ${num} loads`, `${resp.status()} on ${slug}.html`);
      continue;
    }
    ok(`Chapter ${num} returns 200`);
    const chipNum = await page.$eval('.m101-chip .num', el => el.textContent.trim());
    const expected = String(parseInt(num, 10));
    chipNum === expected
      ? ok(`Chapter ${num} chip shows "${expected}"`)
      : fail(`Chapter ${num} chip`, `expected "${expected}", got "${chipNum}"`);
    const cur = await page.$$eval('.m101-syllabus li.cur', els => els.map(e => e.dataset.chapter));
    cur.length === 1 && cur[0] === num
      ? ok(`Chapter ${num} sidebar marks correct current item`)
      : fail(`Chapter ${num} sidebar`, `cur items: ${JSON.stringify(cur)}`);
  }
}

async function testM101NavLink(page) {
  console.log('\n── Marblehead 101 nav link ──');
  await page.goto(SITE + '/');
  const link = await page.$('a.nav-link[href*="/marblehead-101/"]');
  link
    ? ok('Primer nav link present on homepage')
    : fail('Primer nav link', 'not found on homepage');
}

// ── Self-serve verification pages ──────────────────────────

async function testVerifyMePageLoads(page) {
  console.log('\n── /verify-me.html ──');
  const resp = await page.goto(`${SITE}/verify-me.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) {
    fail('verify-me.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('verify-me.html returns 200');

  const h1 = await page.$('h1');
  const h1Text = h1 ? (await h1.textContent()).trim() : '';
  h1Text.length > 0
    ? ok(`verify-me h1 renders: "${h1Text.slice(0, 60)}"`)
    : fail('verify-me h1', 'h1 empty');

  // CTA must point at the Worker host (absolute), not the site (relative
  // would 404 because the site and Worker are at different origins).
  const fbCta = await page.$('a[href*="/api/auth/fb/start"]');
  fbCta
    ? ok('verify-me FB CTA present')
    : fail('verify-me FB CTA', 'missing a[href*="/api/auth/fb/start"]');

  const inviteFallback = await page.$('a[href="/verify.html"]');
  inviteFallback
    ? ok('verify-me invite fallback link present')
    : fail('verify-me invite fallback', 'missing /verify.html link');
}

async function testProfilePageLoads(page) {
  console.log('\n── /profile.html ──');
  const resp = await page.goto(`${SITE}/profile.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) {
    fail('profile.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('profile.html returns 200');

  // Controller renders a "sign in" prompt when no JWT in localStorage.
  // Wait briefly for it to run.
  await page.waitForSelector('#profile-root a[href="/verify-me.html"]', { timeout: 5000 })
    .then(() => ok('profile signed-out state renders sign-in link'))
    .catch(() => fail('profile signed-out state', 'no /verify-me.html link rendered after 5s'));
}

async function testVouchRequestPageLoads(page) {
  console.log('\n── /vouch-request.html ──');
  const resp = await page.goto(`${SITE}/vouch-request.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) {
    fail('vouch-request.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('vouch-request.html returns 200');

  const h1 = await page.$('h1');
  const h1Text = h1 ? (await h1.textContent()).trim() : '';
  h1Text.length > 0
    ? ok(`vouch-request h1 renders: "${h1Text.slice(0, 60)}"`)
    : fail('vouch-request h1', 'h1 empty');

  const form = await page.$('#vr-form');
  form ? ok('#vr-form present') : fail('#vr-form', 'missing');

  const nameInput = await page.$('#vr-name');
  const streetInput = await page.$('#vr-street');
  const numberInput = await page.$('#vr-number');
  (nameInput && streetInput && numberInput)
    ? ok('vouch-request form has name, street, and number inputs')
    : fail('vouch-request inputs', 'one or more of #vr-name, #vr-street, #vr-number missing');
}

async function testVouchPageLoads(page) {
  console.log('\n── /vouch.html ──');
  const resp = await page.goto(`${SITE}/vouch.html?token=fake-smoke-token&n=Test&a=12+Smoke+Street`, {
    waitUntil: 'domcontentloaded',
  });
  if (resp.status() !== 200) {
    fail('vouch.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('vouch.html returns 200');

  const root = await page.$('#vc-root');
  root ? ok('#vc-root present') : fail('#vc-root', 'missing');

  // The page will render either a "sign in to vouch" prompt (no jwt) or an
  // "unknown token" error. Either is fine for smoke; we just want it to
  // not throw. Wait briefly for the controller to settle.
  await page.waitForTimeout(500);
  const html = await page.content();
  html.includes('vm-card')
    ? ok('vouch.html renders some card state (sign-in prompt or error)')
    : fail('vouch.html card state', 'no .vm-card rendered after 500ms');
}

async function testTermsPageLoads(page) {
  console.log('\n── /terms.html ──');
  const resp = await page.goto(`${SITE}/terms.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) {
    fail('terms.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('terms.html returns 200');

  const h1 = await page.$('h1');
  const h1Text = h1 ? (await h1.textContent()).trim() : '';
  h1Text === 'Terms of Use'
    ? ok('terms h1 is "Terms of Use"')
    : fail('terms h1', `expected "Terms of Use", got "${h1Text}"`);
}

// ── /browse/ ───────────────────────────────────────────────────────────

async function testBrowseIndex(page) {
  console.log('\n── /browse/ ──');
  const res = await page.goto(`${SITE}/browse/`, { waitUntil: 'domcontentloaded' });
  res && res.status() === 200 ? ok('/browse/ → 200') : fail('/browse/', `status ${res ? res.status() : 'no response'}`);
  const cards = await page.$$('.browse-card');
  cards.length === 4 ? ok('4 entity cards') : fail('Browse cards', `expected 4, got ${cards.length}`);
}

async function testBrowseEntity(page, slug, minRows) {
  console.log(`\n── /browse/${slug}/ ──`);
  const res = await page.goto(`${SITE}/browse/${slug}/`, { waitUntil: 'networkidle' });
  res && res.status() === 200 ? ok(`/browse/${slug}/ → 200`) : fail(`/browse/${slug}/`, `status ${res ? res.status() : 'no response'}`);

  // Shell.
  const breadcrumb = await page.$('.browse-breadcrumb');
  breadcrumb ? ok('Breadcrumb present') : fail('Breadcrumb', 'missing');
  const search = await page.$('.browse-search');
  search ? ok('Search input present') : fail('Search input', 'missing');
  const navItems = await page.$$('.browse-nav-item');
  navItems.length === 5 ? ok('Left nav has 5 entities') : fail('Left nav', `got ${navItems.length}`);

  // Wait for sql.js to load and render rows.
  try {
    await page.waitForSelector('.browse-table tbody tr', { timeout: 15000 });
  } catch (_) {
    fail(`${slug} table`, 'no rows rendered within 15s');
    return;
  }
  const rows = await page.$$('.browse-table tbody tr');
  rows.length >= minRows
    ? ok(`${rows.length} rows rendered (>= ${minRows})`)
    : fail(`${slug} rows`, `expected at least ${minRows}, got ${rows.length}`);
}

async function testVendorDetail(page) {
  console.log('\n── /browse/vendors/#<slug> (detail) ──');
  await page.goto(`${SITE}/browse/vendors/#hilltop-securities-inc`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.detail-header h2', { timeout: 15000 });
  } catch (_) {
    fail('vendor detail', 'no header rendered within 15s');
    return;
  }
  const header = (await page.textContent('.detail-header h2')).trim();
  header.length > 0
    ? ok(`Vendor detail header rendered: "${header}"`)
    : fail('vendor detail header', 'empty');
  const rows = await page.$$('.detail-payments tbody tr');
  rows.length > 0
    ? ok(`${rows.length} payment rows in vendor detail`)
    : fail('vendor detail payments', 'none');
}

async function testDeptDetail(page) {
  console.log('\n── /browse/dept/#<slug> (detail) ──');
  await page.goto(`${SITE}/browse/dept/#electric-enterprise`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.detail-header h2', { timeout: 15000 });
  } catch (_) {
    fail('dept detail', 'no header rendered within 15s');
    return;
  }
  const header = (await page.textContent('.detail-header h2')).trim();
  /ELECTRIC ENTERPRISE/i.test(header)
    ? ok(`Dept detail header reads "${header}"`)
    : fail('dept detail header', `expected ELECTRIC ENTERPRISE, got "${header}"`);
  const vendorRows = await page.$$('.detail-top-vendors tbody tr');
  vendorRows.length > 0
    ? ok(`${vendorRows.length} top-vendor rows`)
    : fail('dept detail top vendors', 'none');
}

async function testTopicMeetingCounts(page) {
  console.log('\n── /browse/topics/ meeting_count > 0 ──');
  await page.goto(`${SITE}/browse/topics/`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.browse-table tbody tr', { timeout: 10000 });
  } catch (_) {
    fail('topics counts', 'no rows rendered');
    return;
  }
  const counts = await page.$$eval('.browse-table tbody tr td:nth-child(3)', els =>
    els.map(e => parseInt((e.textContent || '0').trim(), 10) || 0)
  );
  const nonZero = counts.filter(c => c > 0).length;
  nonZero > 0
    ? ok(`${nonZero}/${counts.length} topics have non-zero meeting_count`)
    : fail('topics counts', 'all zero');
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
    await testNavLinks(page1);
    await testCheckbookPageLoads(page1);
    await testCheckbookFY26PageLoads(page1);
    await testGeneralGovernmentPeerChart(page1);
    await testSchoolAgeVsEnrollment(page1);
    await testTownBudgetPageLoads(page1);
    await testDepartmentsExplorerPageLoads(page1);
    await testWhatIsActuallyFlexiblePageLoads(page1);
    await testM101Landing(page1);
    await testM101ChapterPages(page1);
    await testM101NavLink(page1);
    await testVerifyMePageLoads(page1);
    await testProfilePageLoads(page1);
    await testVouchRequestPageLoads(page1);
    await testVouchPageLoads(page1);
    await testTermsPageLoads(page1);
    await testBrowseIndex(page1);
    await testBrowseEntity(page1, 'topics', 10);
    await testBrowseEntity(page1, 'meetings', 30);
    await testBrowseEntity(page1, 'budget', 30);
    await testBrowseEntity(page1, 'vendors', 50);
    await testVendorDetail(page1);
    await testDeptDetail(page1);
    await testTopicMeetingCounts(page1);
    await ctx1.close();
  } finally {
    await browser.close();
  }
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
