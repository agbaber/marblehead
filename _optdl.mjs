import { chromium } from 'playwright';
const OUT='/tmp/claude-1000/-home-claude-marblehead/2d367aaf-fede-4193-b685-bb08f423e03a/scratchpad/perac_opeb_may2026_cities_towns.pdf';
const b = await chromium.launch();
const ctx = await b.newContext({ acceptDownloads: true, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const p = await ctx.newPage();
const [dl] = await Promise.all([
  p.waitForEvent('download', { timeout: 60000 }),
  p.goto('https://www.mass.gov/doc/may-2026-opeb-summary-report-download/download', { timeout: 60000 }).catch(()=>{}),
]);
await dl.saveAs(OUT);
console.log('saved', OUT);
await b.close();
