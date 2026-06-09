# Post-election site redesign &ndash; design & handoff

**Status:** Design. Polls close 2026-06-09 8pm ET. Implementation begins after results.
**Date:** 2026-06-09
**Brainstormed with user:** Andrew Baber, this session.

## Goal

Strip override-season scaffolding from the site, leaving the long-term
civic-data resource underneath. Cut ~50 pages to ~25. Establish four
durable pillars (Primer / Checkbook / Data / Meetings / Act) and a
single condensed FY27-override archive. Treatment is outcome-agnostic:
the IA does not change whether the override passes or fails. The
result itself becomes a recap section inside the archive.

## Non-goals

- This spec does not write the FY27-override archive content; only its
  URL, scope, and the pages it absorbs.
- This spec does not redesign individual surviving pages (e.g.
  `how-we-got-here`, `inside-school-staffing`). Each will get its own
  edit pass as part of execution, but content rewrites are out of
  scope here.
- This spec does not change anything inside `/marblehead-101/`, which
  was just redesigned (2026-06-08-marblehead-101-design.md).
- This spec does not touch the `meetings.html` page, the
  `/subscribe/` flow, the meeting-digest worker, or `/me/subscription/`.
  All survive intact.
- No work on the homepage scrolling-infographic *until* the four
  pillars and the Checkbook permalink exist; the new homepage assumes
  them.

## Final information architecture

### Nav

```
Primer  ·  Checkbook  ·  Data  ·  Meetings  ·  Act
```

Five items, down from the current six (`Primer · Ballot · Candidates ·
Questions · Browse · Subscribe`). Subscribe moves to a button inside
`/meetings/` (it is the call-to-action of that pillar, not a peer).

### Top-level pages: 50 → ~25

**11 content pages + 4 infra pages + 9 primer chapters + 5 charts + 3 apps.**

#### The 11 content pages (top-level)

| File | Role | Notes |
|---|---|---|
| `index.html` | Homepage | Full rewrite. Checkbook hero + 5 pillar tiles. |
| `what-can-we-do.html` | Act pillar landing | Keep as-is. Also becomes the engagement surface formerly held by community-pulse reactions. |
| `meetings.html` | Meetings pillar landing | Unchanged. Subscribe CTA inside. |
| `subscribe.html` | Signup permalink | Keep. Thin landing &mdash; shareable URL, not content. |
| `checkbook.html` | Checkbook pillar landing | **Moved** from `/charts/checkbook.html` &rarr; `/checkbook/`. Add `permalink: /checkbook/`. Old URL 301s. |
| `town-debt.html` | Featured data page | Already long-form, recently shipped. Linked from homepage + `/data/` hub. |
| `town-finances.html` | Merged data page | Merge of `town-budget.html` (FY27 line-item explorer) + `where-has-the-money-gone.html` (FY15-FY26 historical analysis). **Implementer should reconsider:** these have different purposes (interactive tool vs. historical narrative). If the merge creates a Frankenstein, keep them split and update this spec. |
| `inside-school-staffing.html` | School-side data | Already absorbed `town-school-admin.html` per earlier cycle; keep. |
| `senior-tax-relief.html` | Live policy page | Probationary: H.4225 in committee. Re-evaluate Q1 2027 once bill resolves; either keep or fold into a primer note. |
| `how-we-got-here.html` | Long-form narrative | Absorbs `what-has-the-town-done.html`, `why-not-elsewhere.html`, `fiscal-goals.html`. |
| `2026-override/index.html` | FY27 override archive | New page. Single URL holding the whole cycle. See "Override condensation" below. |

#### The 4 infra pages

`about.html`, `verify.html`, `privacy.html`, `404.html`. Unchanged.

#### Hubs (folder index pages)

| Folder | Role |
|---|---|
| `/marblehead-101/` | Primer hub (already exists, 8 chapters + index) |
| `/data/` | Data hub. Rename from `browse.html` to `data/index.html` with `permalink: /data/`. Old `/browse.html` 301s. Lays out the data pages above + the surviving charts. |
| `/2026-override/` | Single page; folder URL for cleanliness. |
| `/charts/` | No longer a hub. Individual charts continue to live here but are linked only from `/data/`. |

#### Charts (5 surviving)

`charts/town_explorer.html`, `charts/enrollment_vs_staffing.html`,
`charts/general_government_over_time.html`, `charts/budget_flow.html`,
`charts/override_history.html`.

`charts/checkbook.html` is **not** in this list because it is being
promoted out of `/charts/` to its own permalink at `/checkbook/`.

#### Apps (unchanged)

`/meetings/`, `/subscribe/` (+ `/subscribe/confirm/`), `/me/subscription/`.

### Pillar &rarr; URL map

| Pillar | URL | Hub or page? |
|---|---|---|
| Primer | `/marblehead-101/` | Folder hub, 8 chapters |
| Checkbook | `/checkbook/` | Single page (the spending explorer) |
| Data | `/data/` | Folder hub with 6 pages + 4 charts |
| Meetings | `/meetings/` | App; Subscribe button inside |
| Act | `/what-can-we-do.html` | Single page |

## Page disposition matrix

### Delete outright (campaign-only scaffolding)

Pages whose entire purpose was the FY27 cycle, with no permanent
value:

`whats-on-the-ballot.html`, `where-candidates-stand.html`,
`what-is-the-override.html`, `two-votes.html`, `cap-vs-cost.html`,
`your-true-cost.html`, `no-override-budget.html`, `the-debate.html`,
`explore.html`, `super-summary.html`, `bias-audit.html`,
`what-you-can-do.html` (dupe of `what-can-we-do`), `info-guides.html`,
`question-2-trash.html`, `prop25-story.html`, `after-the-no-vote.html`.

Sixteen pages deleted. Any salvageable content folds into either the
`/2026-override/` archive (FY27-specific) or
`/marblehead-101/07-overrides.html` (timeless mechanics) before
deletion. `prop25-story` Prop-2.5 history specifically goes into the
primer chapter lead-in.

### Delete charts (14 of 20)

**Delete:** `override_calculator`, `override_landscape`,
`statewide_overrides`, `deficit_model`, `sustainability`,
`peer_compensation`, `four_town_rates`, `rate_value_schools`,
`statewide_tax_burden`, `tax_comparison`, `per_capita_levy`,
`levy_vs_bill`, `healthcare_costs`, `your_tax_bill`.

**Keep, stays under `/charts/` (5):** `town_explorer`,
`enrollment_vs_staffing`, `general_government_over_time`, `budget_flow`,
`override_history`.

**Keep, promoted out of `/charts/` (1):** `checkbook` &rarr; `/checkbook/`.

Total surviving chart files: 6 (5 in `/charts/` + 1 promoted).

### Fold (content moves, URL retires)

| Page | Folds into | What survives |
|---|---|---|
| `fiscal-goals.html` | `/marblehead-101/06-why-the-gap-keeps-coming-back.html` | The three measurable milestones as a sidebar in that chapter. |
| `what-has-the-town-done.html` | `how-we-got-here.html` | The cost-control inventory as a section. |
| `why-not-elsewhere.html` | `how-we-got-here.html` | The revenue-alternatives walkthrough as a section. |
| `town-school-admin.html` | `inside-school-staffing.html` | Already done in prior cycle; verify. |
| `town-budget.html` | `town-finances.html` (new merge) | Year-in-context section. |
| `where-has-the-money-gone.html` | `town-finances.html` (new merge) | Historical trends section. |
| `marblehead-voting-record.html` | `/2026-override/index.html` | History-of-overrides section, anchoring the chart. |
| `topics.html` | `/meetings/` | Already a meetings sub-view; fix any standalone link. |
| `branches.html` | `/me/` or `/verify/` | Verification-network internal; minor. |
| `feedback.html` | Footer link only | Replace page with a single "Report an error / suggest a fix" GitHub-issue link in the site footer. |

### Mothball (code stays, surface area hides)

**`/community-pulse/`** &mdash; reactions app. Hide:

- Remove the worker invocation script from `_includes/scripts.html`
  (or wherever it is loaded).
- Strip `community_pulse:` frontmatter from surviving pages.
- Leave the worker, the `/community-pulse/` directory, and its tests
  in place. Cheaper to revive than to rebuild.

## Override condensation

Three surviving slots, down from ~15 override-related pages:

### 1. `/2026-override/` (single-page archive)

The FY27 cycle in one searchable, citable, linkable URL. Sections
(content TBD in execution):

1. **The ballot.** Two questions, the tier structure ($X = $Y/household at $Z assessed value).
2. **The candidates.** Compressed from `where-candidates-stand`.
3. **The debate.** Compressed from `the-debate.html`. Both sides on each dividing line, as the historical record of how residents disagreed.
4. **The history.** Absorbs `marblehead-voting-record.html` and
   `after-the-no-vote.html`. 2022 / 2023 / 2026 votes in one timeline
   with consequences.
5. **The result.** Vote totals, turnout, precinct splits (filled in
   after 8pm).
6. **What happened next.** Filled in over the weeks following the
   vote; replaces `no-override-budget.html` if the vote failed, or
   tracks the rollout if it passed.

### 2. `/marblehead-101/07-overrides.html`

Already exists (part of the recent primer redesign). Stays as the
timeless "how overrides work" chapter. **Edit:** absorb `prop25-story`
statewide-history content into the chapter lead-in so Prop 2.5 is
taught properly.

### 3. `/charts/override_history.html`

Marblehead overrides 1981 &ndash; 2026 chart. Lives under `/data/`, not
promoted on homepage. Evergreen civic data.

## Homepage redesign

Option B from brainstorming: Checkbook hero + five pillar tiles.

**Hero block (above the fold):**

- A large town-spending number (e.g. "$98.1M paid through May 29" from
  the FY26 Checkbook digest). Tabular-nums, clamp(64px, 12vw, 144px),
  similar treatment to the current `home-big`.
- One-line caption underneath: what the number is and why it matters.
- "Open the Checkbook" CTA linking to `/checkbook/`.

**Tile block (below the fold):**

Five equal tiles, one per pillar:

1. Primer &rarr; `/marblehead-101/`
2. Checkbook &rarr; `/checkbook/` (also linked from the hero)
3. Data &rarr; `/data/`
4. Meetings &rarr; `/meetings/`
5. Act &rarr; `/what-can-we-do.html`

Each tile carries a one-line description and the eyebrow label
treatment from the existing homepage. No additional editorial copy
below the tiles. The homepage's job is to route, not to argue.

**Out of scope for this spec:**

- Exact wording of tile captions.
- Whether the Checkbook number is FY26 or rotates with the fiscal year.
- Any "Today in Marblehead" / latest-digest module (could be a later
  enhancement).

## Permalink + redirect changes

| Old URL | New URL | Mechanism |
|---|---|---|
| `/charts/checkbook.html` | `/checkbook/` | `permalink: /checkbook/` in frontmatter; keep `_redirects` or equivalent for the old path. |
| `/browse.html` | `/data/` | Move file to `data/index.html` with `permalink: /data/`; redirect from `/browse.html`. |

All deleted pages get redirects to a sensible parent:

- All override-detail pages &rarr; `/2026-override/`.
- `prop25-story.html` &rarr; `/marblehead-101/07-overrides.html`.
- `info-guides.html`, `super-summary.html`, `bias-audit.html` &rarr;
  `/2026-override/`.
- `what-you-can-do.html` &rarr; `/what-can-we-do.html`.
- `question-2-trash.html` &rarr; `/2026-override/`.
- `topics.html` &rarr; `/meetings/`.
- `branches.html` &rarr; `/verify/`.
- `feedback.html` &rarr; GitHub issues link (external) or `/about/`.
- All deleted `/charts/*` &rarr; `/data/`.

Redirects via `404.html` JS or a `_redirects` file, whichever the
current build supports.

## Implementation order (suggested, not part of this spec)

The execution plan (writing-plans next) will decide the exact
ordering, but a sketch:

1. **Permalink/redirect plumbing** &mdash; move Checkbook to `/checkbook/`,
   rename `browse.html` &rarr; `data/index.html`, wire all 301s. Site
   keeps working while content shifts behind.
2. **Build `/2026-override/index.html`** &mdash; the new archive, populated
   with salvaged content from the doomed pages. Once it exists, the
   redirects have a destination.
3. **Fold content** into `how-we-got-here`, `town-finances` (new),
   `inside-school-staffing`, `/marblehead-101/06-` and `/07-`.
4. **Delete** the 16 campaign pages + 14 dead charts.
5. **Mothball** community-pulse: strip frontmatter, drop the loader.
6. **Nav rewrite** in `_includes/nav.html` to the five-item layout.
7. **Homepage rewrite** with the Checkbook hero + tiles.
8. **Footer cleanup**: add GitHub-issues link, kill the `/feedback`
   page.

## Open questions deferred to execution

- Are there inbound links to deleted pages from Marblehead Current,
  Facebook, etc. that need preservation beyond a 301? Survey before
  deleting.
- Does the existing search index (`search.html` or equivalent) need
  to be rebuilt after the cull? Likely yes.
- Does sitemap.xml need a regen pass? Likely yes (Jekyll handles
  most of it, but the redirects matter).
- The `2026-04-11-debate-page-design.md` spec built `the-debate.html`;
  this redesign deprecates it. Worth noting in that older spec that
  it has been superseded?

## Success criteria

- Top-level HTML files drop from 39 to ~15.
- `/charts/` drops from 20 files to 5.
- Override content lives in 3 URLs total, not 15.
- Nav has 5 items, not 6.
- Homepage no longer mentions ballot questions or candidates.
- All deleted-page URLs return a 301 to a meaningful destination, not
  a 404.
- Site search (if indexed) reflects only surviving pages.
- No surviving page has `community_pulse:` frontmatter.
