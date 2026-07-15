import { chromium } from 'playwright';
const url = process.argv[2] || 'https://ecode360.com/10437215'; // Ch 13 Animals
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await p.waitForTimeout(4000);

const info = await p.evaluate(() => {
  const out = {};
  // Candidate section containers: eCode uses id like "section10437216" and data attrs
  const secs = document.querySelectorAll('[id^="section"], .section, li.section');
  out.sectionCount = secs.length;
  // sample first 3 section outerHTML (trimmed) to see structure
  out.samples = [...secs].slice(0, 3).map(s => ({
    id: s.id,
    cls: s.className,
    html: s.outerHTML.slice(0, 700),
  }));
  // Look for classes that likely hold number/title/history
  const classHits = {};
  for (const el of document.querySelectorAll('*')) {
    const c = el.className;
    if (typeof c === 'string' && /num|title|history|content|para|heading/i.test(c)) {
      classHits[c] = (classHits[c] || 0) + 1;
    }
  }
  out.classHits = Object.entries(classHits).sort((a,b)=>b[1]-a[1]).slice(0, 25);
  return out;
});
console.log(JSON.stringify(info, null, 2));
await b.close();
