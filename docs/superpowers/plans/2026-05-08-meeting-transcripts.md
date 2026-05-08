# Meeting Transcripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a nightly pipeline that turns MHTV public-meeting videos into searchable, summarized, topic-tagged transcript pages on marbleheaddata.org.

**Architecture:** A Hetzner systemd timer runs a Node script: refresh `data/meetings.json` via existing `pull_meetings.mjs` → diff against `_transcripts/` → for each new meeting, `yt-dlp` audio → AssemblyAI universal-2 (with `speaker_labels=true`) → Claude Sonnet 4.6 for summary + topic-tagged segments → write `_transcripts/<slug>.md` with all structured data in YAML frontmatter → open a PR via `gh`. Reviewer merges; Jekyll renders three surfaces (chronological feed, topic pages, full transcript page); Pagefind indexes everything for free.

**Tech Stack:** Node 24 ESM, `node:test`, AssemblyAI HTTP API (universal-2 model), `@anthropic-ai/sdk` (already a project dep), Jekyll 3.10, Pagefind, `yt-dlp`, `ffmpeg`, `gh` CLI, systemd.

**Spec:** `docs/superpowers/specs/2026-05-08-meeting-transcripts-design.md`

---

## File structure overview

```
scripts/transcripts/
  README.md                            usage docs
  transcribe.mjs                       CLI orchestrator
  lib/
    config.mjs                         constants, paths, board map
    config.test.mjs
    discovery.mjs                      diff meetings.json vs _transcripts/
    discovery.test.mjs
    audio.mjs                          yt-dlp wrapper
    audio.test.mjs
    assemblyai.mjs                     AAI HTTP client
    assemblyai.test.mjs
    summarize.mjs                      Claude prompt + client
    summarize.test.mjs
    render.mjs                         data → frontmatter+md
    render.test.mjs
    pr.mjs                             branch / commit / gh pr create
  prompts/
    summary.md                         LLM prompt template
  fixtures/
    aai_response.json                  AAI utterances fixture
    summary_response.json              Claude structured output fixture
    meetings_sample.json               pull_meetings.mjs output sample

data/
  topic_seeds.json                     12 fixed topic slugs + descriptions
  transcripts_proposed_topics.json     accumulator (starts as `[]`)
  transcripts_failures.json            failure log (starts as `[]`)

_transcripts/                          Jekyll collection dir
  .gitkeep

_layouts/
  transcript.html                      per-meeting page

_includes/
  meeting-card.html                    summary-card partial

meetings.html                          /meetings/ chronological feed
topics.html                            /topics/ index of all topics
topics/                                one page per seed topic
  override.html
  school-budget.html
  ... (12 files)

assets/
  transcripts.css                      page styling

hetzner/
  transcribe-meetings.service          systemd unit (committed, deployed by box owner)
  transcribe-meetings.timer

_config.yml                            add `_transcripts` collection + permalinks
package.json                           add `transcribe` and `test:transcripts` scripts
```

---

## Phase 1 — UI scaffolding (Tasks 1–7)

**End of phase: a single hand-crafted transcript renders end-to-end on the site, with /meetings/ and /topics/override/ working.** This validates layouts before the pipeline exists. Ships as PR #1.

### Task 1: Topic seeds file

**Files:**
- Create: `data/topic_seeds.json`

- [ ] **Step 1: Create the seed list**

```json
[
  { "slug": "override",            "title": "Override / Prop 2½ / fiscal",     "description": "Override votes, the 2½ levy cap, structural deficits, FY27 budget gap." },
  { "slug": "school-budget",       "title": "School budget",                    "description": "Marblehead Public Schools finance, staffing, FY budgets, MPS-specific operations." },
  { "slug": "40b-mbta",            "title": "Housing / 40B / MBTA Communities", "description": "Comprehensive permits, 40B projects, MBTA Communities Act 3A compliance." },
  { "slug": "bonding-capital",     "title": "Bonds and capital plan",           "description": "Bond sales, capital improvement plan, debt service, infrastructure financing." },
  { "slug": "trash-dpw",           "title": "Trash and DPW",                    "description": "Solid waste collection, recycling, DPW operations, public works contracts." },
  { "slug": "labor-personnel",     "title": "Labor and personnel",              "description": "Union contracts, hiring, terminations, personnel policy, executive sessions about same." },
  { "slug": "public-comment",      "title": "Public comment",                   "description": "Public comment periods open to residents at any board meeting." },
  { "slug": "permits-zoning",      "title": "Permits and zoning",               "description": "Zoning Board of Appeals, Planning Board, Conservation Commission, license renewals." },
  { "slug": "public-safety",       "title": "Public safety",                    "description": "Police, fire, harbormaster, emergency management, public safety policy." },
  { "slug": "recreation-events",   "title": "Recreation and events",            "description": "Rec department, parks, harbor, town events, festivals, parade approvals." },
  { "slug": "elections-procedural","title": "Elections and procedural",         "description": "Town clerk operations, ballot questions, election procedures, warrant articles." },
  { "slug": "admin-housekeeping",  "title": "Admin and housekeeping",           "description": "Reading and approving prior minutes, future agenda items, board self-administration." }
]
```

- [ ] **Step 2: Validate it parses**

```bash
node -e "console.log(JSON.parse(require('node:fs').readFileSync('data/topic_seeds.json','utf8')).length, 'topics loaded')"
```

Expected: `12 topics loaded`

- [ ] **Step 3: Commit**

```bash
git add data/topic_seeds.json
git commit -m "transcripts: add 12-topic seed taxonomy"
```

---

### Task 2: Empty accumulator files

**Files:**
- Create: `data/transcripts_proposed_topics.json`
- Create: `data/transcripts_failures.json`
- Create: `_transcripts/.gitkeep`

- [ ] **Step 1: Create empty arrays**

```bash
echo '[]' > data/transcripts_proposed_topics.json
echo '[]' > data/transcripts_failures.json
mkdir -p _transcripts
touch _transcripts/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add data/transcripts_proposed_topics.json data/transcripts_failures.json _transcripts/.gitkeep
git commit -m "transcripts: scaffold accumulator files and collection dir"
```

---

### Task 3: Jekyll collection config

**Files:**
- Modify: `_config.yml`

- [ ] **Step 1: Add the collection block**

Find the line in `_config.yml` that defines `defaults:` (around line 14 based on the `head -40` survey done during planning). Above it, add:

```yaml
collections:
  transcripts:
    output: true
    permalink: /meetings/:path/
```

And in the existing `defaults:` block, append:

```yaml
  - scope:
      path: ""
      type: transcripts
    values:
      layout: transcript
      community_pulse: off-sections
```

(The `community_pulse: off-sections` matches what charts use; it suppresses reaction widgets per `feedback_no_reactions_on_contested.md`.)

- [ ] **Step 2: Verify Jekyll picks up the collection**

```bash
bundle exec jekyll build 2>&1 | grep -i "transcripts\|done in" | head
```

Expected: clean build, no errors, `done in N seconds.`

- [ ] **Step 3: Commit**

```bash
git add _config.yml
git commit -m "transcripts: add _transcripts Jekyll collection at /meetings/:slug/"
```

---

### Task 4: Transcript layout (minimal)

**Files:**
- Create: `_layouts/transcript.html`
- Create: `assets/transcripts.css`
- Modify: `_layouts/default.html` (only if `transcripts.css` not auto-loaded; otherwise skip)

- [ ] **Step 1: Inspect default layout to know how to extend**

```bash
head -40 _layouts/default.html
```

- [ ] **Step 2: Create `_layouts/transcript.html`**

```html
---
layout: default
---
<article class="transcript-page">
  <header class="transcript-header">
    <p class="transcript-board">{{ page.board_display }}</p>
    <h1>{{ page.title }}</h1>
    <p class="transcript-meta">
      <time datetime="{{ page.date }}">{{ page.date | date: "%B %-d, %Y" }}</time>
      &middot;
      <a href="{{ page.vimeo_url }}" rel="noopener">Source video on MHTV &rarr;</a>
    </p>
    <p class="ai-disclaimer">
      Transcript and summary generated by AI. May contain errors.
      Verify against the source video before quoting.
    </p>
  </header>

  {% if page.summary_card %}
  <section class="summary-card">
    <h2 class="visually-hidden">Summary</h2>
    <p class="summary-headline"><strong>{{ page.summary_card.headline }}</strong></p>
    <p class="summary-body">{{ page.summary_card.summary }}</p>
    {% if page.summary_card.decisions %}
    <h3>Decisions</h3>
    <ul>
      {% for d in page.summary_card.decisions %}<li>{{ d }}</li>{% endfor %}
    </ul>
    {% endif %}
    {% if page.summary_card.votes %}
    <h3>Votes</h3>
    <ul>
      {% for v in page.summary_card.votes %}
      <li><strong>{{ v.motion }}</strong> &mdash; {{ v.result }}</li>
      {% endfor %}
    </ul>
    {% endif %}
  </section>
  {% endif %}

  {% if page.topic_segments and page.topic_segments.size > 0 %}
  <aside class="topic-sidebar" aria-label="Topics covered">
    <h2>Topics covered</h2>
    <ul>
      {% for seg in page.topic_segments %}
      <li>
        <a href="/topics/{{ seg.topic }}/">{{ seg.topic }}</a>
        <span class="seg-time">{{ seg.start_seconds | divided_by: 60 }}:{{ seg.start_seconds | modulo: 60 | prepend: '00' | slice: -2, 2 }}</span>
        &mdash; {{ seg.summary }}
        <a class="seg-jump" href="{{ page.vimeo_url }}#t={{ seg.start_seconds }}s">watch &rarr;</a>
      </li>
      {% endfor %}
    </ul>
  </aside>
  {% endif %}

  <section class="transcript-body">
    <h2>Full transcript</h2>
    {{ content }}
  </section>
</article>
```

(The em-dash entities here are `&mdash;` Liquid output, not literal em-dashes in source — site copy rule is satisfied because the entity renders to em-dash in browser but source stays plain ASCII.)

- [ ] **Step 3: Create `assets/transcripts.css`**

```css
.transcript-page { max-width: 760px; margin: 0 auto; padding: 1rem; }
.transcript-board { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted, #555); margin: 0; }
.transcript-meta { color: var(--ink-muted, #555); }
.ai-disclaimer { background: #fff8e1; border-left: 3px solid #f0b400; padding: 0.6rem 0.9rem; font-size: 0.9rem; }
.summary-card { background: #f6f8fa; border-radius: 6px; padding: 1rem 1.2rem; margin: 1.5rem 0; }
.summary-headline { font-size: 1.1rem; }
.topic-sidebar { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; margin: 1.5rem 0; }
.topic-sidebar ul { list-style: none; padding: 0; }
.topic-sidebar li { margin-bottom: 0.7rem; line-height: 1.4; }
.seg-time { font-variant-numeric: tabular-nums; color: var(--ink-muted, #555); margin-right: 0.4rem; }
.transcript-body p { line-height: 1.6; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

- [ ] **Step 4: Verify the layout exists; build still passes**

```bash
bundle exec jekyll build 2>&1 | tail -3
```

Expected: `done in N seconds.`

- [ ] **Step 5: Commit**

```bash
git add _layouts/transcript.html assets/transcripts.css
git commit -m "transcripts: add transcript layout and styles"
```

---

### Task 5: Hand-crafted sample transcript end-to-end

**Why:** before building the pipeline, prove the layout renders real content. Uses the verified output from the AssemblyAI POC against the 4-22-26 Select Board meeting.

**Files:**
- Create: `_transcripts/select-board-2026-04-22.md`

- [ ] **Step 1: Create the sample file**

```markdown
---
layout: transcript
slug: select-board-2026-04-22
board: select-board
board_display: "Select Board"
date: 2026-04-22
title: "Select Board: April 22, 2026"
vimeo_id: 1185906675
vimeo_url: "https://vimeo.com/1185906675"
duration_seconds: 2969
ai_generated: true
status: published

summary_card:
  headline: "Approved $24.9M GO bond sale to Oppenheimer"
  summary: >
    The Select Board approved the sale of $24,975,000 in general obligation
    bonds to Oppenheimer Co. at a price of $26,402,202. Funds cover roads,
    sidewalks, the high school roof and HVAC, Mary Alley HVAC and ADA
    improvements, Abbot Public Library renovations, the Mary Alley roof,
    Franklin Street fire station roof, and IT equipment. The board also
    authorized SEC Rule 15c2-12 disclosure procedures and ratified the
    official statement.
  decisions:
    - "Approved sale of $24,975,000 GO bonds to Oppenheimer Co. Inc."
    - "Authorized SEC Rule 15c2-12 continuing-disclosure undertaking"
    - "Ratified preliminary and final official statements"
  votes:
    - motion: "Approve bond sale"
      result: "in favor (unanimous)"

topic_segments:
  - topic: bonding-capital
    topic_confidence: 0.95
    start_seconds: 600
    end_seconds: 960
    summary: "Bond sale closing, motions, and SEC disclosure procedures."
    key_speakers: ["Speaker A (bond agent)", "Speaker C (chair)"]

ingest:
  transcribed_at: "2026-05-08T13:00:00Z"
  assemblyai_id: "e85994e3-e1b5-402e-9d2d-5d99d63e4675"
  speech_model: "universal-2"
  speech_model_cost_usd: 0.027
  source: "hand-crafted-sample"
---

> Note: this is a 6-minute sample of the meeting (10:00–16:00), not the full
> 49-minute recording. The pipeline produces full-meeting transcripts; this
> hand-crafted sample exists to validate the layout.

[ 0:10:00 ] **Speaker A** (bond agent, name not identified):
Public safety, education, accessibility, technology and library services
as follows. We have roads and sidewalks at $9,098,250. We have the high
school roof and HVAC at $8,441,500. The Mary Alley HVAC and ADA
improvements sitting at $5,637,450. Abbot Public Library renovations at
$941,050. And the Mary Alley building roof replacement, $451,550. The
Franklin Street fire station roof and gutter replacement, $123,450. And
then IT equipment and software, $281,750. For that total of $24,975,000.

[ 0:10:53 ] **Speaker C** (board chair):
Any questions from the board?

[ 0:11:13 ] **Speaker C**:
So may I have a motion that the sale of the $24,975,000 general
obligation municipal purpose loan of 2026 bonds of the town, dated May
14, 2026, to Oppenheimer Co. Incorporated at the price of $26,402,202
and accrued interest, if any, is hereby approved and confirmed.

[ 0:13:00 ] **Speaker B** (board member):
So moved. Second.

[ 0:13:05 ] **Speaker C**:
Mr. Fox? In favor. Mr. Krieger? In favor.

(Truncated sample — full transcript will be produced by the pipeline.)
```

- [ ] **Step 2: Build and inspect**

```bash
bundle exec jekyll build && ls _site/meetings/select-board-2026-04-22/index.html
```

Expected: `_site/meetings/select-board-2026-04-22/index.html` exists.

- [ ] **Step 3: Spot-check the rendered HTML**

```bash
grep -i "summary\|approved\|topic" _site/meetings/select-board-2026-04-22/index.html | head -10
```

Expected: contains the headline, decisions, topic link.

- [ ] **Step 4: Commit**

```bash
git add _transcripts/select-board-2026-04-22.md
git commit -m "transcripts: add hand-crafted sample to validate layout"
```

---

### Task 6: Chronological feed page

**Files:**
- Create: `meetings.html`
- Create: `_includes/meeting-card.html`

- [ ] **Step 1: Create the card include**

```html
{%- comment -%}Renders one summary card. Param: card.{%- endcomment -%}
<article class="meeting-card">
  <header>
    <p class="card-board">{{ card.board_display }}</p>
    <h3><a href="{{ card.url }}">{{ card.title }}</a></h3>
    <p class="card-date"><time datetime="{{ card.date }}">{{ card.date | date: "%B %-d, %Y" }}</time></p>
  </header>
  {% if card.summary_card.headline %}
    <p class="card-headline"><strong>{{ card.summary_card.headline }}</strong></p>
  {% endif %}
  {% if card.summary_card.summary %}
    <p class="card-summary">{{ card.summary_card.summary | truncate: 280 }}</p>
  {% endif %}
  {% if card.topic_segments and card.topic_segments.size > 0 %}
    <ul class="card-topics">
      {% for seg in card.topic_segments %}
        <li><a href="/topics/{{ seg.topic }}/">{{ seg.topic }}</a></li>
      {% endfor %}
    </ul>
  {% endif %}
</article>
```

- [ ] **Step 2: Create `meetings.html`**

```html
---
layout: page
title: Meetings
permalink: /meetings/
---

<p class="page-intro">
  AI-generated transcripts and summaries of public board and committee
  meetings, sourced from MHTV. Filter by board.
</p>

{% assign sorted = site.transcripts | sort: 'date' | reverse %}

<nav class="board-filter" aria-label="Filter by board">
  <a href="/meetings/" class="board-filter-active">All</a>
  {% assign boards = sorted | map: 'board' | uniq | sort %}
  {% for b in boards %}
    <a href="#{{ b }}">{{ b | replace: '-', ' ' | capitalize }}</a>
  {% endfor %}
</nav>

<section class="meetings-feed">
  {% for t in sorted %}
    {% include meeting-card.html card=t %}
  {% endfor %}
</section>
```

(The board filter uses anchor links to subsections; for v1 we keep it
simple and don't rebuild as JS-filtered. Each board can later become its
own page.)

- [ ] **Step 3: Build and verify**

```bash
bundle exec jekyll build && grep -c "meeting-card" _site/meetings/index.html
```

Expected: at least 1 (the hand-crafted sample).

- [ ] **Step 4: Commit**

```bash
git add meetings.html _includes/meeting-card.html
git commit -m "transcripts: add /meetings/ chronological feed"
```

---

### Task 7: One example topic page + topic index

**Files:**
- Create: `topics.html`
- Create: `topics/override.html`
- Create: `topics/school-budget.html` (placeholder, for parity)
- Create: `topics/bonding-capital.html`

We create three to prove the pattern. The remaining 9 are added in Task 8 once we know the template is right.

- [ ] **Step 1: Create `topics.html`**

```html
---
layout: page
title: Topics
permalink: /topics/
---

<p class="page-intro">
  Topic pages aggregate every mention across meetings. Click in to see
  every time it came up, who said what, and a one-click jump to the
  source video.
</p>

{% assign seeds = site.data.topic_seeds %}
<ul class="topic-index">
{% for t in seeds %}
  <li>
    <h3><a href="/topics/{{ t.slug }}/">{{ t.title }}</a></h3>
    <p>{{ t.description }}</p>
  </li>
{% endfor %}
</ul>
```

(`site.data.topic_seeds` reads `data/topic_seeds.json` — Jekyll auto-loads
files in `data/` whose name doesn't conflict with `_data/`. This project
uses `data/` for primary sources and Jekyll picks them up because
`data/` is not in `_config.yml`'s `exclude` list.)

- [ ] **Step 2: Create `topics/override.html`**

```html
---
layout: page
title: "Topic: Override / Prop 2½ / fiscal"
permalink: /topics/override/
topic_slug: override
---

{% assign seeds = site.data.topic_seeds | where: "slug", page.topic_slug %}
{% assign topic = seeds[0] %}

<p class="page-intro">{{ topic.description }}</p>

{% comment %}Collect every (transcript, segment) pair tagged with this topic.{% endcomment %}
{% assign hits = "" | split: "" %}
{% for t in site.transcripts %}
  {% for seg in t.topic_segments %}
    {% if seg.topic == page.topic_slug %}
      {% capture row %}{{ t.date }}|{{ t.url }}|{{ t.title }}|{{ seg.start_seconds }}|{{ seg.end_seconds }}|{{ seg.summary }}|{{ t.vimeo_url }}{% endcapture %}
      {% assign hits = hits | push: row %}
    {% endif %}
  {% endfor %}
{% endfor %}

{% if hits.size == 0 %}
  <p class="topic-empty">No segments tagged with this topic yet. Check back as new meeting transcripts are published.</p>
{% else %}
  <ul class="topic-feed">
    {% assign hits_sorted = hits | sort | reverse %}
    {% for h in hits_sorted %}
      {% assign parts = h | split: "|" %}
      <li>
        <p class="th-date"><time>{{ parts[0] | date: "%B %-d, %Y" }}</time> &middot; <a href="{{ parts[1] }}">{{ parts[2] }}</a></p>
        <p class="th-summary">{{ parts[5] }}</p>
        <p class="th-jump"><a href="{{ parts[6] }}#t={{ parts[3] }}s">Jump to this segment in the source video &rarr;</a></p>
      </li>
    {% endfor %}
  </ul>
{% endif %}
```

- [ ] **Step 3: Create `topics/school-budget.html` and `topics/bonding-capital.html`**

These are identical to `override.html` but with different `title`, `permalink`, and `topic_slug` frontmatter. Copy `topics/override.html` twice and edit the three frontmatter fields.

For `topics/school-budget.html`:
```
title: "Topic: School budget"
permalink: /topics/school-budget/
topic_slug: school-budget
```

For `topics/bonding-capital.html`:
```
title: "Topic: Bonds and capital plan"
permalink: /topics/bonding-capital/
topic_slug: bonding-capital
```

- [ ] **Step 4: Build and verify**

```bash
bundle exec jekyll build && \
  ls _site/topics/index.html _site/topics/override/index.html _site/topics/bonding-capital/index.html && \
  grep -c "Bond sale closing" _site/topics/bonding-capital/index.html
```

Expected: all 3 files exist; count of "Bond sale closing" in bonding-capital page = 1 (the sample's segment summary).

- [ ] **Step 5: Commit**

```bash
git add topics.html topics/override.html topics/school-budget.html topics/bonding-capital.html
git commit -m "transcripts: add topics index and 3 example topic pages"
```

---

### Task 8: Remaining 9 topic pages

**Files:**
- Create: `topics/40b-mbta.html`, `topics/trash-dpw.html`, `topics/labor-personnel.html`, `topics/public-comment.html`, `topics/permits-zoning.html`, `topics/public-safety.html`, `topics/recreation-events.html`, `topics/elections-procedural.html`, `topics/admin-housekeeping.html`

- [ ] **Step 1: Stamp out the 9 files**

Each is structurally identical to `topics/override.html` (same Liquid logic). Only frontmatter differs. From the seeds in `data/topic_seeds.json`, the mapping is:

| File | title | permalink | topic_slug |
|---|---|---|---|
| `topics/40b-mbta.html` | `"Topic: Housing / 40B / MBTA Communities"` | `/topics/40b-mbta/` | `40b-mbta` |
| `topics/trash-dpw.html` | `"Topic: Trash and DPW"` | `/topics/trash-dpw/` | `trash-dpw` |
| `topics/labor-personnel.html` | `"Topic: Labor and personnel"` | `/topics/labor-personnel/` | `labor-personnel` |
| `topics/public-comment.html` | `"Topic: Public comment"` | `/topics/public-comment/` | `public-comment` |
| `topics/permits-zoning.html` | `"Topic: Permits and zoning"` | `/topics/permits-zoning/` | `permits-zoning` |
| `topics/public-safety.html` | `"Topic: Public safety"` | `/topics/public-safety/` | `public-safety` |
| `topics/recreation-events.html` | `"Topic: Recreation and events"` | `/topics/recreation-events/` | `recreation-events` |
| `topics/elections-procedural.html` | `"Topic: Elections and procedural"` | `/topics/elections-procedural/` | `elections-procedural` |
| `topics/admin-housekeeping.html` | `"Topic: Admin and housekeeping"` | `/topics/admin-housekeeping/` | `admin-housekeeping` |

For each: copy `topics/override.html`, edit those three frontmatter fields, save under the new filename.

- [ ] **Step 2: Verify all 12 topic pages build**

```bash
bundle exec jekyll build && ls _site/topics/*/index.html | wc -l
```

Expected: `12`

- [ ] **Step 3: Commit**

```bash
git add topics/*.html
git commit -m "transcripts: add remaining 9 topic pages from seed list"
```

---

### Task 9: Pagefind verification

**Why:** confirm the new transcript content is searchable on the live site. Pagefind already runs in `npm run build`.

**Files:**
- Modify: none (this task is verification only)

- [ ] **Step 1: Build with Pagefind**

```bash
npm run build 2>&1 | tail -10
```

Expected: completes without errors; final lines reference Pagefind indexing.

- [ ] **Step 2: Confirm transcripts are indexed**

```bash
grep -li "oppenheimer" _site/pagefind/index/*.pf_index 2>/dev/null | head -3 || \
  echo "Pagefind binary index — content check via search instead"
ls _site/pagefind/ | head
```

Expected: Pagefind directory exists with index files. (Binary index can't be grepped directly; the content presence is implicit from successful build.)

- [ ] **Step 3: No commit** (no source changes)

---

**End of Phase 1.** A reviewer can now load `/meetings/`, `/topics/`, `/topics/override/`, and `/meetings/select-board-2026-04-22/` and see real content. Open this as PR #1 against main; merging unblocks the pipeline phase.

---

## Phase 2 — Pipeline (Tasks 10–18)

**End of phase: a one-meeting end-to-end run produces a real PR.**

### Task 10: Pipeline directory + config module

**Files:**
- Create: `scripts/transcripts/lib/config.mjs`
- Create: `scripts/transcripts/lib/config.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/transcripts/lib/config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPIC_SLUGS, BOARD_SLUGS, paths, slugForMeeting } from './config.mjs';

test('TOPIC_SLUGS has all 12 seed topics', () => {
  assert.equal(TOPIC_SLUGS.length, 12);
  assert.ok(TOPIC_SLUGS.includes('override'));
  assert.ok(TOPIC_SLUGS.includes('admin-housekeeping'));
});

test('BOARD_SLUGS maps Vimeo title patterns to canonical slugs', () => {
  assert.equal(BOARD_SLUGS['Marblehead Select Board Meeting'], 'select-board');
  assert.equal(BOARD_SLUGS['Marblehead Finance Committee'], 'finance-committee');
  assert.equal(BOARD_SLUGS['Marblehead School Committee'], 'school-committee');
});

test('paths.transcriptsCollectionDir resolves to repo _transcripts', () => {
  assert.ok(paths.transcriptsCollectionDir.endsWith('_transcripts'));
});

test('slugForMeeting builds <board>-<YYYY-MM-DD>', () => {
  assert.equal(
    slugForMeeting({ board: 'select-board', date: '2026-04-22' }),
    'select-board-2026-04-22'
  );
});
```

- [ ] **Step 2: Run, see fail**

```bash
node --test scripts/transcripts/lib/config.test.mjs 2>&1 | tail -5
```

Expected: failure (file does not exist).

- [ ] **Step 3: Implement**

```js
// scripts/transcripts/lib/config.mjs
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

export const paths = {
  repoRoot: REPO_ROOT,
  meetingsJson: resolve(REPO_ROOT, 'data/meetings.json'),
  topicSeeds: resolve(REPO_ROOT, 'data/topic_seeds.json'),
  proposedTopics: resolve(REPO_ROOT, 'data/transcripts_proposed_topics.json'),
  failures: resolve(REPO_ROOT, 'data/transcripts_failures.json'),
  transcriptsCollectionDir: resolve(REPO_ROOT, '_transcripts'),
  promptsDir: resolve(__dirname, '../prompts'),
  audioTmpDir: '/tmp/marblehead-transcripts-audio',
};

export const TOPIC_SLUGS = JSON.parse(
  readFileSync(paths.topicSeeds, 'utf8')
).map(t => t.slug);

// Maps the start of MHTV Vimeo titles to canonical board slugs.
// Order matters: longer/more-specific matches first.
export const BOARD_SLUGS = {
  'Marblehead Select Board Meeting': 'select-board',
  'Marblehead Finance Committee': 'finance-committee',
  'Marblehead School Committee': 'school-committee',
  'Marblehead Planning Board': 'planning-board',
  'Marblehead Zoning Board': 'zoning-board',
  'Marblehead Board of Health': 'board-of-health',
  'Marblehead Board of Assessors': 'board-of-assessors',
  'Marblehead Conservation Commission': 'conservation-commission',
  'Marblehead Town Meeting': 'town-meeting',
};

export function slugForMeeting({ board, date }) {
  return `${board}-${date}`;
}

export function classifyMeetingTitle(title) {
  for (const [prefix, slug] of Object.entries(BOARD_SLUGS)) {
    if (title.startsWith(prefix)) return slug;
  }
  return null;
}
```

- [ ] **Step 4: Run, see pass**

```bash
node --test scripts/transcripts/lib/config.test.mjs 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/config.mjs scripts/transcripts/lib/config.test.mjs
git commit -m "transcripts: add config module with paths, topics, board map"
```

---

### Task 11: Discovery module

**Files:**
- Create: `scripts/transcripts/lib/discovery.mjs`
- Create: `scripts/transcripts/lib/discovery.test.mjs`
- Create: `scripts/transcripts/fixtures/meetings_sample.json`

- [ ] **Step 1: Create fixture**

```json
{
  "last_updated": "2026-05-08T00:00:00Z",
  "video_count": 4,
  "videos": [
    { "vimeo_id": 1185906675, "title": "Marblehead Select Board Meeting: 4-22-26", "meeting_date": "2026-04-22", "url": "https://vimeo.com/1185906675" },
    { "vimeo_id": 1187721773, "title": "Marblehead Finance Committee: Town Meeting Warrant Hearing Part 2 4-27-26", "meeting_date": "2026-04-27", "url": "https://vimeo.com/1187721773" },
    { "vimeo_id": 1184114075, "title": "Marblehead Select Board Meeting: 4-15-26", "meeting_date": "2026-04-15", "url": "https://vimeo.com/1184114075" },
    { "vimeo_id": 1188878545, "title": "Seth for Massachusetts in Marblehead May 3, 2026", "meeting_date": "2026-05-03", "url": "https://vimeo.com/1188878545" }
  ]
}
```

The fourth entry is intentional non-meeting content to verify filtering.

(Note: `pull_meetings.mjs` may use slightly different field names. We'll
adapt in the discovery module to match its actual output. Fixture
reflects the *expected* shape; if `pull_meetings.mjs` differs, update
both fixture and discovery code together.)

- [ ] **Step 2: Write the failing tests**

```js
// scripts/transcripts/lib/discovery.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMeetings, filterUntranscribed } from './discovery.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '../fixtures/meetings_sample.json');

test('listMeetings filters non-board content', async () => {
  const meetings = await listMeetings(FIXTURE);
  assert.equal(meetings.length, 3);  // drops the "Seth for Massachusetts" entry
  assert.ok(meetings.every(m => m.board));
});

test('listMeetings classifies boards', async () => {
  const meetings = await listMeetings(FIXTURE);
  const sb = meetings.filter(m => m.board === 'select-board');
  const fc = meetings.filter(m => m.board === 'finance-committee');
  assert.equal(sb.length, 2);
  assert.equal(fc.length, 1);
});

test('filterUntranscribed returns only meetings without an existing _transcripts file', async () => {
  const meetings = [
    { board: 'select-board', date: '2026-04-22', vimeo_id: 1, url: 'x' },
    { board: 'select-board', date: '2099-01-01', vimeo_id: 2, url: 'x' }
  ];
  // Existing transcript: "select-board-2026-04-22"
  const existingSlugs = new Set(['select-board-2026-04-22']);
  const newOnes = filterUntranscribed(meetings, existingSlugs);
  assert.equal(newOnes.length, 1);
  assert.equal(newOnes[0].date, '2099-01-01');
});
```

- [ ] **Step 3: Run, see fail**

```bash
node --test scripts/transcripts/lib/discovery.test.mjs 2>&1 | tail
```

Expected: failure (module missing).

- [ ] **Step 4: Implement**

```js
// scripts/transcripts/lib/discovery.mjs
import { readFile, readdir } from 'node:fs/promises';
import { paths, classifyMeetingTitle, slugForMeeting } from './config.mjs';

export async function listMeetings(meetingsJsonPath = paths.meetingsJson) {
  const raw = JSON.parse(await readFile(meetingsJsonPath, 'utf8'));
  const out = [];
  for (const v of raw.videos || []) {
    const board = classifyMeetingTitle(v.title);
    if (!board) continue;          // not a board/committee meeting
    if (!v.meeting_date) continue; // can't slug it without a date
    out.push({
      board,
      date: v.meeting_date,
      title: v.title,
      vimeo_id: v.vimeo_id,
      url: v.url,
      slug: slugForMeeting({ board, date: v.meeting_date }),
    });
  }
  return out;
}

export function filterUntranscribed(meetings, existingSlugs) {
  return meetings.filter(m => !existingSlugs.has(m.slug));
}

export async function existingTranscriptSlugs(dir = paths.transcriptsCollectionDir) {
  const files = await readdir(dir);
  return new Set(
    files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
  );
}
```

- [ ] **Step 5: Run, see pass**

```bash
node --test scripts/transcripts/lib/discovery.test.mjs 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/transcripts/lib/discovery.mjs scripts/transcripts/lib/discovery.test.mjs scripts/transcripts/fixtures/meetings_sample.json
git commit -m "transcripts: add discovery module + fixture"
```

---

### Task 12: Audio download module

**Files:**
- Create: `scripts/transcripts/lib/audio.mjs`
- Create: `scripts/transcripts/lib/audio.test.mjs`

The module wraps `yt-dlp` and `ffprobe`. The runner is injected as a
dependency so tests can use a fake.

- [ ] **Step 1: Write the failing tests**

```js
// scripts/transcripts/lib/audio.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadAudio, probeDuration } from './audio.mjs';

function makeFakeRunner(scenarios) {
  const calls = [];
  return {
    calls,
    run: async (cmd, args) => {
      calls.push({ cmd, args });
      const key = cmd + ' ' + args.join(' ');
      const matched = scenarios.find(s => key.startsWith(s.match));
      if (!matched) throw new Error(`no scenario for ${key}`);
      if (matched.exitCode !== 0) {
        const err = new Error(matched.stderr || 'fake exec failed');
        err.exitCode = matched.exitCode;
        throw err;
      }
      return { stdout: matched.stdout || '', stderr: '' };
    }
  };
}

test('downloadAudio invokes yt-dlp with audio-extraction flags', async () => {
  const runner = makeFakeRunner([{ match: 'yt-dlp', stdout: 'ok', exitCode: 0 }]);
  const out = await downloadAudio({
    url: 'https://vimeo.com/1185906675',
    outputPath: '/tmp/test.mp3',
    runner,
  });
  assert.equal(out, '/tmp/test.mp3');
  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].cmd, 'yt-dlp');
  assert.ok(runner.calls[0].args.includes('-x'));
  assert.ok(runner.calls[0].args.includes('--audio-format'));
  assert.ok(runner.calls[0].args.includes('mp3'));
  assert.ok(runner.calls[0].args.includes('https://vimeo.com/1185906675'));
});

test('downloadAudio surfaces yt-dlp failure', async () => {
  const runner = makeFakeRunner([{ match: 'yt-dlp', exitCode: 1, stderr: 'ERROR: Geo-blocked' }]);
  await assert.rejects(
    () => downloadAudio({ url: 'https://x', outputPath: '/tmp/x.mp3', runner }),
    /Geo-blocked|fake exec failed/
  );
});

test('probeDuration returns seconds as a number', async () => {
  const runner = makeFakeRunner([{ match: 'ffprobe', stdout: '2969.496000\n', exitCode: 0 }]);
  const seconds = await probeDuration({ path: '/tmp/x.mp3', runner });
  assert.equal(seconds, 2969);
});
```

- [ ] **Step 2: Run, see fail**

```bash
node --test scripts/transcripts/lib/audio.test.mjs 2>&1 | tail -5
```

Expected: failure.

- [ ] **Step 3: Implement**

```js
// scripts/transcripts/lib/audio.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const execFileP = promisify(execFile);

const defaultRunner = {
  async run(cmd, args) {
    const { stdout, stderr } = await execFileP(cmd, args, { maxBuffer: 32 * 1024 * 1024 });
    return { stdout, stderr };
  }
};

export async function downloadAudio({ url, outputPath, runner = defaultRunner }) {
  await mkdir(dirname(outputPath), { recursive: true });
  const args = [
    '-f', 'bestaudio',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputPath,
    url,
  ];
  await runner.run('yt-dlp', args);
  return outputPath;
}

export async function probeDuration({ path, runner = defaultRunner }) {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    path,
  ];
  const { stdout } = await runner.run('ffprobe', args);
  return Math.round(parseFloat(stdout.trim()));
}
```

- [ ] **Step 4: Run, see pass**

```bash
node --test scripts/transcripts/lib/audio.test.mjs 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/audio.mjs scripts/transcripts/lib/audio.test.mjs
git commit -m "transcripts: add audio download + probe wrapper"
```

---

### Task 13: AssemblyAI client

**Files:**
- Create: `scripts/transcripts/lib/assemblyai.mjs`
- Create: `scripts/transcripts/lib/assemblyai.test.mjs`
- Create: `scripts/transcripts/fixtures/aai_response.json`

The client takes `fetch` as a dependency for testability.

- [ ] **Step 1: Create fixture**

```json
{
  "id": "test-id-001",
  "status": "completed",
  "audio_duration": 360,
  "language_code": "en",
  "utterances": [
    { "speaker": "A", "start": 320, "end": 52880, "text": "Public safety, education, accessibility, technology and library services as follows. We have roads and sidewalks at 9,098,250..." },
    { "speaker": "C", "start": 53600, "end": 54400, "text": "So that's." },
    { "speaker": "C", "start": 59210, "end": 60650, "text": "Any questions from the board?" },
    { "speaker": "B", "start": 63530, "end": 70250, "text": "Great news. There's quite a. Quite a good t. Yeah, yeah." }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```js
// scripts/transcripts/lib/assemblyai.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transcribe } from './assemblyai.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '../fixtures/aai_response.json');

function makeFakeFetch(scripted) {
  const calls = [];
  return {
    calls,
    fetch: async (url, opts) => {
      calls.push({ url, method: opts?.method || 'GET' });
      const step = scripted[calls.length - 1];
      if (!step) throw new Error(`unscripted call ${calls.length}: ${url}`);
      return {
        ok: step.status < 400,
        status: step.status,
        json: async () => step.body,
        text: async () => JSON.stringify(step.body),
      };
    }
  };
}

test('transcribe uploads, submits, polls, returns parsed result', async () => {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const fakeFetch = makeFakeFetch([
    // 1. POST /v2/upload
    { status: 200, body: { upload_url: 'https://cdn.assemblyai.com/upload/abc' } },
    // 2. POST /v2/transcript
    { status: 200, body: { id: 'test-id-001' } },
    // 3. GET /v2/transcript/test-id-001 — processing
    { status: 200, body: { status: 'processing' } },
    // 4. GET — completed
    { status: 200, body: fixture },
  ]);
  const audio = new Uint8Array([1, 2, 3]);
  const result = await transcribe({
    audioBytes: audio,
    apiKey: 'test-key',
    fetch: fakeFetch.fetch,
    pollIntervalMs: 1, // fast test
  });
  assert.equal(result.id, 'test-id-001');
  assert.equal(result.utterances.length, 4);
  assert.equal(fakeFetch.calls[0].url, 'https://api.assemblyai.com/v2/upload');
  assert.equal(fakeFetch.calls[1].url, 'https://api.assemblyai.com/v2/transcript');
});

test('transcribe surfaces AAI error status', async () => {
  const fakeFetch = makeFakeFetch([
    { status: 200, body: { upload_url: 'x' } },
    { status: 200, body: { id: 'test-id' } },
    { status: 200, body: { status: 'error', error: 'audio file is empty' } },
  ]);
  await assert.rejects(
    () => transcribe({ audioBytes: new Uint8Array(), apiKey: 'k', fetch: fakeFetch.fetch, pollIntervalMs: 1 }),
    /audio file is empty/
  );
});
```

- [ ] **Step 3: Run, see fail**

```bash
node --test scripts/transcripts/lib/assemblyai.test.mjs 2>&1 | tail -5
```

Expected: failure.

- [ ] **Step 4: Implement**

```js
// scripts/transcripts/lib/assemblyai.mjs
const BASE = 'https://api.assemblyai.com/v2';

async function postJson(fetchFn, url, apiKey, body) {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadAudio(fetchFn, apiKey, audioBytes) {
  const res = await fetchFn(`${BASE}/upload`, {
    method: 'POST',
    headers: { authorization: apiKey },
    body: audioBytes,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).upload_url;
}

export async function transcribe({
  audioBytes,
  apiKey,
  fetch: fetchFn = globalThis.fetch,
  pollIntervalMs = 4000,
  maxWaitMs = 30 * 60 * 1000,
}) {
  const uploadUrl = await uploadAudio(fetchFn, apiKey, audioBytes);
  const submit = await postJson(fetchFn, `${BASE}/transcript`, apiKey, {
    audio_url: uploadUrl,
    speech_models: ['universal-2'],
    speaker_labels: true,
  });

  const id = submit.id;
  const start = Date.now();
  while (true) {
    const res = await fetchFn(`${BASE}/transcript/${id}`, {
      headers: { authorization: apiKey },
    });
    if (!res.ok) throw new Error(`poll failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    if (j.status === 'completed') return j;
    if (j.status === 'error') throw new Error(`AAI error: ${j.error || 'unknown'}`);
    if (Date.now() - start > maxWaitMs) throw new Error(`AAI poll timeout after ${maxWaitMs}ms`);
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
}
```

- [ ] **Step 5: Run, see pass**

```bash
node --test scripts/transcripts/lib/assemblyai.test.mjs 2>&1 | tail -10
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/transcripts/lib/assemblyai.mjs scripts/transcripts/lib/assemblyai.test.mjs scripts/transcripts/fixtures/aai_response.json
git commit -m "transcripts: add AssemblyAI client with fixture-driven tests"
```

---

### Task 14: LLM prompt template

**Files:**
- Create: `scripts/transcripts/prompts/summary.md`

- [ ] **Step 1: Write the prompt template**

```markdown
You are summarizing a Marblehead, Massachusetts public board meeting for
publication on a non-advocacy civic data site. Output VALID JSON ONLY,
matching the schema below. No prose, no markdown fences, no commentary.

EDITORIAL RULES (mandatory):
- All numbers (dollars, percentages, dates, vote tallies) must match the
  transcript verbatim. Copy them; do not paraphrase or round.
- No characterizations: do NOT use "controversial", "shocking",
  "easily", "clearly", "of course", "as expected".
- Quotes must use the exact words from the transcript, with the speaker
  label.
- Decisions must cite a timestamp (`start_seconds` of the relevant
  segment) so a reviewer can spot-check against the source video.
- If a vote is mentioned without a clear roll call, write
  `result: "voice vote / unclear"`.
- If you cannot identify a board member's last name with confidence
  from the transcript, use `Speaker A`, `Speaker B`, etc. — never guess.

TOPIC TAGGING:
You will be given a fixed list of topic slugs. For each substantive
discussion segment (~30s to a few minutes), choose the BEST matching
topic from the fixed list. If a segment genuinely fits no topic, set
`topic` to `"emergent"` and `proposed_new` to a short kebab-case slug
you'd suggest, with `topic_confidence` ≤ 0.5.

OUTPUT JSON SCHEMA:
{
  "summary_card": {
    "headline": "string, ≤90 chars, factual not editorial",
    "summary": "string, ~80-120 words",
    "decisions": ["string with $ amounts and timestamps"],
    "votes": [{ "motion": "string", "result": "5-0 or voice vote / unclear", "members_in_favor": ["lastname"] }]
  },
  "topic_segments": [
    {
      "topic": "fixed-list-slug or 'emergent'",
      "topic_confidence": 0.0-1.0,
      "proposed_new": "kebab-case-slug-or-null",
      "start_seconds": integer,
      "end_seconds": integer,
      "summary": "1-sentence neutral summary",
      "key_speakers": ["Speaker A (role)", ...]
    }
  ]
}

FIXED TOPIC LIST (use these slugs exactly):
{{TOPIC_LIST}}

MEETING METADATA:
- Board: {{BOARD}}
- Date: {{DATE}}
- Duration: {{DURATION_SECONDS}} seconds

TRANSCRIPT:
{{TRANSCRIPT}}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/transcripts/prompts/summary.md
git commit -m "transcripts: add LLM prompt template with editorial guardrails"
```

---

### Task 15: Summarize module

**Files:**
- Create: `scripts/transcripts/lib/summarize.mjs`
- Create: `scripts/transcripts/lib/summarize.test.mjs`
- Create: `scripts/transcripts/fixtures/summary_response.json`

- [ ] **Step 1: Create fixture**

```json
{
  "summary_card": {
    "headline": "Approved $24.9M GO bond sale to Oppenheimer",
    "summary": "Select Board approved sale of $24,975,000 in 2026 GO bonds to Oppenheimer Co. at $26,402,202. Funds cover roads, the high school roof and HVAC, Mary Alley HVAC and ADA improvements, Abbot Public Library, and IT equipment.",
    "decisions": [
      "Approved sale of $24,975,000 GO bonds to Oppenheimer Co. (start_seconds: 600)"
    ],
    "votes": [
      { "motion": "Approve bond sale", "result": "voice vote / unclear", "members_in_favor": ["Fox", "Krieger"] }
    ]
  },
  "topic_segments": [
    {
      "topic": "bonding-capital",
      "topic_confidence": 0.95,
      "proposed_new": null,
      "start_seconds": 0,
      "end_seconds": 360,
      "summary": "Bond sale closing and SEC disclosure procedures.",
      "key_speakers": ["Speaker A (bond agent)", "Speaker C (chair)"]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```js
// scripts/transcripts/lib/summarize.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize, buildPrompt, validateOutput } from './summarize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '../fixtures/summary_response.json');

test('buildPrompt substitutes all template placeholders', async () => {
  const utterances = [
    { speaker: 'A', start: 0, end: 5000, text: 'hello world' }
  ];
  const prompt = await buildPrompt({
    board: 'select-board',
    date: '2026-04-22',
    durationSeconds: 360,
    utterances,
  });
  assert.match(prompt, /select-board/);
  assert.match(prompt, /2026-04-22/);
  assert.match(prompt, /360/);
  assert.match(prompt, /hello world/);
  assert.match(prompt, /override/); // topic seeds present
  assert.doesNotMatch(prompt, /\{\{[A-Z_]+\}\}/); // no unfilled placeholders
});

test('validateOutput accepts conforming JSON', async () => {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  assert.doesNotThrow(() => validateOutput(fixture));
});

test('validateOutput rejects missing summary_card', () => {
  assert.throws(() => validateOutput({ topic_segments: [] }), /summary_card/);
});

test('validateOutput rejects unknown topic slug', () => {
  const bad = {
    summary_card: { headline: 'h', summary: 's', decisions: [], votes: [] },
    topic_segments: [
      { topic: 'not-a-real-topic', topic_confidence: 0.9, proposed_new: null, start_seconds: 0, end_seconds: 1, summary: 's', key_speakers: [] }
    ]
  };
  assert.throws(() => validateOutput(bad), /unknown topic/i);
});

test('summarize calls Anthropic and parses JSON response', async () => {
  const fakeAnthropic = {
    messages: {
      create: async (req) => {
        // Verify cache_control on the system prompt
        assert.ok(req.system.some(s => s.cache_control));
        return {
          content: [{ type: 'text', text: JSON.stringify({
            summary_card: { headline: 'h', summary: 's', decisions: [], votes: [] },
            topic_segments: []
          })}]
        };
      }
    }
  };
  const result = await summarize({
    board: 'select-board',
    date: '2026-04-22',
    durationSeconds: 60,
    utterances: [{ speaker: 'A', start: 0, end: 1000, text: 'x' }],
    anthropicClient: fakeAnthropic,
  });
  assert.equal(result.summary_card.headline, 'h');
});
```

- [ ] **Step 3: Run, see fail**

```bash
node --test scripts/transcripts/lib/summarize.test.mjs 2>&1 | tail -5
```

Expected: failure.

- [ ] **Step 4: Implement**

```js
// scripts/transcripts/lib/summarize.mjs
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths, TOPIC_SLUGS } from './config.mjs';

const PROMPT_PATH = resolve(paths.promptsDir, 'summary.md');

let cachedTemplate = null;
async function loadTemplate() {
  if (!cachedTemplate) cachedTemplate = await readFile(PROMPT_PATH, 'utf8');
  return cachedTemplate;
}

function formatUtterances(utterances) {
  return utterances.map(u => {
    const startSec = Math.round(u.start / 1000);
    return `[${startSec}s] Speaker ${u.speaker}: ${u.text}`;
  }).join('\n');
}

function formatTopicList() {
  return TOPIC_SLUGS.map(s => `- ${s}`).join('\n');
}

export async function buildPrompt({ board, date, durationSeconds, utterances }) {
  const tmpl = await loadTemplate();
  return tmpl
    .replace('{{TOPIC_LIST}}', formatTopicList())
    .replace('{{BOARD}}', board)
    .replace('{{DATE}}', date)
    .replace('{{DURATION_SECONDS}}', String(durationSeconds))
    .replace('{{TRANSCRIPT}}', formatUtterances(utterances));
}

export function validateOutput(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('output is not an object');
  if (!obj.summary_card) throw new Error('missing summary_card');
  if (!obj.summary_card.headline) throw new Error('missing summary_card.headline');
  if (!obj.summary_card.summary) throw new Error('missing summary_card.summary');
  if (!Array.isArray(obj.summary_card.decisions)) throw new Error('summary_card.decisions must be array');
  if (!Array.isArray(obj.summary_card.votes)) throw new Error('summary_card.votes must be array');
  if (!Array.isArray(obj.topic_segments)) throw new Error('topic_segments must be array');
  for (const seg of obj.topic_segments) {
    if (seg.topic !== 'emergent' && !TOPIC_SLUGS.includes(seg.topic)) {
      throw new Error(`unknown topic slug: ${seg.topic}`);
    }
  }
  return true;
}

export async function summarize({
  board, date, durationSeconds, utterances,
  anthropicClient,
  model = 'claude-sonnet-4-6',
}) {
  const prompt = await buildPrompt({ board, date, durationSeconds, utterances });

  // System prompt = the template with placeholders replaced EXCEPT the
  // transcript itself. Cache_control on the static portion (template +
  // topic list) maximizes prompt-cache hits across meetings.
  const systemStatic = prompt.split('TRANSCRIPT:')[0] + 'TRANSCRIPT:';
  const userPart = prompt.split('TRANSCRIPT:')[1] || '';

  const res = await anthropicClient.messages.create({
    model,
    max_tokens: 4096,
    system: [
      { type: 'text', text: systemStatic, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: userPart }],
  });

  const text = res.content.find(c => c.type === 'text')?.text || '';
  // Trim possible code fences just in case.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${e.message}\nRaw: ${cleaned.slice(0, 500)}`);
  }
  validateOutput(parsed);
  return parsed;
}
```

- [ ] **Step 5: Run, see pass**

```bash
node --test scripts/transcripts/lib/summarize.test.mjs 2>&1 | tail -10
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/transcripts/lib/summarize.mjs scripts/transcripts/lib/summarize.test.mjs scripts/transcripts/fixtures/summary_response.json
git commit -m "transcripts: add summarize module with prompt build + output validation"
```

---

### Task 16: Render module

Produces the final `_transcripts/<slug>.md` content from the AAI result + the LLM result + meeting metadata.

**Files:**
- Create: `scripts/transcripts/lib/render.mjs`
- Create: `scripts/transcripts/lib/render.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// scripts/transcripts/lib/render.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTranscriptMarkdown, formatTimestamp, escapeYaml } from './render.mjs';

test('formatTimestamp produces H:MM:SS', () => {
  assert.equal(formatTimestamp(0), '0:00:00');
  assert.equal(formatTimestamp(63), '0:01:03');
  assert.equal(formatTimestamp(3661), '1:01:01');
});

test('escapeYaml quotes strings with colons', () => {
  assert.equal(escapeYaml('plain'), 'plain');
  assert.equal(escapeYaml('has: colon'), '"has: colon"');
  assert.equal(escapeYaml('has "quote"'), `'has "quote"'`);
});

test('renderTranscriptMarkdown produces frontmatter + body', () => {
  const meeting = {
    slug: 'select-board-2026-04-22',
    board: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    title: 'Select Board: April 22, 2026',
    vimeo_id: 1185906675,
    url: 'https://vimeo.com/1185906675',
    duration_seconds: 2969,
  };
  const aaiResult = {
    id: 'test-id-001',
    utterances: [
      { speaker: 'A', start: 320, end: 5500, text: 'Public safety, education, accessibility.' },
      { speaker: 'C', start: 53600, end: 54400, text: 'Any questions from the board?' },
    ],
  };
  const summary = {
    summary_card: {
      headline: 'Approved bond',
      summary: 'Did stuff.',
      decisions: ['Did the thing'],
      votes: []
    },
    topic_segments: [
      { topic: 'bonding-capital', topic_confidence: 0.9, proposed_new: null, start_seconds: 0, end_seconds: 60, summary: 'Bond stuff', key_speakers: ['Speaker A'] }
    ]
  };
  const ingest = {
    transcribed_at: '2026-05-08T13:00:00Z',
    assemblyai_id: 'test-id-001',
    speech_model: 'universal-2',
    speech_model_cost_usd: 0.027,
    summary_model: 'claude-sonnet-4-6',
    summary_cost_usd: 0.04,
  };
  const md = renderTranscriptMarkdown({ meeting, aaiResult, summary, ingest });

  // Frontmatter
  assert.match(md, /^---\n/);
  assert.match(md, /layout: transcript/);
  assert.match(md, /slug: select-board-2026-04-22/);
  assert.match(md, /vimeo_id: 1185906675/);
  assert.match(md, /headline: Approved bond/);

  // Body
  assert.match(md, /Speaker A/);
  assert.match(md, /\[ 0:00:00 \]/);
  assert.match(md, /\[ 0:00:53 \]/);
  assert.match(md, /Any questions from the board\?/);
});

test('renderTranscriptMarkdown handles empty utterances safely', () => {
  const md = renderTranscriptMarkdown({
    meeting: { slug: 'x', board: 'x', board_display: 'X', date: '2026-01-01', title: 'X', vimeo_id: 1, url: 'x', duration_seconds: 60 },
    aaiResult: { id: 'x', utterances: [] },
    summary: { summary_card: { headline: 'h', summary: 's', decisions: [], votes: [] }, topic_segments: [] },
    ingest: { transcribed_at: 'now', assemblyai_id: 'x', speech_model: 'universal-2', speech_model_cost_usd: 0, summary_model: 'x', summary_cost_usd: 0 },
  });
  assert.match(md, /^---/);
  assert.match(md, /\(transcript empty\)/);
});
```

- [ ] **Step 2: Run, see fail**

```bash
node --test scripts/transcripts/lib/render.test.mjs 2>&1 | tail -5
```

Expected: failure.

- [ ] **Step 3: Implement**

```js
// scripts/transcripts/lib/render.mjs

export function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function escapeYaml(s) {
  if (typeof s !== 'string') return JSON.stringify(s);
  if (/[:#\[\]\{\}&\*!\|>'"%@`]/.test(s) === false && !/^[\s-]/.test(s)) {
    return s;
  }
  if (s.includes('"')) return `'${s.replace(/'/g, "''")}'`;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function yamlList(items, indent = '  ') {
  if (!items || items.length === 0) return '[]';
  return '\n' + items.map(i => `${indent}- ${escapeYaml(i)}`).join('\n');
}

function yamlVotes(votes, indent = '  ') {
  if (!votes || votes.length === 0) return '[]';
  return '\n' + votes.map(v => {
    const fav = (v.members_in_favor || []).map(m => escapeYaml(m)).join(', ');
    return [
      `${indent}- motion: ${escapeYaml(v.motion)}`,
      `${indent}  result: ${escapeYaml(v.result)}`,
      `${indent}  members_in_favor: [${fav}]`,
    ].join('\n');
  }).join('\n');
}

function yamlSegments(segments, indent = '  ') {
  if (!segments || segments.length === 0) return '[]';
  return '\n' + segments.map(seg => {
    const speakers = (seg.key_speakers || []).map(s => escapeYaml(s)).join(', ');
    const lines = [
      `${indent}- topic: ${seg.topic}`,
      `${indent}  topic_confidence: ${seg.topic_confidence}`,
    ];
    if (seg.proposed_new) lines.push(`${indent}  proposed_new: ${escapeYaml(seg.proposed_new)}`);
    lines.push(`${indent}  start_seconds: ${seg.start_seconds}`);
    lines.push(`${indent}  end_seconds: ${seg.end_seconds}`);
    lines.push(`${indent}  summary: ${escapeYaml(seg.summary)}`);
    lines.push(`${indent}  key_speakers: [${speakers}]`);
    return lines.join('\n');
  }).join('\n');
}

function renderBody(utterances) {
  if (!utterances || utterances.length === 0) return '(transcript empty)\n';
  return utterances.map(u => {
    const startSec = Math.round(u.start / 1000);
    return `[ ${formatTimestamp(startSec)} ] **Speaker ${u.speaker}**:\n${u.text}\n`;
  }).join('\n');
}

export function renderTranscriptMarkdown({ meeting, aaiResult, summary, ingest }) {
  const fm = [
    '---',
    'layout: transcript',
    `slug: ${meeting.slug}`,
    `board: ${meeting.board}`,
    `board_display: ${escapeYaml(meeting.board_display)}`,
    `date: ${meeting.date}`,
    `title: ${escapeYaml(meeting.title)}`,
    `vimeo_id: ${meeting.vimeo_id}`,
    `vimeo_url: ${escapeYaml(meeting.url)}`,
    `duration_seconds: ${meeting.duration_seconds}`,
    'ai_generated: true',
    'status: published',
    '',
    'summary_card:',
    `  headline: ${escapeYaml(summary.summary_card.headline)}`,
    `  summary: ${escapeYaml(summary.summary_card.summary)}`,
    `  decisions: ${yamlList(summary.summary_card.decisions, '    ')}`,
    `  votes: ${yamlVotes(summary.summary_card.votes, '    ')}`,
    '',
    `topic_segments: ${yamlSegments(summary.topic_segments, '  ')}`,
    '',
    'ingest:',
    `  transcribed_at: ${escapeYaml(ingest.transcribed_at)}`,
    `  assemblyai_id: ${escapeYaml(ingest.assemblyai_id)}`,
    `  speech_model: ${escapeYaml(ingest.speech_model)}`,
    `  speech_model_cost_usd: ${ingest.speech_model_cost_usd}`,
    `  summary_model: ${escapeYaml(ingest.summary_model)}`,
    `  summary_cost_usd: ${ingest.summary_cost_usd}`,
    '---',
    '',
  ].join('\n');

  return fm + renderBody(aaiResult.utterances);
}
```

- [ ] **Step 4: Run, see pass**

```bash
node --test scripts/transcripts/lib/render.test.mjs 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/lib/render.mjs scripts/transcripts/lib/render.test.mjs
git commit -m "transcripts: add render module (data → frontmatter+md)"
```

---

### Task 17: PR creation module

**Files:**
- Create: `scripts/transcripts/lib/pr.mjs`

This module is shell-heavy (`git`, `gh`) and hard to unit-test in
isolation; we keep it small and rely on the integration test in Task 18
to exercise it via dry-run mode.

- [ ] **Step 1: Implement**

```js
// scripts/transcripts/lib/pr.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

async function git(args, cwd) {
  const { stdout, stderr } = await execFileP('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function openTranscriptPR({
  repoRoot,
  branchName,
  filesToAdd,
  prTitle,
  prBody,
  dryRun = false,
}) {
  if (dryRun) {
    console.log(`[dry-run] would create branch ${branchName}`);
    console.log(`[dry-run] would add: ${filesToAdd.join(', ')}`);
    console.log(`[dry-run] PR title: ${prTitle}`);
    console.log(`[dry-run] PR body:\n${prBody}`);
    return { dryRun: true, branchName };
  }

  // Ensure we're on main and clean before branching.
  await git(['checkout', 'main'], repoRoot);
  await git(['pull', '--ff-only', 'origin', 'main'], repoRoot);
  await git(['checkout', '-b', branchName], repoRoot);
  for (const f of filesToAdd) await git(['add', f], repoRoot);
  await git(['commit', '-m', prTitle], repoRoot);
  await git(['push', '-u', 'origin', branchName], repoRoot);

  const { stdout } = await execFileP(
    'gh',
    ['pr', 'create', '--title', prTitle, '--body', prBody, '--base', 'main'],
    { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 },
  );
  return { dryRun: false, branchName, prUrl: stdout.trim() };
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/transcripts/lib/pr.mjs
git commit -m "transcripts: add PR creation helper (git + gh)"
```

---

### Task 18: Orchestrator + integration test

**Files:**
- Create: `scripts/transcripts/transcribe.mjs`
- Create: `scripts/transcripts/transcribe.integration.test.mjs`

The orchestrator is the CLI entry point. It accepts `--dry-run`,
`--meeting <slug>`, and `--max <N>` flags.

- [ ] **Step 1: Write the integration test**

```js
// scripts/transcripts/transcribe.integration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from './transcribe.mjs';

test('runPipeline end-to-end with all deps mocked', async () => {
  const writes = [];
  const fakeAaiResult = { id: 'aai-1', utterances: [{ speaker: 'A', start: 0, end: 1000, text: 'hi' }] };
  const fakeSummary = {
    summary_card: { headline: 'h', summary: 's', decisions: [], votes: [] },
    topic_segments: [{ topic: 'override', topic_confidence: 0.9, proposed_new: null, start_seconds: 0, end_seconds: 1, summary: 's', key_speakers: [] }]
  };

  const meetingsToProcess = [{
    slug: 'select-board-2026-04-22',
    board: 'select-board',
    board_display: 'Select Board',
    date: '2026-04-22',
    title: 'Select Board: April 22, 2026',
    vimeo_id: 1185906675,
    url: 'https://vimeo.com/1185906675',
  }];

  const result = await runPipeline({
    meetings: meetingsToProcess,
    deps: {
      downloadAudio: async () => '/tmp/fake.mp3',
      probeDuration: async () => 60,
      readAudioBytes: async () => new Uint8Array(),
      transcribe: async () => fakeAaiResult,
      summarize: async () => fakeSummary,
      writeTranscript: async (path, content) => { writes.push({ path, content }); },
      openPR: async () => ({ dryRun: true, branchName: 'auto/transcripts-test' }),
    },
  });

  assert.equal(writes.length, 1);
  assert.match(writes[0].path, /select-board-2026-04-22\.md$/);
  assert.match(writes[0].content, /^---/);
  assert.match(writes[0].content, /headline: h/);
  assert.equal(result.processed.length, 1);
  assert.equal(result.failed.length, 0);
});

test('runPipeline records failures without aborting', async () => {
  const meetings = [
    { slug: 'a-2026-01-01', board: 'select-board', board_display: 'X', date: '2026-01-01', title: 'A', vimeo_id: 1, url: 'x' },
    { slug: 'b-2026-01-02', board: 'select-board', board_display: 'X', date: '2026-01-02', title: 'B', vimeo_id: 2, url: 'x' },
  ];
  const writes = [];
  const result = await runPipeline({
    meetings,
    deps: {
      downloadAudio: async (m) => { if (m.url === 'x' && m.vimeo_id === 1) throw new Error('geo-blocked'); return '/tmp/x.mp3'; },
      probeDuration: async () => 60,
      readAudioBytes: async () => new Uint8Array(),
      transcribe: async () => ({ id: 'x', utterances: [] }),
      summarize: async () => ({ summary_card: { headline: 'h', summary: 's', decisions: [], votes: [] }, topic_segments: [] }),
      writeTranscript: async (path, content) => { writes.push({ path, content }); },
      openPR: async () => ({ dryRun: true }),
    },
  });
  assert.equal(result.processed.length, 1);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].reason, /geo-blocked/);
});
```

- [ ] **Step 2: Run, see fail**

```bash
node --test scripts/transcripts/transcribe.integration.test.mjs 2>&1 | tail -5
```

Expected: failure.

- [ ] **Step 3: Implement**

```js
// scripts/transcripts/transcribe.mjs
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';

import { paths } from './lib/config.mjs';
import { listMeetings, filterUntranscribed, existingTranscriptSlugs } from './lib/discovery.mjs';
import { downloadAudio, probeDuration } from './lib/audio.mjs';
import { transcribe as aaiTranscribe } from './lib/assemblyai.mjs';
import { summarize as llmSummarize } from './lib/summarize.mjs';
import { renderTranscriptMarkdown } from './lib/render.mjs';
import { openTranscriptPR } from './lib/pr.mjs';

const execFileP = promisify(execFile);

const BOARD_DISPLAY = {
  'select-board': 'Select Board',
  'finance-committee': 'Finance Committee',
  'school-committee': 'School Committee',
  'planning-board': 'Planning Board',
  'zoning-board': 'Zoning Board',
  'board-of-health': 'Board of Health',
  'board-of-assessors': 'Board of Assessors',
  'conservation-commission': 'Conservation Commission',
  'town-meeting': 'Town Meeting',
};

function pretty(slug) {
  return BOARD_DISPLAY[slug] || slug;
}

export async function runPipeline({ meetings, deps }) {
  const processed = [];
  const failed = [];

  for (const m of meetings) {
    try {
      const audioPath = await deps.downloadAudio(m);
      const durationSeconds = await deps.probeDuration({ path: audioPath });
      const audioBytes = await deps.readAudioBytes(audioPath);
      const aaiResult = await deps.transcribe({ audioBytes });
      const summary = await deps.summarize({
        board: m.board, date: m.date,
        durationSeconds, utterances: aaiResult.utterances,
      });
      const meetingForRender = {
        slug: m.slug,
        board: m.board,
        board_display: m.board_display || pretty(m.board),
        date: m.date,
        title: m.title,
        vimeo_id: m.vimeo_id,
        url: m.url,
        duration_seconds: durationSeconds,
      };
      const ingest = {
        transcribed_at: new Date().toISOString(),
        assemblyai_id: aaiResult.id,
        speech_model: 'universal-2',
        speech_model_cost_usd: +(durationSeconds / 3600 * 0.27).toFixed(3),
        summary_model: 'claude-sonnet-4-6',
        summary_cost_usd: 0.05, // estimate; real number requires usage from Claude response
      };
      const md = renderTranscriptMarkdown({ meeting: meetingForRender, aaiResult, summary, ingest });
      const outPath = resolve(paths.transcriptsCollectionDir, `${m.slug}.md`);
      await deps.writeTranscript(outPath, md);
      processed.push({ slug: m.slug, path: outPath });
    } catch (err) {
      failed.push({ slug: m.slug, reason: err.message });
    }
  }

  if (processed.length > 0) {
    const branchName = `auto/transcripts-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
    const fileList = processed.map(p => p.path);
    const prTitle = `Transcripts: ${processed.map(p => p.slug).join(', ')}`;
    const prBody = [
      'Auto-generated transcripts and summaries.',
      '',
      'Reviewer checklist:',
      '- [ ] Skim summary card for accuracy of decisions and votes',
      '- [ ] Spot-check any dollar amounts or vote tallies against transcript or video',
      '- [ ] Check topic_segments — flag anything mis-tagged',
      '- [ ] If any speaker labels are obviously wrong, edit them in the .md',
      '',
      `Failed meetings (${failed.length}):`,
      ...failed.map(f => `- ${f.slug}: ${f.reason}`),
    ].join('\n');
    const pr = await deps.openPR({
      branchName,
      filesToAdd: fileList,
      prTitle,
      prBody,
    });
    return { processed, failed, pr };
  }

  return { processed, failed, pr: null };
}

async function realDeps() {
  const aaiKey = process.env.AAI_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!aaiKey) throw new Error('missing AAI_KEY env');
  if (!anthropicKey) throw new Error('missing ANTHROPIC_API_KEY env');

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  return {
    downloadAudio: async (m) => {
      await mkdir(paths.audioTmpDir, { recursive: true });
      const out = resolve(paths.audioTmpDir, `${m.slug}.mp3`);
      return downloadAudio({ url: m.url, outputPath: out });
    },
    probeDuration: ({ path }) => probeDuration({ path }),
    readAudioBytes: async (path) => readFile(path),
    transcribe: ({ audioBytes }) => aaiTranscribe({ audioBytes, apiKey: aaiKey }),
    summarize: (args) => llmSummarize({ ...args, anthropicClient: anthropic }),
    writeTranscript: (path, content) => writeFile(path, content),
    openPR: async ({ branchName, filesToAdd, prTitle, prBody }) =>
      openTranscriptPR({
        repoRoot: paths.repoRoot,
        branchName, filesToAdd, prTitle, prBody,
        dryRun: process.env.DRY_RUN === '1',
      }),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const maxArg = args.indexOf('--max');
  const max = maxArg >= 0 ? parseInt(args[maxArg + 1], 10) : 5;

  // 1. Refresh meetings.json
  if (!dryRun) {
    console.log('[transcribe] refreshing meetings.json...');
    await execFileP('node', [resolve(paths.repoRoot, 'pull_meetings.mjs')], { cwd: paths.repoRoot });
  }

  // 2. List + filter
  const all = await listMeetings();
  const existing = await existingTranscriptSlugs();
  const newOnes = filterUntranscribed(all, existing).slice(0, max);
  console.log(`[transcribe] ${newOnes.length} new meeting(s) to process`);

  if (newOnes.length === 0) return;

  // 3. Run
  const deps = dryRun ? null : await realDeps();
  const result = await runPipeline({ meetings: newOnes, deps });
  console.log(`[transcribe] processed ${result.processed.length}, failed ${result.failed.length}`);
  if (result.pr) console.log(`[transcribe] PR: ${result.pr.prUrl || '(dry-run)'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run integration test, see pass**

```bash
node --test scripts/transcripts/transcribe.integration.test.mjs 2>&1 | tail -10
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/transcripts/transcribe.mjs scripts/transcripts/transcribe.integration.test.mjs
git commit -m "transcripts: add orchestrator with dependency-injection seam"
```

---

### Task 19: npm scripts + dependency check

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current package.json scripts**

```bash
node -e "console.log(JSON.stringify(JSON.parse(require('node:fs').readFileSync('package.json','utf8')).scripts, null, 2))"
```

- [ ] **Step 2: Add new scripts**

In `package.json` under `"scripts"`, add:

```json
"test:transcripts": "node --test scripts/transcripts/lib/*.test.mjs scripts/transcripts/*.integration.test.mjs",
"transcribe": "node scripts/transcripts/transcribe.mjs",
"transcribe:dry": "node scripts/transcripts/transcribe.mjs --dry-run"
```

- [ ] **Step 3: Verify all transcript tests still pass via the npm script**

```bash
npm run test:transcripts 2>&1 | tail
```

Expected: all tests pass (config + discovery + audio + assemblyai + summarize + render + integration = 19 tests).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "transcripts: wire npm test:transcripts and transcribe scripts"
```

---

### Task 20: README

**Files:**
- Create: `scripts/transcripts/README.md`

- [ ] **Step 1: Write the README**

```markdown
# Meeting transcripts pipeline

Generates AI transcripts and summaries of MHTV public-meeting recordings
and opens them as PRs against `main`. See
`docs/superpowers/specs/2026-05-08-meeting-transcripts-design.md` for the
full design.

## Pipeline overview

```
data/meetings.json (refreshed by pull_meetings.mjs)
   ↓
discover new meetings (not yet in _transcripts/)
   ↓
yt-dlp audio → AssemblyAI universal-2 (with speaker_labels)
   ↓
Claude Sonnet → summary card + topic-tagged segments
   ↓
write _transcripts/<slug>.md
   ↓
git checkout -b auto/transcripts-<date> + gh pr create
```

## Environment

Required:
- `AAI_KEY` — AssemblyAI API key
- `ANTHROPIC_API_KEY` — Anthropic API key
- `gh` CLI authenticated for the agbaber/marblehead repo

## Run

```bash
# Process up to 5 new meetings, open a PR
npm run transcribe

# Dry-run: list candidates without calling APIs
npm run transcribe:dry

# Tests
npm run test:transcripts
```

## Production: systemd timer

The Hetzner box runs `transcribe-meetings.timer` (in `hetzner/`) at
06:00 daily. The box owner deploys the unit files; this repo only
commits them. If you change the timer or service unit, mention it in
the commit and the box owner will redeploy.

## Costs (going-forward)

- AssemblyAI: ~$0.27/hr audio
- Claude Sonnet: ~$0.05-0.10/meeting
- 800 hrs/yr × $0.27 + 400 meetings × $0.07 ≈ $244/yr ≈ $20/mo
```

- [ ] **Step 2: Commit**

```bash
git add scripts/transcripts/README.md
git commit -m "transcripts: add pipeline README"
```

---

### Task 21: Systemd unit files (committed, not deployed)

**Files:**
- Create: `hetzner/transcribe-meetings.service`
- Create: `hetzner/transcribe-meetings.timer`

Per `~/.claude/CLAUDE.md`: do NOT deploy systemd units yourself. The box
owner does it manually during quiet windows. We commit the units to the
repo so the box owner can copy them.

- [ ] **Step 1: Create the service unit**

```ini
# hetzner/transcribe-meetings.service
# Box owner: copy to /etc/systemd/system/, then:
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now transcribe-meetings.timer
[Unit]
Description=Marblehead transcript pipeline (single run)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=claude
WorkingDirectory=/home/claude/marblehead
EnvironmentFile=/etc/marblehead-transcripts.env
ExecStart=/usr/bin/env npm run transcribe
StandardOutput=journal
StandardError=journal
TimeoutStartSec=2h

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create the timer unit**

```ini
# hetzner/transcribe-meetings.timer
[Unit]
Description=Run Marblehead transcript pipeline daily
Requires=transcribe-meetings.service

[Timer]
OnCalendar=*-*-* 06:00:00
RandomizedDelaySec=10m
Persistent=true
Unit=transcribe-meetings.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Document the env file format**

Append to `scripts/transcripts/README.md` under "Production":

```markdown

### env file (box owner)

`/etc/marblehead-transcripts.env` (mode 0600, owned by root or claude):

```
AAI_KEY=...
ANTHROPIC_API_KEY=...
```

The repo never contains these; they're set by the box owner once.
```

- [ ] **Step 4: Commit**

```bash
git add hetzner/transcribe-meetings.service hetzner/transcribe-meetings.timer scripts/transcripts/README.md
git commit -m "transcripts: add systemd unit files (deployed manually by box owner)"
```

---

### Task 22: Smoke test — one-meeting end-to-end

**Files:** none modified — this is verification.

This is the final acceptance test before we open the PR for the whole feature. Uses real APIs.

- [ ] **Step 1: Verify env vars are present**

```bash
[ -n "$AAI_KEY" ] && echo "AAI_KEY set" || echo "MISSING AAI_KEY"
[ -n "$ANTHROPIC_API_KEY" ] && echo "ANTHROPIC_API_KEY set" || echo "MISSING ANTHROPIC_API_KEY"
```

If either is missing, ask the user to provide it before continuing.

- [ ] **Step 2: Pre-clean any prior sample**

```bash
# The hand-crafted sample from Task 5 is `_transcripts/select-board-2026-04-22.md`.
# To force the pipeline to regenerate it as a smoke test, temporarily move it.
mv _transcripts/select-board-2026-04-22.md /tmp/sample-backup.md
```

- [ ] **Step 3: Run transcribe with a 1-meeting cap**

```bash
DRY_RUN=1 node scripts/transcripts/transcribe.mjs --max 1 2>&1 | tail -20
```

Expected: lists one meeting in dry-run output, no PR created.

- [ ] **Step 4: Run for real, max 1 meeting, no PR**

Edit the orchestrator call to skip PR creation for this smoke test. The
simplest path: set `DRY_RUN=1` only on the PR step. Since the
orchestrator already wires `DRY_RUN` through to `openPR`, run:

```bash
DRY_RUN=1 npm run transcribe -- --max 1
```

Expected output should include:
- "[transcribe] refreshing meetings.json..."
- "[transcribe] N new meeting(s) to process"
- A new file written to `_transcripts/<slug>.md`
- "[dry-run] would create branch ..." (no actual PR)

- [ ] **Step 5: Inspect the generated transcript**

```bash
ls _transcripts/*.md
head -60 _transcripts/$(ls -t _transcripts/*.md | head -1 | xargs basename)
```

Expected: frontmatter with all required fields populated; transcript body with timestamped speaker turns.

- [ ] **Step 6: Verify Jekyll renders it**

```bash
bundle exec jekyll build && \
  ls _site/meetings/*/index.html | tail
```

Expected: a new `_site/meetings/<slug>/index.html` exists for the freshly generated transcript.

- [ ] **Step 7: Restore the hand-crafted sample if needed**

```bash
# If the smoke test happened to regenerate select-board-2026-04-22, the
# new auto-generated version replaces the hand-crafted one. That's fine —
# we no longer need the hand-crafted sample. Otherwise restore it:
[ ! -f _transcripts/select-board-2026-04-22.md ] && mv /tmp/sample-backup.md _transcripts/select-board-2026-04-22.md
```

- [ ] **Step 8: Commit (if the auto-generated transcript is good)**

```bash
git add _transcripts/
git commit -m "transcripts: first auto-generated transcript via pipeline smoke test"
```

If the output is bad (e.g. mis-tagged topics, garbled output), do NOT commit. Tweak the prompt or fix bugs and rerun.

---

## End of plan

PR plan: ship Phase 1 (Tasks 1-9) as PR #1, then Phase 2 (Tasks 10-22) as PR #2. Each is independently mergeable; the site has a working /meetings/ feed after PR #1 even before the pipeline exists.

After merging both PRs, the box owner deploys the systemd timer and the pipeline runs nightly.

## Self-review

**Spec coverage:**
- Goal / why now → covered by Tasks 4, 5, 22 (end-to-end demonstration)
- User-facing surfaces (3 views) → Tasks 4, 5 (transcript layout), 6 (chronological feed), 7-8 (12 topic pages), 9 (Pagefind)
- Pipeline architecture (yt-dlp → AAI → Claude → render → PR) → Tasks 12, 13, 15, 16, 17, 18
- Data model (frontmatter shape) → Task 16 render module produces it; Task 5 hand-crafts an example
- Topic taxonomy (12 seeds) → Task 1; Task 15 prompt enforces it
- LLM prompt structure → Task 14; cache_control present in Task 15 implementation
- Trust model (two-tier, PR review) → Task 18 PR body has reviewer checklist
- Failure modes (skip on yt-dlp fail, AAI error, JSON invalid) → Task 18 try/catch around per-meeting work, failures recorded
- Out-of-scope (no subscriptions, no backfill, no embed) → respected throughout
- Cost estimate → Task 20 README

**Placeholder scan:** searched for "TBD", "TODO", "implement later", "fill in details" — none. All steps include exact code or commands.

**Type/name consistency:**
- `paths.transcriptsCollectionDir` used in config, discovery, transcribe — consistent
- `aaiResult` and `summary` keys used identically across render, transcribe — consistent
- `slug`, `board`, `vimeo_id`, `vimeo_url`, `duration_seconds` — consistent across spec, render, sample
- `summary_card.headline/summary/decisions/votes` and `topic_segments[].topic/topic_confidence/start_seconds` — consistent across render, summarize validator, prompt schema

**Scope:** 22 tasks across two phases; phase 1 ships independently. Each task ends with a green test or a clean Jekyll build, then a commit. Bite-sized.
