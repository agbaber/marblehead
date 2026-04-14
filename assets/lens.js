// Lens mode: lets readers filter the debate page to foreground one side's case.
// Reads ?lens=for or ?lens=against from the URL. Contra perspectives collapse
// into a clickable summary; the full text is one click away. The crux-map and
// mini-synthesis blocks stay unfiltered. The meta-note (four-question framing)
// hides when a lens is active since the reader has already picked a side.
//
// Progressive enhancement: without this script, both sides show in full.
(function () {
  'use strict';

  // Only run on pages that have perspective blocks outside .tldr
  var perspectives = document.querySelectorAll('.perspective--for, .perspective--against');
  if (!perspectives.length) return;

  var VALID = { for: 'against', against: 'for' };
  var LABELS = {
    for:     'For the override',
    against: 'Against the override'
  };

  // --- Read lens from URL ---
  function getLens() {
    var params = new URLSearchParams(window.location.search);
    var v = params.get('lens');
    return VALID[v] ? v : null;
  }

  // --- Update URL without reload ---
  function setLensParam(lens) {
    var url = new URL(window.location);
    if (lens) {
      url.searchParams.set('lens', lens);
    } else {
      url.searchParams.delete('lens');
    }
    history.replaceState(null, '', url);
  }

  // --- Build the lens picker (inserted before .meta-note) ---
  function buildPicker() {
    var wrap = document.createElement('div');
    wrap.className = 'lens-picker';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Reading lens');

    var label = document.createElement('span');
    label.className = 'lens-picker-label';
    label.textContent = 'Read through a lens:';
    wrap.appendChild(label);

    ['for', 'against'].forEach(function (side) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lens-btn lens-btn--' + side;
      btn.setAttribute('data-lens', side);
      btn.textContent = LABELS[side];
      wrap.appendChild(btn);
    });

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'lens-btn lens-btn--clear';
    clear.textContent = 'Both sides';
    clear.setAttribute('data-lens', '');
    wrap.appendChild(clear);

    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-lens]');
      if (!btn) return;
      var next = btn.getAttribute('data-lens') || null;
      applyLens(next);
    });

    return wrap;
  }

  // --- Build the active-lens banner ---
  function buildBanner() {
    var bar = document.createElement('div');
    bar.className = 'lens-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<span class="lens-banner-text"></span>' +
      '<button type="button" class="lens-banner-switch">Switch</button>' +
      '<button type="button" class="lens-banner-clear">Show both sides</button>' +
      '<button type="button" class="lens-banner-share" aria-label="Copy link">Share this view</button>';

    bar.querySelector('.lens-banner-switch').addEventListener('click', function () {
      var cur = getLens();
      applyLens(cur === 'for' ? 'against' : 'for');
    });
    bar.querySelector('.lens-banner-clear').addEventListener('click', function () {
      applyLens(null);
    });
    bar.querySelector('.lens-banner-share').addEventListener('click', function () {
      navigator.clipboard.writeText(window.location.href).then(function () {
        var btn = bar.querySelector('.lens-banner-share');
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = orig; }, 1500);
      });
    });

    return bar;
  }

  // --- Collapse / expand perspectives ---
  function applyLens(lens) {
    setLensParam(lens);

    // Update picker active states
    picker.querySelectorAll('[data-lens]').forEach(function (btn) {
      var val = btn.getAttribute('data-lens') || null;
      btn.classList.toggle('lens-btn--active', val === lens);
    });

    // Show/hide banner
    if (lens) {
      banner.classList.add('lens-banner--visible');
      banner.querySelector('.lens-banner-text').textContent =
        'Reading through the "' + LABELS[lens].toLowerCase() + '" lens. ' +
        'Collapsed blocks are one click away.';
    } else {
      banner.classList.remove('lens-banner--visible');
    }

    // Hide meta-note (four-question framing) when a lens is active
    if (metaNote) {
      metaNote.style.display = lens ? 'none' : '';
    }

    // Walk every perspective block (including inside .tldr)
    var contraClass = lens ? 'perspective--' + VALID[lens] : null;

    perspectives.forEach(function (el) {
      var isContra = contraClass && el.classList.contains(contraClass);

      if (!lens || !isContra) {
        // Expanded state: unwrap from <details> if we wrapped it
        unwrapDetails(el);
        return;
      }

      // Collapsed state: wrap in <details> if not already
      wrapInDetails(el);
    });
  }

  function wrapInDetails(el) {
    if (el.parentNode && el.parentNode.classList &&
        el.parentNode.classList.contains('lens-collapsed')) return;

    var details = document.createElement('details');
    details.className = 'lens-collapsed';

    var summary = document.createElement('summary');
    summary.className = 'lens-collapsed-summary';

    // Determine which side this is
    var side = el.classList.contains('perspective--for') ? 'for' : 'against';
    summary.innerHTML =
      '<span class="lens-collapsed-label">' + LABELS[side] + '</span>' +
      '<span class="lens-collapsed-hint">Tap to read</span>';

    el.parentNode.insertBefore(details, el);
    details.appendChild(summary);
    details.appendChild(el);
  }

  function unwrapDetails(el) {
    var wrapper = el.parentNode;
    if (!wrapper || !wrapper.classList ||
        !wrapper.classList.contains('lens-collapsed')) return;

    wrapper.parentNode.insertBefore(el, wrapper);
    wrapper.remove();
  }

  // --- Init ---
  var metaNote = document.querySelector('.meta-note');
  var picker = buildPicker();
  var banner = buildBanner();

  if (metaNote) {
    metaNote.parentNode.insertBefore(picker, metaNote);
    metaNote.parentNode.insertBefore(banner, metaNote);
  }

  // Apply initial lens from URL
  var initial = getLens();
  applyLens(initial);

  // Analytics (boolean only, no stance value)
  if (initial && typeof posthog !== 'undefined') {
    posthog.capture('lens_activated', { page: window.location.pathname });
  }
})();
