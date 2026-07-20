// Backing and reps widget for what-can-we-do.html.
// Verified residents endorse ideas in their own name; the site never endorses.
// Talks to the community-pulse Worker (/api/engagement, /api/verify/me).
// Fails silent: if the API is unreachable, the page reads exactly as before.

(function () {
  'use strict';

  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8787'
    : 'https://marblehead-community-pulse.agbaber.workers.dev';

  var state = { jwt: null, me: null };

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (state.jwt) h['Authorization'] = 'Bearer ' + state.jwt;
    return h;
  }

  function api(method, path, body) {
    var opts = { method: method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function (r) {
      if (!r.ok && r.status === 401) { return null; }
      return r.json();
    });
  }

  function emptyEntry() {
    return { back_count: 0, rep_count: 0, anon_count: 0, named_backers: [], reps: [], my_state: null };
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // A verified resident's name with optional branch, e.g. "Jane Smith (Necking Branch)".
  function nameLine(entry) {
    var line = entry.name;
    if (entry.branch) line += ' (' + entry.branch + ')';
    return line;
  }

  // ── Render one card ──────────────────────────────────────────────

  function renderCard(card, e) {
    // Top inline strip, appended to the .idea-num line. Hidden when nothing backed.
    var num = card.querySelector('.idea-num');
    var existingStrip = card.querySelector('.idea-engage-strip');
    if (existingStrip) existingStrip.remove();
    if (num && e.back_count > 0) {
      var strip = el('button', 'idea-engage-strip');
      strip.type = 'button';
      var parts = [e.back_count + ' backed'];
      if (e.rep_count > 0) parts.push(e.rep_count + (e.rep_count === 1 ? ' rep' : ' reps'));
      strip.textContent = parts.join(' · ');
      strip.addEventListener('click', function () {
        var panel = card.querySelector('.idea-engage');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      num.appendChild(document.createTextNode('  '));
      num.appendChild(strip);
    }

    // Bottom panel, rebuilt each render.
    var old = card.querySelector('.idea-engage');
    if (old) old.remove();
    var panel = el('div', 'idea-engage');

    panel.appendChild(el('p', 'idea-engage-h', "Who's behind this"));

    if (e.back_count === 0) {
      panel.appendChild(el('p', 'idea-engage-empty',
        'No verified residents have backed this yet.'));
    } else {
      var summary = el('p', 'idea-engage-summary',
        e.back_count + (e.back_count === 1 ? ' verified resident has' : ' verified residents have') + ' backed this.');
      panel.appendChild(summary);

      // Reps are also backers, but they get their own named section below.
      // Don't list them a second time among the plain backers.
      var repKeys = {};
      e.reps.forEach(function (r) { var k = nameLine(r); repKeys[k] = (repKeys[k] || 0) + 1; });
      var plainNamed = e.named_backers.filter(function (b) {
        var k = nameLine(b);
        if (repKeys[k]) { repKeys[k] -= 1; return false; }
        return true;
      });

      if (plainNamed.length) {
        var ul = el('ul', 'idea-engage-names');
        plainNamed.forEach(function (b) { ul.appendChild(el('li', null, nameLine(b))); });
        if (e.anon_count > 0) ul.appendChild(el('li', 'idea-engage-anon', '+ ' + e.anon_count + ' anonymous'));
        panel.appendChild(ul);
      } else if (e.anon_count === e.back_count) {
        panel.appendChild(el('p', 'idea-engage-anononly',
          e.back_count === 1 ? 'Backed anonymously.' : 'All backed anonymously.'));
      } else if (e.anon_count > 0) {
        var aul = el('ul', 'idea-engage-names');
        aul.appendChild(el('li', 'idea-engage-anon', '+ ' + e.anon_count + ' anonymous'));
        panel.appendChild(aul);
      }

      if (e.rep_count > 0) {
        panel.appendChild(el('p', 'idea-engage-summary',
          e.rep_count + (e.rep_count === 1 ? ' rep says' : ' reps say') + ' they’ll talk to others about this:'));
        var rul = el('ul', 'idea-engage-names');
        e.reps.forEach(function (r) { rul.appendChild(el('li', null, nameLine(r))); });
        panel.appendChild(rul);
      }
    }

    panel.appendChild(buildButton(card, e));
    card.appendChild(panel);
  }

  function buildButton(card, e) {
    if (!state.me) {
      var a = el('a', 'idea-engage-btn', 'Verify to back this idea');
      a.href = '/verify-me.html';
      return a;
    }
    var label = 'Back this idea';
    if (e.my_state === 'rep') label = 'Manage (you’re a rep)';
    else if (e.my_state === 'back_named' || e.my_state === 'back_anon') label = 'Manage your backing';
    var btn = el('button', 'idea-engage-btn');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', function () { openModal(card, e); });
    return btn;
  }

  // ── Modal ────────────────────────────────────────────────────────

  function openModal(card, e) {
    var title = card.querySelector('.idea-title');
    var overlay = el('div', 'idea-engage-overlay');
    var modal = el('div', 'idea-engage-modal');
    overlay.appendChild(modal);

    modal.appendChild(el('p', 'idea-engage-modal-eye', 'Back this idea'));
    modal.appendChild(el('h3', 'idea-engage-modal-title', title ? title.textContent : card.id));

    // Name field, shown when backing publicly or as a rep.
    var nameWrap = el('label', 'idea-engage-field');
    nameWrap.appendChild(el('span', null, 'Your name (shown publicly)'));
    var nameInput = el('input', 'idea-engage-name');
    nameInput.type = 'text';
    nameInput.maxLength = 80;
    nameInput.placeholder = 'e.g. Jane Smith';
    if (state.me.display_name) nameInput.value = state.me.display_name;
    nameWrap.appendChild(nameInput);

    var showName = checkbox('Show my name on this idea publicly');
    var rep = checkbox('I’ll talk to others about this (become a rep; this shows your name publicly)');

    // Pre-fill from current state.
    if (e.my_state === 'rep') { rep.input.checked = true; showName.input.checked = true; }
    else if (e.my_state === 'back_named') { showName.input.checked = true; }

    function syncNameField() {
      var needName = showName.input.checked || rep.input.checked;
      nameWrap.style.display = needName ? '' : 'none';
      // Rep implies name shown.
      if (rep.input.checked) { showName.input.checked = true; showName.input.disabled = true; }
      else { showName.input.disabled = false; }
    }
    showName.input.addEventListener('change', syncNameField);
    rep.input.addEventListener('change', syncNameField);

    modal.appendChild(showName.label);
    modal.appendChild(rep.label);
    modal.appendChild(nameWrap);
    syncNameField();

    modal.appendChild(el('p', 'idea-engage-modal-note',
      'Backing this idea is you endorsing it, not the site.'));

    var actions = el('div', 'idea-engage-actions');
    var save = el('button', 'idea-engage-btn');
    save.type = 'button';
    save.textContent = 'Save';
    var cancel = el('button', 'idea-engage-btn idea-engage-btn--ghost');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    actions.appendChild(save);
    actions.appendChild(cancel);
    if (e.my_state) {
      var remove = el('button', 'idea-engage-btn idea-engage-btn--ghost');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () { submit(card, e, 'none', null, overlay, save); });
      actions.appendChild(remove);
    }
    modal.appendChild(actions);

    var err = el('p', 'idea-engage-error');
    modal.appendChild(err);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    save.addEventListener('click', function () {
      var newState = rep.input.checked ? 'rep' : (showName.input.checked ? 'back_named' : 'back_anon');
      var name = null;
      if (newState === 'back_named' || newState === 'rep') {
        name = nameInput.value.trim();
        if (!name) { err.textContent = 'Enter your name, or uncheck the name options to back anonymously.'; return; }
      }
      submit(card, e, newState, name, overlay, save);
    });

    document.body.appendChild(overlay);
    nameInput.focus();
  }

  function checkbox(text) {
    var label = el('label', 'idea-engage-check');
    var input = el('input');
    input.type = 'checkbox';
    label.appendChild(input);
    label.appendChild(el('span', null, text));
    return { label: label, input: input };
  }

  function submit(card, e, newState, name, overlay, saveBtn) {
    saveBtn.disabled = true;
    var body = { target_type: 'idea', target_id: card.id, state: newState };
    if (name) body.display_name = name;
    api('POST', '/api/engagement', body).then(function (res) {
      if (!res || res.error) {
        saveBtn.disabled = false;
        var err = overlay.querySelector('.idea-engage-error');
        if (err) err.textContent = (res && res.error) ? res.error : 'Something went wrong. Try again.';
        return;
      }
      if (name) state.me.display_name = name;
      overlay.remove();
      // Re-fetch this card to refresh names + counts.
      api('GET', '/api/engagement?target_type=idea&target_ids=' + encodeURIComponent(card.id))
        .then(function (data) { renderCard(card, (data && data[card.id]) || emptyEntry()); });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────

  function init() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.idea[id^="idea-"]'));
    if (!cards.length) return;
    var ids = cards.map(function (c) { return c.id; });

    state.jwt = localStorage.getItem('verify_jwt');
    var auth = Promise.resolve();
    if (state.jwt) {
      auth = api('GET', '/api/verify/me').then(function (me) {
        if (me && me.identity_hash) state.me = me;
        else { state.jwt = null; localStorage.removeItem('verify_jwt'); }
      }).catch(function () { state.jwt = null; });
    }

    auth.then(function () {
      return api('GET', '/api/engagement?target_type=idea&target_ids=' + ids.map(encodeURIComponent).join(','));
    }).then(function (data) {
      if (!data) return;
      cards.forEach(function (card) { renderCard(card, data[card.id] || emptyEntry()); });
    }).catch(function () { /* fail silent */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
