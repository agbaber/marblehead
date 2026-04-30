/*
 * Balance the Budget tool runtime (balance-the-budget.html).
 *
 * Loads data/balance_budget_items.json and
 * data/balance_budget_consequences.json, renders a per-category
 * checklist of discrete and scalar levers, and exposes window.__bbState
 * for the status bar, consequences engine, and success state.
 *
 * Tier 0 ("No override") is the default: target is the full FY27
 * override-equivalent gap ($4.30M), and the user closes it via cuts,
 * deferrals, share shifts, or one-time funds.
 *
 * Markup contract: section.bb-checklist is populated with
 * section.bb-category > div.bb-item-row for each item. section.bb-tier-
 * selector carries four buttons with data-tier="0|1|2|3".
 *
 * Pages without section.bb-checklist are early-returned.
 */

(function () {
  'use strict';

  const checklist = document.querySelector('.bb-checklist');
  if (!checklist) return;

  const TIER_TARGETS = { 0: 4296718, 1: 1269564, 2: 2805236, 3: 4296718 };
  const DEFAULT_TIER = 0;

  const state = {
    tier: DEFAULT_TIER,
    checkedIds: new Set(),
    scalars: {}
  };

  let itemsData = null;
  let consequencesData = null;
  let impactsData = null;

  function formatUSD(n) {
    if (n === 0) return '$0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US');
  }

  function tierKey() {
    return state.tier === 0 ? 'tier_3' : `tier_${state.tier}`;
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

  function initScalarDefaults() {
    if (!itemsData) return;
    for (const item of itemsData) {
      if (item.type === 'scalar') {
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
    const amount = item.amounts[tierKey()];
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

  function isPlanDirty() {
    if (state.checkedIds.size > 0) return true;
    if (!itemsData) return false;
    for (const item of itemsData) {
      if (item.type === 'scalar' && state.scalars[item.id] !== scalarDefault(item)) {
        return true;
      }
    }
    return false;
  }

  function resetPlan() {
    state.checkedIds.clear();
    initScalarDefaults();
  }

  function initTierSelector() {
    const btns = document.querySelectorAll('.bb-tier-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTier = Number(btn.dataset.tier);
        if (newTier === state.tier) return;

        if (isPlanDirty()) {
          const ok = window.confirm('Switching scenario will reset your plan. Continue?');
          if (!ok) return;
        }
        state.tier = newTier;
        resetPlan();
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
      resetPlan();
      renderChecklist();
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });
  }

  window.__bbState = {
    getTier: () => state.tier,
    getTarget: () => TIER_TARGETS[state.tier],
    getCuts: () => {
      let total = 0;
      if (!itemsData) return 0;
      for (const item of itemsData) {
        if (item.type === 'discrete' && state.checkedIds.has(item.id)) {
          total += item.amounts[tierKey()] || 0;
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
  const elGap = document.querySelector('[data-bind="gap"]');

  function updateStatusBar() {
    if (!statusBar) return;
    const target = TIER_TARGETS[state.tier];
    const cuts = window.__bbState.getCuts();
    const gap = target - cuts;

    if (elTarget) elTarget.textContent = formatUSD(target);
    if (elCuts) elCuts.textContent = formatUSD(cuts);
    if (elGap) elGap.textContent = gap >= 0 ? formatUSD(gap) : formatUSD(-gap) + ' over';

    statusBar.classList.toggle('bb-balanced', gap <= 0);
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
      empty.textContent = 'No mandate, contract, or rating-agency consequences triggered by the current plan.';
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

  // ── Success state ──
  const successSection = document.querySelector('.bb-success');

  function renderSuccess() {
    if (!successSection) return;
    const target = TIER_TARGETS[state.tier];
    const cuts = window.__bbState.getCuts();
    if (cuts < target) {
      successSection.hidden = true;
      successSection.innerHTML = '';
      return;
    }

    const itemsByCategory = groupByCategory(itemsData);
    const categoryRows = [];
    for (const [category, items] of itemsByCategory) {
      let categoryTotal = 0;
      for (const item of items) {
        if (item.type === 'discrete' && state.checkedIds.has(item.id)) {
          categoryTotal += item.amounts[tierKey()] || 0;
        } else if (item.type === 'scalar') {
          categoryTotal += scalarSavings(item);
        }
      }
      if (categoryTotal > 0) {
        categoryRows.push({ category, total: categoryTotal });
      }
    }

    const rowsHtml = categoryRows.map(r =>
      `<tr><th scope="row">${r.category}</th><td>${formatUSD(r.total)}</td></tr>`
    ).join('');

    const tierLabel = state.tier === 0 ? 'no-override' : `Tier ${state.tier}`;
    successSection.hidden = false;
    successSection.innerHTML = `
      <h2>Your plan closes the ${tierLabel} FY27 gap.</h2>
      <p class="bb-success-summary">Plan total: <strong>${formatUSD(cuts)}</strong> against a ${formatUSD(target)} target.</p>
      <div class="bb-success-comparison">
        <table>
          <thead>
            <tr><th scope="col">Lever category</th><th scope="col">Your plan</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <p class="bb-success-note">The consequences panel above lists the legal, regulatory, contractual, and rating-agency implications of every lever in this plan. Closing the gap on paper is not the same as closing it without trade-offs.</p>
    `;
  }

  document.addEventListener('bb:statechange', renderSuccess);

  loadData().then(() => {
    initScalarDefaults();
    renderChecklist();
    initTierSelector();
    initResetButton();
    document.dispatchEvent(new CustomEvent('bb:statechange'));
  }).catch(err => {
    console.error('balance-budget: failed to load data', err);
    checklist.innerHTML = '<p class="bb-error">Could not load budget data. Please reload the page.</p>';
  });
})();
