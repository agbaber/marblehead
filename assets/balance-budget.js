/*
 * Balance the Budget tool runtime (balance-the-budget.html).
 *
 * Loads data/balance_budget_items.json and
 * data/balance_budget_consequences.json, renders a per-category
 * checklist with per-tier dollar amounts, and exposes window.__bbState
 * for the status bar, consequences engine, and success state.
 *
 * Markup contract: section.bb-checklist is populated with
 * section.bb-category > div.bb-item-row for each item. section.bb-tier-
 * selector carries three buttons with data-tier="1|2|3".
 *
 * Pages without section.bb-checklist are early-returned.
 */

(function () {
  'use strict';

  const checklist = document.querySelector('.bb-checklist');
  if (!checklist) return;

  const TIER_TARGETS = { 1: 1269564, 2: 2805236, 3: 4296718 };
  const SCHOOLS_DEFAULT = 1500000;

  const state = {
    tier: 1,
    checkedIds: new Set(),
    schoolsCut: SCHOOLS_DEFAULT
  };

  let itemsData = null;
  let consequencesData = null;

  function formatUSD(n) {
    if (n === 0) return '$0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US');
  }

  async function loadData() {
    const [itemsRes, consRes] = await Promise.all([
      fetch('/data/balance_budget_items.json'),
      fetch('/data/balance_budget_consequences.json')
    ]);
    itemsData = await itemsRes.json();
    consequencesData = await consRes.json();
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
    const amount = item.amounts[`tier_${state.tier}`];
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

    const nameLabel = document.createElement('label');
    nameLabel.className = 'bb-item-row-name';
    nameLabel.htmlFor = 'bb-' + item.id;
    nameLabel.textContent = item.description;
    if (item.consequences && item.consequences.length > 0) {
      const flag = document.createElement('span');
      flag.className = 'bb-item-row-flag';
      flag.title = 'Triggers a state-law or policy consequence';
      nameLabel.appendChild(flag);
    }

    const dollar = document.createElement('span');
    dollar.className = 'bb-item-row-dollar';
    dollar.textContent = formatUSD(amount);

    row.append(checkbox, nameLabel, dollar);
    return row;
  }

  function renderScalarRow(item) {
    const row = document.createElement('div');
    row.className = 'bb-scalar-row';

    const label = document.createElement('label');
    label.textContent = item.description + ': $';
    label.htmlFor = 'bb-' + item.id;

    const input = document.createElement('input');
    input.id = 'bb-' + item.id;
    input.type = 'number';
    input.min = '0';
    input.step = '10000';
    input.value = String(state.schoolsCut);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      state.schoolsCut = isNaN(v) ? 0 : v;
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });

    row.append(label, input);

    if (item.presets && item.presets.length) {
      const presetsWrap = document.createElement('span');
      presetsWrap.className = 'bb-scalar-presets';
      for (const p of item.presets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bb-scalar-preset';
        btn.textContent = p.label;
        btn.addEventListener('click', () => {
          input.value = String(p.value);
          state.schoolsCut = p.value;
          document.dispatchEvent(new CustomEvent('bb:statechange'));
        });
        presetsWrap.appendChild(btn);
      }
      row.appendChild(presetsWrap);
    }

    const note = document.createElement('p');
    note.className = 'bb-scalar-note';
    note.textContent = "No override tier restores school funding in FY27. The $1.5M cut happens at every tier this year; tier restorations begin in FY28. Change this number to model cutting schools more or less than the town proposed.";
    row.appendChild(note);

    return row;
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

        const dirty = state.checkedIds.size > 0 || state.schoolsCut !== SCHOOLS_DEFAULT;
        if (dirty) {
          const ok = window.confirm('Switching tier will reset your plan. Continue?');
          if (!ok) return;
        }
        state.tier = newTier;
        state.checkedIds.clear();
        state.schoolsCut = SCHOOLS_DEFAULT;
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
      state.checkedIds.clear();
      state.schoolsCut = SCHOOLS_DEFAULT;
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
          total += item.amounts[`tier_${state.tier}`];
        }
      }
      total += state.schoolsCut;
      return total;
    },
    getCheckedIds: () => new Set(state.checkedIds),
    getSchoolsCut: () => state.schoolsCut,
    getItems: () => itemsData,
    getConsequences: () => consequencesData
  };

  loadData().then(() => {
    renderChecklist();
    initTierSelector();
    initResetButton();
    document.dispatchEvent(new CustomEvent('bb:statechange'));
  }).catch(err => {
    console.error('balance-budget: failed to load data', err);
    checklist.innerHTML = '<p class="bb-error">Could not load budget data. Please reload the page.</p>';
  });
})();
