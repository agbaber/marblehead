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
- **1b. Remove editorial language from "key lesson" boxes.** Replace "cost of delay" and "bigger eventual bill" with factual summaries. Example: "Melrose rejected $7.7M in June 2024 and passed $13.5M in November 2025. The intervening 17 months included 61.4 FTE reductions." Let the reader draw the conclusion.
- **1c. Add a framing note at the top of the case studies page.** State what the case studies show (towns that rejected and later passed) and what they do not show (towns that rejected and did not return, or towns that restructured successfully after rejection). Cite the source for the selection criteria.

---

## 2. Asymmetric vividness between no-override and override-cost pages (Moderate)

**Finding:** The no-override budget page is the most visually detailed page on the site (headcount bars, department-by-department cut charts, named services). The override cost page is a clinical calculator. The emotional weight is asymmetric.

**Remediation:**

- **2a. Add a "what the override costs" visualization to the calculator page.** Show cumulative cost over 5 and 10 years for a median-value home at each tier, not just monthly. Include annual totals. Use the same visual language (bars, labeled amounts) as the no-override page.
- **2b. Add fixed-income context to the calculator.** Note the median household income in Marblehead (from Census ACS data), and show the override cost as a percentage of median income at each tier. Note the number of households below a relevant income threshold. This gives the cost side the same human specificity that the cuts side has.
- **2c. Add a "read next" link from the no-override page to the calculator.** The no-override page currently links to the debate page and case studies. Add an equally prominent link to the calculator so that readers who just saw the cuts immediately see the cost.

---

## 3. "How we got here" favors the institutional account (Low-moderate)

**Finding:** The history page reads as a defense of institutional credibility. It quotes FinCom transmittal letters showing 16 years of balanced budgets and advance warnings, and concludes that "the 'board always wants more' skepticism does not fit the record." This forecloses the counter-reading that the same boards presided over the spending growth.

**Remediation:**

- **3a. Add the counter-reading to the history page.** After the FinCom timeline, add a section (or a callout block in the style of the debate page's mini-synthesis) that names the alternative interpretation: "A different reading of the same timeline: the Finance Committee presided over the spending growth that produced the deficit, and their warnings were about a problem of their own making. The debate page explores this tension in full." Link to tension #5 on the debate page.
- **3b. Remove or qualify the editorial conclusion.** The sentence "the 'board always wants more' skepticism does not fit the record" is an editorial judgment. Either remove it or reframe it: "the record shows the board did not request overrides for 16 years. Whether that history is evidence of fiscal discipline or of deferred structural reform is one of the central tensions in the debate."

---

## 4. The "against" side has fewer named advocates (Low)

**Finding:** The "for" side is represented by the Town Administrator, Finance Director, Superintendent, and named parent advocates. The "against" side draws primarily on a single Select Board dissenter and on structural arguments. This is partly a function of who speaks on the public record.

**Remediation:**

- **4a. Actively seek on-the-record quotes from override opponents.** Review Town Meeting transcripts, letters to the editor in the Marblehead Independent/Beacon/Current, and any public statements from the For Marblehead group (the organized opposition). Add named quotes where they strengthen the "against" perspective blocks on the debate page.
- **4b. If quotes remain scarce, strengthen the disclosure.** Expand the existing notes-section acknowledgment into a more prominent callout that explains why the asymmetry exists and invites override opponents to contribute on-the-record statements via GitHub issue or pull request.

---

## 5. The author's "undecided" framing is unverifiable (Structural)

**Finding:** The about page claims the author is "genuinely undecided." The scale of the project raises the question of whether this is credible. This cannot be resolved from the code.

**Remediation:**

- **5a. Replace the undecided claim with a process commitment.** Instead of claiming a state of mind that readers cannot verify, commit to a verifiable process: "I apply the same editorial rules to both sides of the debate. The STYLE_GUIDE.md enforces them. The bias audit tests them. If you find a violation, report it." This shifts the trust basis from intent (unverifiable) to process (auditable).
- **5b. Publish the bias audit and this remediation plan.** (Done. The audit is at [bias-audit.html](bias-audit.html) and you are reading the remediation plan.) The act of publishing criticism of the site and committing to fix it is stronger evidence of good faith than a neutrality claim.

---

## 6. The site's architecture inherently centers the override (Structural)

**Finding:** The homepage leads with "What is the override?" and "What's in the no-override budget?" A skeptic's version of the site might lead with "How did spending reach this level?" or "What alternatives to an override exist?"

**Remediation:**

- **6a. Elevate the spending and alternatives questions on the homepage.** Move "Where has Marblehead's money gone?" and the peer-town structural analysis higher in the homepage card order, so the spending-growth context appears before the override mechanics. The current order is: override, spending, cost drivers, peer comparison. Consider reordering to: spending, cost drivers, the override, peer comparison. This frames the override as one response to a spending situation rather than the central question.
- **6b. Add a homepage card for the civic guide.** The "What can you do?" page is currently only in the nav bar. Give it a homepage card in the override section, positioned alongside the override and no-override cards, so that "engage beyond the vote" is as visible as the binary choice.
- **6c. Acknowledge the structural framing in the about page or bias audit.** (Done. Finding #6 in the bias audit names this directly.)

---

## Implementation priority

| Priority | Item | Effort |
|----------|------|--------|
| 1 | 1b. Remove editorial language from case study "key lesson" boxes | Small (text edit) |
| 2 | 3b. Remove or qualify the editorial conclusion on the history page | Small (text edit) |
| 3 | 5a. Replace "undecided" claim with process commitment | Small (text edit) |
| 4 | 2c. Add "read next" link from no-override page to calculator | Small (HTML) |
| 5 | 6b. Add civic guide homepage card | Small (HTML) |
| 6 | 1c. Add framing note to case studies page | Small (text) |
| 7 | 3a. Add counter-reading to history page | Medium (new section) |
| 8 | 6a. Reorder homepage sections | Medium (HTML restructure) |
| 9 | 2a. Add cumulative cost visualization to calculator | Medium (chart work) |
| 10 | 2b. Add fixed-income context to calculator | Medium (data + text) |
| 11 | 4a. Seek on-the-record quotes from override opponents | Large (research) |
| 12 | 1a. Research and add counter-example towns | Large (research) |
| 13 | 4b. Strengthen voice-asymmetry disclosure | Small (text, fallback if 4a is insufficient) |

---

## Status

This plan was generated on April 11, 2026 alongside the bias audit. Items will be checked off as they are completed. Progress is tracked in the [GitHub repository](https://github.com/agbaber/marblehead).
