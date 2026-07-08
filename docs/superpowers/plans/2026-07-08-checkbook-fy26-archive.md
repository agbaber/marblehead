# FY26 Checkbook Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back the full interactive checkbook explorer for FY26 at `/checkbook/fy26/`, rendered from the same code as the live FY27 `/checkbook/`, with FY26 data auto-refreshing daily until the books close.

**Architecture:** Extract the ~2,000-line inline explorer from `checkbook.html` into a shared `_includes/checkbook-explorer.html` parameterized by two data namespaces (`cb`, `bud`). Both `/checkbook/` (FY27) and a new `/checkbook/fy26/` page call the include with their fiscal year's `_data` dashboards. FY26 dashboards are emitted by the existing (patched) build scripts and kept fresh by a separate daily workflow.

**Tech Stack:** Jekyll 3.10 (Liquid includes, `_data/*.json`, `permalink`), Python 3.11 build scripts (`scripts/*.py`, `fylib`), GitHub Actions, Playwright smoke tests (`tests/smoke-test.mjs`).

**Spec:** `docs/superpowers/specs/2026-07-08-checkbook-fy26-archive-design.md`

---

## File Structure

**Modify:**
- `scripts/build_checkbook_csv.py` — emit per-FY dashboard (`_data/checkbook_fy<yy>.json`) for prior FYs; add `performance_filename` field.
- `scripts/build_budget_actual.py` — emit per-FY budget dashboard (`_data/budget_fy<yy>.json`) for prior FYs.
- `checkbook.html` — reduce to thin FY27 page (frontmatter + include call); update "Prior fiscal years" note to be dashboard-driven; add prominent FY26 link.
- `tests/smoke-test.mjs` — add `/checkbook/fy26/` assertions.
- `data/index.html` — add FY26 card under "Budget & spending".

**Create:**
- `_includes/checkbook-explorer.html` — the shared, parameterized explorer body.
- `checkbook-fy26.html` — thin FY26 page (`permalink: /checkbook/fy26/`).
- `_data/checkbook_fy26.json`, `_data/budget_fy26.json` — FY26 dashboards (generated).
- `data/checkbook_performance_FY26.json` — FY26 pacing rollup (generated).
- `.github/workflows/checkbook-refresh-fy26.yml` — daily FY26 refresh.

---

## Task 1: Per-FY checkbook dashboard emission

**Files:**
- Modify: `scripts/build_checkbook_csv.py:280-301` (the dashboard block)

- [ ] **Step 1: Read the current dashboard block**

Confirm lines 280-301 match the block that starts `dashboard_path = REPO_ROOT / "_data" / "checkbook.json"` and gates on `if year == fylib.current_fiscal_year():`.

- [ ] **Step 2: Replace the dashboard block**

Replace from `dashboard_path = REPO_ROOT / "_data" / "checkbook.json"` through the `else: wrote_dashboard = False` with:

```python
    # Dashboard JSON read by index.html, checkbook.html, and the FY26
    # archive page. Lives under _data/ so Jekyll loads it as
    # `site.data.checkbook` (current FY) or `site.data.checkbook_fy<yy>`
    # (a prior FY archive). A prior-FY close-out re-run writes its own
    # per-FY file and never clobbers the live current-FY dashboard.
    is_current = year == fylib.current_fiscal_year()
    yy = fylib.fy_label(year).replace("FY", "").lower()  # 2026 -> "26"
    dashboard_name = "checkbook.json" if is_current else f"checkbook_fy{yy}.json"
    dashboard_path = REPO_ROOT / "_data" / dashboard_name
    perf_name = ("checkbook_performance.json" if is_current
                 else f"checkbook_performance_FY{year % 100}.json")
    dashboard = {
        "as_of": as_of,
        "as_of_human": as_of_dt.strftime("%b ") + str(as_of_dt.day),
        "fiscal_year": fylib.fy_label(year),
        "year": year,
        "fy_start": fylib.fy_start(year).isoformat(),
        "fy_end": fylib.fy_end(year).isoformat(),
        "months_elapsed": fylib.months_elapsed(year, as_of_dt),
        "total_amount": round(total, 2),
        "total_M": f"${total / 1_000_000:.1f}M",
        "row_count": len(out_rows),
        "row_count_human": f"{len(out_rows):,}",
        "csv_filename": out_path.name,
        "performance_filename": perf_name,
        "generated_by": "scripts/build_checkbook_csv.py",
    }
    dashboard_path.parent.mkdir(parents=True, exist_ok=True)
    dashboard_path.write_text(json.dumps(dashboard, indent=1) + "\n")
    wrote_dashboard = True
```

Note: `performance_filename` is new. It is additive for FY27 (value `checkbook_performance.json`, matching today's hardcoded fetch) and lets the include pick the FY26 file without a hardcoded path.

- [ ] **Step 3: Fix the trailing print branch**

The `else` print at ~line 314 ("skipped ... to protect the live dashboard") no longer applies since we always write. Replace the `if wrote_dashboard: ... else: ...` print block with a single line:

```python
    print(f"wrote {dashboard_path.relative_to(REPO_ROOT)}")
```

- [ ] **Step 4: Verify FY27 output is unchanged in shape**

Run: `python3 -c "import json,ast; d=json.load(open('_data/checkbook.json')); print(sorted(d))"`
Expected: current keys still present. (Field `performance_filename` will be added on the next FY27 refresh; hand-add it now in Step 5 of Task 3 so the live page keeps working immediately.)

- [ ] **Step 5: Commit**

```bash
git add scripts/build_checkbook_csv.py
git commit -m "build_checkbook_csv: emit per-FY dashboard for prior years + performance_filename"
```

---

## Task 2: Per-FY budget dashboard emission

**Files:**
- Modify: `scripts/build_budget_actual.py:213-233` (the dashboard block + current-FY gate)

- [ ] **Step 1: Read the current block**

Confirm the block writes `_data/budget.json` guarded by `if year == fylib.current_fiscal_year():`.

- [ ] **Step 2: Replace the gate to write a per-FY file for prior years**

Change the dashboard destination and remove the skip. Mirror Task 1:

```python
    is_current = year == fylib.current_fiscal_year()
    yy = fylib.fy_label(year).replace("FY", "").lower()
    dashboard_name = "budget.json" if is_current else f"budget_fy{yy}.json"
    dashboard_path = REPO_ROOT / "_data" / dashboard_name
```

Keep the existing dashboard dict fields (`fiscal_year`, `year`, `fy_start`, `fy_end`, `actual_filename`, `burn_filename`, `drill_filename`, `all_funds_budget_M`, `annual_operating_M`, `generated_by`) unchanged — they are already FY-derived. Always write (drop the current-FY-only skip and its warning print).

- [ ] **Step 3: Commit**

```bash
git add scripts/build_budget_actual.py
git commit -m "build_budget_actual: emit per-FY budget dashboard for prior years"
```

---

## Task 3: Generate FY26 data artifacts

**Files:**
- Create: `data/checkbook_performance_FY26.json`, `_data/checkbook_fy26.json`, `_data/budget_fy26.json`
- Refresh: `data/checkbook_FY26_<as-of>.csv`, `data/budget_actual_FY26.json`, `data/budget_drill_FY26.json`

- [ ] **Step 1: Fetch + build the FY26 checkbook CSV and dashboard**

Run: `python3 scripts/fetch_checkbook_export.py --year 2026`
Expected: writes `data/checkbook_FY26_<max-date>.csv` and `_data/checkbook_fy26.json`. The as-of should be `2026-06-30` unless late payments have posted. Review the redaction output before committing.

- [ ] **Step 2: Build the FY26 performance rollup**

Run: `python3 scripts/build_checkbook_performance.py --year 2026 --out data/checkbook_performance_FY26.json`
Expected: `wrote data/checkbook_performance_FY26.json from checkbook_FY26_<date>.csv`. Confirm `fiscal_year` in the file is `FY26`.

- [ ] **Step 3: Rebuild FY26 budget artifacts + dashboard**

Run:
```bash
python3 scripts/build_budget_actual.py --year 2026
python3 scripts/crawl_budget_drill.py --year 2026
```
Expected: `data/budget_actual_FY26.json`, `data/budget_drill_FY26.json`, `_data/budget_fy26.json` written.

- [ ] **Step 4: Backfill `performance_filename` on the live FY27 dashboard**

The FY27 page will read `include.cb.performance_filename` after Task 4. Until the next FY27 refresh regenerates it, add the field by hand so the live page keeps working:

Edit `_data/checkbook.json` to add `"performance_filename": "checkbook_performance.json",` after the `csv_filename` line.

- [ ] **Step 5: Sanity-check no live files were clobbered**

Run: `git status --short _data/ data/`
Expected: `_data/checkbook.json` shows only the one-line `performance_filename` add; `_data/checkbook_fy26.json`, `_data/budget_fy26.json`, `data/checkbook_performance_FY26.json` are new/updated. `_data/budget.json` unchanged.

- [ ] **Step 6: Commit**

```bash
git add _data/checkbook.json _data/checkbook_fy26.json _data/budget_fy26.json \
  data/checkbook_performance_FY26.json data/checkbook_FY26_*.csv \
  data/budget_actual_FY26.json data/budget_drill_FY26.json data/checkbook_redaction_disclosure.json
git commit -m "data: FY26 checkbook artifacts + dashboards for the archive page"
```

---

## Task 4: Extract the explorer into a parameterized include

This is the highest-risk task. The FY27 page must render behavior-identical afterward.

**Files:**
- Create: `_includes/checkbook-explorer.html`
- Modify: `checkbook.html`

- [ ] **Step 1: Capture the FY27 baseline before touching anything**

Build + serve + screenshot (see Task 9 for the exact serve commands). Save `proof/checkbook-fy27-before.png`. This is the regression reference.

- [ ] **Step 2: Move the body into the include**

Cut everything in `checkbook.html` *after the frontmatter* (line 10 onward: the `<h1>` through the closing `</script>`) into a new file `_includes/checkbook-explorer.html`. Leave `checkbook.html` frontmatter in place; append the include call (Step 5).

- [ ] **Step 3: Parameterize data references in the include**

In `_includes/checkbook-explorer.html`, apply these exact replacements (all occurrences):

| Find | Replace |
|---|---|
| `site.data.checkbook.` | `include.cb.` |
| `site.data.budget.` | `include.bud.` |
| `../data/{{ include.cb.csv_filename }}` | `{{ '/data/' | append: include.cb.csv_filename | relative_url }}` |
| `../data/{{ include.bud.actual_filename }}` | `{{ '/data/' | append: include.bud.actual_filename | relative_url }}` |
| `../data/{{ include.bud.drill_filename }}` | `{{ '/data/' | append: include.bud.drill_filename | relative_url }}` |
| `'../data/checkbook_performance.json'` | `'{{ '/data/' | append: include.cb.performance_filename | relative_url }}'` |
| `../data/checkbook_performance.json` (the download link, plain href) | `{{ '/data/' | append: include.cb.performance_filename | relative_url }}` |
| `../data/checkbook_labels.json` | `{{ '/data/checkbook_labels.json' | relative_url }}` |
| `../data/checkbook_redaction_disclosure.json` | `{{ '/data/checkbook_redaction_disclosure.json' | relative_url }}` |

- [ ] **Step 4: Make the "Prior fiscal years" note dashboard-driven**

In the include, replace the hardcoded FY26 note (currently referencing `checkbook_FY26_2026-06-30.csv`) with a version that only renders on the FY27 (current) page and links the FY26 archive page and its dashboard-driven CSV:

```liquid
{% if include.cb.fiscal_year == site.data.checkbook.fiscal_year %}
    <dt>Prior fiscal years</dt>
    <dd>The full FY26 interactive explorer: <a href="{{ '/checkbook/fy26/' | relative_url }}">/checkbook/fy26/</a>. Raw ledger: <a href="{{ '/data/' | append: site.data.checkbook_fy26.csv_filename | relative_url }}">{{ site.data.checkbook_fy26.csv_filename }}</a>. FY26 figures remain subject to year-end close adjustments recorded through fall 2026. The <a href="{{ '/spending-by-vote/' | relative_url }}">FY26 year in review</a> is a separate by-vote analysis.</dd>
{% endif %}
```

- [ ] **Step 5: Reduce `checkbook.html` to a thin page**

After the frontmatter, `checkbook.html` body becomes exactly:

```liquid
{% include checkbook-explorer.html cb=site.data.checkbook bud=site.data.budget %}
```

- [ ] **Step 6: Rebuild + screenshot FY27, diff against baseline**

Rebuild/serve, screenshot `proof/checkbook-fy27-after.png`. Compare visually to `-before.png`: KPIs, budget chart, ranked vendors, table, filters must be identical.

- [ ] **Step 7: Run the smoke suite**

Run: `npm run test:local`
Expected: 52 pass / 0 fail (the existing `/checkbook/` assertion still green).

- [ ] **Step 8: Commit**

```bash
git add checkbook.html _includes/checkbook-explorer.html
git commit -m "checkbook: extract explorer into parameterized _includes/checkbook-explorer.html"
```

---

## Task 5: Create the FY26 archive page

**Files:**
- Create: `checkbook-fy26.html`

- [ ] **Step 1: Write the page**

```liquid
---
title: "Town checkbook: FY26"
permalink: /checkbook/fy26/
scripts: [citations]
og_title: "FY26: every check the town wrote"
og_description: "The full FY26 spending and pacing explorer for Marblehead, archived. Budget vs actual by Fund, Department, Category, Division, and Object. Refreshed until the town closes its FY26 books."
og_image: /assets/og/checkbook.png
og_url: https://marbleheaddata.org/checkbook/fy26/
---
<div class="archive-banner">
  Archived fiscal year. FY26 closed June 30, 2026; this page still refreshes as late payments and year-end corrections post. For the current year, see <a href="{{ '/checkbook/' | relative_url }}">the FY27 checkbook</a>.
</div>
{% include checkbook-explorer.html cb=site.data.checkbook_fy26 bud=site.data.budget_fy26 %}
```

- [ ] **Step 2: Add the archive-banner style**

Confirm `.archive-banner` exists in `assets/site.css`; if not, add a scoped block to the include or page `<style>` using existing tokens (e.g. `background: var(--c-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; color: var(--c-text-mid); margin: 0 0 20px;`). No new color tokens.

- [ ] **Step 3: Build + screenshot**

Serve, then screenshot `proof/checkbook-fy26.png`. Verify the explorer renders with **FY26** numbers (total, row count, budget-vs-actual all reflect FY26, not FY27).

- [ ] **Step 4: Commit**

```bash
git add checkbook-fy26.html assets/site.css
git commit -m "Add /checkbook/fy26/ archived explorer page"
```

---

## Task 6: Link the FY26 page from the site

**Files:**
- Modify: `checkbook.html` (top "Also see" line), `data/index.html`

- [ ] **Step 1: Add a prominent FY26 link on the FY27 page**

The dashboard-driven "Prior fiscal years" note (Task 4 Step 4) covers the notes section. Additionally, update the top "Also see" line in `checkbook.html` (currently pointing only to `/spending-by-vote/`) to also surface the FY26 explorer:

```html
  Also see: <a href="{{ '/checkbook/fy26/' | relative_url }}">the FY26 checkbook</a> and <a href="{{ '/spending-by-vote/' | relative_url }}">the FY26 year in review</a>.
```

- [ ] **Step 2: Add a `/data/` card under "Budget & spending"**

In `data/index.html`, inside the `Budget &amp; spending` `question-list` (after the `where-has-the-money-gone` card), add:

```html
  <a class="question" href="/checkbook/fy26/">
    <h2>Last year's checkbook, in full (FY26)</h2>
    <p>The complete FY26 vendor ledger and budget-vs-actual explorer, archived and still refreshing as the town closes its books.</p>
    <span class="tag tag-charts">Interactive</span>
  </a>
```

- [ ] **Step 3: Build + verify links resolve**

Serve; click through `/checkbook/` → FY26 link, and `/data/` → FY26 card. Both land on `/checkbook/fy26/`.

- [ ] **Step 4: Commit**

```bash
git add checkbook.html data/index.html
git commit -m "Link the FY26 checkbook archive from /checkbook/ and /data/"
```

---

## Task 7: Daily FY26 refresh workflow

**Files:**
- Create: `.github/workflows/checkbook-refresh-fy26.yml`

- [ ] **Step 1: Write the workflow**

Adapt `checkbook-refresh.yml`: pin `--year 2026`, use label `auto-checkbook-fy26`, concurrency group `checkbook-refresh-fy26`, cron offset to 11:00 UTC (30 min after the FY27 job at 10:30), and prune only FY26 dated CSVs. Build the FY26 performance/budget artifacts explicitly.

```yaml
name: Refresh checkbook CSV (FY26 archive)

# Daily refresh of the FY26 checkbook archive until the town closes its
# FY26 books (expected fall 2026, at which point delete this workflow).
# Kept separate from checkbook-refresh.yml so a stuck FY26 PR never
# blocks the live current-year refresh.

on:
  schedule:
    - cron: '0 11 * * *'
  workflow_dispatch:

concurrency:
  group: checkbook-refresh-fy26
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.INGEST_PAT }}
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Skip if an open FY26 auto PR already exists
        id: gate
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
        run: |
          set -euo pipefail
          gh label create auto-checkbook-fy26 --color d62728 \
            --description "Daily auto-refresh of the FY26 checkbook archive" 2>/dev/null || true
          open_count=$(gh pr list --label auto-checkbook-fy26 --state open --json number --jq 'length')
          if [ "$open_count" -gt 0 ]; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Fetch + redact FY26 export, rebuild artifacts
        if: steps.gate.outputs.skip == 'false'
        run: |
          set -euo pipefail
          python3 scripts/fetch_checkbook_export.py --year 2026
          python3 scripts/build_checkbook_performance.py --year 2026 --out data/checkbook_performance_FY26.json
          python3 scripts/build_budget_actual.py --year 2026
          python3 scripts/crawl_budget_drill.py --year 2026

      - name: Prune superseded FY26 dated CSVs
        if: steps.gate.outputs.skip == 'false'
        run: |
          set -euo pipefail
          python3 <<'PY'
          import json
          from pathlib import Path
          dash = json.loads(Path('_data/checkbook_fy26.json').read_text())
          keep = Path('data') / dash['csv_filename']
          for old in Path('data').glob('checkbook_FY26_*.csv'):
              if old != keep:
                  old.unlink(); print(f'removed {old}')
          PY

      - name: Detect changes
        if: steps.gate.outputs.skip == 'false'
        id: changes
        run: |
          set -euo pipefail
          git add -A data/ _data/
          if git diff --cached --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit, push, open PR, auto-merge
        if: steps.changes.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.INGEST_PAT }}
        run: |
          set -euo pipefail
          as_of=$(python3 -c "import json;print(json.load(open('_data/checkbook_fy26.json'))['as_of'])")
          branch="bot/checkbook-fy26-$(date -u +%Y-%m-%d-%H%M)"
          git config user.name "marblehead-bot"
          git config user.email "noreply@marbleheaddata.org"
          git checkout -b "$branch"
          git commit -m "Refresh FY26 checkbook archive through ${as_of}"
          git push -u origin "$branch"
          pr_url=$(gh pr create \
            --title "Refresh FY26 checkbook archive through ${as_of}" \
            --body "Daily FY26 archive refresh. Auto-merged; same redaction + required checks as the live job. Delete this workflow once FY26 books close." \
            --label auto-checkbook-fy26 --base main --head "$branch")
          gh pr merge "$pr_url" --auto --squash --delete-branch
```

- [ ] **Step 2: Lint the YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/checkbook-refresh-fy26.yml')); print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/checkbook-refresh-fy26.yml
git commit -m "ci: daily FY26 checkbook archive refresh (own label, auto-merge)"
```

---

## Task 8: Smoke test for the FY26 page

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Read the existing `/checkbook/` assertion**

Find the `${SITE}/checkbook/` block (around line 49) and note how it asserts (status 200, a KPI/table selector present).

- [ ] **Step 2: Add a parallel `/checkbook/fy26/` assertion**

Immediately after the `/checkbook/` block, add an analogous check that `${SITE}/checkbook/fy26/` returns 200, the explorer root element renders, and the FY label shown is `FY26` (assert page text contains `FY26`, not `FY27`). Mirror the existing block's selectors exactly.

- [ ] **Step 3: Run smoke**

Run: `npm run test:local`
Expected: 53 pass / 0 fail (was 52; +1 for the new page).

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "test: smoke assertion for /checkbook/fy26/ archive page"
```

---

## Task 9: Proof + PR

**Files:**
- Create: `proof/checkbook-fy26-archive.png`, `proof/checkbook-fy27-after.png`

- [ ] **Step 1: Build + serve**

```bash
bundle exec jekyll build
cd _site && python3 -m http.server 4001 &
```

- [ ] **Step 2: Screenshot both pages**

```bash
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4001/checkbook/" "proof/checkbook-fy27-after.png"
npx playwright screenshot --browser=chromium --viewport-size=1440,900 --device-scale-factor=2 \
  "http://localhost:4001/checkbook/fy26/" "proof/checkbook-fy26-archive.png"
```

Verify `proof/checkbook-fy26-archive.png` shows FY26 numbers and the archive banner; verify the FY27 shot matches the Task 4 baseline.

- [ ] **Step 3: Commit proof + push**

```bash
git add proof/*.png
git commit -m "proof: FY26 archive + FY27 unchanged screenshots"
git push -u origin checkbook-fy26-archive
```

- [ ] **Step 4: Open the PR**

Use `mcp__github__create_pull_request` (per CLAUDE.md: always open a PR after pushing). Body must include: Preview URL (Cloudflare Pages), the two proof screenshots, specific paths to visit (`/checkbook/`, `/checkbook/fy26/`, `/data/`), expected behavior (FY26 explorer live, FY27 unchanged), and edge cases (mobile table scroll, the archive banner, the dashboard-driven CSV link). Note the follow-up: delete `checkbook-refresh-fy26.yml` when FY26 books close.

---

## Self-Review Notes

- **Spec coverage:** Part 1 (template) → Tasks 4,5; Part 2 (data) → Tasks 1,2,3; Part 3 (ingestion) → Task 7 + the per-FY dashboard emission in Tasks 1,2; Part 4 (link/tests/proof) → Tasks 6,8,9. Rolling-filename wrinkle → Task 4 Step 4 + Task 7 prune. Relative-path gotcha → Task 4 Step 3.
- **Risk isolation:** the 2,000-line extraction (Task 4) has before/after screenshots + smoke as its own checkpoint.
- **Retirement:** noted in Task 7 header and Task 9 PR body.
