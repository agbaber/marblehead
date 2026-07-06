# Cash balance tracking — design

**Status:** spec, no implementation yet.
**Origin:** Select Board member's request on June 17, 2026 — "track Town's cash balance" (alongside a separate ask for monthly spend + variance to budget, which is partially addressed by the existing `/checkbook/` BVA chart + the choice-bucketed view added in PR #890).

## What the asker actually wants

The Select Board member wants visibility into the Town's liquidity position over time, separate from the operating-expense ledger that `/checkbook/` already shows. Their context phrase: *"I have been asking for that internally for quite some time."* That signals (a) they consider it actionable for board-level decisions, and (b) the existing internal channels haven't delivered it on a cadence they can rely on.

The substantive thing being tracked is *how much spendable cash does the Town have right now*, broken into the categories that municipal finance treats differently:

1. **Operating cash on hand** — checking + sweep accounts the Town Accountant draws from to pay this month's bills.
2. **Stabilization Fund** — voter-approved reserve for non-recurring spending (capital, emergencies). Withdrawal requires a 2/3 Town Meeting vote.
3. **OPEB Trust Fund** — pre-funded post-employment benefits (retiree health insurance). Restricted use; long horizon.
4. **Free Cash** — DOR-certified annually (typically each fall for the prior FY). Available to appropriate at Town Meeting for any purpose.
5. **Special revenue / enterprise / trust balances** — Light Plant cash, Water/Sewer Enterprise cash, individual trust funds (Larz Anderson, Pickett, etc.).

Each of those moves on a different cadence. Lumping them as "cash" is misleading; separating them tells the actual story.

## What's available today

Inventory of existing data sources, ordered by lag from "real time":

| Source                                                              | Cadence                       | Lag        | What it covers                                                        | Pipeline status                                    |
| ------------------------------------------------------------------- | ----------------------------- | ---------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| Munis General Ledger (internal)                                     | Live                          | None       | All five categories above, exact                                      | **Not public.** Would need PRR or Town Accountant. |
| Monthly Treasurer's Report (internal)                               | Monthly                       | ~2 weeks   | Operating cash + reserves                                             | **Not published.** Probably exists internally.     |
| Finance Committee meeting packets                                   | When FinCom meets             | 1&ndash;4 weeks | Often include a cash position exhibit                                  | Public, but manual to scrape; inconsistent format. |
| Select Board meeting packets                                        | Weekly                        | 1 week     | Sometimes include Treasurer's update                                  | Public, manual scrape, inconsistent format.        |
| DOR DLS Schedule A                                                  | Annual                        | ~9&nbsp;months | Year-end fund balances by fund type                                   | Already use DOR data for other reports.            |
| DOR DLS Free Cash certification                                     | Annual                        | ~12&nbsp;months | Certified Free Cash as of FY end                                    | Already in `data/marblehead_free_cash.csv` (FY04+).|
| ACFR (Annual Comprehensive Financial Report)                        | Annual                        | ~9&nbsp;months | All balance-sheet positions as of FY end                              | Already use for site charts.                       |
| Bank statements                                                     | Monthly                       | 1 week     | Just the bank balance, doesn't break down restricted vs unrestricted  | Not public.                                        |

Bluntly: nothing public is updated more often than ~monthly via FinCom packets (irregular cadence), and most public data is annual + 9–12-month lag.

## Recommendation

Three phases, each useful independently. Don't block phase 1 on the others.

### Phase 1 — ship what we already have, well

Build a `/cash-balance/` (or a section on `/checkbook/`) that shows what we *can* show today, honestly framed about the lag:

- **Free Cash certified history** (FY04 → most recent certification). Already in `data/marblehead_free_cash.csv`. A simple line or bar chart with a "last certified: [date]" caveat.
- **Stabilization Fund balance** at each year-end from ACFRs. We already have 21 ACFRs in `data/acfr/`; the balance sheet pages have the number. Hand-extract or script.
- **OPEB Trust balance** at year-end. Same source.
- **Free Cash appropriations** — how much was drawn down each FY (from FinCom reports we already have local). Already partially in `data/free_cash_operating_history.csv`.

Honest framing on the page: *"These are the most-current cash-position numbers the town publishes. The Treasurer's internal monthly report is more granular and timely, but isn't published. See [data gap notes] for what'd close that."*

**Cost:** moderate. Maybe 1–2 PRs. Mostly data extraction + a chart page. No new ingest pipeline.

**Value:** gives the Select Board member (and everyone else) a baseline they don't currently have on the public site. Even at annual cadence, the multi-year trend matters.

### Phase 2 — request monthly Treasurer's data

Ask the Town Administrator (or directly the Town Accountant/Treasurer) whether the monthly cash-position report could be published as a regular PDF or CSV. The board member's "asking internally for quite some time" line suggests the data exists; the question is publication.

If yes: build a monthly ingest. Likely a manual upload of a one-page PDF or a spreadsheet, parsed into a tiny JSON like:

```json
{
  "as_of": "2026-06-30",
  "operating_cash":      12345678,
  "stabilization":        8765432,
  "opeb_trust":           4567890,
  "enterprise_cash":      9876543,
  "other_restricted":     1234567
}
```

Then the `/cash-balance/` page becomes data-driven (similar pattern to `checkbook_view.json`) and refreshes when a new monthly report lands.

**Cost:** small once data flows; the unknown is whether the town will publish.

**Value:** turns the page from "this is what we have annually" into "this is current within a month" — which is what the Select Board member actually asked for.

### Phase 3 — automated pull, if/when there's an API

Long-term, if the town ever exposes the monthly cash position via the existing Tyler/Socrata Open Finance portal (currently just spending), the ingest could become a daily script like `scripts/fetch_checkbook_export.py`. No reason to spec this in detail now; it depends on town infrastructure decisions outside our control.

## Scope guardrails

**In scope for the eventual implementation:**
- A page or section showing cash position over time
- Honest cadence disclosure ("annual" vs "monthly" vs "as of")
- Linkbacks to ACFRs and DOR Free Cash filings as primary sources
- Citation links per the site's standard `<sup class="cite">` pattern

**Out of scope:**
- Projecting future cash flow (the page should show position, not forecast — leave that to FinCom)
- Anything live API-driven until the town actually exposes one
- Bank-level transaction detail (privacy + irrelevance)

## Open questions for the asker

Worth checking with the Select Board member before building Phase 1:

1. Is the existing `data/marblehead_free_cash.csv` (Free Cash FY04 → present) what they have in mind, or do they specifically want **operating cash** which is a different metric?
2. Would a quarterly cadence (pulled from FinCom meeting packets, where Treasurer's updates sometimes appear) be useful, or does it need to be monthly?
3. Do they have access to the internal monthly report and can share an example so we know what shape the data would take?

## What this spec does not authorize

- No code changes yet.
- No new data files committed yet.
- No new page created yet.

Next step is a conversation with the asker to confirm Phase 1 scope, then a separate implementation PR.
