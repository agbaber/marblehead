/*
 * ballot-picker.js
 * Sample-ballot picker for where-candidates-stand.html.
 *
 * Progressive enhancement: reads the existing race/candidate DOM, injects
 * a pick control per candidate, a sticky progress bar, and a summary modal.
 * Picks are stored in localStorage only. Nothing leaves the browser unless
 * the reader taps "Share my picks", which renders a PNG client-side.
 *
 * No candidate selection state is ever sent anywhere. No backend.
 */
(function () {
  'use strict';

  var STORE_NAME = 'marblehead-ballot-picks';
  var PAGE_URL = 'marbleheaddata.org/where-candidates-stand.html';

  var races = Array.prototype.slice.call(document.querySelectorAll('.race'));
  var firstCand = document.querySelector('.cand');
  if (!races.length || !firstCand) return;

  document.body.classList.add('js-picker');

  // ---- state ----------------------------------------------------------
  var picks = load();          // { raceName: [candidateName, ...] }
  var raceData = [];           // [{ el, name, max, cands, counter }]
  var bar, barText, barFill, overlay, modal, toastEl;

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_NAME);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }
  function save() {
    try { window.localStorage.setItem(STORE_NAME, JSON.stringify(picks)); } catch (e) {}
  }

  // ---- build per-race model + inject controls -------------------------
  var CHECK_SVG = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  races.forEach(function (raceEl) {
    var h2 = raceEl.querySelector('.race-headings h2');
    var meta = raceEl.querySelector('.race-meta');
    if (!h2) return;
    var name = h2.textContent.trim();
    var max = 1;
    if (meta) {
      var m = meta.textContent.match(/not more than\s+(\d+)/i);
      if (m) max = parseInt(m[1], 10);
    }

    var rd = { el: raceEl, name: name, max: max, cands: [], counter: null };

    Array.prototype.forEach.call(raceEl.querySelectorAll('.cand'), function (candEl) {
      var h3 = candEl.querySelector('.cand-head h3');
      var head = candEl.querySelector('.cand-head');
      if (!h3 || !head) return;
      var cname = h3.textContent.trim();

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = '<span class="tick">' + CHECK_SVG + '</span><span class="pick-btn__label">Pick</span>';
      head.appendChild(btn);

      var rec = { el: candEl, name: cname, btn: btn, label: btn.querySelector('.pick-btn__label') };
      rd.cands.push(rec);
      btn.addEventListener('click', function () { toggle(rd, rec); });
    });

    if (max > 1 && meta) {
      rd.counter = document.createElement('span');
      rd.counter.className = 'seat-count';
      meta.appendChild(rd.counter);
    }

    raceData.push(rd);
    applyRace(rd);
    updateCounter(rd);
  });

  // ---- selection ------------------------------------------------------
  function selected(rd) { return picks[rd.name] ? picks[rd.name].slice() : []; }

  function toggle(rd, rec) {
    var arr = selected(rd);
    var i = arr.indexOf(rec.name);
    if (i !== -1) {
      arr.splice(i, 1);
    } else if (rd.max === 1) {
      arr = [rec.name];
    } else {
      arr.push(rec.name);
      if (arr.length > rd.max) arr.shift(); // bump earliest pick
    }
    if (arr.length) picks[rd.name] = arr; else delete picks[rd.name];
    save();
    applyRace(rd);
    updateCounter(rd);
    updateBar();
  }

  function applyRace(rd) {
    var arr = selected(rd);
    rd.cands.forEach(function (rec) {
      var on = arr.indexOf(rec.name) !== -1;
      rec.el.classList.toggle('is-picked', on);
      rec.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (rec.label) rec.label.textContent = on ? 'Picked' : 'Pick';
    });
  }

  function updateCounter(rd) {
    if (!rd.counter) return;
    var n = selected(rd).length;
    rd.el.classList.toggle('is-incomplete', n > 0 && n < rd.max);
    rd.counter.classList.remove('is-need', 'is-full');
    if (n === 0) {
      rd.counter.textContent = '';
      rd.counter.style.display = 'none';
      return;
    }
    rd.counter.style.display = '';
    if (n < rd.max) {
      rd.counter.textContent = 'Pick ' + (rd.max - n) + ' more';
      rd.counter.classList.add('is-need');
    } else {
      rd.counter.textContent = rd.max + ' selected';
      rd.counter.classList.add('is-full');
    }
  }

  function racesChosen() {
    var k = 0;
    raceData.forEach(function (rd) { if (selected(rd).length) k++; });
    return k;
  }

  // ---- sticky progress bar -------------------------------------------
  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'bp-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<span class="bp-bar__text"></span>' +
      '<span class="bp-bar__track"><span class="bp-bar__fill"></span></span>' +
      '<button type="button" class="bp-bar__btn">View my ballot</button>';
    document.body.appendChild(bar);
    barText = bar.querySelector('.bp-bar__text');
    barFill = bar.querySelector('.bp-bar__fill');
    bar.querySelector('.bp-bar__btn').addEventListener('click', openSummary);
  }

  function updateBar() {
    if (!bar) buildBar();
    var k = racesChosen();
    var total = raceData.length;
    barText.textContent = k + ' of ' + total + ' races chosen';
    barFill.style.width = (k / total * 100) + '%';
    bar.classList.toggle('is-active', k >= 1);
  }

  // ---- summary modal --------------------------------------------------
  function buildModal() {
    overlay = document.createElement('div');
    overlay.className = 'bp-overlay';
    overlay.innerHTML =
      '<div class="bp-modal" role="dialog" aria-modal="true" aria-label="My June 9 sample ballot">' +
        '<div class="bp-card" id="bp-card">' +
          '<p class="bp-card__kicker">Marblehead &middot; June 9, 2026</p>' +
          '<h2 class="bp-card__title">My sample ballot</h2>' +
          '<div class="bp-card__rows" id="bp-rows"></div>' +
          '<p class="bp-card__foot"><strong>marbleheaddata.org</strong> &middot; my sample ballot, not an endorsement</p>' +
        '</div>' +
        '<div class="bp-actions">' +
          '<button type="button" class="bp-act bp-act--primary" data-act="share">Share my picks</button>' +
          '<button type="button" class="bp-act" data-act="copy">Copy as text</button>' +
          '<button type="button" class="bp-act bp-act--ghost" data-act="clear">Clear</button>' +
          '<button type="button" class="bp-act bp-act--ghost" data-act="close">Done</button>' +
        '</div>' +
        '<p class="bp-footnote">Saved on this device only. The four ballot questions are on the <a href="whats-on-the-ballot.html#how-youll-vote">practice ballot</a>.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    modal = overlay.querySelector('.bp-modal');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSummary(); });
    overlay.querySelector('[data-act="close"]').addEventListener('click', closeSummary);
    overlay.querySelector('[data-act="copy"]').addEventListener('click', copyText);
    overlay.querySelector('[data-act="share"]').addEventListener('click', sharePicks);
    overlay.querySelector('[data-act="clear"]').addEventListener('click', clearAll);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeSummary();
    });
  }

  function renderRows() {
    var rows = overlay.querySelector('#bp-rows');
    rows.innerHTML = '';
    raceData.forEach(function (rd) {
      var arr = selected(rd);
      var row = document.createElement('div');
      row.className = 'bp-row';
      var pick = arr.length
        ? arr.map(function (n) { return '<p class="bp-row__pick">' + escapeHtml(n) + '</p>'; }).join('')
        : '<p class="bp-row__pick is-empty">No pick yet</p>';
      var hint = (arr.length && arr.length < rd.max)
        ? '<p class="bp-row__hint">Pick ' + (rd.max - arr.length) + ' more</p>'
        : '';
      row.innerHTML = '<p class="bp-row__race">' + escapeHtml(rd.name) + '</p>' + pick + hint;
      rows.appendChild(row);
    });
  }

  function openSummary() {
    if (!overlay) buildModal();
    renderRows();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var first = overlay.querySelector('.bp-act');
    if (first) first.focus();
  }
  function closeSummary() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function clearAll() {
    picks = {};
    save();
    raceData.forEach(function (rd) { applyRace(rd); updateCounter(rd); });
    updateBar();
    renderRows();
    toast('Ballot cleared');
  }

  // ---- copy / share ---------------------------------------------------
  function ballotText() {
    var lines = ['My Marblehead sample ballot, June 9, 2026', ''];
    var any = false;
    raceData.forEach(function (rd) {
      var arr = selected(rd);
      if (!arr.length) return;
      any = true;
      if (arr.length === 1) {
        lines.push(rd.name + ': ' + arr[0]);
      } else {
        lines.push(rd.name + ':');
        arr.forEach(function (n) { lines.push('  ' + n); });
      }
    });
    if (!any) lines.push('(no picks yet)');
    lines.push('');
    lines.push(PAGE_URL);
    return lines.join('\n');
  }

  function copyText() {
    var text = ballotText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); },
        function () { legacyCopy(text); });
    } else {
      legacyCopy(text);
    }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard'); }
    catch (e) { toast('Copy failed'); }
    document.body.removeChild(ta);
  }

  function sharePicks() {
    var canvas = drawShareCard();
    canvas.toBlob(function (blob) {
      if (!blob) { toast('Could not make image'); return; }
      var file = new File([blob], 'marblehead-ballot.png', { type: 'image/png' });
      var shareData = {
        title: 'My Marblehead sample ballot',
        text: ballotText()
      };
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        shareData.files = [file];
        navigator.share(shareData).catch(function () {});
      } else {
        downloadCanvas(canvas);
      }
    }, 'image/png');
  }

  function downloadCanvas(canvas) {
    try {
      var url = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'marblehead-ballot.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast('Image saved');
    } catch (e) { toast('Could not save image'); }
  }

  // ---- share card (drawn client-side, light palette) -----------------
  function drawShareCard() {
    var W = 1080, H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d');

    // background
    var g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#EAF1F5');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // top accent band
    c.fillStyle = '#1B3A57'; c.fillRect(0, 0, W, 14);

    var PAD = 84;
    var SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    var y = 150;

    c.textBaseline = 'alphabetic';
    c.fillStyle = '#7A8A98';
    c.font = '700 26px ' + SANS;
    c.fillText('MARBLEHEAD  ·  JUNE 9, 2026', PAD, y);
    y += 64;

    c.fillStyle = '#0F2A3D';
    c.font = '800 76px ' + SANS;
    c.fillText('My sample ballot', PAD, y);
    y += 40;

    c.strokeStyle = '#D8E1E8'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(PAD, y); c.lineTo(W - PAD, y); c.stroke();
    y += 30;

    raceData.forEach(function (rd) {
      var arr = selected(rd);
      y += 34;
      c.fillStyle = '#7A8A98';
      c.font = '700 24px ' + SANS;
      c.fillText(rd.name.toUpperCase(), PAD, y);
      y += 46;
      c.font = '600 40px ' + SANS;
      if (arr.length) {
        c.fillStyle = '#0F2A3D';
        arr.forEach(function (n, idx) {
          if (idx > 0) y += 50;
          y = wrapText(c, n, PAD, y, W - PAD * 2, 50);
        });
      } else {
        c.fillStyle = '#A6B3BE';
        c.fillText('No pick yet', PAD, y);
      }
      y += 18;
      c.strokeStyle = '#ECF1F5'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(PAD, y); c.lineTo(W - PAD, y); c.stroke();
    });

    // footer
    c.fillStyle = '#1B3A57';
    c.font = '800 30px ' + SANS;
    c.fillText('marbleheaddata.org', PAD, H - 90);
    c.fillStyle = '#7A8A98';
    c.font = '500 24px ' + SANS;
    c.fillText('My sample ballot, not an endorsement.', PAD, H - 54);

    return canvas;
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(test).width > maxWidth && line) {
        c.fillText(line, x, y);
        line = words[i];
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) { c.fillText(line, x, y); }
    return y;
  }

  // ---- toast ----------------------------------------------------------
  var toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'bp-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('is-show'); }, 1900);
  }

  // ---- util -----------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // ---- init -----------------------------------------------------------
  updateBar();
})();
