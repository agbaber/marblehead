import { chromium } from 'playwright';
const SCR = '/tmp/claude-1000/-home-claude-marblehead/2d367aaf-fede-4193-b685-bb08f423e03a/scratchpad';
const b = await chromium.launch();
const ctx = await b.newContext({ acceptDownloads: true, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const p = await ctx.newPage();

// 1. Download the 2025 list PDF
try {
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 45000 }),
    p.goto('https://www.mass.gov/doc/peracs-january-1-2025-list-of-retirement-boards-by-funded-ratio/download', { timeout: 45000 }).catch(()=>{}),
  ]);
  await dl.saveAs(SCR + '/perac_funded_ratio_list_2025.pdf');
  console.log('DOWNLOADED 2025 list PDF');
} catch (e) { console.log('2025 PDF download FAILED:', e.message); }

// 2. Grab the HTML funded-ratios sortable table
try {
  await p.goto('https://www.mass.gov/info-details/funded-ratios', { timeout: 45000, waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const txt = await p.locator('body').innerText();
  console.log('=====HTML FUNDED RATIOS PAGE=====');
  console.log(txt);
} catch (e) { console.log('HTML page FAILED:', e.message); }

await b.close();
