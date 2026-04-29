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
    if (elGap) elGap.textContent = gap >= 0 ? formatUSD(gap) : formatUSD(-gap) + ' over target';

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
        // Each discrete checkbox represents a cut the user is making.
        // Consequences fire when the cut is made (item IS checked).
        if (state.checkedIds.has(item.id) && item.consequences) {
          for (const cid of item.consequences) triggered.add(cid);
        }
      } else if (item.type === 'scalar') {
        if (item.id === 'schools_cut' && item.consequences) {
          for (const c of item.consequences) {
            if (typeof c === 'object' && c.threshold_gt !== undefined && state.schoolsCut > c.threshold_gt) {
              triggered.add(c.id);
            }
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
      empty.textContent = 'No mandate or rating-agency consequences triggered by the current plan.';
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
          if (i < cons.links.length - 1) links.appendChild(document.createTextNode(' \u00b7 '));
        });
        card.appendChild(links);
      }

      consequencesList.appendChild(card);
    }
  }

  document.addEventListener('bb:statechange', renderConsequences);

  // ── Success state ──
  const successSection = document.querySelector('.bb-success');

  function townPlanCutsForTier() {
    // The town's no-override plan = every restoration the override would
    // fund at this tier is being cut, plus the $1.5M schools cut. We
    // model that as "all discrete items at this tier are checked".
    const townChecked = new Set();
    let townTotal = 0;
    for (const item of itemsData) {
      if (item.type === 'discrete') {
        const amount = item.amounts[`tier_${state.tier}`];
        if (amount > 0) {
          townChecked.add(item.id);
          townTotal += amount;
        }
      }
    }
    townTotal += SCHOOLS_DEFAULT;
    return { townChecked, townTotal };
  }

  function sumAmounts(ids) {
    let total = 0;
    const byId = new Map(itemsData.filter(i => i.type === 'discrete').map(i => [i.id, i]));
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) continue;
      total += item.amounts[`tier_${state.tier}`];
    }
    return total;
  }

  function renderSuccess() {
    if (!successSection) return;
    const target = TIER_TARGETS[state.tier];
    const cuts = window.__bbState.getCuts();
    if (cuts < target) {
      successSection.hidden = true;
      successSection.innerHTML = '';
      return;
    }

    const { townChecked, townTotal } = townPlanCutsForTier();
    const userChecked = state.checkedIds;

    const overlapIds = Array.from(userChecked).filter(id => townChecked.has(id));
    const userCutTownDidnt = Array.from(userChecked).filter(id => !townChecked.has(id));
    const userKeptTownCut = Array.from(townChecked).filter(id => !userChecked.has(id));

    const schoolsDelta = state.schoolsCut - SCHOOLS_DEFAULT;
    const schoolsDeltaText = schoolsDelta === 0
      ? ''
      : ` (${schoolsDelta > 0 ? '+' : ''}${formatUSD(schoolsDelta)} vs town)`;

    successSection.hidden = false;
    successSection.innerHTML = `
      <h2>Your plan closes the Tier ${state.tier} FY27 gap.</h2>
      <div class="bb-success-comparison">
        <table>
          <thead>
            <tr><th></th><th>Your plan</th><th>Town's no-override plan</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total cuts</th>
              <td>${formatUSD(cuts)}</td>
              <td>${formatUSD(townTotal)}</td>
            </tr>
            <tr>
              <th scope="row">Schools cut</th>
              <td>${formatUSD(state.schoolsCut)}${schoolsDeltaText}</td>
              <td>${formatUSD(SCHOOLS_DEFAULT)}</td>
            </tr>
            <tr>
              <th scope="row">Item cuts shared with town</th>
              <td colspan="2">${overlapIds.length} items (${formatUSD(sumAmounts(overlapIds))})</td>
            </tr>
            <tr>
              <th scope="row">Items you cut, town protected</th>
              <td colspan="2">${userCutTownDidnt.length === 0 ? 'None' : userCutTownDidnt.length + ' items'}</td>
            </tr>
            <tr>
              <th scope="row">Items you kept, town cut</th>
              <td colspan="2">${userKeptTownCut.length === 0 ? 'None' : userKeptTownCut.length + ' items (' + formatUSD(sumAmounts(userKeptTownCut)) + ')'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="bb-success-note">These are the legal, regulatory, and policy consequences of the plan above, not a judgment about whether the plan is good policy.</p>
    `;
  }

  document.addEventListener('bb:statechange', renderSuccess);

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
