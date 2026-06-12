# Social Media Plan H2 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the post-vote H2 2026 social media plan: replace the pre-vote operational doc, build post templates, shift the existing meeting-digest cron from Friday to Monday, capture a baseline, and queue the three tentpole posts (Jul 1, Sep 12 checkpoint, Dec 12 roundup).

**Architecture:** The plan is mostly documentation and one cron change. The committed operational doc replaces `SOCIAL_MEDIA_PLAN.md`. The digest cron in `meeting-digest/worker/wrangler.toml` shifts from Friday 7 AM ET to Monday 7 AM ET. Two templates (FB post, email digest structure) land as committed markdown so future drafts have an anchor. Baseline metrics get a one-shot capture script. The summer biweekly toggle is human discretion, not code.

**Tech Stack:** Markdown (plan + templates), `meeting-digest/worker/wrangler.toml` (cron config), `meeting-digest/worker/src/scheduled.js` (comment update), Node script under `meeting-digest/tools/` for baseline metric capture.

**Spec reference:** `docs/superpowers/specs/2026-06-12-social-media-plan-h2-design.md`

---

## File map

- Modify: `SOCIAL_MEDIA_PLAN.md` (full rewrite, post-vote operational doc)
- Create: `docs/social/fb-post-template.md` (Facebook post template + Canva guidance)
- Create: `docs/social/email-digest-template.md` (Monday digest structure: lead + sub-items + sidebar)
- Create: `docs/social/tentpole-calendar.md` (date-anchored posts: Jul 1, Sep 12, Dec 12, plus any first MOU quarterly review date once announced)
- Modify: `meeting-digest/worker/wrangler.toml` (cron Fri to Mon)
- Modify: `meeting-digest/worker/src/scheduled.js` (header comment to match Monday)
- Modify: `meeting-digest/worker/test/scheduled.test.js` (if it pins Friday)
- Create: `meeting-digest/tools/baseline-h2.mjs` (one-shot metric snapshot script)
- Create: `docs/social/baseline-2026-06-12.md` (output of the baseline snapshot, hand-edited if needed)

---

## Task 1: Archive the pre-vote social plan and write the H2 operational doc

The pre-vote `SOCIAL_MEDIA_PLAN.md` describes a campaign that ended June 9. Keep it in git history (no separate archive file) and replace the in-repo file with the H2 operational version.

**Files:**
- Modify: `SOCIAL_MEDIA_PLAN.md`

- [ ] **Step 1: Replace `SOCIAL_MEDIA_PLAN.md` with the H2 version**

Write the file with this structure (fill in real numbers where bracketed):

```markdown
# Social Media Plan

Marblehead Data, post-vote operational plan.
Six months: Jun 12 to Dec 12, 2026.
Spec: docs/superpowers/specs/2026-06-12-social-media-plan-h2-design.md

## Why this plan exists

The pre-vote plan (April 24 to June 9, 2026) ended its mission when
all four override ballot questions passed. This is the post-vote
plan: watchdog spine, tools as discovery layer, civic literacy as
durable fallback.

## Channels and cadence

- Facebook page "Marblehead Data": 2x/week, Mon and Thu mornings.
- Meeting Digest email: weekly Monday during active season
  (Sep through Jun), biweekly during summer (Jul to Aug).
- Marblehead Current op-eds: held in reserve. Revisited mid-Sep.

The Monday email and the Monday FB post anchor the same morning. The
email goes to subscribers; the FB post highlights the email's lead
finding and links to it / to the digest signup.

## Three post types

Pick what has substance that week. No fixed ratio.

1. Watchdog. What the town did. Default for email and Monday FB.
2. Tool feature. Screenshot plus a paragraph from one site tool.
   Default for Thursday FB.
3. Civic literacy. One durable concept. Fallback when the first two
   are thin.

## Templates

- Facebook post: docs/social/fb-post-template.md
- Email digest: docs/social/email-digest-template.md
- Tentpole calendar: docs/social/tentpole-calendar.md

## Tone rules

Same as pre-vote: neutral, sourced, plain text, no markdown bold on
Facebook, no em-dashes anywhere, no editorial language. Acronyms
expanded on first use. Screenshots default to unfiltered views.

## Baseline (Jun 12, 2026)

See docs/social/baseline-2026-06-12.md for the starting metric snapshot.

## Month 3 checkpoint (mid-September)

Targets, measured against April 2026 baseline:

- Email subscribers: at least 100 active.
- Facebook page followers: at least 200.
- Monthly site traffic: at or above April baseline (462 visitors).
- Channel mix: email plus Facebook drive at least 40 percent of
  traffic.

If short on reach, add op-eds. If short on email growth, run a
one-time FB push for digest signup.
```

- [ ] **Step 2: Commit**

```bash
git add SOCIAL_MEDIA_PLAN.md
git commit -m "Replace pre-vote social plan with H2 operational doc"
```

---

## Task 2: Create the Facebook post template

A reusable scaffold so each Monday or Thursday post has a known shape and the user does not redesign the post each week.

**Files:**
- Create: `docs/social/fb-post-template.md`

- [ ] **Step 1: Write the template file**

```markdown
# Facebook post template

Plain text only. No markdown bold or italic (renders as literal
asterisks). No em-dashes. No emojis unless integral to the data.

## Structure

1. Hook (1 to 2 sentences): the specific finding or question. Lead
   with the number or the verb. No "this post is about" framing.
2. Two to four lines: what the data shows, in plain language. Cite
   the source inline ("from the FY27 adopted budget", "from the
   May 18 Select Board meeting").
3. One link to a specific page on marbleheaddata.org. Not the
   homepage unless the post is intentionally a homepage push.
4. Page tag at end: @MarbleheadData (only if posting from a personal
   account in a group).

## Screenshot

Always attach one. Specs:

- Source: a specific tool view on the site (Checkbook drill, Town
  Explorer filter, a chart, a card from a longread).
- Defaults: unfiltered view. Do not pre-sort or pre-filter to make
  a point.
- Format: PNG. Aspect ratio 16:9 or 4:3, not full-page strips.
- Frame: navy #1B3A57 border, lighthouse mark top-left, URL bottom.
  Canva template lives at [link to Canva when created].

## Anti-patterns

- "Check this out" with no lead finding.
- Markdown bold (\*\*word\*\*) appearing as literal asterisks.
- Em-dashes (use periods or commas).
- Editorial framing: "shocking", "concerning", "outrageous", etc.
- Pre-filtered screenshots that load a conclusion.
- More than one link per post.
- Tagging "@MarbleheadData" on the page itself (only useful when
  posting from a personal account into a group).

## By post type

Watchdog: lead with the finding. "The Select Board voted 4-1 on
Tuesday to spend X on Y." Link to the meeting page or the relevant
tool.

Tool feature: lead with the question the tool answers. "Want to see
which line items grew most between FY26 and FY27? The Checkbook
drill now shows..." Screenshot is the tool itself.

Civic literacy: lead with the concept name and a one-line definition.
"Free cash is the money the town has at end of year that was not
spent. Here is how it gets used." Link to the page that explains it
in full.
```

- [ ] **Step 2: Commit**

```bash
git add docs/social/fb-post-template.md
git commit -m "Add Facebook post template for H2 social plan"
```

---

## Task 3: Create the email digest template

The existing meeting-digest worker renders subject and body from
recent transcripts. The template below describes the editorial shape
for the human-curated lead and sidebar that wrap the auto-generated
transcript matches.

**Files:**
- Create: `docs/social/email-digest-template.md`

- [ ] **Step 1: Write the template file**

```markdown
# Meeting Digest email template

The digest worker (meeting-digest/worker/src/scheduled.js) builds the
body from recent MHTV transcripts matched to each subscriber's
boards and topics. This template covers the editorial shape that
wraps those matches.

## Structure

1. Subject. One line, lead with the most concrete finding from the
   week. "Select Board: Q1 FY27 spending is tracking 3% under budget"
   not "Marblehead Data weekly digest". Subject is what gets opened.
2. Lead finding (one short paragraph). The watchdog headline of the
   week. Specific number or decision, not "things happened".
3. Per-board sections (auto-generated). One sub-section per board
   the subscriber follows, with transcript-matched bullets.
4. Sidebar (optional, one item). Tool feature or civic literacy
   piece. Two sentences. Link to the page.
5. Footer (unchanged from existing worker output): unsubscribe,
   manage preferences, source attribution.

## Editorial rules

- Lead finding has a number in it whenever possible.
- Acronyms expanded on first use: "Annual Comprehensive Financial
  Report (ACFR)" not "ACFR".
- No editorial language. Say "the budget is X dollars over the FY26
  baseline", not "the budget jumped to X" or "budget surges to X".
- Source attribution inline. "From the FY27 adopted budget" or
  "From the June 3 Select Board meeting".
- Plain language, but full sentences. Email tolerates a longer
  attention span than a Facebook post.

## Summer mode

July and August: send every other Monday, not weekly. Skip the
intermediate Mondays. Human discretion: if there is nothing
substantive to report that week, skip; if there is, send.

There is no code-level summer toggle. The user decides per send.

## When the lead finding is thin

Late summer or holiday weeks may not have a watchdog lead. In that
case, lead with a civic literacy piece or a tool feature, and label
the email accordingly ("Marblehead Data: how free cash works" not
"weekly digest"). Subscribers tolerate fewer "nothing happened
this week" emails than they tolerate substantive non-watchdog ones.
```

- [ ] **Step 2: Commit**

```bash
git add docs/social/email-digest-template.md
git commit -m "Add email digest editorial template"
```

---

## Task 4: Move the digest cron from Friday to Monday

The existing cron fires Friday 7 AM ET. The H2 plan anchors on
Monday. Update the wrangler config and the comments.

**Files:**
- Modify: `meeting-digest/worker/wrangler.toml`
- Modify: `meeting-digest/worker/src/scheduled.js` (header comment only)

- [ ] **Step 1: Update wrangler.toml cron**

Replace the existing cron block:

```toml
# Friday 7:00 AM ET == 11:00 UTC (EST) / 12:00 UTC (EDT).
# Run at 11:00 and 12:00; the scheduled handler chooses one based on the
# current ET hour, the other becomes a no-op. Keeps DST handling simple.
[triggers]
crons = ["0 11 * * 5", "0 12 * * 5"]
```

with:

```toml
# Monday 7:00 AM ET == 11:00 UTC (EST) / 12:00 UTC (EDT).
# Run at 11:00 and 12:00; the scheduled handler chooses one based on the
# current ET hour, the other becomes a no-op. Keeps DST handling simple.
[triggers]
crons = ["0 11 * * 1", "0 12 * * 1"]
```

- [ ] **Step 2: Update the comment header in scheduled.js**

Open `meeting-digest/worker/src/scheduled.js` and locate the comment that says:

```
// Only run on the cron hour that corresponds to 7 AM ET.
// EST (Nov–Mar): UTC = ET + 5  ⇒  11 UTC == 6 AM ET, 12 UTC == 7 AM ET
// EDT (Mar–Nov): UTC = ET + 4  ⇒  11 UTC == 7 AM ET, 12 UTC == 8 AM ET
// We schedule both 11 and 12 UTC, and run when the ET hour equals 7.
```

No change required to the function logic itself (it still runs when the ET hour equals 7, regardless of day). Update the file's top-level docstring (if any) to refer to "Monday" rather than "Friday" if it currently does. Search for any "Friday" mention in the file and update.

- [ ] **Step 3: Check for any test that pins Friday**

```bash
grep -rE "(friday|Friday|day.*5)" meeting-digest/worker/test/ meeting-digest/worker/src/
```

If any test asserts the run-day is Friday, update it to Monday.

- [ ] **Step 4: Run the worker test suite**

```bash
cd meeting-digest/worker
npm test
```

Expected: PASS for all tests.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/wrangler.toml meeting-digest/worker/src/scheduled.js
# include any updated tests
git commit -m "Shift digest cron from Friday to Monday for H2 social plan"
```

- [ ] **Step 6: Deploy the worker (not automated)**

The cron change does not take effect until the worker is deployed.
Note in the commit message or PR body that a manual deploy is
required:

```
cd meeting-digest/worker
npx wrangler deploy
```

Do not deploy from the agent. The user will deploy when they review
the PR.

---

## Task 5: Build the baseline-metric snapshot script

A one-shot script that pulls current values for the four month-3
checkpoint metrics, so we have a Jun 12 baseline to compare to in
mid-September.

**Files:**
- Create: `meeting-digest/tools/baseline-h2.mjs`
- Create: `docs/social/baseline-2026-06-12.md`

- [ ] **Step 1: Write `meeting-digest/tools/baseline-h2.mjs`**

```javascript
#!/usr/bin/env node
// Pulls a one-shot snapshot of the four month-3 checkpoint metrics
// and prints them to stdout in markdown. Intended to be run once on
// Jun 12, 2026 and once on Sep 12, 2026 (and again on Dec 12, 2026).
//
// Outputs:
//   - Email subscribers count (from the meeting-digest D1 database)
//   - Facebook page follower count (NOT automated, prompts user to
//     fill in manually)
//   - Monthly site traffic (NOT automated, prompts user to read off
//     PostHog dashboard manually)
//   - Channel mix percentage (NOT automated, prompts manually)
//
// Why partial automation: only the D1 subscriber count is reachable
// without OAuth scaffolding we do not have. Everything else is a
// two-minute human pull from PostHog and the FB page admin view.

import { execSync } from 'node:child_process';

function pullSubscriberCount() {
  // wrangler d1 execute against the meeting-digest DB. Requires the
  // user to be logged into wrangler.
  const cmd = `cd meeting-digest/worker && npx wrangler d1 execute meeting-digest --command "SELECT COUNT(*) as n FROM subscriber WHERE status = 'confirmed'" --json`;
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    return parsed?.[0]?.results?.[0]?.n ?? 'unknown';
  } catch (e) {
    return `error: ${e.message}`;
  }
}

const today = new Date().toISOString().slice(0, 10);
const subs = pullSubscriberCount();

const out = `# Baseline snapshot ${today}

Run via: \`node meeting-digest/tools/baseline-h2.mjs\`

| Metric | Value | Source |
|---|---|---|
| Email subscribers (confirmed) | ${subs} | D1 query, automated |
| Facebook page followers | FILL IN | FB page admin > Insights > Followers |
| Monthly site traffic (last 30 days unique visitors) | FILL IN | PostHog dashboard |
| Channel mix: FB + email as % of total traffic | FILL IN | PostHog acquisition |

## Notes

Compare against April 2026 baseline: 462 unique visitors, 26% Facebook.
Hand-edit this file with the manual numbers, then commit.
`;

console.log(out);
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x meeting-digest/tools/baseline-h2.mjs
```

- [ ] **Step 3: Run it and capture output**

```bash
node meeting-digest/tools/baseline-h2.mjs > docs/social/baseline-2026-06-12.md
```

Expected: The subscriber count is populated. The other three fields say "FILL IN".

- [ ] **Step 4: Fill in the three manual values**

Open `docs/social/baseline-2026-06-12.md` in an editor. Replace
each "FILL IN" with the actual current number from PostHog and the
FB admin view.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/tools/baseline-h2.mjs docs/social/baseline-2026-06-12.md
git commit -m "Capture Jun 12 baseline metrics for H2 social plan"
```

---

## Task 6: Write the tentpole calendar

Three date-anchored posts the user should not forget. Each has a draft
hook so the live writing is not from scratch.

**Files:**
- Create: `docs/social/tentpole-calendar.md`

- [ ] **Step 1: Write the file**

```markdown
# Tentpole calendar, H2 2026

Three date-anchored posts for the six-month H2 plan. Each is a
short-notice draft so the live writing is not from scratch.

## Jul 1, 2026 (Wed): "FY27 starts today"

Channels: Facebook (Monday post on Jun 30 cannot mention this; do
Tue Jun 30 evening FB queued for Wed Jul 1 7 AM, OR shift Thursday
post to Wed Jul 1).

Draft hook:
"Today, July 1, is the first day of FY27. The override that passed
last month adds $15M to the operating budget this year. We will be
tracking where it lands, line item by line item, on the Checkbook.
[Link to Checkbook FY27 view as soon as it exists, or to the
budget-flow page in the meantime.]"

Sub-mentions to include:
- The trash question also passed; trash funding is now in its own
  carve-out (link to the trash page).
- First MOU quarterly review expected in Sep or Oct.

Email send: tie the Jun 29 or Jun 30 Monday digest to this marker.
Lead: "FY27 starts Wednesday. Here is what changes."

## Sep 12, 2026 (Sat): Month 3 checkpoint

Not a public post; an internal task.

1. Re-run `node meeting-digest/tools/baseline-h2.mjs` and capture as
   `docs/social/checkpoint-2026-09-12.md`.
2. Fill in the three manual values.
3. Compare against the four month-3 targets in `SOCIAL_MEDIA_PLAN.md`.
4. Decide:
   - If all four met: stay the course.
   - If reach short: draft first op-ed for the Marblehead Current.
   - If email growth short: queue a FB push for digest signup
     (screenshot a recent digest, lead with the one finding people
     would have learned by subscribing).
5. Record the decision in `docs/social/checkpoint-2026-09-12.md`.

## Dec 12, 2026 (Sat): Six-month roundup

Public post and email.

Draft hook:
"Six months ago, Marblehead voted yes on a $15M override and a
$2.3M trash carve-out. Here is what the data shows about the first
six months of FY27 spending. [Link to a half-year spending breakdown
page, or to the existing Checkbook with a fiscal-year filter set to
H1 FY27.]"

Components to assemble before the post:
- H1 FY27 spending pull from the Checkbook (likely needs a
  pre-loaded query or page).
- Comparison against the override's promised spending mix (the four
  Tier 3 line items: schools, public safety, DPW, facilities).
- Any divergence: where the money landed differently than promised.
- One civic literacy piece in the email sidebar: how the next
  budget cycle starts in Jan.

This is also the moment to re-evaluate cadence and channel mix for
H1 2027.
```

- [ ] **Step 2: Commit**

```bash
git add docs/social/tentpole-calendar.md
git commit -m "Add tentpole calendar for H2 social plan (Jul 1, Sep 12, Dec 12)"
```

---

## Task 7: Open a pull request

Per the project's "always open a PR after pushing" rule (CLAUDE.md).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin social-plan-h2
```

- [ ] **Step 2: Open the PR**

Use `gh pr create` (works fine from inside the worktree). Title:

"Social media plan H2 2026: post-vote operational setup"

Body sections (paste preview URL when CI populates it):

```markdown
## Summary

Stands up the post-vote H2 social media plan. Two channels (Facebook
2x/week Mon/Thu, email digest weekly Mon). Op-eds in the Marblehead
Current held in reserve, revisited mid-September.

- Replaces pre-vote `SOCIAL_MEDIA_PLAN.md` with H2 operational doc
- Adds FB post template and email digest editorial template
- Shifts meeting-digest cron from Friday to Monday (requires manual
  worker deploy after merge)
- Captures Jun 12 baseline metrics (subscribers automated, traffic
  and FB followers hand-filled)
- Adds tentpole calendar with three date-anchored posts (Jul 1 FY27
  start, Sep 12 month-3 checkpoint, Dec 12 six-month roundup)

## Preview URL

[fill in once Cloudflare preview deploys]

## Test plan

- [ ] Read `SOCIAL_MEDIA_PLAN.md` in the preview, verify the H2
      content renders.
- [ ] Read `docs/social/fb-post-template.md` in the preview.
- [ ] Read `docs/social/email-digest-template.md` in the preview.
- [ ] Read `docs/social/baseline-2026-06-12.md` and confirm the
      three hand-filled values are populated.
- [ ] Read `docs/social/tentpole-calendar.md` and confirm the three
      drafts read as usable.

## Post-merge

- [ ] Deploy meeting-digest worker:
      `cd meeting-digest/worker && npx wrangler deploy`
- [ ] Verify next Monday's digest fires (Jun 15 if merged before
      then; otherwise the next Monday after deploy).
```

---

## Self-review checklist

Run before declaring done.

1. **Spec coverage:** Every spec section maps to a task.
   - Strategic anchor: Task 1 (the in-repo plan doc).
   - Channels: Task 1 plus Task 4 (cron) plus Task 7 (PR description).
   - Cadence: Task 4 (Monday cron); summer biweekly is human
     discretion per Task 3 template.
   - Three post types: Task 1 plus Task 2 (FB) plus Task 3 (email).
   - Tone: Task 1, Task 2, Task 3.
   - Tentpole calendar: Task 6.
   - Success metric at month 3: Task 5 (baseline) plus Task 6 (Sep
     12 checkpoint task in the tentpole calendar).
   - What this plan does not do / out of scope: covered by absence
     of tasks; no Instagram, no Substack, etc.

2. **Placeholder scan:** the only "fill in" markers are deliberate
   (manual metric pulls, preview URL).

3. **Type consistency:** the script in Task 5 names match between
   creation, executable bit, and run commands.

4. **File-path consistency:** `docs/social/` is used consistently
   across Tasks 2, 3, 5, 6, 7. Template files are referenced from
   `SOCIAL_MEDIA_PLAN.md` in Task 1 by the same paths.
