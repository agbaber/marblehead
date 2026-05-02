# Style-rule enforcement: making the design system mechanical

**Date:** 2026-05-02
**Status:** Draft (brainstormed)
**Stack:** Jekyll 3.10 (no migration)
**Approach:** Tooling-first. Land lint rules as warnings, build the includes + CSS, migrate top-traffic pages, then flip rule severity from warn to block.

## Goal

Convert the design rules in `STYLE_GUIDE.md` and `CLAUDE.md` from prose conventions into mechanical artifacts &ndash; reusable Liquid includes, scoped CSS, and CI-enforced lint checks &ndash; so that the recurring re-prompts on PRs ("bullets escape the box," "missing chart axis labels," "table overflows on mobile," "footnote/heading hierarchy is too loud") become structurally hard to introduce in the first place.

## Motivation

Most of the recurring style problems in PR review are violations of rules that *already exist* in `STYLE_GUIDE.md`. The rules are well-thought-out; they're just unenforced. Today the lint workflow (`.github/workflows/lint.yml`) catches em-dashes, editorial language, missing acronym wraps, broken internal links, and missing citation `data-source` attributes &ndash; but it does not catch the visual/structural failures listed above. Each violation gets caught in human review, the author rewrites it, and the rule lives on as oral tradition.

This project replaces oral tradition with three mechanical layers:

1. **Includes** &ndash; rule patterns that have a canonical shape (charts, callouts, read-next, methodology drawer, section ToC) become Liquid includes. Authors call the include and pass parameters; the include emits markup that conforms to the rule by construction.
2. **CSS** &ndash; rules about visual rhythm (heading margins, scroll offsets, list containers, anchor links, table wrappers, long-page back-to-top) live as scoped CSS rules in `assets/site.css`. The author can't get the spacing wrong because they don't author the spacing.
3. **Lint** &ndash; rules that can be detected from the source (heading hierarchy, frontmatter completeness, paragraph length, list cardinality, bold-URL anti-patterns, inline-script bans) run as warnings or blocks in CI.

## Out of scope

- Changing the IA. Pages stay where they are; URLs don't change. (A separate "trim/combine pages" project may follow this one.)
- Changing the stack. Jekyll stays. No Astro/Eleventy migration.
- Rewriting every page. High-traffic pages (top 5 by traffic) migrate to the new includes; the long tail stays as-is and migrates opportunistically when touched for content reasons.
- New aesthetic redesign. Color palette, typography, and overall visual style are unchanged. This project tightens enforcement of the existing design.
- Replacing existing working systems: `assets/citations.js` runtime sources injection, the `data-stance-section` voting tool, the read-time auto-band in `_layouts/page.html`, and the existing `page.scripts` opt-in mechanism all stay.

## Architecture

### Layer 1: Liquid includes

New includes live in `_includes/` alongside the existing `head.html`, `footer.html`, `nav.html`. Each include owns a single canonical pattern.

| Include | Purpose | Required params | Optional params |
|---------|---------|-----------------|-----------------|
| `chart.html` | Wraps a chart sub-section: heading, legend slot, SVG slot, methodology drawer, source line. | `id`, `title`, `aria_label`, `source` | `subtitle`, `methodology` (HTML), `legend` (HTML), `mobile_height` |
| `callout.html` | Renders a callout aside in one of four variants. | `variant` (one of `info` &#124; `caveat` &#124; `warning` &#124; `key`), body content | none |
| `methodology.html` | Renders a `<details class="methodology">` drawer collapsed by default. | `summary`, body content | none |
| `read-next.html` | Renders the canonical "Read next" block. | `links` (list of `{href, title, desc}` objects) | none |
| `section-toc.html` | Renders an inline "On this page" ToC for long pages. | none (auto-extracts h2 ids from `page.content`) | none |

The include slot mechanism uses Liquid's `{% capture %}` pattern for body content, since Jekyll's standard `{% include %}` doesn't support multi-slot natively. Pattern:

```liquid
{% capture cb %}
  <p>Body of the callout goes here.</p>
{% endcapture %}
{% include callout.html variant="caveat" body=cb %}
```

### Layer 2: CSS

All new rules live in `assets/site.css`. Existing rules unchanged unless explicitly listed in a bucket.

New / modified rules:

- `.callout`, `.callout--info`, `.callout--caveat`, `.callout--warning`, `.callout--key` &ndash; aside boxes with consistent padding/typography, varying only by left-border color and optional icon glyph.
- `details.methodology` &ndash; one canonical visual treatment, replaces per-page styling like the current `four_town_rates.html` inline `<style>` block.
- `.bullets` &ndash; default explainer-page list container (companion to existing `.tldr`, `.steps`, `.list-checklist`).
- `.page h2`, `.page h3`, `.chart-page h2`, `.chart-page h3` &ndash; uniform vertical rhythm (`margin-top: 3rem` / `1.75rem`) and `scroll-margin-top: var(--nav-height)` so anchor clicks don't tuck headings under the sticky nav.
- `.page h2::after` / `.chart-page h2::after` &ndash; anchor link glyph that appears on hover (desktop) or on tap (mobile), copies the URL with fragment.
- `.chart-source` &ndash; canonical italic + muted + small treatment for chart source lines.
- `.chart-wrapper { overflow-x: auto }` for sub-360px viewports so charts scroll horizontally instead of squashing.
- `body.long-page` triggered by Liquid based on word count; reveals a fixed-position `a.back-to-top` after 1.5 viewport heights of scroll.
- `--nav-height` token added to `:root` so `scroll-margin-top` and back-to-top math share one value.

### Layer 3: Lint

A new Node script `scripts/lint-content.mjs` runs every rule from the catalog below. Invoked from the existing `.github/workflows/lint.yml` workflow as a third job alongside the existing `secrets` and `content` jobs.

The two content-checking jobs run side-by-side without overlap. The existing `content` job stays as-is, owning the rules it already enforces (em-dashes, editorial words, `marbleheadma.gov` upload URLs, unwrapped acronyms, missing citation `data-source`, broken internal links, broken anchors). The new `lint-content.mjs` job owns everything in the catalog below: heading hierarchy, list structure, paragraph length, frontmatter completeness, callout markup, table wrapping, inline-script bans, etc. No rule is enforced by both.

Why Node, not Ruby: existing test infrastructure (`tests/smoke-test.mjs`, `scripts/test-local.mjs`) is Node, and the linter needs DOM walking (count h2s, find h2 directly followed by ul, count words inside `<p>`, validate frontmatter), which is trivial with `node-html-parser` or `cheerio` and awkward in bash. Adding a Node-based linter doesn't introduce a new toolchain.

The script reads two modes:

- **Diff mode** (default in PR CI): only added or modified lines; matches the current `lint.yml` content-job pattern. Catches new violations; grandfathers existing.
- **Whole-file mode** (used for frontmatter, heading-hierarchy, single-h1 checks): runs against the entire file when *any* line in that file appears in the diff. Required because rules like "every page has `og_url`" can't be expressed as added-line regex.

Severity has two levels:

- **block** &ndash; lint exits non-zero, CI fails. Used for rules with rare false positives.
- **warn** &ndash; lint emits a GitHub PR annotation but exits zero. Used for rules with thoughtful exceptions.

The PR-1 rollout runs *every* rule as `warn` regardless of its target severity, to surface the existing-violation inventory without breaking CI on pages that haven't been migrated yet.

## Rule catalog

Six buckets. Each rule tagged with its mechanism and severity.

### Bucket 1: Chart anatomy

The proposal: one Liquid include `chart.html` that wraps every chart (whether on a `charts/*.html` page or embedded in an explainer). It owns the legend slot, SVG slot, methodology `<details>`, and source line. The author hand-writes the SVG inside it; everything else around the SVG is mechanical.

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 1.1 | Every chart sub-section is wrapped by `{% include chart.html id="..." title="..." subtitle="..." aria_label="..." source="..." methodology="..." %}` (slots: `legend`, `svg`, optional `methodology` body). | `[include]` | n/a |
| 1.2 | The include's `source` and `aria_label` parameters are required; build fails if either is empty on a chart that uses the include. | `[lint]` | block |
| 1.3 | Methodology is a `<details>` collapsed by default, with consistent muted styling. No per-page `<style>` block defining `details.notes` or `dl.defined-terms`. | `[include + css + lint]` | warn |
| 1.4 | Source line at chart bottom is italic + muted + small (`.chart-source`). One canonical visual treatment. | `[css]` | n/a |
| 1.5 | No inline `style=""` on any SVG element. | `[lint]` | warn |
| 1.6 | Every `<svg class="chart">` has at least one `<line class="axis-base">` and &ge;2 `<text class="tick-label">` elements. (Imperfect &ndash; catches "I forgot the axis entirely" but not partial-axis bugs.) | `[lint]` | warn |
| 1.7 | Chart wrapper supports horizontal scroll on viewports below ~360px (`.chart-wrapper { overflow-x: auto; min-width: 360px; }`) instead of squashing the SVG. | `[css]` | n/a |
| 1.8 | Frontmatter `title` and `<h1>` casing must match (chart pages: Title Case; explainers: sentence case). | `[lint]` | warn |

Design decisions baked into the include:

- Methodology slot accepts full HTML (small data tables, footnoted prose).
- Embedded charts inside explainer pages use `{% include chart.html %}` too, not just the standalone `charts/*.html` pages.

### Bucket 2: Section structure

The h2 is the section delimiter; no `<section>` wrapper. Rules below preserve the existing pattern (`<h2 id="..." data-stance-section="...">` followed by h3 subdivisions and prose, ending in a `<details class="notes">`) and lock it down.

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 2.1 | Every `<h2>` on a site-facing page carries non-empty `id="..."` and `data-stance-section="..."` (use `data-stance-section="off"` to opt out, like `how-we-got-here.html` does for "Key terms"). | `[lint]` | block |
| 2.2 | No heading-level skips. h1 &rarr; h2 &rarr; h3, never h2 &rarr; h4. | `[lint]` | block |
| 2.3 | One `<h1>` per page. h2 casing matches h1 casing (sentence case for explainers, Title Case for charts). h3 follows the same casing as h2 on the same page. | `[lint]` | block |
| 2.4 | Every explainer page has exactly one of `<p class="page-lead">` or `<div class="key-stats">` between `<h1>` and the first `<h2>`. | `[lint]` | block |
| 2.5 | An `<h2>` should not be immediately followed by a list (`<ul>`/`<ol>`) or `<table>`. Needs at least one paragraph, key-stat block, callout, or chart between the heading and the list. | `[lint]` | warn |
| 2.6 | Vertical rhythm comes from CSS only. Margins set centrally: `h2 { margin-top: 3rem }`, `h3 { margin-top: 1.75rem }`, scoped to `.page` and `.chart-page`. The lint half forbids `<br>` and empty `<p></p>` as spacing tools (legitimate `<br>` inside `<address>` / poetry is rare enough to handle case-by-case via inline-disable comment). | `[css + lint]` | block |
| 2.7 | `scroll-margin-top: var(--nav-height)` on h2/h3 so clicking an anchor doesn't hide the heading under the sticky nav. | `[css]` | n/a |
| 2.8 | Anchor link at end of every h2 &ndash; `#` glyph that appears on hover (desktop), tap-target on mobile, copies the URL with fragment. CSS-only via `::after`. | `[css]` | n/a |

### Bucket 3: Reading flow inside a section

Targets the user-named pain points "rules for bullets" and "avoiding giant walls of text."

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 3.1 | Single paragraph word count: warn at >100, block at >150. | `[lint]` | warn at 100, block at 150 |
| 3.2 | Run of consecutive `<p>` totaling >400 words without a structural break (`<h3>`, list, `.callout`, `.key-stats`, chart, blockquote, `<details>`) warns. Forces a visual reset. | `[lint]` | warn |
| 3.3 | On `.page` / `.chart-page`, bullets must live inside a class-tagged container: `.tldr`, `.steps`, `.list-checklist`, or new `.bullets`. Bare `<ul>`/`<ol>` warns. (Markdown doc pages with `body.doc-page` have their own list styling and are exempt.) | `[css + lint]` | warn |
| 3.4 | Single-`<li>` lists block. A list of one is a paragraph or callout, not a list. | `[lint]` | block |
| 3.5 | Lists over 7 items warn. Either split with sub-headings, group, or convert to a table. | `[lint]` | warn |
| 3.6 | List items longer than one sentence warn. (Detection: an `<li>` whose text contains more than one sentence-ending period followed by space and capital letter.) | `[lint]` | warn |
| 3.7 | `<strong>` runs over ~10 words warn. Bold is for noun phrases / key terms, not whole sentences. | `[lint]` | warn |
| 3.8 | No bold URLs &ndash; `**http...**` or `<strong>http...</strong>` blocks. | `[lint]` | block |

### Bucket 4: Tables

Existing `.data` + `.data--stack` system already works; the bucket consolidates the six existing one-off classes (`.peer-table`, `.vote-detail`, `.mandate-table`, `.peer-trash`, `.data-table`, `.data`) and locks down the wrap pattern.

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 4.1 | One canonical class: `<table class="data">`. Soft migration: existing one-offs (`.peer-table`, `.vote-detail`, `.mandate-table`, `.peer-trash`, `.data-table`) get rewritten to `.data` only when their containing page migrates in PRs 4&ndash;8; long-tail tables grandfather. Lint warns on any new `<table>` without `class="data"`. | `[css migration + lint]` | warn |
| 4.2 | Every `<table class="data">` is a direct child of `<div class="table-wrap">`. The wrap provides `overflow-x: auto`. | `[lint]` | block |
| 4.3 | `.data--stack` opts a table into card-stack on mobile instead of horizontal-scroll. Use when readers scan rows row-by-row; default to scroll when readers compare across columns. | `[convention]` | n/a |
| 4.4 | Every `<table class="data">` contains a `<caption>`. Same role as a chart caption. | `[lint]` | block |
| 4.5 | Header cells use `<th scope="col">`; row labels use `<th scope="row">`. | `[lint]` | block |
| 4.6 | A `<thead>` with more than 6 `<th scope="col">` warns. | `[lint]` | warn |

### Bucket 5: Callouts and disclosures

Adds a generic in-flow callout (so pages stop inventing them) and a shared methodology drawer pattern.

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 5.1 | Four canonical callout variants: `.callout--info` (neutral, default), `.callout--caveat` (data-quality / "this number is volatile"), `.callout--warning` (caution about scope), `.callout--key` (the takeaway). All four share padding/typography; vary only by left-border color and optional icon. No new bespoke callout classes. | `[css + lint]` | warn (on a new `<style>` block defining a class containing `callout`) |
| 5.2 | Markup: `<aside class="callout callout--caveat">…</aside>`. Semantic `<aside>`, not `<div>`. | `[lint]` | warn |
| 5.3 | Callout body word cap ~50. If you need more, use `<details class="methodology">` instead. | `[lint]` | warn |
| 5.4 | Methodology disclosure is `<details class="methodology"><summary>…</summary>…</details>`, collapsed by default. One canonical CSS treatment shared between chart pages and explainers. | `[css]` | n/a |
| 5.5 | No callouts inside callouts; no `<details>` inside callouts. | `[lint]` | warn |
| 5.6 | Sources block is the one auto-injected by `assets/citations.js`. Manually-authored `<h2>Sources</h2>` blocks fail lint. | `[lint]` | block |
| 5.7 | `.key-stats`/`.key-stat` unchanged &ndash; for 2&ndash;4 headline numbers at top of explainers only. Second `.key-stats` per page warns (use `.callout--key` instead). | `[convention + lint]` | warn |

Color discipline: variants use existing palette tokens (`--c-teal` for info, `--c-buoy` for caveat and warning, `--c-navy` for key). No red/orange/yellow added; coastal palette stays restrained.

### Bucket 6: Page-level chrome

| # | Rule | Mechanism | Severity |
|---|------|-----------|----------|
| 6.1 | Frontmatter required on every site-facing page: `title`, `og_title`, `og_description`. (`og_url` stays optional; the head template already auto-derives it from `page.url | absolute_url` when missing, and that auto-derivation is correct in every case I've seen.) The current head template silently falls back to site defaults for the three required fields, which means pages without explicit OG meta ship Facebook cards identical to the homepage. | `[lint]` | block |
| 6.2 | `og_description` &le; 160 characters. | `[lint]` | warn |
| 6.3 | Auto-generated inline ToC ("On this page") on long pages. Trigger: &ge;4 `<h2>` elements OR >1500 words. Renders right after the `.page-lead` / `.key-stats` opener. Generated by walking `page.content` for `<h2 id="...">`. | `[include + Liquid]` | n/a |
| 6.4 | `{% include read-next.html links=… %}` is the canonical Read-next block. Hand-rolled `.read-next` markup migrates opportunistically; lint warns on new hand-rolled `.read-next` divs. | `[include + lint]` | warn |
| 6.5 | Per-page inline `<style>` blocks cap at ~30 lines. Larger styling moves into `assets/site.css`. | `[lint]` | warn |
| 6.6 | Per-page inline `<script>` blocks blocked, except `<script type="application/json">` data blocks (the existing chart-tooltip pattern). Behavior JS opts in via `page.scripts: [name]`. | `[lint]` | block |
| 6.7 | "Back to top" floating link auto-renders on long pages (`body.long-page` set by Liquid on the read-time word-count metric; CSS shows a fixed-position anchor after 1.5 viewport heights of scroll). | `[css + Liquid]` | n/a |

## Implementation approach: tooling-first

Nine PRs in order (one scaffolding, one rule-tuning, one infrastructure, five page migrations, one severity flip). Each is independently reviewable, independently revertable, and produces visible CI output before the next builds on it.

### PR 1: Linter scaffolding + all rules as warnings

- Add `scripts/lint-content.mjs` (Node, with `node-html-parser` or `cheerio` for DOM walking, `gray-matter` for frontmatter parsing).
- Add a third job to `.github/workflows/lint.yml` invoking the new script.
- All rules from the catalog above run as **warnings** regardless of their final severity. CI does not fail.
- Output: GitHub PR annotations naming each violation, file, and line.

The PR's own diff will trip a flood of warnings against itself. That output is the deliverable &ndash; it tells us the existing-violation inventory across the site, which feeds rule revisions in PR 2.

**Definition of done:** lint workflow runs green; the PR comment lists ~N violations across ~M files; we have a baseline.

### PR 2: Linter rule revisions + first round of rule-tuning

Based on the PR-1 inventory, revise wording / thresholds where the lint produces too many false positives. Document the final wording in `STYLE_GUIDE.md` so the rule is human-readable and the lint is the enforcement of the same wording. Rules unchanged in semantics; thresholds tuned.

**Definition of done:** PR-1 inventory shrinks to a target violation count agreed at this stage (likely <100 across the site).

### PR 3: Includes + CSS

- Add `_includes/chart.html`, `callout.html`, `methodology.html`, `read-next.html`, `section-toc.html`.
- Add CSS rules for `.callout--*`, `details.methodology`, `.bullets`, `.chart-source`, `body.long-page` + back-to-top, `.page h2/h3` margin and `scroll-margin-top` rules, h2 anchor `::after`, `--nav-height` token, `.chart-wrapper { overflow-x: auto }` mobile rule.
- Update `_layouts/page.html` to set `body.long-page` based on word-count threshold and emit the back-to-top anchor.
- No existing pages migrated yet; the new infrastructure is dormant until PRs 4&ndash;8 use it.

**Definition of done:** Playwright proof shot of one explainer page (unchanged content) showing the new spacing + anchor-link hover behavior; visual regression suite still green.

### PRs 4&ndash;8: Migrate top 5 pages

One PR per page, in priority order. Per-PR work: rewrite the page onto includes, run the linter locally, fix all warnings on that page, attach Playwright proof shot.

Suggested order (subject to revision based on PostHog traffic data):

1. `index.html`
2. `what-is-the-override.html`
3. `how-we-got-here.html`
4. `no-override-budget.html`
5. The two highest-traffic chart pages (likely `charts/healthcare_costs.html` and `charts/four_town_rates.html`, but confirm at execution time via PostHog).

**Definition of done per PR:** lint passes with zero warnings on the migrated file; Playwright proof shot of the migrated page; reviewer confirms visual parity; long-page back-to-top + ToC behavior verified on long migrations.

### PR 9: Flip block-marked rules from warn to error

Once the top 5 pages are clean, change rule severity from `warn` to `block` for every rule whose target severity is `block` in the catalog above. CI starts failing on new violations of those rules.

The long-tail pages remain grandfathered until they're touched for content reasons (because the diff-based lint only runs on changed lines for most rules).

**Definition of done:** CI red on a synthetic test PR that introduces a block-level violation; CI green on a content-only PR to a long-tail page.

## Open questions / deferred decisions

- **Which six DOM-walking lint helpers vs. regex?** Some rules can be expressed as added-line regex (em-dash style); others need DOM traversal (h2 directly followed by ul). The lint script architecture decides per-rule. Defer to implementation; no architectural decision needed.
- **Liquid `{% capture %}` slot pattern for callouts.** Confirms during PR 3 with a real authored callout in one of the migrated pages. If the capture pattern is too painful, fall back to a single-string `body` parameter for short callouts and a separate `<aside>` markup pattern for long ones.
- **Long-page word-count threshold.** Currently the read-time band uses 1500-word "deep dive." The back-to-top + auto-ToC threshold can either share that 1500-word cutoff or pick its own. Defer to PR 3 implementation.
- **Migration order for PRs 4&ndash;8.** Pull PostHog traffic data at execution time to confirm the priority list. The five named above are an educated guess.
- **Color of `.callout--key`.** Spec says `--c-navy`. If navy collides visually with `.key-stats` styling, fall back to `--c-teal`. Defer to CSS implementation.

## Success criteria

The project is a success when, six months from PR 9 merging:

1. The recurring re-prompts the user described at the start of this brainstorm (bullets escaping their box, missing chart axis labels, mobile table overflow, footnote/heading hierarchy) appear in zero PRs.
2. New pages added during that period adopt the includes by default, not as a deliberate choice.
3. The `STYLE_GUIDE.md` rule list and the `scripts/lint-content.mjs` rule list are 1:1 in scope &ndash; every prose rule has a mechanical enforcement, every mechanical enforcement has a prose rule.
4. PR review time on style-related comments drops materially (subjective; not a hard metric).

A failed-but-recoverable outcome looks like: PR 1 ships, lint inventory is too noisy to act on (>500 violations across the site), and the project pauses there until rule thresholds are revised. That's recoverable; the cost is a single revertable PR.

A failed-and-bad outcome looks like: PR 9 flips block severity prematurely, blocks legitimate work for a week, and the rules get rolled back without the includes ever being adopted. The PR cadence above is designed to make this outcome unreachable &ndash; block flip happens after the high-traffic pages are clean, so the only PRs that fail are ones that *should* fail.
