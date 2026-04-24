# Positions lost chart, design

**Date:** 2026-04-24
**Owner:** Andrew Baber
**Status:** Approved, ready for implementation plan

## Purpose

Add a standalone chart visualizing the town-side positions Marblehead has lost between FY18 and FY27 while holding the tax levy roughly flat. The thesis: absent an override, the town has already been cutting services, specifically, municipal staff positions, just to keep the budget balanced. The existing `what-has-the-town-done.html` page documents these cuts in prose, tables, and bullets. It has no visualization. A reader skimming the page has no way to see the cuts at a glance.

**Single claim the chart makes:** "Between FY18 and FY27, Marblehead's town government lost 9 positions net. The losses concentrated in four departments: DPW, Community Development, Police, and Engineering (eliminated entirely). Every outlined circle is a job that used to exist and doesn't anymore."

The chart is scoped to town-side only. School-side staffing is larger in absolute terms (~36 teachers lost FY18-FY26) but declined roughly in proportion to enrollment, which makes for a different story that can't be told cleanly in the same visual. The chart will link to the existing `charts/enrollment_vs_staffing.html` for the school-side picture.

## Scope

**One new file:** `charts/positions-lost.html`, standalone chart page following the pattern of `charts/enrollment_vs_staffing.html` and `charts/per_capita_levy.html`. Hand-authored SVG, semantic CSS classes, no chart library, no JS interactivity in v1.

**One existing file modified:** `what-has-the-town-done.html`, add a `btn-link` to the new chart near the `#staffing` section, matching the existing link to `charts/enrollment_vs_staffing.html`.

**No CSS changes** unless the outlined-circle treatment requires a new utility class. Prefer inline attributes or a single scoped block in the chart page.

**No new data files.** Numbers come from existing sources already cited on `what-has-the-town-done.html` and compiled in `data/savings_measures_compiled.md`.

## Data

### Department-level changes

Sorted by positions lost descending. Numbers drawn from FinCom reports, Select Board budget hearing testimony (March 2026), and Marblehead Independent reporting.

| Department | FY18 | FY27 | Lost | Provenance |
|---|---:|---:|---:|---|
| DPW | ~31 | 19 | ~12 | Noonan quote: "30+ workers down to 19." Approximate starting count. |
| Community Development | 4 | 1 | 3 | Director eliminated FY27; reduced to one vacant planner + clerk. Source: March 2026 budget hearing. |
| Police (sworn) | 32 | 30 | 2 | Noonan, FY24-FY26. SRO pulled back to patrol; 1 FT officer defunded over five years of level-funding. |
| Engineering Dept | 2 | 0 | 2 | FY26 FinCom Report, budget zeroed (-$210,559). Functions absorbed into DPW. |
| Fire | n/a | n/a | "several" | Testimony only; not quantified. 1 vacancy unfilled >1 year, forcing 96-hour shifts. |
| All other (est.) | ~130 | ~130 | ~0 | Derived: 199 town total minus named-department starting counts. |
| **Town total** | **~199** | **~190** | **~9** | Kezer, March 2026 budget hearing. |

### Honesty calls baked into the design

1. **DPW "~31" is an approximation.** The "30+ workers" quote is from Select Board member Erin Noonan, not an audited FY18 headcount. A footnote on the chart must disclose this: *"DPW starting count quoted as '30+' in public testimony; exact FY18 audited headcount not yet located in primary sources."* If we later locate the precise FY18 figure in a FinCom report or the Finance Department, correct the chart.

2. **Fire Department is a callout, not dots.** The record says "several firefighter positions defunded" without a count. Drawing a specific number of outlined dots would invent precision. Fire gets a labeled note row (no dots) alongside the other rows.

3. **"All other ~130 → ~130" is derived, not sourced.** It's the residual: 199 town total minus the named departments' starting counts. The chart should label this row explicitly as "all other departments (estimated)" to avoid implying audited precision.

4. **The ~190 ending total is Kezer's phrase "approximately 190."** The chart will show ~190 in the total row, not 190 exact, to preserve the quoted approximation.

### Source list (for caption)

- 2026 FinCom Annual Report (FY26 budget), May 2025 ATM: Engineering Dept zeroed; Highway/Drain/Tree consolidation footnote
- March 2026 Select Board budget hearings: Kezer workforce count, Community Development reductions, Fire vacancy testimony
- Marblehead Independent, late 2025 and March 2026: Noonan testimony on DPW and Police staffing
- `data/savings_measures_compiled.md`: compiled internal reference with source citations per item (not itself a primary source; points to the primary sources above)

## Visual design

### Overall layout

Standalone page, top to bottom:

1. **Page header** (inherits from `_layouts/page.html`): site nav, title.
2. **H1:** "What Marblehead lost to keep the levy flat"
3. **Subtitle / lead paragraph:** one sentence naming the FY18-FY27 window and the ~199 → ~190 headline number.
4. **Legend:** short, two symbols. `●` = position still funded. `○` = position eliminated.
5. **Chart SVG:** one row per department, ordered by absolute loss descending. Fire callout row has no dots. Town total row at bottom, separated by a horizontal rule, larger dot size.
6. **Caption block:** methodology and honesty notes (DPW approximation, Fire callout, derived "all other" row).
7. **School-side pointer paragraph:** one sentence acknowledging school staffing is a different story and linking to `charts/enrollment_vs_staffing.html`.
8. **Source line:** formal sources, bulleted.
9. **Cross-links:** buttons to related charts/pages (parent page, enrollment chart, deficit model).

### Chart structure

**Rows, top to bottom:**

```
DPW                 31 → 19
  ●●●●●●●●●●●●●●●●●●● ○○○○○○○○○○○○
  Lost: heavy equipment operator, working foreman, general laborer

Community Dev       4 → 1
  ● ○○○
  Director role eliminated FY27; reduced to one vacant planner + clerk

Police (sworn)      32 → 30
  ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● ○○
  SRO reassigned to patrol; one FT officer defunded over five years

Engineering Dept    2 → 0
  ○○
  Department eliminated FY26; functions absorbed into DPW (-$210,559)

Fire                (several defunded)
  Several positions defunded through level-funding; one vacancy unfilled
  over a year, forcing 96-hour shifts

All other (est.)    ~130 → ~130
  ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● ... (compressed row)
  All other municipal departments combined; net change approximately zero

────────────────────────────────

Town total          ~199 → ~190
  ●●● [compressed dot bar representing 199 FTEs] ○○○○○○○○○
```

### Visual specifics

- **Dot geometry:** radius ~5-6px, gap ~3-4px. Row height ~44-56px to allow for department name, delta number, and sentence caption.
- **Filled dots:** solid neutral fill using the existing `s-neutral` color token or `var(--text)`. Not green.
- **Outlined dots:** `fill: none; stroke: var(--text-subtle); stroke-width: 1.2px`. Not red.
- **Left-column "Name + X → Y" block:** fixed width (~180px desktop, full-width on mobile). Department name bold, "FY18 → FY27" numbers in a smaller muted font beside or below.
- **Right-column "what was lost" sentence:** either wraps below the dot row (mobile) or sits to the right at a consistent column (desktop).
- **Horizontal separator rule** between the "All other" row and "Town total" row, using `border-top: 1px solid var(--border)`.
- **Town total dots** slightly larger (radius ~7-8px) to anchor the eye.
- **Compression for long rows (Police 32, Total 199):** acceptable to reduce dot size on those specific rows to fit, as long as the "1 dot = 1 position" equivalence is preserved. Do not switch to "1 dot = N positions", that would break the legend.

### Responsive behavior

- Mobile (≤600px): department name, delta, dot row, sentence caption each on their own line, stacked. SVG scales to container width via `viewBox`. Dots can shrink to ~4px radius if needed.
- Desktop (>600px): department name + delta in left gutter, dots flowing right, sentence caption to the right of dots or beneath row.
- The "all other" and "town total" rows contain 130 and 199 dots respectively. On mobile these may need to wrap to two lines within the SVG. Acceptable as long as the dot count remains honest.

### Color and style constraints (STYLE_GUIDE compliance)

- No green/red value coding. Filled = still funded, outlined = eliminated, both in neutral tones.
- No inline `style=""` on SVG elements. All styling via CSS classes or SVG presentation attributes.
- No editorial language in captions. Facts only ("SRO reassigned to patrol," not "SRO lost to budget cuts").
- No em-dashes anywhere in the chart or surrounding copy. Use hyphens, commas, or `&ndash;` in HTML if an en-dash is needed.

### Chart CSS classes

Reuse existing:
- `svg.chart`, the outer SVG element
- `chart-wrapper`, container div
- `s-neutral`, filled dot color

Scoped to this chart (inline `<style>` in the page, following the pattern of `charts/per_capita_levy.html`):
- `.pl-row`, a `<g>` element wrapping one department row
- `.pl-dot-filled`, filled circle
- `.pl-dot-empty`, outlined circle
- `.pl-label`, department name + delta text
- `.pl-sentence`, "what was lost" sentence text
- `.pl-total-row`, total row with larger dots and separator rule

## Integration

### Parent page link

In `what-has-the-town-done.html`, near the existing link to `charts/enrollment_vs_staffing.html` in the `#staffing` section, add:

```html
<a class="btn-link" href="charts/positions-lost.html">Town workforce: 199 &rarr; 190 over FY18-FY27</a>
```

Exact button copy to be finalized during implementation; should match the tone of the existing "School enrollment vs. staffing over time" button.

### Navigation / discoverability

- No primary nav change. The chart is a child of `what-has-the-town-done.html` and discoverable from that page.
- Include in `sitemap.xml` (automatic via Jekyll).
- Add to `data/DATA_CATALOG.md` if appropriate (other charts have entries).

### Open graph tags

Standard OG tags in frontmatter, matching the pattern of existing chart pages. `og_title`, `og_description`, `og_url`. Chart does not need a preview image in v1.

## Explicitly out of scope for v1

- No interactivity (tooltips, hover states, filters).
- No year-by-year timeline, only FY18 vs FY27 comparison.
- No peer-town comparison. Other towns' workforce trajectories are out of scope.
- No dollar figures on the chart itself (Engineering's $210,559 is an exception only because it's the sole evidence of that department's cut). Dollar framing lives on the parent page.
- No school-side positions in this chart. Schools link out to `charts/enrollment_vs_staffing.html`.
- No FY27 projected cuts (30 school positions under level funding; any town-side FY27 proposals). The chart is retrospective: positions already eliminated.
- No department-level breakdown on school side (gen-ed vs SPED vs EL). DESE reporting volatility makes sub-categories unreliable.
- No animation.

## Open questions and follow-up work

### To verify during implementation

1. **DPW FY18 exact headcount.** Search FinCom Annual Reports FY18-FY20 for a Table of Estimated Appropriations DPW line-item with position count. If found, update from "~31" to the audited figure.
2. **Police "FY18" baseline.** The testimony says "reduced from 32 to 30 over two years" implying FY24-FY26 is the window, not FY18-FY27. Verify: was Police sworn headcount also 32 in FY18? If so, the chart is consistent. If FY18 was different, the chart window needs to be clarified in the caption or the Police row adjusted.
3. **Fire count, if possible.** Search 2024-2026 FinCom Reports for Fire Department authorized strength; compare to FY18 to quantify "several" if feasible. If not, Fire stays as a callout.
4. **"All other" residual.** The ~130 figure should be verified against a FinCom report with full department-level headcount. If the real residual differs materially, disclose.

### Deferred to future iterations

- **Tooltip/hover overlay.** Showing source snippet on hover when a dot or row is hovered. Needs a pattern; other charts do this via the `data-chart-tooltip` JSON block and `assets/chart-tooltips.js`. Would add implementation cost but improves verifiability.
- **School-side companion chart with enrollment context.** Potentially a future chart pairing teacher FTE, total educator FTE, and enrollment over time, with explicit framing around the FY27 projected cuts (30 positions) that are *on top of* the enrollment-tracking cuts.
- **Timeline-of-cuts version.** Year-by-year chart showing when each position was lost. More informative but much higher implementation cost and data-collection burden.

### Potential pushback to anticipate

- "The town employee total was 199 in 2018 and 190 in 2026 but the starting date is selective, what about 2015 or 2010?" Fair pushback. Mitigation: caption explicitly states FY18 baseline is from Kezer's March 2026 public statement, not chosen by the site. If an earlier baseline becomes available and tells a different story, we revisit.
- "Engineering Dept functions were absorbed by DPW, not eliminated." The chart should make this clear, the row sentence already says "absorbed into DPW." The positions are nonetheless gone (budget zeroed); this is disclosed, not hidden.
- "Community Development was a new department (created FY26), you can't count the FY27 reduction as a cut if the dept didn't exist before." Verify the FY18 baseline: was there a planning office with 4 staff in FY18, or did those 4 positions arrive with the FY26 department creation? If the latter, the row needs reframing or removal. This is the single highest-risk accuracy question in the chart.

## Acceptance criteria

The chart is ready to ship when:

1. Every FY18 and FY27 number is either cited to a primary source or disclosed as an approximation in the caption.
2. The chart renders cleanly on a 375px-wide screen without horizontal scroll.
3. STYLE_GUIDE rules are verified: no green/red, no editorial language in captions, no em-dashes, no inline `style=""`, numbers traceable.
4. The chart works without JavaScript.
5. The parent page (`what-has-the-town-done.html`) has a link to the chart in the `#staffing` section.
6. The school-side pointer paragraph and link to `charts/enrollment_vs_staffing.html` is present under the chart.
7. The Community Development FY18 baseline question (from "Potential pushback") is resolved one way or the other: either the row stays with confirmed FY18 headcount, or it is reframed/removed.
