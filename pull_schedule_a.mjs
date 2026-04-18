import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN';

const TOWNS = new Set([
  'Arlington', 'Brookline', 'Cohasset', 'Duxbury', 'Easton', 'Framingham', 'Hingham',
  'Lexington', 'Marblehead', 'Melrose', 'Natick', 'Needham', 'Newton',
  'Stoneham', 'Swampscott', 'Wellesley', 'Winchester'
]);

const REV_HEADER = 'dor_code,municipality,fiscal_year,taxes,service_charges,licenses_permits,federal_revenue,state_revenue,other_govt_revenue,special_assessments,fines,miscellaneous,other_financing,transfers,total_revenues';
const EXP_HEADER = 'dor_code,municipality,fiscal_year,general_government,public_safety,education,public_works,human_services,culture_recreation,fixed_costs,intergov_assessments,other,debt_service,total_expenditures';

const ARGS = process.argv.slice(2);
const SINGLE_YEAR = ARGS.find(a => a.startsWith('--year='))?.split('=')[1] || null;
const VIEWS = ARGS.includes('--rev-only') ? ['Revenues']
  : ARGS.includes('--exp-only') ? ['Expenditures']
  : ['Revenues', 'Expenditures'];
const FORCE = ARGS.includes('--force');

function filenameFor(view) {
  return view === 'Revenues'
    ? 'data/peer_schedule_a_revenues.csv'
    : 'data/peer_schedule_a_expenditures.csv';
}
function headerFor(view) {
  return view === 'Revenues' ? REV_HEADER : EXP_HEADER;
}

function yearsAlreadyIn(filename) {
  if (!existsSync(filename)) return new Set();
  const text = readFileSync(filename, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = new Set();
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 3) out.add(fields[2]);
  }
  return out;
}

function appendRowsToCSV(filename, view, rows) {
  mkdirSync('data', { recursive: true });
  const exists = existsSync(filename);
  if (!exists) writeFileSync(filename, headerFor(view) + '\n');
  const filtered = rows.filter(r => TOWNS.has(r[1]));
  if (filtered.length === 0) return 0;
  const body = filtered.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
  appendFileSync(filename, body);
  return filtered.length;
}

function csvEscape(s) {
  s = String(s ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i+1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === ',' && !q) {
      fields.push(cur); cur = '';
    } else cur += ch;
  }
  fields.push(cur);
  return fields;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();

  console.log('Discovering available years...');
  const years = await loadAndGetYears(page);
  console.log('Available years:', years.map(y => y.year).join(', '));

  const targetYears = SINGLE_YEAR
    ? years.filter(y => y.year === SINGLE_YEAR)
    : years;
  if (targetYears.length === 0) {
    throw new Error('No matching years; got ' + JSON.stringify(years));
  }

  for (const view of VIEWS) {
    const filename = filenameFor(view);
    const done = FORCE ? new Set() : yearsAlreadyIn(filename);
    console.log('\n========== ' + view.toUpperCase() + ' ==========');
    if (done.size > 0) console.log('  Skipping years already in ' + filename + ': ' + [...done].sort().join(','));

    for (const yearInfo of targetYears) {
      const yr = yearInfo.year;
      if (done.has(yr)) continue;

      const t0 = Date.now();
      console.log('\n--- ' + view + ' FY' + yr + ' ---');
      let rows;
      try {
        rows = await scrapeYear(page, yearInfo, view);
      } catch (err) {
        console.error('  ERROR on FY' + yr + ': ' + err.message + ' -- retrying once');
        try { rows = await scrapeYear(page, yearInfo, view); }
        catch (err2) { console.error('  FAILED FY' + yr + ' twice: ' + err2.message); continue; }
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log('  Total rows for FY' + yr + ': ' + rows.length + ' (' + elapsed + 's)');
      if (rows.length < 250) {
        console.error('  WARN: expected ~351 rows, got ' + rows.length + '. Skipping write for FY' + yr);
        continue;
      }
      const saved = appendRowsToCSV(filename, view, rows);
      console.log('  Appended ' + saved + ' peer rows to ' + filename);
    }
  }

  buildSummary();

  await browser.close();
}

async function loadAndGetYears(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const frame = await waitForFrame(page);
  return await frame.evaluate(() => {
    const result = [];
    const cbs = document.querySelectorAll('input[name="islYear"]');
    for (const cb of cbs) {
      if (cb.id.includes('All')) continue;
      const label = document.querySelector('label[for="' + cb.id + '"]');
      if (label) result.push({ id: cb.id, year: label.textContent.trim() });
    }
    return result;
  });
}

function getFrame(page) {
  return page.frames().find(fr => fr.url().includes('ScheduleA.GeneralFund'));
}

async function waitForFrame(page) {
  for (let i = 0; i < 60; i++) {
    const f = getFrame(page);
    if (f) {
      const cnt = await f.evaluate(() => document.querySelectorAll('input[name="islYear"]').length).catch(() => 0);
      if (cnt > 0) return f;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Could not find Schedule A iframe with islYear inputs');
}

async function waitForFrameReady(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const f = getFrame(page);
    if (f) {
      const ok = await f.evaluate(() => !!document.getElementById('xtGenFund')).catch(() => false);
      if (ok) return f;
    }
    await page.waitForTimeout(400);
  }
  throw new Error('Frame never became ready');
}

async function scrapeYear(page, yearInfo, view) {
  // Reload the full page to bypass ASP.NET __VIEWSTATE pagination stickiness.
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  let frame = await waitForFrame(page);

  // Uncheck all default-selected years; check just the target year.
  await frame.evaluate((yearId) => {
    const allCb = document.querySelector('input[id="islYear_rdListAll"]');
    if (allCb && allCb.checked) allCb.click();
    const cbs = document.querySelectorAll('input[name="islYear"]');
    for (const cb of cbs) {
      if (cb.checked && !cb.id.includes('All')) cb.click();
    }
    const target = document.getElementById(yearId);
    if (target && !target.checked) target.click();
  }, yearInfo.id);

  // Pick the view (Revenues or Expenditures).
  await frame.evaluate((viewName) => {
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      for (const opt of sel.options) {
        if (opt.text.includes(viewName)) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change'));
          return;
        }
      }
    }
  }, view);

  // Submit the real <input type="button" id="btnSubmit">.
  await frame.evaluate(() => {
    const submit = document.getElementById('btnSubmit');
    if (submit) { submit.click(); return; }
    for (const btn of document.querySelectorAll('input, button')) {
      const t = (btn.value || btn.textContent || '').trim().toLowerCase();
      if (t === 'submit') { btn.click(); return; }
    }
  });

  // The submit click triggers a form POST that navigates the iframe.
  // Wait for the new document to load with our target year showing.
  frame = await waitForFrameReady(page);
  await waitForTable(frame, yearInfo.year);
  // Let the iframe's script runtime settle so rdAjaxRequest-based pager
  // links work on the first click. Shorter waits caused page 2 to hang.
  await page.waitForTimeout(6000);

  return await scrapeAllPages(page);
}

async function waitForTable(frame, expectedYear, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await frame.evaluate((yr) => {
      const t = document.getElementById('xtGenFund');
      if (!t) return { ready: false };
      const trs = t.querySelectorAll('tr');
      if (trs.length < 2) return { ready: false };
      const head = trs[0].querySelectorAll('th, td');
      let yearCol = 2;
      for (let i = 0; i < head.length; i++) {
        if (head[i].textContent.trim().toLowerCase().includes('fiscal')) { yearCol = i; break; }
      }
      const cells = trs[1].querySelectorAll('td');
      if (cells.length <= yearCol) return { ready: false };
      return { ready: cells[yearCol].textContent.trim() === yr };
    }, expectedYear).catch(() => ({ ready: false }));
    if (status.ready) return;
    await frame.waitForTimeout(500);
  }
  throw new Error('table did not show year ' + expectedYear + ' within ' + timeoutMs + 'ms');
}

async function scrapeAllPages(page) {
  const allRows = [];
  const seenSig = new Set();

  for (let pg = 1; pg <= 30; pg++) {
    const frame = await waitForFrameReady(page);

    const rows = await frame.evaluate(() => {
      const table = document.getElementById('xtGenFund');
      if (!table) return [];
      const trs = table.querySelectorAll('tr');
      const result = [];
      for (let i = 1; i < trs.length; i++) {
        const cells = trs[i].querySelectorAll('td');
        if (cells.length >= 3) {
          result.push(Array.from(cells).map(c => c.textContent.trim()));
        }
      }
      return result;
    }).catch(() => []);

    if (rows.length === 0) break;

    const sig = rows[0].join('|') + '::' + rows[rows.length - 1].join('|');
    if (seenSig.has(sig)) break;
    seenSig.add(sig);

    for (const row of rows) allRows.push(row);

    const hasNext = await advanceToNextPage(page, pg);
    if (!hasNext) break;
  }

  return allRows;
}

async function advanceToNextPage(page, currentPageNum) {
  const frame = await waitForFrameReady(page);
  const beforeFirst = await frame.evaluate(() => {
    const tr = document.querySelectorAll('#xtGenFund tr')[1];
    return tr ? tr.textContent.trim().slice(0, 120) : '';
  }).catch(() => '');
  if (!beforeFirst) return false;

  const respPromise = page.waitForResponse(
    r => r.url().includes('rdPage.aspx') && r.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);

  const triggered = await frame.evaluate(() => {
    const cap = document.getElementById('xtGenFund-NextPageCaption');
    const a = cap ? cap.closest('a') : null;
    if (!a) return false;
    const code = (a.getAttribute('href') || '').replace(/^javascript:/, '');
    if (!code) return false;
    try { window.eval(code); return true; }
    catch (e) { return false; }
  }).catch(() => true);
  if (!triggered) return false;

  await respPromise;

  const start = Date.now();
  while (Date.now() - start < 12000) {
    await page.waitForTimeout(300);
    const f = getFrame(page);
    if (!f) continue;
    const cur = await f.evaluate(() => {
      const tr = document.querySelectorAll('#xtGenFund tr')[1];
      return tr ? tr.textContent.trim().slice(0, 120) : '';
    }).catch(() => null);
    if (cur && cur !== beforeFirst) return true;
  }
  throw new Error('advance timeout after page ' + currentPageNum);
}

function buildSummary() {
  const revFile = 'data/peer_schedule_a_revenues.csv';
  const expFile = 'data/peer_schedule_a_expenditures.csv';
  if (!existsSync(revFile) && !existsSync(expFile)) return;

  const revMap = {};
  const expMap = {};
  function load(file, target) {
    if (!existsSync(file)) return;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 3) continue;
      target[row[1] + '|' + row[2]] = row[row.length - 1];
    }
  }
  load(revFile, revMap);
  load(expFile, expMap);

  const keys = Array.from(new Set([...Object.keys(revMap), ...Object.keys(expMap)])).sort();
  const out = ['municipality,fiscal_year,total_revenues,total_expenditures'];
  for (const key of keys) {
    const [town, fy] = key.split('|');
    out.push([town, fy, revMap[key] || '', expMap[key] || ''].map(csvEscape).join(','));
  }
  writeFileSync('data/peer_gf_rev_exp_summary.csv', out.join('\n') + '\n');
  console.log('Wrote summary: data/peer_gf_rev_exp_summary.csv (' + (out.length - 1) + ' rows)');
}

main().catch(err => { console.error(err); process.exit(1); });
