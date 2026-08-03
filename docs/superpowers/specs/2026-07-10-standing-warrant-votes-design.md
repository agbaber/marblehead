# Standing Warrant Votes: v1 design

Date: 2026-07-10
Status: draft for review

## Summary

A new product where verified Marblehead residents cast standing, amendable votes on the questions Town Meeting actually decides: the omnibus operating budget decomposed by department, the recurring money articles, and each year's specific articles. Individual votes are private; aggregates are quorum-gated and published as dated, citable snapshots. It runs on the existing community-pulse verification stack, a new SvelteKit app, and a public versioned API that the app itself consumes.

This is the first sub-project of a larger "digitize Marblehead" direction. It deliberately excludes deliberation, user-submitted warrants, moderation, chatbots, and native apps. Those are later phases that land on this foundation.

## Decisions made during brainstorming, with reasons

1. **Brand relationship to marbleheaddata.org: deliberately undecided.** The design works under either a separate brand or a subdomain. Everything ships to a neutral subdomain first; the naming call is deferred and nothing forecloses it. The data site's non-advocacy charter is not modified by this project.
2. **V1 bet: the count is legitimate.** Not verification scale, not online deliberation. V1 succeeds if its published counts are credible enough to be cited in town debate.
3. **No Special Town Meeting angle.** MGL c. 39 s. 10 lets 200 registered voters compel an STM, and the platform could organize that, but v1 stays out of it. Targeting the FY28 budget cycle keeps the posture neutral and the runway long. (Statute facts verified against malegislature.gov: 200 voters or 20 percent, whichever is less, compels an STM; 10 voters insert an annual warrant article; 100 insert a special warrant article.)
4. **Electorate: verified residents, voter-flagged.** Any verified adult resident can vote. Every published aggregate reports two cuts: all verified residents, and the registered-voter subset. Registration is a reporting dimension, never a gate.
5. **Tallies: quorum-gated, vote-first, standing.** Questions stay open for months. Tallies are hidden from everyone until a question crosses quorum (default 100, configurable per question), and past quorum are visible only after the viewer has cast their own vote. Dated snapshots are the citable artifact; there is no live public scoreboard.
6. **Ballot shape: warrant-mirrored.** The ballot is the warrant, restructured: omnibus budget article decomposed into its department lines (too high, too low, just right), recurring and year-specific articles voted support or oppose, consent articles displayed but not voted. Published results map one-to-one onto what Town Meeting decides.
7. **Build: new SvelteKit app, API-first, on the shared Cloudflare plumbing.** The community-pulse worker grows a versioned public API; the app is its first client. SvelteKit over Next or Astro because it is closest to the existing vanilla-JS mental model, deploys first-party on Cloudflare, ships small bundles to phone-heavy Facebook traffic, and gives no-JavaScript voting through form actions.

## Non-goals for v1

- No user-submitted warrant articles, so no content moderation surface.
- No comments, reactions, or discussion threads anywhere.
- No claim, express or implied, that results bind the town. The methodology page says what the count is and is not.
- No chatbot, no native app, no paid API tiers.
- No changes to marbleheaddata.org beyond optional cross-links.

## Architecture

- **App (new repository):** SvelteKit on Cloudflare. Deploy target detail (Pages vs Worker with static assets) is settled by a DNS constraint: the zone lives at Namecheap and the site on GitHub Pages, and a subdomain CNAME to Cloudflare Pages works with external DNS while a Workers custom domain requires the zone on Cloudflare. Default plan: Cloudflare Pages behind `votes.marbleheaddata.org` (name provisional).
- **API (existing worker, grown):** community-pulse worker adds a `/api/v1/` namespace. Existing widget endpoints are untouched. CORS opens to the app origin.
- **Database (existing D1):** same database, new tables below. The verification tree, passkeys, invites, and recovery keys are reused as-is.
- **Corpus pipeline:** warrant article series and instances are maintained as CSVs in the marblehead repo `data/` directory with provenance columns, synced into D1 by script, following the parcel-owners sync pattern. First extraction is committed with this spec as `data/town_meeting_warrant_articles.csv` (348 articles, meeting years 2016, 2019, 2021, 2022, 2023, 2025, 2026; gap years 2017, 2018, 2020, 2024 are explicit; sources are the FinCom Report PDFs in the source-archive-v1 release).

## Data model (new tables)

- **`article_series`**: slug, title, kind (`budget_line`, `money_article`, `other_article`, `consent`), first_year, notes. Persistent identity across years. Department lines of the omnibus are `budget_line` series.
- **`article_instances`**: series_id, meeting_year, meeting_type (annual or special), article_number, amount, fincom_recommendation, tm_result, tm_vote_yes, tm_vote_no, in_effect, source_doc. What the town actually put on the warrant and what Town Meeting did. The result vocabulary observed in the 2019-2025 corpus: adopted, defeated, indefinitely postponed, withdrawn, not taken up. `in_effect` is distinct from adoption because the two can diverge (the 2025 3A overlay was adopted 951-759 at Town Meeting, then overturned by the July 2025 town-wide referendum). Facts only; usable by the data site independent of voting.
- **`questions`**: series_id, cycle (`fy27-enacted`, `fy28-proposed`, ...), vote_type (`tri` or `support`), status (`open`, `superseded`), quorum_n, opened_at, superseded_by. When a new cycle opens, affected questions supersede with a final snapshot and fresh questions open on the same series.
- **`question_votes`**: primary key (question_id, identity_hash), answer, first_voted_at, updated_at. Upsert on amendment; the current row is the vote. Never exposed per-identity through any interface.
- **`snapshots`**: immutable dated aggregates per question and per cycle: N, answer distribution, registered-voter cut, verification-method mix. Permalinked, downloadable as JSON and CSV.
- **`residents`** (existing) gains: is_registered_voter, voter_checked_at, voter_check_method.
- **`street_list`**: normalized resident rows from the town clerk's annual street list, loaded like `parcel_owners`, used as a second self-serve match source (covers renters) and as the registered-voter source if its voter markings are usable.

## Verification and identity

- Verification paths, all existing: Facebook OAuth plus parcel-owner match; invite tree (3 invites per resident, branch roots, revocation); in-person license checks creating branch roots. Passkeys for persistent login.
- New: street-list matching for self-serve verification of non-owners. Acquiring the street list from the clerk is an offline errand with lead time and is the biggest single unlock for renter participation.
- New: registered-voter flag per resident, with method and check date.
- Privacy boundary: per-identity votes never cross the API. Aggregates only, and only past quorum. Any resident-map visualization renders density at most, never addresses or names.

## Voting mechanics

- **Ballot home:** four groups: Budget by department (roughly 20 tri-state questions), Money articles, Other articles, Consent (read-only). Whole-ballot progress indicator. Every question skippable; partial ballots are normal.
- **Question page:** vote control; "what this pays for" content, largely drawn from existing data-site material via links; the series' multi-year history from `article_instances`; FinCom recommendation where one exists; source citations throughout. Site editorial rules apply: neutral semantic colors, facts not conclusions, no green-good red-bad.
- **Casting:** plain form POST works without JavaScript (SvelteKit form action), enhanced when JS is available. Votes amendable anytime.
- **Tally visibility:** hidden below quorum; past quorum, visible after the viewer votes on that question.
- **Cycle transition:** on FY28 proposal release, final FY27 snapshots publish, new questions open, and subscribers are notified through the existing digest infrastructure that the numbers changed and their standing votes are being re-asked.

## Results and methodology

- Question pages show distribution, N, registered-voter cut, and trend since opening, only under the visibility rules above.
- Snapshots are the citable artifact and each carries its own methodology block.
- The methodology page states plainly: this is a self-selected count of verified residents, not a probability sample; there is no margin of error because there is no sampling; here is the verification-method mix; here is N against registered voters and against typical Town Meeting attendance. The product never claims "what Marblehead thinks," only "what N verified residents said."

## API

- **Public reads, no key:** series, instances (the warrant corpus with citations), questions with quorum-gated aggregates, snapshots, cycles. JSON, CORS-open, edge-cached with ETags, generous anonymous rate limits.
- **Authenticated writes:** cast and amend votes, manage verification. Session-authed only; votes never flow through API keys.
- **Ships with v1:** OpenAPI spec and a docs page.
- **Deferred:** API keys for higher read limits; payment only if demand justifies it. Corpus data is public record and stays free.

## Design system

Small and owned: one token file (type scale, spacing, semantic colors that respect the neutral-comparison rule) and roughly ten components: question card, tri-vote control, support control, quorum-aware tally bar, snapshot table, verify badge, progress header. Visual identity stays placeholder-neutral until the naming decision.

## Rollout

1. Foundation: app repo, CI, deploy, `/api/v1/` scaffold on the worker.
2. Corpus: load series and instances from the CSVs. Town Meeting results for 2019-2025 (398 articles, including the October 2020 Special Town Meeting) are already committed as `data/town_meeting_results.csv`; remaining backfill is 2016 dispositions and the 2026 results when the town posts them.
3. Private beta: end-to-end voting with the existing verified cohort.
4. Street list: acquire, load, enable renter self-serve and voter flags.
5. Public launch against the FY27 enacted budget; snapshots begin as questions cross quorum.
6. FY28 cycle when the proposal drops (winter 2026-27).

## Testing

- Playwright end-to-end on real flows: verify, vote with and without JavaScript, amend, quorum boundary, cycle transition.
- Worker API tests in vitest, following the existing community-pulse test pattern, on staging first.
- Manual accessibility pass on the ballot (keyboard, screen reader, no-JS).

## Open questions, each with a working default

- **Name and domain.** Default until decided: `votes.marbleheaddata.org`, placeholder-neutral visual identity.
- **Quorum default.** Working default 100 per question; revisit against real verification counts before public launch.
- **Registered-voter source.** Default: street list voter markings if usable; fall back to a voter-list records request.
- **Digest integration timing.** Default: cycle-transition notifications only, nothing per-question, until subscribers opt in to more.

## Later phases (out of scope, recorded so v1 doesn't foreclose them)

Deliberation and Q&A with proposed answers; resident-proposed warrant articles with a moderation model designed on purpose (friction-first, consistent with the GitHub-issue preference for corrections); bylaws and vote history as a browsable versioned corpus (seeded by `article_series` and `article_instances`); a native app as a second API client; the binding-recognition campaign, which is a political project (home rule petition, special act) that the platform can inform but not shortcut.
