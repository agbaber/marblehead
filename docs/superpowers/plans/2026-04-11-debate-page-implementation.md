# Override Debate Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the override debate page: a new `/the-debate.html` presenting five tensions with steelmanned perspective blocks for each side, a TL;DR at the top, and a synthesis summary at the bottom, plus a new featured card on `index.html` linking to it.

**Architecture:** Single new HTML page using the existing site CSS plus inline page-specific styles for `.perspective` and `.mini-synthesis` blocks. New `.featured-card` component promoted to `assets/site.css` for reuse. Three file changes, one commit.

**Tech Stack:** Plain HTML, CSS custom properties, `color-mix` for theme-adapting backgrounds. No JavaScript, no build step. Jekyll-rendered by GitHub Pages but this page is hand-authored HTML, not Markdown.

---

## File Structure

**Files to create:**
- `/Users/agbaber/marblehead/the-debate.html` — the new page (self-contained HTML with inline `<style>` block for `.perspective` and `.mini-synthesis`)

**Files to modify:**
- `/Users/agbaber/marblehead/assets/site.css` — add `.featured-card` component (~40 lines in a new section at the end)
- `/Users/agbaber/marblehead/index.html` — add featured card markup above the three existing section grids

**Out of scope for Phase 1** (deferred to Phase 2):
- Inbound link sentences from `about.html`, `how-we-got-here.html`, `why-not-elsewhere.html`, `what-fails.html`, `what-is-the-override.html`
- Closing paragraph under the synthesis bullets
- Embedded primary-source quotes (`.perspective-quote`) — blocks ship as prose only; quotes land in subsequent passes as the author verifies sources

---

## Task 1: Create the page scaffold

**Files:**
- Create: `/Users/agbaber/marblehead/the-debate.html`

This task creates a renderable HTML skeleton with the site's standard head, GTM tags, viewport meta, nav, and an empty `<div class="page">` wrapper. Content is added in later tasks. At the end of this task the page loads successfully in a browser and shows the nav bar and the page heading.

- [ ] **Step 1: Create the file with the complete scaffold**

Write the following to `/Users/agbaber/marblehead/the-debate.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5PQG62BJ');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZK1KEJT3KX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ZK1KEJT3KX');
</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F4F7FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1620" media="(prefers-color-scheme: dark)">
<title>The override debate, both sides - Marblehead Budget Data</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/site.css">
<style>
  /* page-specific styles added in Task 2 */
</style>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5PQG62BJ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

<nav class="site-nav">
  <div class="nav-inner">
    <a class="nav-brand" href="./">MHD Budget</a>
    <a href="what-is-the-override.html">Override</a>
    <a href="how-we-got-here.html">How We Got Here</a>
    <a href="what-fails.html">No-Override Budget</a>
    <a href="why-not-elsewhere.html">Peer Towns</a>
    <a href="senior-tax-relief.html">Senior Relief</a>
    <a href="about.html">About</a>
  </div>
</nav>

<div class="page">
  <h1>The override debate, both sides</h1>
  <p>Marblehead residents are debating whether to approve the FY27 override. This page presents the strongest version of each side in the local debate, organized around the five tensions where voters actually disagree. It is not a recommendation or a summary. It is a map of where the real disagreements are, for readers still deciding how to vote. See <a href="about.html">about this site</a> for the author's disclosure (including that the author is genuinely undecided as of writing).</p>

  <!-- Content sections added in Tasks 3-9 -->
</div>

</body>
</html>
```

- [ ] **Step 2: Verify the page loads**

Run from the project root:
```bash
python3 -m http.server 8765 > /tmp/srv.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/the-debate.html
```

Expected output: `200`

Leave the server running for subsequent tasks.

---

## Task 2: Add page-specific CSS for perspective and mini-synthesis blocks

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html` (replace the empty `<style>` block from Task 1)

This task adds the CSS for `.perspective` blocks (the two sides) and `.mini-synthesis` blocks (the per-tension closers). Uses the site's existing CSS custom properties so dark mode works automatically.

- [ ] **Step 1: Replace the `<style>` block contents**

In `/Users/agbaber/marblehead/the-debate.html`, replace:
```html
<style>
  /* page-specific styles added in Task 2 */
</style>
```

with:

```html
<style>
  /* Perspective blocks: one per side per tension */
  .perspective {
    border-radius: 0 10px 10px 0;
    padding: 18px 22px 16px;
    margin: 14px 0;
    background: var(--surface);
    border-left: 4px solid var(--border);
    box-shadow: var(--shadow-sm);
  }
  .perspective--supporter {
    border-left-color: var(--c-teal);
    background: color-mix(in srgb, var(--c-teal) 5%, var(--surface));
  }
  .perspective--skeptic {
    border-left-color: var(--c-brass);
    background: color-mix(in srgb, var(--c-brass) 5%, var(--surface));
  }
  .perspective-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: var(--text-subtle);
    margin-bottom: 10px;
  }
  .perspective p {
    font-size: 15px;
    line-height: 1.65;
    color: var(--text);
    margin: 0 0 10px;
  }
  .perspective p:last-child {
    margin-bottom: 0;
  }
  .perspective a {
    color: var(--link);
  }

  /* Mini-synthesis: the quieter block between tensions */
  .mini-synthesis {
    margin: 20px 0 28px;
    padding: 14px 0 0;
    border-top: 1px solid var(--divider);
    text-align: center;
  }
  .mini-synthesis p {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 0 auto;
    font-style: italic;
    max-width: 540px;
  }
  .mini-synthesis strong {
    color: var(--text);
    font-style: normal;
    font-weight: 700;
  }

  /* Tension headings */
  .page h2.tension-heading {
    margin-top: 40px;
    font-size: 20px;
  }
  .page p.tension-framing {
    font-size: 14px;
    color: var(--text-muted);
    margin: 6px 0 6px;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .perspective { padding: 16px 18px 14px; }
    .perspective p { font-size: 14px; line-height: 1.6; }
    .page h2.tension-heading { font-size: 18px; margin-top: 32px; }
  }
</style>
```

- [ ] **Step 2: Reload the page in the browser and verify it still renders**

Navigate to `http://localhost:8765/the-debate.html`. The page should still load (the styles don't do anything visible yet because there's no content using them). No JS errors, no CSS errors in the browser console.

---

## Task 3: Draft the TL;DR section

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html` (insert after the intro paragraph)

This task adds the "short version" block with both sides' 75-word synopses, using the same `.perspective` component that the tension blocks below will use. This section sets the tone for the whole page.

- [ ] **Step 1: Insert the TL;DR section**

In `/Users/agbaber/marblehead/the-debate.html`, replace the line:
```html
  <!-- Content sections added in Tasks 3-9 -->
```

with:
```html
  <h2 class="tension-heading">The short version</h2>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>Marblehead's FY27 deficit is the predictable result of health insurance and pension costs growing faster than revenue under Proposition 2&frac12;, in a town whose 95.5%-residential tax base offers few structural alternatives. The Finance Committee has been warning about this arc since 2019. The no-override budget removes 22 town positions, 14 school positions, cuts the library 43%, and eliminates the OPEB trust contribution. These are services residents use, and the reductions would be hard to reverse.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>The same FY27 deficit reflects local choices the town made and keeps making: overhiring, an 83%/17% benefits split more generous than peers, enrollment down while school staffing grew, and a Select Board whose answer to every year's budget is "more." The override pattern won't stop, because the cost drivers don't stop. The honest path is spending discipline and structural reform now, not a bigger tax bill to postpone the reckoning.</p>
  </div>

  <!-- Tension sections added in Tasks 4-8 -->
  <!-- Synthesis section added in Task 9 -->
```

- [ ] **Step 2: Reload and visually verify**

Reload `http://localhost:8765/the-debate.html` in the browser. Expected: two stacked colored blocks, supporter on top with teal left border and subtle teal background tint, skeptic below with brass left border and subtle brass background tint. Both labels visible in uppercase. Text readable in both light and dark mode.

---

## Task 4: Draft Tension 1 — Where does the cost pressure come from?

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html` (insert before the "Tension sections" comment)

Each tension section has the same four-element structure: tension heading, framing paragraph, skeptic perspective block, supporter perspective block, mini-synthesis. The spec requires skeptic-first drafting order but either order is acceptable in the final rendered page; we use supporter-first rendering because that matches the TL;DR order readers just saw.

- [ ] **Step 1: Insert the Tension 1 section**

In `/Users/agbaber/marblehead/the-debate.html`, replace:
```html
  <!-- Tension sections added in Tasks 4-8 -->
```

with:
```html
  <h2 class="tension-heading">Tension 1. Where does the cost pressure come from?</h2>
  <p class="tension-framing">Both sides agree costs are rising faster than revenue. They disagree on whether the town chose those costs or they happened to it.</p>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>The FY27 deficit is driven by categories the town cannot meaningfully negotiate in the twelve weeks before Town Meeting. Health insurance premiums are set through the Group Insurance Commission, which raised Marblehead's rates 11% for FY27 (+$1.65M on a single line item). Pension obligations (+9%, +$463K) come from a PERAC-certified actuarial schedule with no local discretion. Debt service (+19%, +$1.78M) reflects contractual obligations on bonds already issued. State aid is 25% below its 2002 level after inflation, a statewide decline documented in the MMA's 2025 <em>Perfect Storm</em> report. These are real pressures from outside the town's short-term decision-making horizon. Within the FY27 budget cycle they are effectively fixed, and calling them "just choices" conflates long-horizon policy with near-term fiscal reality.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>Calling FY27's cost growth "external" obscures the local choices inside it. Marblehead pays 83% of health insurance premiums while employees contribute 17%. Many comparable towns use stricter splits that shift more cost to employees. The town extends health benefits to part-time employees working as few as 20 hours per week, the floor the GIC allows rather than a fiscal necessity. School enrollment has declined from its peak while education FTE has grown. The benefits structure, the hiring pace, and the premium split are town policies, not state mandates or market forces. Any cost the town can in principle renegotiate is a cost the town is choosing to carry. Treating them as external costs abdicates the responsibility to examine whether they remain appropriate.</p>
  </div>

  <div class="mini-synthesis">
    <p><strong>Where they actually disagree:</strong> whether a cost the town could in principle renegotiate counts as "external" depends on whether you are looking at a 12-week budget cycle or a 5-year planning horizon. Both sides are answering different versions of the question.</p>
  </div>

  <!-- Tensions 2-5 added in subsequent tasks -->
```

- [ ] **Step 2: Reload and visually verify**

Reload `http://localhost:8765/the-debate.html`. Expected: Tension 1 heading, a small italic framing paragraph, the teal supporter block, the brass skeptic block, a short italic synthesis with a subtle top border separating it from the next section. Read both blocks for length parity (both should look similar in height).

---

## Task 5: Draft Tension 2 — Are the proposed reductions damage or discipline?

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html`

- [ ] **Step 1: Insert the Tension 2 section**

Replace the line:
```html
  <!-- Tensions 2-5 added in subsequent tasks -->
```

with:
```html
  <h2 class="tension-heading">Tension 2. Are the proposed reductions damage or discipline?</h2>
  <p class="tension-framing">The no-override budget is published. Both sides have read it and reached opposite conclusions. See <a href="what-fails.html">what's in the no-override budget</a>.</p>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>The FY27 no-override budget removes 22 town positions (18-19 filled), 14 school positions, cuts the library 43%, eliminates the OPEB trust contribution, reduces Community Development 59%, and reduces Public Buildings 38%. These are not administrative line items. They are services Marblehead residents use every week. The library was renovated in 2021 with a separate $8.5 million debt exclusion that voters approved; the proposed reduction would hollow out a building the town just invested in. The reductions are structured to balance the budget in one year, but reversing them later would require rehiring, rebuilding programs, and re-earning trust from staff who leave for more stable districts. Melrose and Stoneham both lived through this after failed overrides. The word for what happened there is not discipline. It is damage, and it took larger overrides to begin reversing.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>Every department's budget has slack, and when departments are asked to cut, they find they can. The FY27 no-override budget's "reductions" are measured against a FY26 baseline that itself grew faster than inflation for years. Calling a return to an earlier baseline a "cut" presumes that last year's level was the correct one, which is exactly what the skeptic case contests. Staffing declined 12% in this budget because staffing grew before it. The library at -43% gets the most attention, but the library is one line item in a budget that grew steadily around it. If the town cannot absorb a correction after years of above-inflation expansion, that is evidence the expansion itself was too fast, not evidence that the correction is cruel. Hard choices are painful. The question is whether the pain signals over-reach or under-funding.</p>
  </div>

  <div class="mini-synthesis">
    <p><strong>Where they actually disagree:</strong> whether FY26 is the correct baseline against which to measure cuts. Pro-override treats FY26 as the level of service residents have chosen and should maintain. The skeptic treats FY26 as the peak of a trajectory that should have been corrected earlier.</p>
  </div>

  <!-- Tensions 3-5 added in subsequent tasks -->
```

- [ ] **Step 2: Reload and visually verify**

Reload the page. Expected: Tension 2 section appears below Tension 1 with the same structure. The link to what-fails.html should be clickable and styled as a link. Blocks should look similar in length.

---

## Task 6: Draft Tension 3 — Is this a one-time reset or the start of annual asks?

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html`

- [ ] **Step 1: Insert the Tension 3 section**

Replace the line:
```html
  <!-- Tensions 3-5 added in subsequent tasks -->
```

with:
```html
  <h2 class="tension-heading">Tension 3. Is this a one-time reset or the start of annual asks?</h2>
  <p class="tension-framing">If the override passes, does the problem go away for years, or does the same pressure rebuild immediately?</p>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>The three-tier structure ($9M / $12M / $15M) was designed as a multi-year correction, not a one-year patch. The Finance Committee's three-year operating budget forecast projects structural deficits only under the no-override scenario. Tier 2 ("stabilize") builds baseline capacity for recurring costs; Tier 3 ("invest") adds a cushion to absorb future pressure without returning to the ballot. The 2025 Finance Committee transmittal letter (see <a href="how-we-got-here.html">how we got here</a>) named FY26, FY27, and FY28 as the projected deficit years. The override is scoped to resolve that window. "Will they ask again?" is a reasonable question, and the answer depends on the cost environment several years from now. In the near term, approval at Tier 2 or Tier 3 eliminates the immediate ask.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>Passing an override does not pause the cost drivers that caused the deficit. Health insurance premiums will keep rising. Pension obligations will keep accruing. Debt service will keep scaling with each new borrowing. The override buys one to three years before the same pressure reaches the same place, and then the town faces the same question with a higher baseline. Melrose illustrates the pattern: a $7.7M override failed in 2024, and a $13.5M override passed the next year, 75% larger. Each failed ask is followed by a larger successful one because the underlying math does not wait for a political moment. Saying "this is a one-time reset" assumes that reforms will come during the breathing room the override creates. If those reforms do not materialize, the next ask is already on its way.</p>
  </div>

  <div class="mini-synthesis">
    <p><strong>Where they actually disagree:</strong> whether "one-time reset" means "no override next year" or "no override for the foreseeable future." Both sides agree costs will keep rising; they disagree on whether the override's capacity absorbs that rise or just delays its arrival.</p>
  </div>

  <!-- Tensions 4-5 added in subsequent tasks -->
```

- [ ] **Step 2: Reload and visually verify**

Reload and check Tension 3 renders correctly. The link to how-we-got-here.html should work.

---

## Task 7: Draft Tension 4 — Do meaningful alternatives exist?

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html`

- [ ] **Step 1: Insert the Tension 4 section**

Replace the line:
```html
  <!-- Tensions 4-5 added in subsequent tasks -->
```

with:
```html
  <h2 class="tension-heading">Tension 4. Do meaningful alternatives exist?</h2>
  <p class="tension-framing">The debate turns on whether the town has real options other than override versus reductions. See <a href="why-not-elsewhere.html">why some MA towns run overrides and others don't</a> for the structural data underneath this tension.</p>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>The peer-town analysis shows Marblehead at the extremes of every structural metric: 95.5% residential share of the tax levy, the highest in a 21-town peer set, and a 0.54% five-year average new growth rate, the lowest. The policy levers other towns use (CIP shift, commercial development, state aid, gateway-city designation) either do not exist in Marblehead or do not scale. A CIP shift on a 4.5% commercial base produces a trivial burden transfer. Commercial development is constrained by peninsula geography, historic districts, and zoning any rezoning debate would take years to resolve. State aid formulas exclude high-wealth suburbs by design. Benefits reform is on the town's longer agenda but cannot be enacted in time to close the FY27 gap. The "alternatives" argument assumes a planning horizon the fiscal year does not have.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>"No alternatives exist" is itself a policy position, not a fact. Benefits reform, though politically difficult, is possible. Other Massachusetts towns have moved to stricter eligibility thresholds and less generous premium splits. Commercial development is constrained by geography and zoning, but those zoning choices can be revisited over time if the town decides it wants to. State aid formulas exclude Marblehead, but active advocacy for reform is absent from the town's agenda. These alternatives require longer planning horizons than a 12-week budget cycle, which is exactly the point: the override is being asked for in lieu of the harder, slower conversation about what the town could change structurally over five years. Voting for the override because "nothing else will work in three months" is true, and ignores that three months is the wrong time horizon.</p>
  </div>

  <div class="mini-synthesis">
    <p><strong>Where they actually disagree:</strong> whether "meaningful alternatives" is measured over a 12-week budget cycle or a 5-year planning horizon. Both sides are answering different versions of the same question.</p>
  </div>

  <!-- Tension 5 added in next task -->
```

- [ ] **Step 2: Reload and visually verify**

Reload. Tension 4 should appear. The link to why-not-elsewhere.html should work.

---

## Task 8: Draft Tension 5 — Can we trust the people asking?

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html`

This is the most locally-specific tension and the one where `how-we-got-here.html` already provides strong primary-source evidence for the supporter side. The perspective block references that page directly.

- [ ] **Step 1: Insert the Tension 5 section**

Replace the line:
```html
  <!-- Tension 5 added in next task -->
```

with:
```html
  <h2 class="tension-heading">Tension 5. Can we trust the people asking?</h2>
  <p class="tension-framing">Most Prop 2&frac12; debates are about money. In Marblehead this tension is also about who decides, what they tell residents, and whether residents believe them.</p>

  <div class="perspective perspective--supporter">
    <div class="perspective-label">Override-supporter reading</div>
    <p>The <a href="how-we-got-here.html">how we got here</a> page documents Marblehead's Finance Committee transmittal letters from 2016 through 2025. For sixteen consecutive years FinCom reported balanced budgets without an override, and said so each year in writing. The shift began in 2019 with the Town Administrator's "unsustainable" characterization of free cash reliance and became an explicit override prediction in the 2022 transmittal letter, one year before the FY24 override attempt. The 2025 transmittal letter named FY26, FY27, and FY28 as the projected deficit years. This is not a board that "always wants more." It is a board that actively did not ask for an override for sixteen years, told residents exactly when the math changed, and predicted the current vote four years in advance. Trust in future decisions is reasonable when past decisions have tracked the underlying math.</p>
  </div>

  <div class="perspective perspective--skeptic">
    <div class="perspective-label">Skeptic reading</div>
    <p>Transparency of documents is not the same as accountability for outcomes. The Select Board and Finance Committee have presided over years of above-inflation budget growth, and now ask voters to fund the gap that growth created. Questions about efficiency, benefits structure, and specific line items get redirected into state formulas or insurance market forces. The sense that town leadership does not work <em>for</em> residents but instead asks residents to trust their judgment is a fact about the local political climate, regardless of whether anyone can point to a specific failure. A yes vote is a vote to extend credit to an institution that has not yet demonstrated it will spend the next dollar differently than the last twenty years of dollars. The skeptic case is not that the board is malicious; it is that past behavior is not sufficient evidence of future discipline.</p>
  </div>

  <div class="mini-synthesis">
    <p><strong>Where they actually disagree:</strong> whether past behavior plus transparent process is sufficient evidence that future spending will be responsible. Pro-override reads the FinCom arc as evidence of disciplined governance. The skeptic reads the same arc as the pattern the override perpetuates rather than interrupts.</p>
  </div>

  <!-- Synthesis section added in Task 9 -->
```

- [ ] **Step 2: Reload and visually verify**

Reload. Tension 5 should render with the link to how-we-got-here.html. Read the full page top to bottom to check cumulative length feels reasonable.

---

## Task 9: Draft the closing synthesis section

**Files:**
- Modify: `/Users/agbaber/marblehead/the-debate.html`

This task adds the closing synthesis block: a 5-point bulleted summary of the mini-syntheses, plus a closing notes block with source links. The closing paragraph (the declarative "data supports both readings" sentence) is deliberately deferred to Phase 2, as decided in the spec.

- [ ] **Step 1: Insert the synthesis and notes sections**

Replace the line:
```html
  <!-- Synthesis section added in Task 9 -->
```

with:
```html
  <h2 class="tension-heading">Where they actually disagree</h2>
  <p>The five tensions above are not about different facts. Both sides read the same facts: the same FY27 deficit, the same health insurance trajectory, the same Finance Committee letters, the same no-override budget. They reach different conclusions because they apply different frames. The cruxes, in one place:</p>

  <ul style="font-size: 15px; color: var(--text); line-height: 1.7; margin: 14px 0 10px 24px;">
    <li><strong>Cost source:</strong> whether a cost the town could in principle renegotiate counts as "external"</li>
    <li><strong>Damage or discipline:</strong> whether FY26 is the correct baseline against which to measure cuts</li>
    <li><strong>One-time or annual:</strong> whether "reset" means "no override next year" or "no override for years"</li>
    <li><strong>Alternatives:</strong> whether meaningful alternatives are measured over a 12-week budget cycle or a 5-year planning horizon</li>
    <li><strong>Trust:</strong> whether past behavior plus transparent process is sufficient evidence of responsible future spending</li>
  </ul>

  <div class="notes">
    <p><strong>Sources and methodology.</strong> Each tension's factual claims are sourced on the linked pages: FY27 budget numbers and the no-override cut list on <a href="what-fails.html">what's in the no-override budget</a>; the Finance Committee transmittal letter arc on <a href="how-we-got-here.html">how we got here</a>; the peer-town structural data on <a href="why-not-elsewhere.html">why some MA towns run overrides and others don't</a>; the three-tier override structure and the ballot mechanics on <a href="what-is-the-override.html">what is the override</a>. Statewide fiscal context: MMA, <a href="https://www.mma.org/wp-content/uploads/2025/10/MMA-APerfectStorm-HistoricFiscalPressures-report-10.9.25.pdf"><em>A Perfect Storm: Cities and Towns Face Historic Fiscal Pressures</em> (October 2025)</a>.</p>
    <p><strong>What this page doesn't do.</strong> It does not argue for or against the override, does not summarize "the" debate, and does not engage with the minority of voters who would reject any override regardless of the specifics. Each side here is the persuadable version of its position, not the version that treats the debate as already decided.</p>
    <p><strong>Author disclosure.</strong> See <a href="about.html">about this site</a>. The author is a Marblehead homeowner who is genuinely undecided and uses this page as a tool to work through both sides.</p>
  </div>
</div>

</body>
</html>
```

Note: the last two lines above (`</div>` and `</body>`) replace the existing closing tags at the bottom of the file. Do not duplicate them.

- [ ] **Step 2: Reload and verify the page is complete**

Reload `http://localhost:8765/the-debate.html`. Scroll from top to bottom. Expected sequence:
1. Nav bar
2. H1 "The override debate, both sides"
3. Intro paragraph with link to about
4. "The short version" with two stacked perspective blocks
5. Five tension sections, each with framing, supporter, skeptic, mini-synthesis
6. "Where they actually disagree" synthesis section with bulleted list
7. Notes block with sources, methodology, author disclosure

Check the HTML source view for any broken tags.

---

## Task 10: Add .featured-card component to the shared stylesheet

**Files:**
- Modify: `/Users/agbaber/marblehead/assets/site.css` (append new section at the end of the file)

This task promotes the `.featured-card` styles to the site CSS. The component will be used on `index.html` in the next task but stays in the shared stylesheet in case it's used again elsewhere.

- [ ] **Step 1: Append the featured-card section to site.css**

Append the following to the end of `/Users/agbaber/marblehead/assets/site.css`:

```css

/* ==========================================================================
   Featured card (promoted single-card CTA above section grids on the home page)
   ========================================================================== */

.featured-card {
  display: block;
  padding: 24px 28px 22px;
  margin: 0 0 36px;
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  border-left: 4px solid var(--c-navy);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s, transform 0.2s;
}
.featured-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
  text-decoration: none;
}
.featured-card-eyebrow {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--c-buoy);
  margin-bottom: 8px;
}
.featured-card-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  margin-bottom: 6px;
}
.featured-card-desc {
  font-size: 14px;
  color: var(--text-subtle);
  line-height: 1.55;
  margin-bottom: 12px;
}
.featured-card .tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 100px;
  letter-spacing: 0.3px;
  background: var(--tag-text-bg);
  color: var(--tag-text-fg);
}

@media (max-width: 600px) {
  .featured-card { padding: 20px 22px 18px; margin-bottom: 28px; }
  .featured-card-title { font-size: 18px; }
}
```

- [ ] **Step 2: Verify the site still renders after the CSS change**

Reload `http://localhost:8765/index.html`. The page should still render identically (no consumers of the new class yet). No CSS parse errors in the browser console.

---

## Task 11: Add the featured card markup to index.html

**Files:**
- Modify: `/Users/agbaber/marblehead/index.html` (insert above the first `<p class="section-label">`)

This task adds a single `<a class="featured-card">` element above the three existing section grids, pointing to the new debate page.

- [ ] **Step 1: Find the insertion point**

Run:
```bash
grep -n 'section-label">The override' /Users/agbaber/marblehead/index.html
```

Expected output: a single line number (around 52). This is the `<p class="section-label">The override</p>` that currently sits at the top of the question sections.

- [ ] **Step 2: Insert the featured card above that line**

In `/Users/agbaber/marblehead/index.html`, find the block:
```html
  <p class="section-label">The override</p>
```

and replace it with:
```html
  <a class="featured-card" href="the-debate.html">
    <div class="featured-card-eyebrow">Still deciding?</div>
    <div class="featured-card-title">The override debate, both sides steelmanned</div>
    <div class="featured-card-desc">Five tensions in the local debate, with the strongest version of each case. Neither a recommendation nor a summary. A map of where the real disagreements are, for readers still working through their vote.</div>
    <span class="tag">Analysis</span>
  </a>

  <p class="section-label">The override</p>
```

- [ ] **Step 3: Reload index.html and verify**

Reload `http://localhost:8765/index.html`. Expected: above the three section grids (below the hero), a new featured card appears with:
- A small red "STILL DECIDING?" eyebrow label
- A larger title "The override debate, both sides steelmanned"
- A description paragraph
- An "Analysis" tag
- A navy left border accent

Click the card. It should navigate to `the-debate.html`.

---

## Task 12: Mobile and dark-mode verification, then commit

**Files:**
- Verify only. Commit all changes from Tasks 1-11.

- [ ] **Step 1: Mobile viewport check**

Open the browser devtools and switch to a mobile viewport (375px wide). Reload both `http://localhost:8765/the-debate.html` and `http://localhost:8765/index.html`. Expected:
- Nav bar scrolls horizontally without wrapping
- Perspective blocks stack cleanly, text stays readable, no horizontal scroll
- Tension headings shrink to 18px per the media query
- Featured card padding shrinks, title shrinks to 18px
- Mini-synthesis stays centered and max-width constrained

- [ ] **Step 2: Dark mode check**

In devtools, toggle `prefers-color-scheme: dark`. Reload both pages. Expected:
- Perspective block backgrounds adapt to dark surface via `color-mix`
- Teal and brass accents remain visible against the dark background
- Text stays high-contrast
- Featured card accent remains visible

- [ ] **Step 3: Stop the local server**

```bash
kill $(pgrep -f "http.server 8765") 2>/dev/null; true
```

- [ ] **Step 4: Review the diff**

Run:
```bash
cd /Users/agbaber/marblehead && git status --short
```

Expected output (order may vary):
```
 M assets/site.css
 M index.html
?? the-debate.html
```

Run:
```bash
cd /Users/agbaber/marblehead && git diff --stat assets/site.css index.html
```

Expected: `assets/site.css` shows ~60 lines added, `index.html` shows ~8 lines added, 1 line removed.

- [ ] **Step 5: Stage and commit**

```bash
cd /Users/agbaber/marblehead && git add the-debate.html assets/site.css index.html && git commit -m "$(cat <<'EOF'
Add the override debate page, steelmanned both sides

New page at /the-debate.html presents the five tensions in the local
override debate with a perspective block for each side. Mirror structure
with TL;DR at the top and synthesis bullets at the bottom. No closing
paragraph and no inbound back-links from existing pages yet, both
deferred to Phase 2 per the design spec.

New .featured-card component in assets/site.css, used once on index.html
above the three section grids with the "Still deciding?" eyebrow,
pointing to the new debate page.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Verify commit landed**

```bash
cd /Users/agbaber/marblehead && git log --oneline -3
```

Expected: the new commit is the most recent entry, message starts with "Add the override debate page".

---

## Out of Scope (Phase 2)

The following items are deliberately deferred from this plan and will be handled after the user reviews the live page:

1. **Closing paragraph under the synthesis bullets** — the declarative "the data supports both readings" sentence. Added only after the five tensions have been reviewed and refined by the author.

2. **Back-links from existing pages** (`about.html`, `how-we-got-here.html`, `why-not-elsewhere.html`, `what-fails.html`, `what-is-the-override.html`) — one-sentence cross-references pointing at the debate page. Deferred so the debate page can stabilize before cross-editing multiple files.

3. **Primary-source quote embedding** — `.perspective-quote` blockquotes inside perspective blocks, added as the author verifies hard primary sources per the site's quote attribution rule.

4. **Tension refinement** — the author has signaled intent to review each tension live and push back on weak steelmanning. Those refinements are a separate iteration pass per tension, not a single task.

---

## Self-Review

**Spec coverage check:**
- ✅ Steelmanning both sides (Tasks 3-8, perspective blocks in mirror structure)
- ✅ Mirror structure across the 5 tensions in the same order (Tasks 4-8)
- ✅ Composite voice with primary-source quotes where available (quotes omitted from this phase by design, per spec Phase 2 scope)
- ✅ File `/the-debate.html` at site root (Task 1)
- ✅ Not in top nav (nav block in Task 1 omits the debate page)
- ✅ Linked from index via new featured card (Tasks 10, 11)
- ✅ TL;DR at top using same `.perspective` component (Task 3)
- ✅ Five tensions with framing, two blocks, mini-synthesis (Tasks 4-8)
- ✅ Closing synthesis bullets without the declarative closing paragraph (Task 9)
- ✅ `.perspective` and `.mini-synthesis` inline CSS (Task 2)
- ✅ `.featured-card` promoted to `assets/site.css` (Task 10)
- ✅ Dark mode via CSS custom properties (Task 2 uses tokens; Task 12 verifies)
- ✅ No sticky sidebar, no accordions, no interactivity, no icons (nothing in the plan adds these)
- ✅ Mobile responsive (media queries in Tasks 2 and 10; verification in Task 12)
- ✅ Skeptic-first drafting discipline (content in Tasks 4-8 was drafted skeptic-first; rendering order is supporter-first to match the TL;DR, noted in Task 4)
- ✅ Out-of-scope items explicitly listed (Out of Scope section)

**Placeholder scan:** No "TBD", no "TODO", no "add appropriate error handling," no "similar to Task N," no uncoded steps. Every content block has the full HTML inlined. Every command has the full command and expected output.

**Type consistency check:** The class names `.perspective`, `.perspective--supporter`, `.perspective--skeptic`, `.perspective-label`, `.mini-synthesis`, `.tension-heading`, `.tension-framing`, `.featured-card`, `.featured-card-eyebrow`, `.featured-card-title`, `.featured-card-desc` are used consistently across Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10, and 11. The featured card class in Task 10 CSS matches the markup in Task 11. The `<nav class="site-nav">` in Task 1 matches the existing pattern used across the site.

Plan complete.
