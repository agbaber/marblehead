---
layout: page
body_class: doc-page
title: Bias remediation plan
---

# Bias remediation plan

Remediation actions for every finding in the [April 11, 2026 bias audit](bias-audit.html). Each item maps to a numbered concern from that report.

---

## 1. Case studies show only one direction (Moderate)

**Finding:** The case studies page presents Melrose and Stoneham, both towns where a failed override led to cuts and then a larger override. No counter-examples are presented. The "key lesson" boxes use editorial language ("cost of delay," "bigger eventual bill").

**Remediation:**

- **1a. Add counter-examples or acknowledge their absence.** Research Massachusetts towns that rejected overrides and sustained the resulting budget without returning to the ballot at a larger amount within three years. If such towns exist, add them as case studies with equal depth. If the research finds that the pattern genuinely runs one direction (failed overrides nearly always return larger), state that finding explicitly and cite the DOR dataset that supports it, so the reader knows the selection is not cherry-picked but representative.
- **1b. Remove editorial language from "key lesson" boxes.** ~~Replace "cost of delay" and "bigger eventual bill" with factual summaries.~~ **Done.** The Melrose key-lesson box now reads: "Melrose rejected $7.7M in June 2024 and passed $13.5M in November 2025, 75% more than the original ask. The intervening 17 months included 61.4 FTE reductions, class sizes proposed up to 32, and the smallest new-teacher orientation in years."
- **1c. Add a framing note at the top of the case studies page.** ~~State what the case studies show and what they do not show.~~ **Done.** A blockquote at the top of the page explains the selection, acknowledges the absence of counter-examples, cites the DOR fail-and-return data, and invites readers to submit counter-example towns via GitHub issue.

---

## 2. Asymmetric vividness between no-override and override-cost pages (Moderate)

**Finding:** The no-override budget page is the most visually detailed page on the site (headcount bars, department-by-department cut charts, named services). The override cost page is a clinical calculator. The emotional weight is asymmetric.

**Remediation:**

- **2a. Add a "what the override costs" visualization to the calculator page.** **Done.** The calculator now includes a "Cumulative cost over time" section showing 5-year and 10-year total additional taxes for each tier, dynamically scaled to the entered home value.
- **2b. Add fixed-income context to the calculator.** **Done.** An "Income context" section shows the Year 3 annual override cost as a percentage of household income at $50K (roughly 16th percentile), $75K (roughly 28th percentile), and $182,132 (Marblehead median). Source: US Census Bureau, ACS 2020-2024 5-year estimates. 8,289 total households; approximately 16% earn under $50K.
- **2c. Add a "read next" link from the no-override page to the calculator.** **Done.** "What does the override cost me?" is now the first link in the no-override page's read-next section.

---

## 3. "How we got here" favors the institutional account (Low-moderate)

**Finding:** The history page reads as a defense of institutional credibility. It quotes FinCom transmittal letters showing 16 years of balanced budgets and advance warnings, and concludes that "the 'board always wants more' skepticism does not fit the record." This forecloses the counter-reading that the same boards presided over the spending growth.

**Remediation:**

- **3a. Add the counter-reading to the history page.** **Done.** The paragraph after the 2021 FinCom quote now presents both readings and links to [tension #5 on the debate page](the-debate.html#tension-5).
- **3b. Remove or qualify the editorial conclusion.** **Done.** The takeaway was changed from `takeaway--pos` to `takeaway--neutral` and rewritten: "Whether that history is evidence of fiscal discipline or of deferred structural reform is one of the central tensions in the debate."

---

## 4. The "against" side has fewer named advocates (Low)

**Finding:** The "for" side is represented by the Town Administrator, Finance Director, Superintendent, and named parent advocates. The "against" side draws primarily on a single Select Board dissenter and on structural arguments. This is partly a function of who speaks on the public record.

**Remediation:**

- **4a. Actively seek on-the-record quotes from override opponents.** Review Town Meeting transcripts, letters to the editor in the Marblehead Independent/Beacon/Current, and any public statements from the For Marblehead group (the organized opposition). Add named quotes where they strengthen the "against" perspective blocks on the debate page.
- **4b. If quotes remain scarce, strengthen the disclosure.** **Done** (present from initial debate page build). The notes section explains the asymmetry: named officials appear more often on the record than resident opponents, and notes that the "against" voices on the page reflect accountability voices inside the process rather than organized opposition outside it.

---

## 5. The author's "undecided" framing is unverifiable (Structural)

**Finding:** The about page claims the author is "genuinely undecided." The scale of the project raises the question of whether this is credible. This cannot be resolved from the code.

**Remediation:**

- **5a. Replace the undecided claim with a process commitment.** **Done.** The about page, debate page, and question-2-trash page now use: "The same editorial rules apply to both sides... the bias audit tests them. If you find a violation, report it." with links to the bias audit and a pre-filled GitHub issue.
- **5b. Publish the bias audit and this remediation plan.** (Done. The audit is at [bias-audit.html](bias-audit.html) and you are reading the remediation plan.) The act of publishing criticism of the site and committing to fix it is stronger evidence of good faith than a neutrality claim.

---

## 6. The site's architecture inherently centers the override (Structural)

**Finding:** The homepage leads with "What is the override?" and "What's in the no-override budget?" A skeptic's version of the site might lead with "How did spending reach this level?" or "What alternatives to an override exist?"

**Remediation:**

- **6a. Elevate the spending and alternatives questions on the homepage.** **Done.** Homepage section order is now: Spending, Cost drivers, The override, Peer comparison. The spending-growth context appears before the override mechanics, framing the override as one response to a spending situation. The "start here" flow and featured debate card remain at the top for new visitors.
- **6b. Add a homepage card for the civic guide.** **Done.** "What can you do?" was repositioned in the override section to appear directly after the no-override budget card, before the case studies card.
- **6c. Acknowledge the structural framing in the about page or bias audit.** (Done. Finding #6 in the bias audit names this directly.)

---

## Implementation priority

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| 1 | 1b. Remove editorial language from case study "key lesson" boxes | Small (text edit) | Done |
| 2 | 3b. Remove or qualify the editorial conclusion on the history page | Small (text edit) | Done |
| 3 | 5a. Replace "undecided" claim with process commitment | Small (text edit) | Done |
| 4 | 2c. Add "read next" link from no-override page to calculator | Small (HTML) | Done |
| 5 | 6b. Add civic guide homepage card | Small (HTML) | Done |
| 6 | 1c. Add framing note to case studies page | Small (text) | Done |
| 7 | 3a. Add counter-reading to history page | Medium (new section) | Done |
| 8 | 6a. Reorder homepage sections | Medium (HTML restructure) | Done |
| 9 | 2a. Add cumulative cost visualization to calculator | Medium (chart work) | Done |
| 10 | 2b. Add fixed-income context to calculator | Medium (data + text) | Done |
| 11 | 4a. Seek on-the-record quotes from override opponents | Large (research) | Open |
| 12 | 1a. Research and add counter-example towns | Large (research) | Open |
| 13 | 4b. Strengthen voice-asymmetry disclosure | Small (text, fallback if 4a is insufficient) | Done |

---

## Status

This plan was generated on April 11, 2026 alongside the bias audit. Progress is tracked in the [GitHub repository](https://github.com/agbaber/marblehead).

**April 12, 2026 (round 1):** Items 1b, 1c, 2c, 3a, 3b, 4b, 5a, and 6b completed in [PR #157](https://github.com/agbaber/marblehead/pull/157). The history page takeaway was changed from `takeaway--pos` to `takeaway--neutral` and rewritten to present both readings of the FinCom arc. The "genuinely undecided" claim was replaced with a process commitment on about, debate, and question-2-trash pages. The case studies page received a framing note acknowledging what the studies do and don't show. The no-override page now links to the calculator as its first read-next suggestion. The voice-asymmetry disclosure (4b) was already present on the debate page from its initial build.

**April 12, 2026 (round 2):** Items 2a, 2b, and 6a completed. The override calculator now shows cumulative 5-year and 10-year costs and override cost as a percentage of household income at three thresholds (Census ACS 2020-2024). The homepage section order was changed from override-first to spending-first. Two items remain open: 4a (on-the-record opponent quotes, requires Town Meeting transcript research) and 1a (counter-example towns, requires DOR dataset research).
