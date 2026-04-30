/*
 * Balance the Budget tool runtime (balance-the-budget.html).
 *
 * Loads items, consequences, and impacts. Renders a per-category
 * checklist with discrete cut/transfer items and scalar lever inputs
 * (insurance share, one-time funds). Schools is presented as fixed
 * context in the HTML, not a user-editable scalar.
 *
 * Pedagogical model: the user starts at "No override" with every
 * department cut and skipped transfer pre-checked - that is the
 * town's no-override plan. Status reads "Balanced." Clicking a tier
 * does not change which items are checked; it changes the target
 * (cuts the user must make). The plan now exceeds target by the
 * override's first-year gross fill. The user un-checks items totaling
 * that fill to land back at Balanced - that is the user choosing
 * which cuts the override should restore.
 *
 * Targets and override fills are computed from items data:
 *   total_gross  = sum of tier_3 amounts across all discrete items
 *   fill[tier]   = sum of tier_<tier> amounts (0 for No override)
 *   target[tier] = total_gross - fill[tier]
 */

(function () {
  'use strict';

  const checklist = document.querySelector('.bb-checklist');
  if (!checklist) return;

  const DEFAULT_TIER = 0;

  const state = {
    tier: DEFAULT_TIER,
    checkedIds: new Set(),
    scalars: {}
  };

  let itemsData = null;
  let consequencesData = null;
  let impactsData = null;
  let TOTAL_GROSS = 0;
  const TIER_FILLS = { 0: 0, 1: 0, 2: 0, 3: 0 };

  function formatUSD(n) {
    if (n === 0) return '$0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US');
  }

  // Items are always shown at their gross (tier_3) cost regardless
  // of which scenario is selected. The dollar magnitude of a cut is
  // what it is; the only thing that varies by tier is the target the
  // user must hit (= total minus override fill).
  const ITEM_AMOUNT_KEY = 'tier_3';

  function targetForTier(tier) {
    return TOTAL_GROSS - TIER_FILLS[tier];
  }

  function scalarDefault(item) {
    return typeof item.default === 'number' ? item.default : 0;
  }

  function scalarSavings(item) {
    const v = state.scalars[item.id];
    if (typeof v !== 'number' || isNaN(v)) return 0;
    const per = typeof item.savings_per_unit === 'number' ? item.savings_per_unit : 1;
    return v * per;
  }

  function computeTotals() {
    TOTAL_GROSS = 0;
    TIER_FILLS[0] = 0;
    TIER_FILLS[1] = 0;
    TIER_FILLS[2] = 0;
    TIER_FILLS[3] = 0;
    if (!itemsData) return;
    for (const item of itemsData) {
      if (item.type !== 'discrete' || !item.amounts) continue;
      TIER_FILLS[1] += item.amounts.tier_1 || 0;
      TIER_FILLS[2] += item.amounts.tier_2 || 0;
      TIER_FILLS[3] += item.amounts.tier_3 || 0;
    }
    TOTAL_GROSS = TIER_FILLS[3];
  }

  function initDefaults() {
    if (!itemsData) return;
    state.checkedIds = new Set();
    state.scalars = {};
    for (const item of itemsData) {
      if (item.type === 'discrete') {
        const amount = (item.amounts && (item.amounts.tier_3 || 0)) || 0;
        if (amount > 0) state.checkedIds.add(item.id);
      } else if (item.type === 'scalar') {
        state.scalars[item.id] = scalarDefault(item);
      }
    }
  }

  async function loadData() {
    const [itemsRes, consRes, impactsRes] = await Promise.all([
      fetch('/data/balance_budget_items.json'),
      fetch('/data/balance_budget_consequences.json'),
      fetch('/data/balance_budget_impacts.json')
    ]);
    itemsData = await itemsRes.json();
    consequencesData = await consRes.json();
    impactsData = await impactsRes.json();
  }

  function groupByCategory(items) {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    return groups;
  }

  function renderDiscreteRow(item) {
    const amount = item.amounts[ITEM_AMOUNT_KEY];
    if (amount <= 0) return null;

    const row = document.createElement('div');
    row.className = 'bb-item-row';
    row.dataset.id = item.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'bb-' + item.id;
    checkbox.checked = state.checkedIds.has(item.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.checkedIds.add(item.id);
      else state.checkedIds.delete(item.id);
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });

    const textWrap = document.createElement('div');
    textWrap.className = 'bb-item-row-text';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'bb-item-row-name';
    nameLabel.htmlFor = 'bb-' + item.id;
    nameLabel.textContent = item.description;
    if (item.consequences && item.consequences.length > 0) {
      const flag = document.createElement('span');
      flag.className = 'bb-item-row-flag';
      flag.title = 'Triggers a state-law, contract, or rating-agency consequence';
      flag.setAttribute('aria-hidden', 'true');
      nameLabel.appendChild(flag);
    }
    textWrap.appendChild(nameLabel);

    const impact = impactsData && impactsData[item.id];
    if (impact) {
      const impactEl = document.createElement('p');
      impactEl.className = 'bb-item-row-impact';
      impactEl.textContent = impact;
      textWrap.appendChild(impactEl);
    }

    const dollar = document.createElement('span');
    dollar.className = 'bb-item-row-dollar';
    dollar.textContent = formatUSD(amount);

    row.append(checkbox, textWrap, dollar);
    return row;
  }

  function renderScalarRow(item) {
    const row = document.createElement('div');
    row.className = 'bb-scalar-row';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'bb-scalar-label';
    const labelText = document.createElement('label');
    labelText.htmlFor = 'bb-' + item.id;
    labelText.textContent = item.description;
    labelWrap.appendChild(labelText);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'bb-scalar-input';

    const isPct = item.unit === 'percentage_points';
    const prefix = isPct ? '+' : '$';
    const suffix = isPct ? ' pp' : '';

    const prefixSpan = document.createElement('span');
    prefixSpan.className = 'bb-scalar-affix';
    prefixSpan.textContent = prefix;

    const input = document.createElement('input');
    input.id = 'bb-' + item.id;
    input.type = 'number';
    if (typeof item.min === 'number') input.min = String(item.min);
    if (typeof item.max === 'number') input.max = String(item.max);
    input.step = String(item.step != null ? item.step : (isPct ? 1 : 10000));
    input.value = String(state.scalars[item.id] != null ? state.scalars[item.id] : scalarDefault(item));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      state.scalars[item.id] = isNaN(v) ? 0 : v;
      updateLiveSavingsHint(item, savingsHint);
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });

    inputWrap.append(prefixSpan, input);
    if (suffix) {
      const suffixSpan = document.createElement('span');
      suffixSpan.className = 'bb-scalar-affix';
      suffixSpan.textContent = suffix;
      inputWrap.appendChild(suffixSpan);
    }

    const savingsHint = document.createElement('span');
    savingsHint.className = 'bb-scalar-savings';
    updateLiveSavingsHint(item, savingsHint);

    row.append(labelWrap, inputWrap, savingsHint);

    if (item.presets && item.presets.length) {
      const presetsWrap = document.createElement('div');
      presetsWrap.className = 'bb-scalar-presets';
      for (const p of item.presets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bb-scalar-preset';
        btn.textContent = p.label;
        btn.addEventListener('click', () => {
          input.value = String(p.value);
          state.scalars[item.id] = p.value;
          updateLiveSavingsHint(item, savingsHint);
          document.dispatchEvent(new CustomEvent('bb:statechange'));
        });
        presetsWrap.appendChild(btn);
      }
      row.appendChild(presetsWrap);
    }

    if (item.note) {
      const note = document.createElement('p');
      note.className = 'bb-scalar-note';
      note.textContent = item.note;
      row.appendChild(note);
    }

    return row;
  }

  function updateLiveSavingsHint(item, span) {
    if (!span) return;
    const v = state.scalars[item.id];
    if (item.savings_per_unit && item.savings_per_unit !== 1 && v) {
      span.textContent = '≈ ' + formatUSD(v * item.savings_per_unit);
    } else {
      span.textContent = '';
    }
  }

  function renderChecklist() {
    checklist.innerHTML = '';
    const groups = groupByCategory(itemsData);
    for (const [category, items] of groups) {
      const section = document.createElement('section');
      section.className = 'bb-category';
      const h3 = document.createElement('h3');
      h3.textContent = category;
      section.appendChild(h3);

      for (const item of items) {
        const row = item.type === 'discrete'
          ? renderDiscreteRow(item)
          : renderScalarRow(item);
        if (row) section.appendChild(row);
      }

      if (section.children.length > 1) {
        checklist.appendChild(section);
      }
    }
  }

  function initTierSelector() {
    const btns = document.querySelectorAll('.bb-tier-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTier = Number(btn.dataset.tier);
        if (newTier === state.tier) return;
        state.tier = newTier;
        // Tier change does not reset the user's plan - it only changes
        // the target. That is the whole pedagogical move: at Tier 1
        // the user keeps the town's plan checked and sees "over by
        // $1.68M" until they uncheck the items the override would fund.
        btns.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
        renderChecklist();
        document.dispatchEvent(new CustomEvent('bb:statechange'));
      });
    });
  }

  function initResetButton() {
    const reset = document.querySelector('.bb-reset');
    if (!reset) return;
    reset.addEventListener('click', () => {
      initDefaults();
      renderChecklist();
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });
  }

  window.__bbState = {
    getTier: () => state.tier,
    getTarget: () => targetForTier(state.tier),
    getCuts: () => {
      let total = 0;
      if (!itemsData) return 0;
      for (const item of itemsData) {
        if (item.type === 'discrete' && state.checkedIds.has(item.id)) {
          total += item.amounts[ITEM_AMOUNT_KEY] || 0;
        } else if (item.type === 'scalar') {
          total += scalarSavings(item);
        }
      }
      return total;
    },
    getCheckedIds: () => new Set(state.checkedIds),
    getScalar: id => state.scalars[id],
    getItems: () => itemsData,
    getConsequences: () => consequencesData
  };

  // ── Status bar ──
  const statusBar = document.querySelector('.bb-status-bar');
  const elTarget = document.querySelector('[data-bind="target"]');
  const elCuts = document.querySelector('[data-bind="cuts"]');
  const elStatus = document.querySelector('[data-bind="status"]');
  const elMessage = document.querySelector('[data-bind="status-message"]');

  function statusMessage(target, plan, gap) {
    if (state.tier === 0 && plan === target && Math.abs(gap) < 1) {
      return "This matches the town's no-override plan exactly.";
    }
    if (Math.abs(gap) < 1) {
      const tierLabel = state.tier === 0 ? 'No override' : `Tier ${state.tier}`;
      return `Balanced for ${tierLabel}: your plan plus the override revenue closes the FY27 department gap.`;
    }
    if (gap < 0) {
      // plan > target: user has over-cut; override revenue available
      const overBy = -gap;
      const tierLabel = state.tier === 0 ? '' : ` Tier ${state.tier}`;
      return `Plan exceeds target by ${formatUSD(overBy)}.${state.tier === 0 ? '' : ` That is roughly the override's first-year gross fill — uncheck items totaling ${formatUSD(overBy)} to use it.`}`;
    }
    // plan < target: short
    return `Plan falls short by ${formatUSD(gap)}. Add cuts (re-check items) or savings (insurance share, one-time funds) to close the gap.`;
  }

  function updateStatusBar() {
    if (!statusBar) return;
    const target = targetForTier(state.tier);
    const cuts = window.__bbState.getCuts();
    const gap = target - cuts;

    if (elTarget) elTarget.textContent = formatUSD(target);
    if (elCuts) elCuts.textContent = formatUSD(cuts);
    if (elStatus) {
      let label;
      if (Math.abs(gap) < 1) label = 'Balanced';
      else if (gap < 0) label = 'Over by ' + formatUSD(-gap);
      else label = 'Short by ' + formatUSD(gap);
      elStatus.textContent = label;
      elStatus.classList.toggle('is-balanced', Math.abs(gap) < 1);
      elStatus.classList.toggle('is-over', gap < -0.5);
      elStatus.classList.toggle('is-short', gap > 0.5);
    }

    if (elMessage) elMessage.textContent = statusMessage(target, cuts, gap);

    statusBar.classList.toggle('bb-balanced', Math.abs(gap) < 1);
  }

  document.addEventListener('bb:statechange', updateStatusBar);

  // ── Consequences panel ──
  const consequencesList = document.querySelector('.bb-consequences-list');
  const consequencesCount = document.querySelector('[data-bind="consequence-count"]');

  function triggeredConsequences() {
    const triggered = new Set();
    if (!itemsData) return [];

    for (const item of itemsData) {
      if (item.type === 'discrete') {
        if (state.checkedIds.has(item.id) && item.consequences) {
          for (const cid of item.consequences) triggered.add(cid);
        }
      } else if (item.type === 'scalar' && item.consequences) {
        const v = state.scalars[item.id] || 0;
        for (const c of item.consequences) {
          if (typeof c === 'object' && c.threshold_gt !== undefined && v > c.threshold_gt) {
            triggered.add(c.id);
          } else if (typeof c === 'string') {
            if (v > 0) triggered.add(c);
          }
        }
      }
    }

    return Array.from(triggered);
  }

  function renderConsequences() {
    if (!consequencesList) return;
    const triggered = triggeredConsequences();
    if (consequencesCount) consequencesCount.textContent = String(triggered.length);
    consequencesList.innerHTML = '';

    if (triggered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bb-consequence-empty';
      empty.textContent = 'No legal, contract, or rating-agency triggers in your current plan.';
      consequencesList.appendChild(empty);
      return;
    }

    for (const cid of triggered) {
      const cons = consequencesData && consequencesData[cid];
      if (!cons) continue;

      const card = document.createElement('div');
      card.className = 'bb-consequence-card';

      const h = document.createElement('h4');
      h.textContent = cons.name;
      card.appendChild(h);

      const authority = document.createElement('p');
      authority.className = 'bb-cc-authority';
      authority.textContent = cons.authority;
      card.appendChild(authority);

      const effect = document.createElement('p');
      effect.className = 'bb-cc-effect';
      effect.textContent = cons.effect;
      card.appendChild(effect);

      if (cons.links && cons.links.length) {
        const links = document.createElement('p');
        links.className = 'bb-cc-links';
        cons.links.forEach((l, i) => {
          const a = document.createElement('a');
          a.href = l.url;
          a.textContent = l.label;
          a.target = '_blank';
          a.rel = 'noopener';
          links.appendChild(a);
          if (i < cons.links.length - 1) links.appendChild(document.createTextNode(' · '));
        });
        card.appendChild(links);
      }

      consequencesList.appendChild(card);
    }
  }

  document.addEventListener('bb:statechange', renderConsequences);

  loadData().then(() => {
    computeTotals();
    initDefaults();
    renderChecklist();
    initTierSelector();
    initResetButton();
    document.dispatchEvent(new CustomEvent('bb:statechange'));
  }).catch(err => {
    console.error('balance-budget: failed to load data', err);
    checklist.innerHTML = '<p class="bb-error">Could not load budget data. Please reload the page.</p>';
  });
})();
