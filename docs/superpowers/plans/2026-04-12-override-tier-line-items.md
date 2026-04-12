# Override tier line-item detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse prose tier cards on `what-is-the-override.html` with detailed, dollar-denominated line-item breakdowns sourced from `data/override_town_line_items.csv`.

**Architecture:** CSS additions to `assets/site.css` for tier line-item layout and Restore/New tags; HTML replacement of the three tier card blocks in `what-is-the-override.html`. No JS. Hardcoded HTML consistent with the rest of the site.

**Tech Stack:** Static HTML, CSS custom properties, Jekyll/GitHub Pages

---

### Task 1: Add CSS styles for tier line items

**Files:**
- Modify: `assets/site.css` (after the existing `.tier-list` rules, around line 2739)

- [ ] **Step 1: Add tier line-item CSS rules**

Insert after the `.tier-list` mobile media query (after line 2739 in `assets/site.css`):

```css
/* ==========================================================================
   Tier line-item detail (override page)
   ========================================================================== */

.tier-items { margin: 12px 0 4px; }

.tier-group-heading {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-subtle);
  margin: 16px 0 4px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
}
.tier-group-heading:first-child {
  margin-top: 4px;
  padding-top: 0;
  border-top: none;
}

.tier-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  font-size: 14px;
}
.tier-line-name { color: var(--text); }
.tier-line-amount {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tier-line--offset .tier-line-name,
.tier-line--offset .tier-line-amount { color: var(--text-subtle); }
.tier-line--school {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
  font-weight: 600;
}
.tier-line--school .tier-line-name { color: var(--text); }
.tier-line--school .tier-line-amount { color: var(--text); }

.tier-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-right: 4px;
  vertical-align: 1px;
}
.tier-tag--restore {
  color: var(--c-teal);
  background: color-mix(in srgb, var(--c-teal) 12%, transparent);
}
.tier-tag--new {
  color: var(--c-navy);
  background: color-mix(in srgb, var(--c-navy) 12%, transparent);
}

@media (max-width: 600px) {
  .tier-line { font-size: 13px; }
  .tier-tag { font-size: 9px; }
}
```

- [ ] **Step 2: Commit CSS**

```bash
git add assets/site.css
git commit -m "Add CSS for tier line-item detail on override page"
```

---

### Task 2: Replace Tier 1 card with line-item detail

**Files:**
- Modify: `what-is-the-override.html` (lines 103-116)

- [ ] **Step 1: Replace the Tier 1 card**

Replace the existing Tier 1 card (lines 103-116, from `<div class="card tier-card--1">` through its closing `</div>`) with:

```html
  <div class="card tier-card--1">
    <p class="tier-label">Tier 1: Restore ($9 million)</p>
    <h3>Bring back services cut from the <a href="no-override-budget.html">no-override budget</a></h3>
    <div class="tier-items">
      <div class="tier-group-heading">Public Safety</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Police school resource officer</span>
        <span class="tier-line-amount">$65,482</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Police equipment</span>
        <span class="tier-line-amount">$2,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Inspections subscriptions and maintenance</span>
        <span class="tier-line-amount">$52,500</span>
      </div>

      <div class="tier-group-heading">Public Works</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> DPW staffing</span>
        <span class="tier-line-amount">$140,594</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> DPW hot top paving</span>
        <span class="tier-line-amount">$60,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Cemetery laborer</span>
        <span class="tier-line-amount">$58,692</span>
      </div>

      <div class="tier-group-heading">Recreation, Library & Parks</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Library staffing for accreditation</span>
        <span class="tier-line-amount">$311,183</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Recreation and Parks groundskeeper</span>
        <span class="tier-line-amount">$45,000</span>
      </div>

      <div class="tier-group-heading">General Government</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Finance staffing</span>
        <span class="tier-line-amount">$68,287</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Finance technology and training</span>
        <span class="tier-line-amount">$58,361</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Finance Committee Reserve Fund</span>
        <span class="tier-line-amount">$26,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> HR advertising and subscriptions</span>
        <span class="tier-line-amount">$11,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Community Development staffing</span>
        <span class="tier-line-amount">$137,423</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Public Buildings custodians</span>
        <span class="tier-line-amount">$122,554</span>
      </div>

      <div class="tier-group-heading">Health & Human Services</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Council on Aging staffing</span>
        <span class="tier-line-amount">$76,171</span>
      </div>

      <div class="tier-group-heading">Reserves & Transfers</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> OPEB trust transfer</span>
        <span class="tier-line-amount">$96,771</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Stabilization transfer</span>
        <span class="tier-line-amount">$250,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Workers Comp and Section 111F transfer</span>
        <span class="tier-line-amount">$97,662</span>
      </div>

      <div class="tier-line tier-line--offset">
        <span class="tier-line-name">Unemployment reduction from restored positions</span>
        <span class="tier-line-amount">&minus;$410,116</span>
      </div>

      <div class="tier-line tier-line--school">
        <span class="tier-line-name">Schools</span>
        <span class="tier-line-amount">~$7.7M</span>
      </div>
    </div>
    <p class="source">Source: Town Administrator's <a href="https://www.marbleheadindependent.com/kezer-presents-9m-to-15m-tiered-override-plan-and-separate-2-2m-trash-tax-option/">April 8, 2026 override presentation</a>. School allocation is the tier total minus town-side line items.</p>
  </div>
```

The Dan Fox blockquote immediately after this card (lines 118-121) stays exactly where it is.

- [ ] **Step 2: Commit Tier 1 card**

```bash
git add what-is-the-override.html
git commit -m "Replace Tier 1 card with line-item detail"
```

---

### Task 3: Replace Tier 2 card with line-item detail

**Files:**
- Modify: `what-is-the-override.html` (lines 123-127 after previous edit)

- [ ] **Step 1: Replace the Tier 2 card**

Replace the existing Tier 2 card (from `<div class="card tier-card--2">` through its closing `</div>`) with:

```html
  <div class="card tier-card--2">
    <p class="tier-label">Tier 2: Stabilize ($12 million)</p>
    <h3>Everything in Tier 1, plus maintenance and staffing</h3>
    <div class="tier-items">
      <div class="tier-group-heading">Public Safety</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Police staffing</span>
        <span class="tier-line-amount">$65,482</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Fire staffing</span>
        <span class="tier-line-amount">$148,000</span>
      </div>

      <div class="tier-group-heading">Public Works</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> DPW GIS position</span>
        <span class="tier-line-amount">$70,000</span>
      </div>

      <div class="tier-group-heading">Recreation, Library & Parks</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Library staffing</span>
        <span class="tier-line-amount">$218,980</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Library materials</span>
        <span class="tier-line-amount">$168,400</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Library PT custodian and assistant</span>
        <span class="tier-line-amount">$38,378</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Recreation and Parks PT Senior Clerk</span>
        <span class="tier-line-amount">$27,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Recreation and Parks maintenance</span>
        <span class="tier-line-amount">$15,000</span>
      </div>

      <div class="tier-group-heading">General Government</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Finance IT Director</span>
        <span class="tier-line-amount">$150,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Finance Budget Analyst</span>
        <span class="tier-line-amount">$70,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Community Development staffing</span>
        <span class="tier-line-amount">$170,552</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--restore">Restore</span> Town Clerk staffing</span>
        <span class="tier-line-amount">$66,125</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Public Buildings maintenance</span>
        <span class="tier-line-amount">$450,000</span>
      </div>

      <div class="tier-group-heading">Health & Human Services</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Council on Aging PT Social Worker</span>
        <span class="tier-line-amount">$45,000</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Council on Aging maintenance</span>
        <span class="tier-line-amount">$15,000</span>
      </div>

      <div class="tier-line tier-line--offset">
        <span class="tier-line-name">Additional unemployment reduction</span>
        <span class="tier-line-amount">&minus;$282,245</span>
      </div>

      <div class="tier-line tier-line--school">
        <span class="tier-line-name">Schools</span>
        <span class="tier-line-amount">~$1.6M</span>
      </div>
    </div>
    <p class="source">Source: Town Administrator's <a href="https://www.marbleheadindependent.com/kezer-presents-9m-to-15m-tiered-override-plan-and-separate-2-2m-trash-tax-option/">April 8, 2026 override presentation</a>. School allocation is the tier total minus town-side line items. Amounts shown are incremental to Tier 1.</p>
  </div>
```

- [ ] **Step 2: Commit Tier 2 card**

```bash
git add what-is-the-override.html
git commit -m "Replace Tier 2 card with line-item detail"
```

---

### Task 4: Replace Tier 3 card with line-item detail

**Files:**
- Modify: `what-is-the-override.html` (lines 129-133 after previous edits)

- [ ] **Step 1: Replace the Tier 3 card**

Replace the existing Tier 3 card (from `<div class="card tier-card--3">` through its closing `</div>`) with:

```html
  <div class="card tier-card--3">
    <p class="tier-label">Tier 3: Invest ($15 million)</p>
    <h3>Everything in Tiers 1 and 2, plus capital</h3>
    <div class="tier-items">
      <div class="tier-group-heading">Public Safety</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Police staffing</span>
        <span class="tier-line-amount">$65,482</span>
      </div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Fire staffing</span>
        <span class="tier-line-amount">$296,000</span>
      </div>

      <div class="tier-group-heading">General Government</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Community Development Grant Writer</span>
        <span class="tier-line-amount">$70,000</span>
      </div>

      <div class="tier-group-heading">Health & Human Services</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Health Department mental health counseling</span>
        <span class="tier-line-amount">$60,000</span>
      </div>

      <div class="tier-group-heading">Recurring Capital</div>
      <div class="tier-line">
        <span class="tier-line-name"><span class="tier-tag tier-tag--new">New</span> Capital funding for leases, equipment, and buildings</span>
        <span class="tier-line-amount">$1,000,000</span>
      </div>

      <div class="tier-line tier-line--school">
        <span class="tier-line-name">Schools</span>
        <span class="tier-line-amount">~$1.5M</span>
      </div>
    </div>
    <p class="source">Source: Town Administrator's <a href="https://www.marbleheadindependent.com/kezer-presents-9m-to-15m-tiered-override-plan-and-separate-2-2m-trash-tax-option/">April 8, 2026 override presentation</a>. School allocation is the tier total minus town-side line items. Amounts shown are incremental to Tier 2.</p>
  </div>
```

- [ ] **Step 2: Commit Tier 3 card**

```bash
git add what-is-the-override.html
git commit -m "Replace Tier 3 card with line-item detail"
```

---

### Task 5: Push and open PR

- [ ] **Step 1: Create branch off main, cherry-pick commits, push**

```bash
git checkout -b override-tier-line-items origin/main
# cherry-pick or recreate the commits from the worktree
git push -u origin override-tier-line-items
```

- [ ] **Step 2: Open pull request**

Title: "Add line-item detail to override tier cards"

Body: Replace the prose bullet-point tier cards on the override page with
dollar-denominated line items from the Town Administrator's override
presentation. Each item tagged Restore or New. Incremental framing (Tier 2
shows only what it adds beyond Tier 1). Schools line in each card to account
for the full tier amount.

---

## Data derivation notes (for the implementer)

All town-side line items and dollar amounts come directly from
`data/override_town_line_items.csv`. The CSV has columns:
`category,description,tier_1_9m,tier_2_12m,tier_3_15m`.

**Tier 1 items:** All rows where `tier_1_9m > 0` (or < 0 for the offset).

**Tier 2 incremental items:** All rows where `tier_2_12m > tier_1_9m`. The
displayed amount is `tier_2_12m - tier_1_9m`. Two items have this:
- Community Development staffing: $307,975 - $137,423 = $170,552
- Offset (unemployment): -$692,361 - (-$410,116) = -$282,245

All other Tier 2 items go from $0 to their Tier 2 value.

**Tier 3 incremental items:** All rows where `tier_3_15m > tier_2_12m`. The
displayed amount is `tier_3_15m - tier_2_12m`:
- Police staffing: $130,964 - $65,482 = $65,482
- Fire staffing: $444,000 - $148,000 = $296,000
- Grant Writer and Mental Health go from $0 to their values.
- Recurring Capital: $0 to $1,000,000.

**School allocation per tier (cumulative):**
- Tier 1: $9,000,000 - $1,269,564 = $7,730,436 (~$7.7M)
- Tier 2: $12,000,000 - $2,705,236 = $9,294,764 (~$9.3M cumulative)
- Tier 3: $15,000,000 - $4,196,718 = $10,803,282 (~$10.8M cumulative)

**School allocation per tier (incremental, as displayed):**
- Tier 1: ~$7.7M
- Tier 2: $9,294,764 - $7,730,436 = $1,564,328 (~$1.6M)
- Tier 3: $10,803,282 - $9,294,764 = $1,508,518 (~$1.5M)

**Restore vs New tagging:** If the CSV description starts with "Restore", tag
as Restore. If it starts with "Increase" or is the Recurring Capital row, tag
as New. The Offset row gets neither tag.
