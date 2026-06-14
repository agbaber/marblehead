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
    var dataSeats = raceEl.getAttribute('data-seats');
    if (dataSeats && /^\d+$/.test(dataSeats)) {
      max = parseInt(dataSeats, 10);
    } else if (meta) {
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
      var pickRow = document.createElement('p');
      pickRow.className = 'race-pick';
      pickRow.appendChild(rd.counter);
      meta.parentNode.insertBefore(pickRow, meta);
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
      rd.counter.textContent = 'Pick up to ' + rd.max;
      return;
    }
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
    drawShareCard().then(function (canvas) {
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
    }).catch(function () { toast('Could not make image'); });
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

  // ---- share card (drawn client-side, dark palette) ------------------
  // Hardcoded for the June 9, 2026 election. Update when next election rolls.
  var ELECTION_KICKER = 'MARBLEHEAD · JUNE 9, 2026 ELECTION';

  // Dark theme tokens (mirroring assets/site.css prefers-color-scheme: dark)
  var SC_BG = '#0B1620';
  var SC_NAV_BG = '#0F1B26';
  var SC_TEXT = '#E6ECF1';
  var SC_TEXT_MID = '#AFBCC7';
  var SC_TEXT_SUB = '#7D8C99';
  var SC_TEXT_FAINT = '#5B6B78';
  var SC_HAIRLINE = '#22303C';

  // Race accent color per data-accent value (dark-theme lifted variants)
  var SC_ACCENT = {
    navy:  '#8AB0C4',
    teal:  '#6FB3C7',
    plum:  '#B08AB4',
    sage:  '#9DBC7A',
    brass: '#E4B363'
  };

  var SC_HEAD = '"Libre Franklin", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var SC_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  var houseImg = null;
  function loadHouseImg() {
    if (houseImg) return Promise.resolve(houseImg);
    return fetch('/assets/lighthouse/lighthouse.svg')
      .then(function (r) { return r.text(); })
      .then(function (svgText) {
        var recolored = svgText.replace(/currentColor/g, SC_TEXT);
        var blob = new Blob([recolored], { type: 'image/svg+xml' });
        var url = URL.createObjectURL(blob);
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { houseImg = img; resolve(img); };
          img.onerror = reject;
          img.src = url;
        });
      });
  }

  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 80px "Libre Franklin"'),
      document.fonts.load('700 36px "Libre Franklin"'),
      document.fonts.load('700 26px "Libre Franklin"'),
      document.fonts.load('500 28px "Libre Franklin"'),
      document.fonts.ready
    ]);
  }

  function drawShareCard() {
    return Promise.all([loadHouseImg().catch(function () { return null; }), ensureFonts()])
      .then(function () { return drawShareCardSync(); });
  }

  function drawShareCardSync() {
    var W = 1080, H = 1500;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d');
    c.textBaseline = 'alphabetic';

    // background
    c.fillStyle = SC_BG; c.fillRect(0, 0, W, H);

    // lighthouse watermark behind content
    if (houseImg) {
      c.save();
      c.globalAlpha = 0.065;
      c.drawImage(houseImg, W - 700, H - 1280, 820, 1230);
      c.restore();
    }

    // top nav strip
    var navH = 88;
    c.fillStyle = SC_NAV_BG; c.fillRect(0, 0, W, navH);
    c.strokeStyle = SC_HAIRLINE; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, navH); c.lineTo(W, navH); c.stroke();
    if (houseImg) {
      // Use the cropped favicon-style icon for the nav badge: a small
      // navy roundel with the lighthouse silhouette.
      c.save();
      c.fillStyle = '#1B3A57';
      var iconR = 10;
      roundRect(c, 40, 22, 48, 48, iconR);
      c.fill();
      c.globalAlpha = 1;
      // Draw the full SVG scaled and offset so just the lamp room shows
      // (mimics the favicon crop).
      c.drawImage(houseImg, 40 - 12, 22 - 8, 48 * 1.6, 48 * 1.6 * (1536 / 1024));
      c.restore();
    }
    c.fillStyle = SC_TEXT;
    c.font = '700 26px ' + SC_HEAD;
    c.fillText('MHD Data', 104, 58);

    var PAD = 84;
    var y = navH + 96;

    // kicker with leading rule
    var ruleW = 28;
    c.fillStyle = SC_TEXT;
    c.fillRect(PAD, y - 6, ruleW, 3);
    c.fillStyle = SC_TEXT_SUB;
    c.font = '700 16px ' + SC_SANS;
    drawTracked(c, ELECTION_KICKER, PAD + ruleW + 14, y, 2);

    y += 76;
    c.fillStyle = SC_TEXT;
    c.font = '700 80px ' + SC_HEAD;
    c.fillText('My sample ballot', PAD, y);

    y += 80;

    raceData.forEach(function (rd, idx) {
      var arr = selected(rd);
      var accent = resolveAccent(rd);

      // accent dot
      c.fillStyle = accent;
      c.beginPath();
      c.arc(PAD + 6, y - 7, 6, 0, Math.PI * 2);
      c.fill();

      // race label small caps tracked
      c.fillStyle = SC_TEXT_SUB;
      c.font = '700 16px ' + SC_SANS;
      drawTracked(c, rd.name.toUpperCase(), PAD + 22, y, 1.8);

      y += 38;

      if (arr.length === 0) {
        c.fillStyle = SC_TEXT_FAINT;
        c.font = '500 28px ' + SC_HEAD;
        c.fillText('No pick yet', PAD, y);
        y += 12;
      } else {
        c.fillStyle = SC_TEXT;
        c.font = '700 36px ' + SC_HEAD;
        arr.forEach(function (n, i) {
          if (i > 0) y += 48;
          y = wrapText(c, n, PAD, y, W - PAD * 2, 48);
        });
        y += 12;
      }

      y += 36;
      if (idx < raceData.length - 1) {
        c.strokeStyle = SC_HAIRLINE; c.lineWidth = 1;
        c.beginPath(); c.moveTo(PAD, y); c.lineTo(W - PAD, y); c.stroke();
        y += 36;
      }
    });

    // footer
    var footY = H - 70;
    c.fillStyle = SC_TEXT;
    c.font = '700 24px ' + SC_HEAD;
    c.fillText('marbleheaddata.org', PAD, footY);
    c.fillStyle = SC_TEXT_SUB;
    c.font = '500 16px ' + SC_SANS;
    var tag = 'Saved on this device';
    var tagW = c.measureText(tag).width;
    c.fillText(tag, W - PAD - tagW, footY);

    return canvas;
  }

  function resolveAccent(rd) {
    var hex = rd.el && rd.el.getAttribute('data-accent');
    return SC_ACCENT[hex] || SC_ACCENT.navy;
  }
  function drawTracked(c, text, x, y, ls) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      c.fillText(text[i], cx, y);
      cx += c.measureText(text[i]).width + ls;
    }
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
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
