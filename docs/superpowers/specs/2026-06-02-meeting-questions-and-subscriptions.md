# Design: subscriptions and resident question routing

**Status:** draft, awaiting review
**Date:** 2026-06-02
**Author:** Andrew Baber + Claude
**Builds on:**
- [2026-05-08-meeting-transcripts-design.md](2026-05-08-meeting-transcripts-design.md) (transcript pipeline, PR #754)
- [2026-06-02-meeting-transcripts-scaling.md](2026-06-02-meeting-transcripts-scaling.md) (Tier A/B/C scaling)
- The Neighbor Verification Network (passkey-based identity layer; per project memory)

## Two features, one substrate

1. **Subscriptions** &mdash; residents pick boards and topics; we email them when a matching summary lands.
2. **Question routing** &mdash; residents ask a question tied to a board or topic; we surface it back to the board as input for the next public-comment period.

Both ride on top of the transcript collection and the existing Neighbor Verification Network. Neither makes sense without verified-resident identity at the entry point: we don't want anonymous spam or non-residents driving the queue. The verification network already handles passkey auth, two-sided invite handshakes, street typeahead, and verified-ballot tally &mdash; **that layer is the foundation; we don't rebuild it.**

### Prerequisite: email capture on the verification network

The current verification flow is passkey-only and does **not** capture an email address. That gap is the blocker for subscriptions. Before either feature ships, the verify flow needs:

1. An optional email field at sign-up, with a clear "this is only used for the meeting digest you opt into; we won't email you otherwise" disclosure.
2. An email-management surface for the resident to add/change/remove the address later.
3. Storage in the existing D1 verification database, joined to the resident's verified identity row.

Until that lands, the "Log in to subscribe" CTA on transcript pages is gated behind a `site.transcripts_subscribe` feature flag in `_config.yml` (currently `false`). Flip to `true` once the email-capture flow and the Friday-digest worker both exist.

## Why now

Three readers' jobs to be done that the current site doesn't serve:

- **The lurker** &mdash; cares about schools but doesn't watch SC meetings. Wants a Friday-morning email: *"3 things happened this week."*
- **The advocate** &mdash; tracking the override across three boards. Wants a single feed of every meeting that mentions a tier or the MOU, with subject lines that are scannable.
- **The questioner** &mdash; has a specific concern (Bouvier Road sidewalks; full-day K fees) and wants their voice in front of the board *before* the next vote, not at the mic three weeks later.

We have the data (PR #754 transcripts) and the identity layer (verification network). The missing pieces are delivery and a back-channel.

## Subscriptions

### What you subscribe to

Same axes the transcript pages already use:

- **Boards** &mdash; Select Board, School Committee, Finance Committee, etc. (the 5 Tier A boards plus optional Tier B)
- **Topics** &mdash; the 13 seed topics from `data/topic_seeds.json` (override, school-budget, 40b-mbta, etc.)
- **Frequency** &mdash; *immediate* (one email per matching meeting), *weekly digest* (Friday morning), *never* (no email)

Default profile for a new verified resident: weekly digest, no boards or topics pre-selected. Subscriptions form is at `/me/subscriptions/` once they're signed in via passkey.

### What lands in the email

Reused from the transcript layout, rendered as a single-column email:

- **Subject:** `[MHD Data] N meetings this week: <three-headline excerpt>`
- **Body per meeting:** the slim hero (board chip, title, date) + the headline-callout card + 2-3 secondary article headlines (no full bodies; just the dek). Click through to the live transcript page for the rest.
- **Footer:** the same `?unsub=` token-based opt-out as community-pulse already uses.

The email template lives at `_layouts/email-digest.html` and renders the same `summary_card` + `topic_segments[]` data as the web page. Same data, smaller surface.

### Delivery

Cloudflare Worker + D1 + scheduled cron + a transactional-mail provider (existing pattern in community-pulse).

```
cron (Fri 7:00 AM ET) → Worker:
  for each verified resident with subscriptions:
    pull last 7d of _transcripts/ via GitHub API (same repo)
    filter by their (boards, topics) → matching meetings
    render email-digest.html with matching meeting data
    send via transactional provider
    log delivery to D1 (for unsub + bounce handling)
```

No new infrastructure needed beyond what community-pulse already runs. The transcript collection is the source of truth; subscriptions are a filter view over it.

### Cost

At ~200 verified residents subscribed, weekly digest: ~800 emails/month. Transactional-mail providers in this range are typically free (Resend, Postmark, Mailgun all offer 100/day or 3K/mo free tiers). Cloudflare Workers + D1 stay well within free tier.

## Question routing &mdash; the harder feature

### Hypothesis

Residents have questions for boards. Public comment at the mic is a bad UX: it requires being at the meeting, public-speaking willingness, and the courage to ask a question without knowing how it'll land. Many residents are blocked by all three.

If we let residents submit questions in writing, tied to a specific board and topic, and surface them on the splashy page **and** in the next-meeting agenda packet, then:

- The board sees a queue of resident concerns before the meeting starts
- Public-comment time at the mic gets focused on the questions that warrant elaboration
- Lurkers and asynchronous participants get a real channel
- A reader can search the question log alongside transcripts

The risk: low-quality questions, brigading, harassment. The mitigation: verified-resident-only submission + visible attribution + board-side moderation.

### Data model

```
question:
  id: q_abc123
  asked_by: <verified resident handle from network>
  asked_at: 2026-06-02T14:30:00Z
  board: select-board                # required
  topic: override                    # optional; from seed list
  question_text: "Why does Tier 1 leave the sustainability coordinator out?"
  context_meeting: select-board-2026-04-08    # optional; links to the transcript that prompted the question
  status: pending | answered | declined-to-answer | duplicate
  answer:
    answered_by: <board-member name>           # filled if status=answered
    answered_at: ...
    answer_text: "..."
    answered_in_meeting: select-board-2026-05-13   # link to the meeting transcript where it was answered
  votes_supporting: 12                # other verified residents endorsing the question
```

### Surfaces

Two surfaces per topic + board, then aggregated:

1. **On the transcript page** &mdash; new section between "Tonight's record" and the full-transcript disclosure: "Questions from residents about this meeting". Lists questions whose `context_meeting` matches, with vote counts and answer state.

2. **On the topic page** (`/topics/<topic>/`) &mdash; "Outstanding questions" panel at the top. Lists questions filtered by topic. Sorted by `votes_supporting DESC, asked_at DESC`.

3. **For the board** &mdash; a per-board view at `/boards/<board>/questions/`. Public-readable but the actionable view (mark-answered, mark-duplicate) is gated behind board-member auth.

### Friction is the feature

Per project memory: "for correction/feedback features, prefer GitHub-issue paths over zero-friction widgets; friction self-selects for serious signal."

Application here: question submission requires:

- Passkey sign-in via the verification network (already required to be a verified resident)
- Pick a board and topic from the existing taxonomy &mdash; no free-form board/topic
- Question text limited to **300 characters** &mdash; forces clarity, prevents speeches
- Cool-down: **3 pending questions** per resident maximum at any time

These constraints kill nearly all brigading and spam without needing manual review of every submission. Resident bandwidth is a real cost; protecting boards from a flood of low-quality questions is what makes them willing to engage with the system at all.

### Surfacing back to the board

Two channels:

1. **Pre-meeting digest** &mdash; the Tuesday before each Select Board / School Committee / FinCom meeting, a cron sends a digest email to the board chairs and clerks with all pending questions in the matching board's queue, sorted by votes. **The board does not have to answer.** They simply see what's queued. If they want to answer in the meeting, that becomes part of the meeting; the answer flows back into the question record via the same transcript pipeline.

2. **Self-service dashboard** &mdash; board chairs and clerks can log in (passkey, same identity layer) to a board view that shows pending questions and lets them mark answered / declined-to-answer / duplicate. Marking answered requires linking to a meeting URL where the answer happened.

### Question lifecycle

```
pending  ──asked──►  queue
  │
  ├──answered in meeting──►  answered  (linked to transcript)
  │
  ├──vote count > threshold──►  promoted to "agenda candidate"
  │   (chairs see a stronger nudge)
  │
  ├──marked duplicate by chair──►  duplicate (merged into target Q)
  │
  └──marked declined-to-answer──►  declined  (with optional reason)
```

A question that's never answered after 60 days auto-flags as "unanswered &mdash; please follow up" on the topic page; not a punishment, just a visibility nudge.

### Anti-patterns we are not building

- **Voting/polling on positions.** This is a question channel, not a town-meeting substitute. No "should the override pass yes/no" surveys.
- **Anonymous submission.** Verified residents only. No exceptions. The verification network gate is the only thing that makes this safe for boards to engage with.
- **Comment threads on questions.** No nested discussion under each question. One question, optional one answer. If a resident has a follow-up, they ask another question. Nested threads turn this into Facebook.
- **Public-facing emoji reactions on board pages.** Memory: contested-question pages stay reaction-free. Same applies here.
- **Auto-classification of questions into topics by LLM.** The resident picks the topic at submission. We don't risk silent miscategorization.

## Where this rides on existing infrastructure

| Capability | Existing system | New work |
|---|---|---|
| Resident identity | Neighbor Verification Network (passkey, street typeahead, invite handshake) | None |
| Email delivery | community-pulse Cloudflare Worker pattern | New `_layouts/email-digest.html` |
| Question storage | D1 (used by verification + community-pulse) | New table `questions`, new table `question_votes` |
| Question display | Jekyll site | New `/topics/<t>/` panel, new `/boards/<b>/questions/` page, new transcript-page section |
| Board moderation | &mdash; | New gated dashboard, gated by `is_board_member` flag in identity layer |
| Pre-meeting digest | community-pulse cron pattern | New cron job, new email template |
| Auto-flagging unanswered | &mdash; | New scheduled task to mark 60-day-stale questions |

This is **2-3 weeks of work**, not a quarter. The leverage comes from reusing the existing verification network for identity and the transcript pipeline for context.

## Success criteria

- 50 verified residents subscribed to at least one board within 60 days of launch
- Email open rates ≥30% on the Friday digest (transactional benchmarks for civic content suggest 25-35%)
- At least one question per Tier A board per month getting a board response
- No brigading incidents in the first 6 months (defined as: >5 low-quality questions from one resident in 7 days)
- Topic-page "Outstanding questions" panel populated for at least 5 of the 13 seed topics

## Open questions for the human reviewer

1. **Question-vote threshold for "agenda candidate" promotion.** What number? Recommend: **10 supporting votes**, sized to roughly the same activation energy as standing at the public-comment mic.
2. **Should chairs be able to *answer questions in writing* between meetings?** Or only by answering in a meeting that produces a transcript? Recommend: latter only. Forces the answer onto the public record and into the searchable archive. Chairs can still respond informally to a question's asker out-of-band.
3. **Cross-board questions.** Resident asks a question about the override that touches three boards. Pick one or duplicate to each? Recommend: pick one, with the chair able to forward via a "this belongs to <other board>" action that just re-tags it.
4. **Should public-comment-period mic time still exist?** Yes &mdash; this augments, doesn't replace. Open Meeting Law requires the mic option. The submitted-question queue is a parallel channel.
5. **Subscription email author/sender.** From `noreply@marbleheaddata.org` with a reply-to that hits Andrew? Or do we want a proper inbox? Recommend: `noreply` for v1; revisit if open rates suggest residents want to engage back.
6. **PRR exposure.** Verified-resident question records become public records once the question is asked. Make this clear in the submission UI: "Questions submitted here are public records and will be visible on this site and may be cited by other residents and the board."

## Out of scope for this design

- Resident polling on positions (the homepage already handles that for the override)
- LLM-assisted question drafting ("rephrase my question")
- Automatic answer detection in transcripts (Phase 3; could LLM-flag answered questions on PR review)
- Board-to-board cross-referrals beyond a manual flag
- Comment threads on questions (anti-pattern, see above)
- Reactions on questions (anti-pattern, see contested-questions memory)

## Implementation handoff

This is a self-contained 2-3 week project. Suggested phasing:

1. **Week 1:** subscriptions only. Worker + D1 table + Jekyll subscription-management page + Friday digest cron.
2. **Week 2:** question submission + topic-page surfacing. No board dashboard yet; first questions go into the queue without anyone actioning them.
3. **Week 3:** board moderation dashboard + pre-meeting digest email + answer-linking workflow.

Each week ships independently. Subscriptions can live without questions; questions can live with only the public-readable surfaces and add the moderation flow later.

Next step: `writing-plans` on this spec to produce ordered tasks.
