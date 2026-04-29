# Two-votes page (design spec)

Date: 2026-04-29

## Goal

Standalone shareable explainer at `marbleheaddata.org/two-votes` clarifying the difference between the Town Meeting vote and the ballot vote. Most public discussion of the override blurs the two votes into one. This page exists to fix that, in time for the May 2026 Annual Town Meeting and the June 9, 2026 ballot.

## Scope (v1)

Cover only the structure and the cases we're certain about. Skip the "does the ballot question still go forward if Town Meeting rejects the appropriation?" procedural question pending response from Select Board chair Dan Fox. The page is structured so that fourth cell of the 2x2 grid can be filled in later without restructuring the page.

## Page

- URL: `two-votes.html`
- Title (h1): Spending vote, ceiling vote
- Subtitle: Town Meeting approves the budget and spending. The ballot raises the cap on what the town can collect.
- Length target: 600-800 words
- Layout: bespoke HTML matching site convention (no `body_class: doc-page` needed)
- Scripts: `citations` (so `assets/citations.js` injects the Sources h2)

## Sections

### Section 1: "Two votes"

Lede + short mechanics paragraph. States the core claim and explains what each vote does:

- Town Meeting: appropriation. Authority to spend. Can be amended on the floor, line items can be stripped, the package can be sent back. Binding on what gets spent.
- Ballot: override of Prop 2.5 cap. Authority to raise taxes above the 2.5% growth limit. Binary yes/no per ballot question. Three nested tiers in 2026 (Tier 1 $9M, Tier 2 $12M, Tier 3 $15M).

Cite M.G.L. c. 59 Section 21C(g) inline. Use "ceiling" as the site does throughout (colloquial: the cap on what the town can collect), since site precedent (`marblehead-voting-record.html`, `index.html`) already uses this vocabulary.

### Section 2: "2 on 2"

A 2x2 outcomes grid showing what happens under each combination of votes. Three cells are confident; one is open:

|              | Ballot yes                                   | Ballot no                                                              |
|--------------|----------------------------------------------|------------------------------------------------------------------------|
| **TM yes**   | Override budget enacted                      | No-override budget; override-funded spending does not take effect      |
| **TM no**    | (Open question - see note below)             | No-override budget                                                     |

Caption: "If Town Meeting approves the appropriation but the ballot fails, the override-funded portion of the budget does not take effect even though Town Meeting approved it. That is what happened in 2023." (See Section 3 for that case.)

The TM-no / Ballot-yes cell carries a short note: "We have asked the Select Board chair whether the override question still goes on the ballot if the Town Meeting appropriation fails. We will update this page when we have an authoritative answer."

### Section 3: "Yes and yes and no"

The 2023 case study. The actual sequence: Town Meeting 534 yes / 230 no on May 1, 2023; ballot rejected the override on June 20, 2023 by 407 votes (2,992 yes / 3,399 no). Demonstrates the "TM yes, Ballot no" cell of the grid in real life.

Reuse the existing `vote-chart` styling from `what-is-the-override.html` lines 669+ if it transplants cleanly; otherwise simple bar markup.

Source citations:
- 2023 Town Meeting minutes (marbleheadma.gov uploads)
- 2023 FinCom transmittal letter (already cited on `what-is-the-override.html`)
- 2023 ballot results

## Cross-linking (in scope)

- `what-is-the-override.html` line 30: replace "It requires a majority vote at both Town Meeting and at the ballot" with a pointer to the new page that uses the same correction the new page makes (something like: "Two separate votes are required, doing two different things. See the [two votes](two-votes.html) page for what each authorizes.")
- `whats-on-the-ballot.html`: add a see-also link in the relevant section.

Homepage Q list integration is deferred to a follow-up - the page can stand alone first.

## Out of scope (v1)

- Gatekeeping case (the TM-no / Ballot-yes cell). Page notes the question is open, invites readers to come back, and is structured so this cell can be filled later without restructure.
- Editorial recommendations. The site is non-advocacy; this page explains structure and decision logic, does not tell anyone how to vote.
- Voter archetypes / "how to think about your two votes" framing. The 2x2 grid replaces that section per Andrew's preference for the outcomes-grid approach.

## Editorial guardrails

- No em-dashes (use hyphens or "and"/comma constructions)
- No meta-narration ("This page explains...", "Below you'll find...")
- "Ceiling" as the site uses it (colloquial cap), not the strict DOR distinction (limit vs. ceiling)
- Every factual claim cites a primary source via `<sup class="cite">`; `assets/citations.js` injects the Sources h2 at runtime

## Sources

All cited claims trace to primary documents already in use on the site:
- M.G.L. c. 59 Section 21C (statute)
- Town Meeting minutes May 1, 2023 (marbleheadma.gov/wp-content/uploads/2025/03/town_meeting_minutes_2023__0.pdf)
- 2023 FinCom transmittal letter (marbleheadma.gov/wp-content/uploads/2025/05/2023-04-28_fincom_report-final.pdf.pdf)
- 2023 ballot results
