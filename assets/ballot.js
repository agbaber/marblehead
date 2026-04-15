/*
 * Clickable sample-ballot runtime with anonymous pick sharing.
 *
 * Makes the .ballot-oval buttons on sample-ballot blocks interactive so
 * readers can practice marking the ballot they'll see on June 9, 2026.
 * Enforces per-row "at most one of Yes/No marked" semantics.
 *
 * After marking at least one question, a "Share your picks anonymously"
 * button appears. Submitting POSTs the full ballot combination to the
 * community-pulse worker (IP rate-limited, one submission per visitor,
 * no identity stored). Results are rendered inline as per-question bars
 * and a highest-supported-tier distribution.
 *
 * Returning visitors (localStorage flag) see results on load via GET.
 *
 * Markup contract:
 *
 *   <div class="ballot-row">
 *     ...
 *     <div class="ballot-choices">
 *       <span class="ballot-choice">
 *         <span class="ballot-choice-label">Yes</span>
 *         <button type="button" class="ballot-oval"
 *                 aria-pressed="false" aria-label="Mark Yes">
 *           <svg class="ballot-oval-fill" ...>
 *             <ellipse .../>
 *           </svg>
 *         </button>
 *       </span>
 *       ... (No)
 *     </div>
 *   </div>
 *
 * Clicks anywhere on .ballot-choice (including the visible Yes/No
 * label text) are routed to the .ballot-oval inside it, which gives
 * the label text an extended tap target on mobile where the 22x14
 * oval is below the 44px WCAG recommendation.
 *
 * Pages with no .ballot-oval elements are early-returned, matching
 * the pattern used by assets/citations.js.
 */

(function () {
  'use strict';

  // -- Helpers ---------------------------------------------------------------

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  /** Read API base from the community-pulse script tag already on the page. */
  function getApiBase() {
    var el = document.querySelector('script[data-api-base]');
    return el ? el.dataset.apiBase : '';
  }

  /** Derive the page key from the current pathname. */
  function getPageKey() {
    var path = window.location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    // Only the two ballot pages are valid.
    if (path === 'question-2-trash') return 'question-2-trash';
    return 'what-is-the-override';
  }

  /** Read all marked picks from the DOM. Returns e.g. { "1A": "Y", "2": "N" }. */
  function readPicks() {
    var picks = {};
    var rows = document.querySelectorAll('.ballot-row');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var qNum = (row.querySelector('.ballot-q-num') || {}).textContent;
      if (!qNum) continue;
      qNum = qNum.trim();
      var marked = row.querySelector('.ballot-oval[aria-pressed="true"]');
      if (!marked) continue;
      var choice = marked.closest('.ballot-choice');
      if (!choice) continue;
      var label = (choice.querySelector('.ballot-choice-label') || {}).textContent || '';
      picks[qNum] = label.trim().toLowerCase() === 'yes' ? 'Y' : 'N';
    }
    return picks;
  }

  /** True if at least one oval is marked on the page. */
  function hasAnyPick() {
    return !!document.querySelector('.ballot-oval[aria-pressed="true"]');
  }

  var STORAGE_KEY = 'ballot-submitted';
  var TIER_LABELS = {
    '1A': 'Invest ($15M)',
    '1B': 'Stabilize ($12M)',
    '1C': 'Restore ($9M)',
    none: 'No override'
  };
  var Q_LABELS = {
    '1A': '1A Invest $15M',
    '1B': '1B Stabilize $12M',
    '1C': '1C Restore $9M',
    '2':  'Q2 Trash $2.3M'
  };

  // -- Submit button ---------------------------------------------------------

  /** Inject the submit row after the last .ballot container on the page. */
  function injectSubmitRow() {
    var ballots = document.querySelectorAll('.ballot');
    if (ballots.length === 0) return null;
    var last = ballots[ballots.length - 1];

    var row = document.createElement('div');
    row.className = 'ballot-submit-row';
    row.hidden = true;
    row.innerHTML =
      '<button type="button" class="ballot-submit">Share your picks anonymously</button>' +
      '<p class="ballot-submit-note">One submission per visitor. No identity stored.</p>';
    last.parentNode.insertBefore(row, last.nextSibling);
    return row;
  }

  /** Show or hide the submit row based on whether any pick is marked. */
  function syncSubmitVisibility(submitRow) {
    if (!submitRow) return;
    submitRow.hidden = !hasAnyPick();
  }

  // -- Results renderer ------------------------------------------------------

  function pct(n, total) {
    if (total === 0) return 0;
    return Math.round((n / total) * 100);
  }

  /**
   * Build and return a .ballot-results element from the API aggregate.
   * @param {Object} data - { total, questions, highest_tier }
   * @param {boolean} showTiers - whether to show the highest-tier section (false on Q2-only page)
   */
  function buildResultsPanel(data, showTiers) {
    var el = document.createElement('div');
    el.className = 'ballot-results';

    var html = '<h3 class="ballot-results-heading">Community picks' +
      '<span class="ballot-results-count">' + data.total + ' ballot' + (data.total !== 1 ? 's' : '') + ' shared</span></h3>';

    // Per-question bars.
    html += '<div class="ballot-results-bars">';
    var questions = data.questions || {};
    var qOrder = showTiers ? ['1A', '1B', '1C', '2'] : ['2'];
    for (var i = 0; i < qOrder.length; i++) {
      var q = qOrder[i];
      var qData = questions[q];
      if (!qData) continue;
      var total = qData.yes + qData.no;
      var yesPct = pct(qData.yes, total);
      var noPct = 100 - yesPct;
      html += '<div class="ballot-results-q">' +
        '<span class="ballot-results-q-label">' + Q_LABELS[q] + '</span>' +
        '<div class="ballot-results-bar">' +
          '<div class="ballot-results-bar-yes" style="width:' + yesPct + '%">' + (yesPct >= 10 ? yesPct + '% Yes' : '') + '</div>' +
          '<div class="ballot-results-bar-no">' + (noPct >= 10 ? noPct + '% No' : '') + '</div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';

    // Highest tier section (Q1 only).
    if (showTiers && data.highest_tier) {
      var ht = data.highest_tier;
      var tierTotal = (ht['1A'] || 0) + (ht['1B'] || 0) + (ht['1C'] || 0) + (ht.none || 0);
      if (tierTotal > 0) {
        html += '<div class="ballot-results-tier">' +
          '<p class="ballot-results-tier-title">Highest supported tier</p>' +
          '<div class="ballot-results-tier-rows">';
        var tierOrder = ['1A', '1B', '1C', 'none'];
        for (var j = 0; j < tierOrder.length; j++) {
          var tk = tierOrder[j];
          var tv = ht[tk] || 0;
          var tp = pct(tv, tierTotal);
          html += '<div class="ballot-results-tier-row">' +
            '<span class="ballot-results-tier-label">' + TIER_LABELS[tk] + '</span>' +
            '<div class="ballot-results-tier-fill" data-tier="' + tk + '" style="width:' + tp + '%"></div>' +
            '<span class="ballot-results-tier-pct">' + tp + '%</span>' +
          '</div>';
        }
        html += '</div></div>';
      }
    }

    html += '<p class="ballot-results-disclaimer">Anonymous and approximate. One submission per visitor.</p>';
    el.innerHTML = html;
    return el;
  }

  /** Insert the results panel, replacing the submit row if present. */
  function showResults(data, submitRow) {
    var showTiers = getPageKey() === 'what-is-the-override';
    var panel = buildResultsPanel(data, showTiers);

    if (submitRow && submitRow.parentNode) {
      submitRow.parentNode.replaceChild(panel, submitRow);
    } else {
      // Fallback: append after the last .ballot.
      var ballots = document.querySelectorAll('.ballot');
      if (ballots.length > 0) {
        var last = ballots[ballots.length - 1];
        last.parentNode.insertBefore(panel, last.nextSibling);
      }
    }
  }

  // -- API calls -------------------------------------------------------------

  function fetchResults(apiBase, page, callback) {
    fetch(apiBase + '/api/ballot?page=' + encodeURIComponent(page))
      .then(function (r) { return r.json(); })
      .then(callback)
      .catch(function () { /* silent failure */ });
  }

  function submitPicks(apiBase, picks, page, callback) {
    fetch(apiBase + '/api/ballot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks: picks, page: page })
    })
      .then(function (r) { return r.json(); })
      .then(callback)
      .catch(function () { /* silent failure */ });
  }

  // -- Main ------------------------------------------------------------------

  ready(function () {
    if (!document.querySelector('.ballot-oval')) return;

    var apiBase = getApiBase();
    var page = getPageKey();
    var submitted = false;
    var submitRow = null;

    // If already submitted, show results immediately.
    if (localStorage.getItem(STORAGE_KEY) && apiBase) {
      submitted = true;
      fetchResults(apiBase, page, function (data) {
        if (data && data.total > 0) showResults(data, null);
      });
    }

    // Inject the submit button (hidden until a pick is made).
    if (!submitted) {
      submitRow = injectSubmitRow();
    }

    // Click handler for ballot ovals (existing behavior + submit row sync).
    document.addEventListener('click', function (event) {
      var choice = event.target.closest('.ballot-choice');
      if (!choice) return;
      var row = choice.closest('.ballot-row');
      if (!row) return;
      var box = choice.querySelector('.ballot-oval');
      if (!box) return;

      var isPressed = box.getAttribute('aria-pressed') === 'true';

      if (isPressed) {
        box.setAttribute('aria-pressed', 'false');
        syncSubmitVisibility(submitRow);
        return;
      }

      var siblings = row.querySelectorAll('.ballot-oval[aria-pressed="true"]');
      for (var i = 0; i < siblings.length; i++) {
        siblings[i].setAttribute('aria-pressed', 'false');
      }
      box.setAttribute('aria-pressed', 'true');

      syncSubmitVisibility(submitRow);

      if (typeof posthog !== 'undefined') {
        var label = (choice.querySelector('.ballot-choice-label') || {}).textContent || '';
        var qNum = (row.querySelector('.ballot-q-num') || {}).textContent || '';
        posthog.capture('ballot_practiced', {
          vote: label.trim(),
          question: qNum.trim(),
          page: window.location.pathname
        });
      }
    });

    // Submit handler.
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.ballot-submit')) return;
      if (submitted || !apiBase) return;

      var picks = readPicks();
      if (Object.keys(picks).length === 0) return;

      // Disable button while submitting.
      var btn = event.target.closest('.ballot-submit');
      btn.disabled = true;
      btn.textContent = 'Sharing\u2026';
      submitted = true;

      submitPicks(apiBase, picks, page, function (data) {
        localStorage.setItem(STORAGE_KEY, '1');

        var results = data.results || data;
        if (results && results.total > 0) {
          showResults(results, submitRow);
        }

        if (typeof posthog !== 'undefined') {
          posthog.capture('ballot_submitted', {
            picks: picks,
            page: window.location.pathname
          });
        }
      });
    });
  });
})();
