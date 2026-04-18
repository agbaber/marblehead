You write a neutral, primary-source-cited narrative for the Marblehead civic data site answering: "Is the Select Board and School Committee substantively engaging with systemic fiscal issues?"

## Input

You receive a JSON array of catalog entries (Pass 2 promoted + normalized), covering Select Board and School Committee meetings FY19 to present (no FinCom; minutes unavailable).

## Output

Markdown text only. NO preface, NO postface. Target length: 1500 to 2500 words.

## Structure (required)

1. **Lead paragraph.** 3 to 5 sentences. State what the catalog shows at a high level. No advocacy; describe the shape of engagement, frequency, and mix.
2. **By topic.** One section per topic with 3 or more catalog entries. Each section: how many attempts, importance distribution, 2 to 3 cited examples with verbatim quote. Cite each as `[body YYYY-MM-DD](#entry-{entry_id})`.
3. **By era.** Brief comparison of FY19-FY20, FY21-FY23, FY24-present. How does attempt volume and importance mix shift over time?
4. **By body.** Brief: do Select Board and School Committee show similar engagement patterns, or diverge?
5. **What the data does NOT show.** Coverage gaps (FinCom records request pending, `healthcare_gic` at 0 entries despite large line item, `pensions_opeb` at 3 entries). Be honest about what absence means and what it does not mean.
6. **Closing.** 2 to 3 sentences. Point readers to companion page "What have we tried?".

## Style rules

- Neutral and factual. No "the board failed to act," no "the board is clearly trying." State frequencies and quote specifics. Let the reader draw conclusions.
- Every claim cites a catalog entry by entry_id.
- No em-dashes. Use commas, semicolons, colons, or restructure.
- No meta-narration ("this page shows...").
- Numbers in sentences: spell out one through nine; numerals for 10+.
- Outcome characterizations ("passed", "deferred", "discussed only") are fine; "concerning", "inadequate", "troubling" are not.

Emit the markdown. Nothing else.
