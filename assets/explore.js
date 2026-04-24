(function () {
  /* ── State ── */
  var selections = {};   // { questionId: answerId }
  var notesPill = document.getElementById('notesPill');
  var notesPanel = document.getElementById('notesPanel');
  var notesPanelBody = document.getElementById('notesPanelBody');
  var notesPillCount = document.getElementById('notesPillCount');
  var notesBackdrop = document.getElementById('notesBackdrop');

  /* ── Reorder question-screens: concrete/factual first, interpretive last.
     The HTML source order (override, voteno, schools, ...) front-loads the
     two most identity-activating questions. That primes a partisan read
     before the reader has any concrete numbers in hand, which runs against
     the project's "form their own opinions based on facts" stance. Show
     the tax-math and comparison questions first and save the interpretive
     ones for the end.

     Every downstream piece (topicOrder, progress dots, landing-card order,
     next-question buttons, stats strip) derives from DOM order, so moving
     the section elements is enough. */
  (function reorderQuestions() {
    var preferredOrder = [
      'mycost',       // What would the override cost my household?
      'servicelevel', // What level of service do I want from Marblehead?
      'seniors',      // How does this affect seniors?
      'taxrank',      // How does Marblehead's tax burden compare?
      'levy',         // How can town income keep up with cost growth?
      'moneygone',    // What explains the budget growth?
      'size',         // What does each tier get us?
      'schools',      // Did school staffing grow while enrollment fell?
      'trash',        // Should we pay for trash through property taxes or a flat fee?
      'library',      // Why does the library take the heaviest cut?
      'alternatives', // Do any of the town's levers have enough impact?
      'again',        // How soon would we come back for another override?
      'voteno',       // What will happen if we vote no?
      'override',     // Does an override buy time, and for what?
      'trust'         // Should I trust the town with more revenue?
    ];
    var parent = document.querySelector('.explore-stage');
    if (!parent) return;
    var allScreens = parent.querySelectorAll('.question-screen');
    if (!allScreens.length) return;
    var screensByTopic = {};
    allScreens.forEach(function (s) { screensByTopic[s.dataset.topic] = s; });
    // Anchor: whatever comes right after the last question-screen today.
    // Re-inserting every screen before the same anchor rebuilds the group
    // in preferredOrder without disturbing unrelated siblings.
    var anchor = allScreens[allScreens.length - 1].nextSibling;
    preferredOrder.forEach(function (topic) {
      var el = screensByTopic[topic];
      if (el) parent.insertBefore(el, anchor);
    });
  })();

  /* ── Inject pick prompt below each question's answers ── */
  (function injectPickPrompt() {
    document.querySelectorAll('.question-screen').forEach(function (screen) {
      var answersEl = screen.querySelector('.answers');
      if (!answersEl) return;
      var prompt = document.createElement('p');
      prompt.className = 'answers-prompt';
      prompt.textContent = 'Tap any answer to read the case for it';
      answersEl.parentNode.insertBefore(prompt, answersEl.nextSibling);
    });
  })();

  /* ── Reactions API (server-side social proof for all users) ── */
  var API_BASE = 'https://marblehead-community-pulse.agbaber.workers.dev';

  // Per-topic counts from server: { topic: { decided, views, shares } }
  var socialCounts = {};

  // Which actions this browser already counted (prevents double-counting).
  // Values are timestamps; views expire after VIEW_COOLDOWN_MS so returning
  // visitors are counted again. Decided/answer counts stay permanent (true).
  var VIEW_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
  var counted = {};
  try { counted = JSON.parse(localStorage.getItem('explore-counted')) || {}; } catch (e) {}
  function saveCounted() { localStorage.setItem('explore-counted', JSON.stringify(counted)); }
  function isCounted(key) {
    var v = counted[key];
    if (!v) return false;
    if (v === true) return true; // legacy boolean (decided/answer -- permanent)
    // Timestamp: check if still within cooldown
    return (Date.now() - v) < VIEW_COOLDOWN_MS;
  }

  // Section ID conventions: q- = decided, v- = viewed, s- = shared,
  //                          a- = answer pick, m- = move (reconsideration)
  function sectionId(prefix, topic) { return 'index.html#' + prefix + '-' + topic; }

  // Batch-fetch all counts for all topics in one request.
  // 'u' is the "Not sure yet" answer, a real first-class option.
  var ANSWER_KEYS = ['a', 'b', 'c', 'u'];
  var PAGE_SHARE_SECTION = 'index.html#s-positions';
  var pageShareCount = 0; // server total for position-level shares
  function fetchAllCounts(topics) {
    var ids = [];
    topics.forEach(function (t) {
      ids.push(encodeURIComponent(sectionId('q', t)));
      ids.push(encodeURIComponent(sectionId('v', t)));
      ids.push(encodeURIComponent(sectionId('s', t)));
      ids.push(encodeURIComponent(sectionId('m', t))); // reconsideration count
      // Answer-level counts for distribution bars
      ANSWER_KEYS.forEach(function (ak) {
        ids.push(encodeURIComponent(sectionId('a', t + '-' + ak)));
      });
    });
    // Also fetch the page-level position share count
    ids.push(encodeURIComponent(PAGE_SHARE_SECTION));
    fetch(API_BASE + '/api/reactions?section_ids=' + ids.join(','))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        topics.forEach(function (t) {
          var picks = {};
          ANSWER_KEYS.forEach(function (ak) {
            picks[ak] = (data[sectionId('a', t + '-' + ak)] || {}).total || 0;
          });
          var serverViews   = (data[sectionId('v', t)] || {}).total || 0;
          var serverShares  = (data[sectionId('s', t)] || {}).total || 0;
          var serverDecided = (data[sectionId('q', t)] || {}).total || 0;
          var serverMoves   = (data[sectionId('m', t)] || {}).total || 0;
          // Use the higher of server vs optimistic to avoid flash-down
          var prev = socialCounts[t] || {};
          socialCounts[t] = {
            decided: Math.max(serverDecided, prev.decided || 0),
            views:   Math.max(serverViews, prev.views || 0),
            shares:  Math.max(serverShares, prev.shares || 0),
            moves:   Math.max(serverMoves, prev.moves || 0),
            picks:   picks
          };
        });
        pageShareCount = (data[PAGE_SHARE_SECTION] || {}).total || 0;
        updateSocialDisplays();
      })
      .catch(function () {});
  }

  // Increment a server counter (once per cooldown window per action per topic).
  // Returns true if the increment fired, false if deduped.
  function incrementSocial(prefix, topic) {
    var key = prefix + '-' + topic;
    if (isCounted(key)) return false;
    // Views use a timestamp so they expire; decided/answer are permanent
    counted[key] = (prefix === 'v') ? Date.now() : true;
    saveCounted();

    // Optimistically bump the local count so the UI updates immediately
    if (!socialCounts[topic]) socialCounts[topic] = { decided: 0, views: 0, shares: 0 };
    var field = prefix === 'q' ? 'decided' : prefix === 'v' ? 'views' : 'shares';
    socialCounts[topic][field]++;
    updateSocialDisplays();

    var sid = sectionId(prefix, topic);
    fetch(API_BASE + '/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sid })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) {
          // Server response is authoritative; correct the optimistic value
          socialCounts[topic][field] = data.total;
          updateSocialDisplays();
        }
      })
      .catch(function () {
        // Revert optimistic bump and counted flag
        socialCounts[topic][field]--;
        delete counted[key];
        saveCounted();
        updateSocialDisplays();
      });
    return true;
  }

  // Increment page-level share counter (one POST per "Copy link to positions" click)
  function incrementPageShare() {
    pageShareCount++;
    updateSocialDisplays();
    fetch(API_BASE + '/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: PAGE_SHARE_SECTION })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) { pageShareCount = data.total; updateSocialDisplays(); }
      })
      .catch(function () {
        pageShareCount--;
        updateSocialDisplays();
      });
  }

  // Increment share counter (cumulative, not once-per-browser)
  function incrementShareCount(topic) {
    // Optimistic bump
    if (!socialCounts[topic]) socialCounts[topic] = { decided: 0, views: 0, shares: 0 };
    socialCounts[topic].shares++;
    updateSocialDisplays();

    var sid = sectionId('s', topic);
    fetch(API_BASE + '/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sid })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) {
          socialCounts[topic].shares = data.total;
          updateSocialDisplays();
        }
      })
      .catch(function () {
        socialCounts[topic].shares--;
        updateSocialDisplays();
      });
  }

  // Update all social proof displays (question bars only; landing cards use position pips)
  function updateSocialDisplays() {
    // Question-screen bars
    updateQuestionSocialBar(currentTopic);
    // Refresh pick distribution if this topic already has a selection
    if (currentTopic && selections[currentTopic]) {
      showPickDistribution(currentTopic);
    }
    // Refresh landing card distribution bars
    updateLandingCards();
    // Refresh the stats strip so community totals reflect server data
    updateStatsStrip();
  }

  // Update the social proof bar on the active question screen
  function updateQuestionSocialBar(topic) {
    if (!topic) return;
    var bar = document.getElementById('qsocial-' + topic);
    if (!bar) return;
    var c = socialCounts[topic] || {};
    // Community row
    var decidedEl = bar.querySelector('.qsocial-decided');
    var viewsEl = bar.querySelector('.qsocial-views');
    var sharesEl = bar.querySelector('.qsocial-shares');
    if (decidedEl) decidedEl.textContent = c.decided || 0;
    if (viewsEl) viewsEl.textContent = c.views || 0;
    if (sharesEl) sharesEl.textContent = c.shares || 0;
    // Your row
    var yourDecided = bar.querySelector('.qsocial-your-decided');
    var yourViews = bar.querySelector('.qsocial-your-views');
    var yourShares = bar.querySelector('.qsocial-your-shares');
    var tv = getTopicViews();
    var ts = getTopicShares();
    if (yourDecided) {
      var d = selections[topic] ? 'Decided' : 'Not yet';
      yourDecided.innerHTML = d === 'Decided'
        ? '<span class="question-social-num">&#10003;</span> decided'
        : 'undecided';
    }
    if (yourViews) {
      var myViews = tv[topic] || 0;
      yourViews.innerHTML = '<span class="question-social-num">' + myViews + '</span> views';
    }
    if (yourShares) {
      var myShares = ts[topic] || 0;
      yourShares.innerHTML = '<span class="question-social-num">' + myShares + '</span> shares';
    }
  }

  // Show answer distribution bar below the answers container for a topic.
  // Four segments: A, B, C, plus "Not sure yet" ('u'). If anyone has
  // reconsidered after reading, append a "X changed their pick" line
  // under the legend.
  function showPickDistribution(topic) {
    var screen = document.querySelector('.question-screen[data-topic="' + topic + '"]');
    if (!screen) return;
    var answersEl = screen.querySelector('.answers');
    if (!answersEl) return;

    var topicState = socialCounts[topic] || {};
    var counts = topicState.picks || {};
    var cA = counts.a || 0, cB = counts.b || 0, cC = counts.c || 0, cU = counts.u || 0;
    var total = cA + cB + cC + cU;
    if (total === 0) return; // No data yet

    // Find or create the distribution bar
    var bar = screen.querySelector('.pick-distribution');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pick-distribution';
      answersEl.parentNode.insertBefore(bar, answersEl.nextSibling);
    }

    function pctOf(n) { return total > 0 ? Math.round((n / total) * 100) : 0; }
    var pA = pctOf(cA);
    var pB = pctOf(cB);
    var pC = pctOf(cC);
    var pU = 100 - pA - pB - pC; // Absorb rounding drift on the muted segment
    if (pU < 0) pU = 0;

    var moves = topicState.moves || 0;
    var movesHtml = '';
    if (moves > 0) {
      var label = (moves === 1) ? 'reader' : 'readers';
      movesHtml =
        '<div class="pick-dist-moves">' +
          '<strong>' + moves + '</strong> ' + label +
          ' changed their pick after reading the evidence' +
        '</div>';
    }

    bar.innerHTML =
      '<div class="pick-dist-bar">' +
        '<div class="pick-dist-seg pick-dist-a" style="width:' + pA + '%">' + (pA >= 8 ? pA + '%' : '') + '</div>' +
        '<div class="pick-dist-seg pick-dist-b" style="width:' + pB + '%">' + (pB >= 8 ? pB + '%' : '') + '</div>' +
        '<div class="pick-dist-seg pick-dist-c" style="width:' + pC + '%">' + (pC >= 8 ? pC + '%' : '') + '</div>' +
        '<div class="pick-dist-seg pick-dist-u" style="width:' + pU + '%">' + (pU >= 8 ? pU + '%' : '') + '</div>' +
      '</div>' +
      '<div class="pick-dist-legend">' +
        '<span class="pick-dist-key"><span class="pick-dist-dot pick-dist-dot-a"></span>A ' + pA + '% <span class="pick-dist-count">(' + cA + ')</span></span>' +
        '<span class="pick-dist-key"><span class="pick-dist-dot pick-dist-dot-b"></span>B ' + pB + '% <span class="pick-dist-count">(' + cB + ')</span></span>' +
        '<span class="pick-dist-key"><span class="pick-dist-dot pick-dist-dot-c"></span>C ' + pC + '% <span class="pick-dist-count">(' + cC + ')</span></span>' +
        '<span class="pick-dist-key"><span class="pick-dist-dot pick-dist-dot-u"></span>Not sure ' + pU + '% <span class="pick-dist-count">(' + cU + ')</span></span>' +
        '<span class="pick-dist-total">' + total + ' picked</span>' +
      '</div>' +
      movesHtml;

    // Verified branch bar is handled by the polling scanner below.
  }

  // ── Verified branch bar (polling approach) ──────────────────
  // Scans for .pick-distribution bars and adds a verified overlay
  // as a sibling. Survives innerHTML re-renders because it's not
  // a child of the distribution bar.

  var _verifyJwt = localStorage.getItem('verify_jwt');
  var _verifyProfile = null;
  var _verifyCache = {};
  var _verifySubmitted = {};

  if (_verifyJwt) {
    setInterval(scanForVerifiedBars, 500);
    setTimeout(scanForVerifiedBars, 200);
    // Sync existing picks as verified votes (one-time on load).
    syncExistingPicks();
  }

  function syncExistingPicks() {
    var synced = localStorage.getItem('verify_synced');
    if (synced) return; // Already synced this session.
    var topics = Object.keys(selections);
    if (topics.length === 0) return;
    var hdr = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _verifyJwt };
    var done = 0;
    topics.forEach(function (topic) {
      if (!selections[topic]) return;
      fetch(API_BASE + '/api/verify/vote', {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ topic: topic, answer: selections[topic] })
      }).then(function () {
        done++;
        if (done >= topics.length) localStorage.setItem('verify_synced', '1');
      }).catch(function () {});
    });
  }

  function scanForVerifiedBars() {
    document.querySelectorAll('.pick-distribution').forEach(function (bar) {
      var screen = bar.closest('.question-screen');
      if (!screen) return;
      var topic = screen.dataset.topic;
      if (!topic) return;
      // Skip if already has a verified sibling.
      var next = bar.nextElementSibling;
      if (next && next.classList.contains('pick-dist-verified')) return;
      addVerifiedBar(topic, bar);
    });
  }

  function addVerifiedBar(topic, distBar) {
    getVerifyProfile(function (profile) {
      if (!profile) return;

      // Auto-submit verified vote once per topic per session.
      if (!_verifySubmitted[topic] && selections[topic]) {
        _verifySubmitted[topic] = true;
        fetch(API_BASE + '/api/verify/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _verifyJwt },
          body: JSON.stringify({ topic: topic, answer: selections[topic] })
        }).catch(function () {});
      }

      var cacheKey = profile.branch_root + ':' + topic;
      if (_verifyCache[cacheKey]) { renderVerifiedBar(distBar, _verifyCache[cacheKey], profile, topic); return; }

      fetch(API_BASE + '/api/verify/branches/' + encodeURIComponent(profile.branch_root) + '/votes?topic=' + topic, {
        headers: { 'Authorization': 'Bearer ' + _verifyJwt }
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.breakdown) { _verifyCache[cacheKey] = data; renderVerifiedBar(distBar, data, profile, topic); }
      }).catch(function () {});
    });
  }

  function getVerifyProfile(cb) {
    if (_verifyProfile) return cb(_verifyProfile);
    fetch(API_BASE + '/api/verify/me', {
      headers: { 'Authorization': 'Bearer ' + _verifyJwt }
    }).then(function (r) { return r.json(); }).then(function (p) {
      if (p && p.identity_hash) { _verifyProfile = p; cb(p); } else cb(null);
    }).catch(function () { cb(null); });
  }

  function renderVerifiedBar(distBar, data, profile, topic) {
    // Remove old sibling.
    var next = distBar.nextElementSibling;
    if (next && next.classList.contains('pick-dist-verified')) next.remove();

    var bd = data.breakdown;
    var vA = bd.a || 0, vB = bd.b || 0, vC = bd.c || 0, vU = bd.u || 0;
    var vTotal = vA + vB + vC + vU;
    if (vTotal === 0) return;

    function vPct(n) { return vTotal > 0 ? Math.round((n / vTotal) * 100) : 0; }
    var vpA = vPct(vA), vpB = vPct(vB), vpC = vPct(vC);
    var vpU = 100 - vpA - vpB - vpC;
    if (vpU < 0) vpU = 0;

    var branchName = profile.branch_name || 'Your branch';
    var el = document.createElement('div');
    el.className = 'pick-dist-verified';
    el.innerHTML =
      '<div class="pick-dist-verified-label">' + branchName + ' (' + vTotal + ' verified)</div>' +
      '<div class="pick-dist-bar-verified">' +
        '<div class="pick-dist-seg pick-dist-a" style="width:' + vpA + '%"></div>' +
        '<div class="pick-dist-seg pick-dist-b" style="width:' + vpB + '%"></div>' +
        '<div class="pick-dist-seg pick-dist-c" style="width:' + vpC + '%"></div>' +
        '<div class="pick-dist-seg pick-dist-u" style="width:' + vpU + '%"></div>' +
      '</div>';
    distBar.after(el);
  }

  // Personal counters (localStorage) -- per-topic + totals
  var SHARES_KEY = 'explore-your-shares';
  var TOPIC_VIEWS_KEY = 'explore-topic-views';    // { topic: count }
  var TOPIC_SHARES_KEY = 'explore-topic-shares';  // { topic: count }

  function getYourViews() {
    var tv = getTopicViews();
    var sum = 0;
    for (var k in tv) { if (tv.hasOwnProperty(k)) sum += tv[k]; }
    return sum;
  }
  function getYourShares() { return parseInt(localStorage.getItem(SHARES_KEY), 10) || 0; }
  // bumpYourViews removed -- personal views are now derived from topic view sum
  function bumpYourShares() { var v = getYourShares() + 1; localStorage.setItem(SHARES_KEY, v); return v; }

  function getTopicViews() { try { return JSON.parse(localStorage.getItem(TOPIC_VIEWS_KEY)) || {}; } catch (e) { return {}; } }
  function getTopicShares() { try { return JSON.parse(localStorage.getItem(TOPIC_SHARES_KEY)) || {}; } catch (e) { return {}; } }
  function bumpTopicView(topic) {
    var tv = getTopicViews();
    tv[topic] = (tv[topic] || 0) + 1;
    localStorage.setItem(TOPIC_VIEWS_KEY, JSON.stringify(tv));
    return tv[topic];
  }
  function bumpTopicShare(topic) {
    var ts = getTopicShares();
    ts[topic] = (ts[topic] || 0) + 1;
    localStorage.setItem(TOPIC_SHARES_KEY, JSON.stringify(ts));
    return ts[topic];
  }

  // Personal view count is now derived from topic views (incremented in switchTopic)

  // Count-up animation for the community totals on initial server response.
  // Runs once per page load (the first time real server data arrives); later
  // updates from single-user increments just set textContent directly so a
  // share of 97 -> 98 doesn't trigger a visible animation.
  var statsCommunityAnimated = false;
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animateStatCount(el, from, to, duration) {
    if (!el) return;
    if (prefersReducedMotion || from === to) { el.textContent = to; return; }
    var start = null;
    var diff = to - from;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      // Ease-out cubic: fast at first, slows as it finishes
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + diff * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = to;
      }
    }
    requestAnimationFrame(step);
  }

  function updateStatsStrip() {
    var statsEl = document.getElementById('exploreStats');
    var decidedCount = topicOrder.filter(function (t) { return !!selections[t]; }).length;
    var totalCount = topicOrder.length;

    // Sum server-side totals across all topics + page-level shares
    var allViews = 0, allShares = pageShareCount;
    topicOrder.forEach(function (t) {
      var c = socialCounts[t] || {};
      allViews += c.views || 0;
      allShares += c.shares || 0;
    });

    document.getElementById('statDecided').textContent = decidedCount;
    document.getElementById('statTotal').textContent = totalCount;
    document.getElementById('statYourViews').textContent = getYourViews();
    document.getElementById('statYourShares').textContent = getYourShares();
    var allViewsEl = document.getElementById('statAllViews');
    var allSharesEl = document.getElementById('statAllShares');
    if (!statsCommunityAnimated && (allViews > 0 || allShares > 0)) {
      // First time real server totals arrive: count up from zero.
      animateStatCount(allViewsEl, 0, allViews, 1200);
      animateStatCount(allSharesEl, 0, allShares, 1200);
      statsCommunityAnimated = true;
    } else {
      allViewsEl.textContent = allViews;
      allSharesEl.textContent = allShares;
    }
    var pct = totalCount > 0 ? Math.round((decidedCount / totalCount) * 100) : 0;
    document.getElementById('statBar').style.width = pct + '%';

    // Progress message
    var msgEl = document.getElementById('statMsg');
    if (decidedCount === 0) {
      msgEl.textContent = 'Pick your first answer';
      msgEl.className = 'explore-stats-msg';
    } else if (decidedCount < totalCount) {
      msgEl.textContent = (totalCount - decidedCount) + ' to go';
      msgEl.className = 'explore-stats-msg';
    } else {
      msgEl.textContent = '';
      msgEl.className = 'explore-stats-msg explore-stats-msg--complete';
    }

    statsEl.style.display = '';
  }

  // Reset button: clears all local data (selections, notes, counters, tutorial)
  document.getElementById('statsReset').addEventListener('click', function () {
    if (!confirm('Erase all your picks? Nothing about you is stored anywhere except your browser.')) return;
    // Clear selections
    Object.keys(selections).forEach(function (k) { delete selections[k]; });
    persistSelections();
    // Clear notes
    localStorage.removeItem('explore-position-notes');
    // Clear personal counters
    localStorage.removeItem(SHARES_KEY);
    localStorage.removeItem(TOPIC_VIEWS_KEY);
    localStorage.removeItem(TOPIC_SHARES_KEY);
    // Clear decided-counted flags
    localStorage.removeItem('explore-counted');
    counted = {};
    // Clear tutorial flag so it shows again
    localStorage.removeItem(TUTORIAL_KEY);
    tutorialSeen = false;
    // Update UI
    document.querySelectorAll('.answer-card').forEach(function (c) {
      c.classList.remove('selected', 'viewing', 'dimmed');
    });
    document.querySelectorAll('.unsure-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    updateAnswerCheckTitles();
    document.querySelectorAll('.evidence').forEach(function (e) {
      e.classList.remove('open');
    });
    document.querySelectorAll('.answer-note-badge').forEach(function (b) { b.remove(); });
    showLanding();
    updateNotesPill();
    updateNotesPanel();
    updateStatsStrip();
    window.scrollTo(0, 0);
  });

  /* ── First-time tutorial ── */
  var TUTORIAL_KEY = 'explore-tutorial-seen';
  var tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === '1';
  var tutorialEl = document.getElementById('exploreTutorial');
  var browseHintEl = document.getElementById('browseHint');

  function showTutorial() {
    if (tutorialSeen) return;
    // Mark as seen immediately on display, not only on "Got it" click.
    // Otherwise users who ignore the box keep seeing it on every later pick.
    tutorialSeen = true;
    localStorage.setItem(TUTORIAL_KEY, '1');
    tutorialEl.classList.add('visible');
  }

  function dismissTutorial() {
    tutorialSeen = true;
    localStorage.setItem(TUTORIAL_KEY, '1');
    tutorialEl.classList.remove('visible');
    // Show persistent browse hint after tutorial
    browseHintEl.classList.add('visible');
  }

  document.getElementById('tutorialDismiss').addEventListener('click', dismissTutorial);

  // Show browse hint on subsequent visits if tutorial was already seen.
  // Suppress it while the tutorial box itself is still on screen -- the
  // tutorial already contains the same hint, so showing both is redundant.
  function updateBrowseHint(topic) {
    if (tutorialSeen && selections[topic] && !tutorialEl.classList.contains('visible')) {
      browseHintEl.classList.add('visible');
    } else {
      browseHintEl.classList.remove('visible');
    }
  }
  var notesGrip = document.getElementById('notesGrip');
  var panelOpen = false;

  /* ── Inject checkmarks and hint labels ── */
  document.querySelectorAll('.answer-card').forEach(function (card) {
    var check = document.createElement('button');
    check.type = 'button';
    check.className = 'answer-check';
    check.innerHTML = '\u2713';
    check.title = 'Make this my view';
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      var q = card.dataset.question;
      var a = card.dataset.answer;
      if (card.classList.contains('selected')) {
        deselectAnswer(q);
      } else {
        selectAnswer(q, a);
      }
      updateNotesPill();
      updateNotesPanel();
    });
    card.appendChild(check);

    // Hint removed: first tap already picks + opens evidence,
    // and after a pick the hint was hidden anyway.
  });

  var stageEl = document.querySelector('.explore-stage');
  var currentTopic = null;

  /* ── Related questions map ── */
  var relatedMap = {
    override:     ['voteno', 'levy', 'trust'],
    voteno:       ['override', 'again', 'schools'],
    schools:      ['override', 'mycost', 'voteno'],
    levy:         ['taxrank', 'mycost', 'override'],
    moneygone:    ['override', 'levy', 'schools'],
    taxrank:      ['levy', 'mycost', 'schools'],
    mycost:       ['size', 'levy', 'taxrank'],
    seniors:      ['mycost', 'override', 'voteno'],
    size:         ['mycost', 'again', 'override'],
    again:        ['size', 'override', 'voteno'],
    alternatives: ['override', 'levy', 'trust'],
    trash:        ['mycost', 'voteno', 'taxrank'],
    library:      ['voteno', 'override', 'mycost'],
    trust:        ['override', 'alternatives', 'voteno']
  };

  /* ── Topic order (for progress dots) ── */
  var topicOrder = [];
  var topicLabels = {};
  document.querySelectorAll('.question-screen').forEach(function (s) {
    topicOrder.push(s.dataset.topic);
    var h1 = s.querySelector('.question-block h1');
    if (h1) topicLabels[s.dataset.topic] = h1.textContent;
  });

  /* ── Build progress dots ── */
  var dotsEl = document.getElementById('progressDots');
  topicOrder.forEach(function (topic) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'progress-dot';
    dot.dataset.topic = topic;
    dot.title = topicLabels[topic] || topic;
    dot.addEventListener('click', function () {
      switchTopic(topic);
      window.scrollTo(0, 0);
    });
    dotsEl.appendChild(dot);
  });

  /* ── URL state ── */
  function readURL() {
    var params = new URLSearchParams(window.location.search);
    return {
      topic: params.get('q') || null,
      pos: params.get('pos') || null
    };
  }

  // When true, writeURL is a no-op. Used during initial load and popstate
  // handling so that restoring state from the URL doesn't itself create
  // new history entries.
  var suppressURLWrite = false;

  function writeURL(topic, pos, replace) {
    if (suppressURLWrite) return;
    var newUrl;
    if (!topic) {
      newUrl = window.location.pathname;
    } else {
      var params = new URLSearchParams();
      params.set('q', topic);
      if (pos) params.set('pos', pos);
      newUrl = window.location.pathname + '?' + params.toString();
    }
    // No-op if the URL isn't actually changing -- avoids duplicate entries.
    if (newUrl === window.location.pathname + window.location.search) return;
    if (replace) {
      history.replaceState(null, '', newUrl);
    } else {
      history.pushState(null, '', newUrl);
    }
  }

  /* ── Update question header elements ── */
  function updateQuestionHeader(topic) {
    // Progress dots
    dotsEl.querySelectorAll('.progress-dot').forEach(function (dot) {
      dot.classList.toggle('active', dot.dataset.topic === topic);
      dot.classList.toggle('picked', !!selections[dot.dataset.topic] && dot.dataset.topic !== topic);
    });

    // Related questions
    var relEl = document.getElementById('relatedQuestions');
    var relList = document.getElementById('relatedList');
    var related = relatedMap[topic] || [];
    relList.innerHTML = '';
    if (related.length) {
      related.forEach(function (rel) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'related-link';
        btn.textContent = topicLabels[rel] || rel;
        btn.addEventListener('click', function () {
          if (typeof posthog !== 'undefined') {
            posthog.capture('explore_related_click', { from: topic, to: rel });
          }
          switchTopic(rel);
          window.scrollTo(0, 0);
        });
        relList.appendChild(btn);
      });
      relEl.classList.add('visible');
    } else {
      relEl.classList.remove('visible');
    }
  }

  /* ── Topic switching ── */
  function switchTopic(topic) {
    if (typeof posthog !== 'undefined') {
      posthog.capture('explore_topic_opened', { topic: topic });
    }
    currentTopic = topic;
    stageEl.classList.add('has-topic');

    // Server-side view increment + personal counter (only when server counted)
    if (incrementSocial('v', topic)) {
      bumpTopicView(topic);
    }
    updateQuestionSocialBar(topic);
    document.querySelectorAll('.question-screen').forEach(function (s) {
      s.style.display = s.dataset.topic === topic ? 'block' : 'none';
    });
    updateQuestionHeader(topic);
    writeURL(topic, selections[topic] || null);

    // Restore visual state if this topic already has a selection
    var pick = selections[topic];
    if (pick) {
      document.querySelectorAll('.answer-card[data-question="' + topic + '"]').forEach(function (c) {
        c.classList.remove('selected');
        if (c.dataset.answer === pick) c.classList.add('selected');
      });
      var unsureBtn = document.querySelector('.unsure-btn[data-question="' + topic + '"]');
      if (unsureBtn) unsureBtn.classList.toggle('selected', pick === 'u');
      updateAnswerCheckTitles();
      viewEvidence(topic, pick);
      var screen = document.querySelector('.question-screen[data-topic="' + topic + '"]');
      var prompt = screen && screen.querySelector('.answers-prompt');
      if (prompt) prompt.classList.add('hidden');
      var nextBtn = screen && screen.querySelector('.next-question');
      if (nextBtn) nextBtn.classList.add('visible');
      // Show pick distribution if already decided
      showPickDistribution(topic);
    } else {
      // No pick yet: leave all evidence panels closed so the reader
      // chooses what to expand. Auto-opening a random answer's
      // evidence reads as the site endorsing that answer, which
      // violates the "let the reader form their own opinion" stance.
    }
    updateBrowseHint(topic);
  }

  /* Show landing state (no topic selected) */
  function showLanding() {
    currentTopic = null;
    stageEl.classList.remove('has-topic');
    document.querySelectorAll('.question-screen').forEach(function (s) {
      s.style.display = 'none';
    });
    updateLandingCards();
    updateStatsStrip();
    browseHintEl.classList.remove('visible');
    writeURL(null, null);
  }

  /* ── Nav back button ──
     "All questions" must always return to the landing/list view.
     history.back() picked the previous URL entry, which after a few
     question switches lands on a different question, not the list. */
  document.getElementById('navBack').addEventListener('click', function () {
    showLanding();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Inject "Next question" buttons ── */
  document.querySelectorAll('.question-screen').forEach(function (screen) {
    var topic = screen.dataset.topic;
    var idx = topicOrder.indexOf(topic);
    var nextTopic = idx < topicOrder.length - 1 ? topicOrder[idx + 1] : null;

    var wrap = document.createElement('div');
    wrap.className = 'next-question';
    wrap.dataset.topic = topic;

    if (nextTopic) {
      var nextLabel = topicLabels[nextTopic] || nextTopic;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'next-question-btn';
      btn.innerHTML = 'Next question &rarr;';
      btn.addEventListener('click', function () {
        if (typeof posthog !== 'undefined') {
          posthog.capture('explore_next_question', { from: topic, to: nextTopic });
        }
        switchTopic(nextTopic);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      wrap.appendChild(btn);
      var label = document.createElement('p');
      label.className = 'next-question-label';
      label.textContent = nextLabel;
      wrap.appendChild(label);
    } else {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'next-question-btn';
      btn.innerHTML = 'Back to all questions';
      btn.addEventListener('click', function () {
        showLanding();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      wrap.appendChild(btn);
    }

    // Insert right after .answers so it sits above the pick distribution bar
    var answersEl = screen.querySelector('.answers');
    if (answersEl) {
      answersEl.parentNode.insertBefore(wrap, answersEl.nextSibling);
    } else {
      screen.appendChild(wrap);
    }
  });

  /* ── Inject "Not sure yet" button directly under the answer cards ──
     Runs after the next-question injection so it ends up as the element
     immediately after .answers (centered, above the Next question CTA). */
  (function injectUnsureButton() {
    document.querySelectorAll('.question-screen').forEach(function (screen) {
      var topic = screen.dataset.topic;
      var answersEl = screen.querySelector('.answers');
      if (!answersEl) return;

      var row = document.createElement('div');
      row.className = 'unsure-row';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'unsure-btn';
      btn.dataset.answer = 'u';
      btn.dataset.question = topic;
      btn.textContent = 'Not sure yet';
      row.appendChild(btn);

      answersEl.parentNode.insertBefore(row, answersEl.nextSibling);

      btn.addEventListener('click', function () {
        var q = btn.dataset.question;
        if (selections[q] === 'u') return; // already unsure
        selectAnswer(q, 'u');
        updateNotesPill();
        updateNotesPanel();
      });
    });
  })();

  /* ── Inject social proof bar + share button into each question screen ── */
  document.querySelectorAll('.question-screen').forEach(function (screen) {
    var topic = screen.dataset.topic;
    var answersEl = screen.querySelector('.answers');
    if (!answersEl) return;

    var bar = document.createElement('div');
    bar.className = 'question-social';
    bar.id = 'qsocial-' + topic;

    bar.innerHTML =
      '<div class="question-social-row">' +
        '<span class="question-social-label">Community</span>' +
        '<span class="question-social-stat"><span class="question-social-num qsocial-decided">0</span> decided</span>' +
        '<span class="question-social-stat"><span class="question-social-num qsocial-views">0</span> views</span>' +
        '<span class="question-social-stat"><span class="question-social-num qsocial-shares">0</span> shares</span>' +
      '</div>' +
      '<div class="question-social-row">' +
        '<span class="question-social-label">You</span>' +
        '<span class="question-social-stat qsocial-your-decided"></span>' +
        '<span class="question-social-stat qsocial-your-views"></span>' +
        '<span class="question-social-stat qsocial-your-shares"></span>' +
      '</div>';

    var shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'question-social-share';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', function () {
      var pick = selections[topic] || null;
      var params = new URLSearchParams();
      params.set('q', topic);
      if (pick) params.set('pos', pick);
      var url = window.location.origin + window.location.pathname + '?' + params.toString();
      navigator.clipboard.writeText(url).then(function () {
        shareBtn.textContent = 'Copied';
        setTimeout(function () { shareBtn.textContent = 'Share'; }, 2000);
        bumpYourShares();
        bumpTopicShare(topic);
        incrementShareCount(topic);
        updateStatsStrip();
        updateQuestionSocialBar(topic);
        if (typeof posthog !== 'undefined') {
          posthog.capture('explore_question_shared', { topic: topic, has_pick: !!pick });
        }
      });
    });
    // Append share button to the "You" row
    var yourRow = bar.querySelector('.question-social-row + .question-social-row');
    if (yourRow) yourRow.appendChild(shareBtn);

    // Insert bar between question-block and answers
    screen.insertBefore(bar, answersEl);
  });

  /* ── Topic icons (inline SVG paths) ── */
  /* Lucide-based icons, 24x24 viewBox */
  var topicIcons = {
    override:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M15.5 9.5a3 3 0 0 0-3-2h-1a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6h-1a3 3 0 0 1-3-2"/>',  /* coin with $ */
    servicelevel: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>', /* three sliders with handles */
    voteno:       '<ellipse cx="12" cy="6" rx="7" ry="3.5"/><ellipse cx="12" cy="13" rx="7" ry="3.5"/><ellipse cx="12" cy="20" rx="7" ry="3.5"/>', /* three ballot ovals */
    schools:      '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>', /* graduation cap */
    levy:         '<path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-7"/>',          /* trending up */
    taxrank:      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>',  /* map pin */
    mycost:       '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', /* dollar sign */
    size:         '<rect x="3" y="14" width="4" height="8" rx="1"/><rect x="10" y="9" width="4" height="13" rx="1"/><rect x="17" y="4" width="4" height="18" rx="1"/>', /* three tiered bars */
    again:        '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>', /* refresh */
    alternatives: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', /* question circle */
    trash:        '<path d="M20 7l-1.2 12.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 7"/><path d="M10 11v6m4-6v6M1 7h22M8 7V3.5A1.5 1.5 0 0 1 9.5 2h5A1.5 1.5 0 0 1 16 3.5V7"/>', /* trash */
    library:      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', /* book */
    trust:        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',     /* shield */
    seniors:      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.87a4 4 0 0 1 0 7.75"/>', /* two people */
    moneygone:    '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>' /* pie chart */
  };

  /* ── Build landing question cards from actual h1s ── */
  var listEl = document.getElementById('questionList');
  var shareStripEl = document.getElementById('shareStrip');
  var landingCards = {};  // topic -> { el, pips }

  document.querySelectorAll('.question-screen').forEach(function (screen) {
    var topic = screen.dataset.topic;
    var h1 = screen.querySelector('.question-block h1');
    if (!h1 || !listEl) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'explore-question-card';
    btn.dataset.topic = topic;

    /* Icon */
    var iconWrap = document.createElement('span');
    iconWrap.className = 'explore-card-icon';
    var svgMarkup = topicIcons[topic] || '';
    iconWrap.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + svgMarkup + '</svg>';
    btn.appendChild(iconWrap);

    /* Title */
    var titleSpan = document.createElement('span');
    titleSpan.className = 'explore-card-title';
    titleSpan.textContent = h1.textContent;
    btn.appendChild(titleSpan);

    /* Context subtitle. When the reader has picked an answer for this
       topic, this slot recaps their choice instead of re-explaining
       the question. We stash the original elaboration text and the
       per-answer headings so updateLandingCards() can swap between
       them without re-querying the DOM. */
    var ctxP = screen.querySelector('.question-context');
    var ctxText = ctxP ? ctxP.textContent.trim() : '';
    var answerHeadings = {};
    ['a', 'b', 'c'].forEach(function (pos) {
      var ac = screen.querySelector('.answer-card[data-answer="' + pos + '"]');
      var h2 = ac ? ac.querySelector('h2') : null;
      if (h2) answerHeadings[pos] = h2.textContent.trim();
    });
    var ctxSpan = document.createElement('span');
    ctxSpan.className = 'explore-card-context';
    ctxSpan.textContent = ctxText;
    btn.appendChild(ctxSpan);

    /* Mini position indicators (a, b, c, u). The 'u' pip is the
       muted "Not sure yet" state -- lights up when the reader's
       own pick is unsure for this topic. */
    var posRow = document.createElement('div');
    posRow.className = 'explore-card-positions';
    var pips = {};
    ['a', 'b', 'c', 'u'].forEach(function (pos) {
      var pip = document.createElement('div');
      pip.className = 'explore-mini-pos';
      pip.dataset.pos = pos;
      posRow.appendChild(pip);
      pips[pos] = pip;
    });
    btn.appendChild(posRow);

    /* Community split bar (populated later from socialCounts) */
    var distEl = document.createElement('div');
    distEl.className = 'explore-card-dist';
    btn.appendChild(distEl);

    btn.addEventListener('click', function () {
      switchTopic(topic);
      window.scrollTo(0, 0);
    });
    listEl.appendChild(btn);
    landingCards[topic] = {
      el: btn,
      pips: pips,
      dist: distEl,
      ctxSpan: ctxSpan,
      ctxText: ctxText,
      answerHeadings: answerHeadings
    };
  });

  /* Update landing cards to reflect current selections */
  function updateLandingCards() {
    var hasAny = false;
    Object.keys(landingCards).forEach(function (topic) {
      var card = landingCards[topic];
      var answer = selections[topic];
      // Reset all pips
      ['a', 'b', 'c', 'u'].forEach(function (pos) {
        if (card.pips[pos]) card.pips[pos].classList.remove('picked');
      });
      if (answer) {
        hasAny = true;
        if (card.pips[answer]) card.pips[answer].classList.add('picked');
        card.el.classList.add('has-pick');
        // Recap the reader's pick in the subheader slot. For 'u'
        // (Not sure yet) there's no answer heading to show, so keep
        // the original question elaboration -- the muted pip already
        // signals the unsure state.
        if (card.ctxSpan) {
          var recap = card.answerHeadings[answer];
          card.ctxSpan.textContent = recap || card.ctxText;
        }
        // Populate community split bar from server counts. 'u' is a
        // real fourth segment; the muted pip keeps it from competing
        // visually with the three real positions.
        var picks = (socialCounts[topic] || {}).picks || {};
        var cA = picks.a || 0, cB = picks.b || 0, cC = picks.c || 0, cU = picks.u || 0;
        var total = cA + cB + cC + cU;
        if (total > 0 && card.dist) {
          var pA = Math.round((cA / total) * 100);
          var pB = Math.round((cB / total) * 100);
          var pC = Math.round((cC / total) * 100);
          var pU = 100 - pA - pB - pC;
          if (pU < 0) pU = 0;
          card.dist.innerHTML =
            '<div class="explore-card-dist-bar">' +
              '<span class="cd-a" style="width:' + pA + '%"></span>' +
              '<span class="cd-b" style="width:' + pB + '%"></span>' +
              '<span class="cd-c" style="width:' + pC + '%"></span>' +
              '<span class="cd-u" style="width:' + pU + '%"></span>' +
            '</div>' +
            '<div class="explore-card-dist-legend">' +
              '<span><span class="cd-dot cd-dot-a"></span>A ' + pA + '% <span class="cd-count">(' + cA + ')</span></span>' +
              '<span><span class="cd-dot cd-dot-b"></span>B ' + pB + '% <span class="cd-count">(' + cB + ')</span></span>' +
              '<span><span class="cd-dot cd-dot-c"></span>C ' + pC + '% <span class="cd-count">(' + cC + ')</span></span>' +
              '<span><span class="cd-dot cd-dot-u"></span>? ' + pU + '% <span class="cd-count">(' + cU + ')</span></span>' +
              '<span class="cd-total">' + total + ' picked</span>' +
            '</div>';
        }
      } else {
        card.el.classList.remove('has-pick');
        if (card.dist) card.dist.innerHTML = '';
        if (card.ctxSpan) card.ctxSpan.textContent = card.ctxText;
      }
    });
    // Show share buttons if any selections
    if (shareStripEl) {
      shareStripEl.classList.toggle('visible', hasAny);
    }
    if (shareTopEl) {
      shareTopEl.style.display = hasAny ? '' : 'none';
    }
    // Sort unanswered questions to the top
    if (hasAny && listEl) {
      var cards = Array.prototype.slice.call(listEl.children);
      cards.sort(function (a, b) {
        var aAnswered = a.classList.contains('has-pick') ? 1 : 0;
        var bAnswered = b.classList.contains('has-pick') ? 1 : 0;
        return aAnswered - bAnswered;
      });
      cards.forEach(function (c) { listEl.appendChild(c); });
    }
    renderFeaturedQuestion();
    updateSynthesis();
  }

  /* ── Featured question (first-visit onboarding) ──
     When the visitor has zero picks, clone the featured topic into the
     landing's #featuredQuestion slot with its answers visible and
     tappable. The goal is a clear first action above the fold: a new
     visitor sees "pick one of three" before they see the two-votes
     strip or stats row. Hidden the moment any pick exists.

     Featured is servicelevel, not the first list-order question
     (mycost). mycost's three answers are framings of the same cost
     (monthly vs. 10-year vs. share of income), which reads as
     confusing when the onboarding promise is "three positions, pick
     the one you agree with." servicelevel's three answers are genuinely
     different positions (cut / maintain / expand) and teach the
     mechanic cleanly. */
  var FEATURED_TOPIC = 'servicelevel';
  var featuredEl = document.getElementById('featuredQuestion');
  var featuredBuilt = false;

  function renderFeaturedQuestion() {
    if (!featuredEl) return;
    var hasAnyPick = Object.keys(selections).length > 0;
    if (hasAnyPick || isSharedView) {
      featuredEl.classList.remove('visible');
      return;
    }
    if (!featuredBuilt) buildFeaturedQuestion();
    featuredEl.classList.add('visible');
  }

  function buildFeaturedQuestion() {
    var screen = document.querySelector('.question-screen[data-topic="' + FEATURED_TOPIC + '"]');
    if (!screen) return;
    var qBlock = screen.querySelector('.question-block');
    var answers = screen.querySelector('.answers');
    if (!qBlock || !answers) return;

    var label = document.createElement('p');
    label.className = 'featured-question-label';
    label.textContent = 'Start here';
    featuredEl.appendChild(label);

    var qClone = qBlock.cloneNode(true);
    featuredEl.appendChild(qClone);

    /* Clone the three answer cards. The clones keep data-question /
       data-answer attributes but are NOT reachable by the global
       answer-card handlers (those bound at load against the original
       elements). Wire dedicated click handlers that navigate into the
       real question-screen and open the evidence panel for the chosen
       answer WITHOUT committing a pick -- on the rest of the site,
       tapping an answer card browses (see line ~1672) and the check
       button commits. The prompt under these cards says "Tap any
       answer to read the case for it", so the featured block needs to
       browse too. Commitment then happens via the check button or the
       "This resonates" action on the question-screen. */
    var answersClone = answers.cloneNode(true);
    answersClone.classList.add('featured-answers');
    answersClone.querySelectorAll('.answer-check').forEach(function (c) { c.remove(); });
    answersClone.querySelectorAll('.answer-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var q = card.dataset.question;
        var a = card.dataset.answer;
        if (!q || !a) return;
        switchTopic(q);
        viewEvidence(q, a);
        /* Smooth-scroll to the evidence panel so the "case" the visitor
           asked to read is immediately in view. Wait one frame so the
           question-screen has laid out (switchTopic flips display:none
           to block, and scrollIntoView needs the new element rect).
           scrollIntoView honors prefers-reduced-motion in modern
           browsers, so no extra check needed. */
        var ev = document.querySelector('.evidence[data-evidence="' + q + '-' + a + '"]');
        if (ev) {
          requestAnimationFrame(function () {
            ev.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        } else {
          window.scrollTo(0, 0);
        }
      });
    });
    featuredEl.appendChild(answersClone);

    var prompt = document.createElement('p');
    prompt.className = 'answers-prompt featured-answers-prompt';
    prompt.textContent = 'Tap any answer to read the case for it';
    featuredEl.appendChild(prompt);

    featuredBuilt = true;
  }

  /* ── "Where you landed" synthesis panel ──
     Reads back the reader's picks grouped by theme once they've made
     enough of them (>= WYL_THRESHOLD). Pure readback: no scoring, no
     implied "yes/no" label, no advocacy. Still-open questions are
     surfaced at the bottom so a partial flow has a clear nudge. */
  var WYL_THRESHOLD = 3;
  var WYL_THEMES = [
    { key: 'preference',     label: 'What I want from the town',          topics: ['servicelevel', 'mycost', 'seniors'] },
    { key: 'money',          label: 'Money and taxes',                    topics: ['taxrank', 'levy'] },
    { key: 'structure',      label: 'Why the gap exists',                 topics: ['moneygone', 'size'] },
    { key: 'services',       label: 'Services on the table',              topics: ['schools', 'trash', 'library'] },
    { key: 'futures',        label: 'Paths not taken, and what comes next', topics: ['alternatives', 'again'] },
    { key: 'interpretation', label: 'Reading the choice',                 topics: ['voteno', 'override', 'trust'] }
  ];
  // Short, scannable titles for the recap. The full h1 on each question
  // screen is a sentence; these are the nouns that sentence is about.
  var WYL_TOPIC_LABELS = {
    mycost:       'What the override would cost',
    servicelevel: 'Service level I want',
    seniors:      'Impact on seniors',
    taxrank:      'Where Marblehead ranks',
    levy:         'Income vs. cost growth',
    moneygone:    'What drove budget growth',
    size:         'What each tier gets us',
    schools:      'Staffing vs. enrollment',
    trash:        'Property tax vs. flat fee',
    library:      'Heaviest cut without an override',
    alternatives: 'Do the levers scale',
    again:        'How soon we come back',
    voteno:       'If the override fails',
    override:     'What an override buys',
    trust:        'Trusting the decision-makers'
  };

  // Pull the answer-card's own summary text -- the actual case the reader
  // read when they picked. This is the right "why" for revisit.
  var _answerSummaryCache = {};
  function getAnswerSummary(topic, answer) {
    var key = topic + '-' + answer;
    if (key in _answerSummaryCache) return _answerSummaryCache[key];
    var card = document.querySelector(
      '.answer-card[data-question="' + topic + '"][data-answer="' + answer + '"]'
    );
    var summary = card && card.querySelector('.answer-summary');
    if (!summary) { _answerSummaryCache[key] = null; return null; }
    var text = (summary.textContent || '').replace(/\s+/g, ' ').trim();
    _answerSummaryCache[key] = text || null;
    return _answerSummaryCache[key];
  }

  function updateSynthesis() {
    var panel = document.getElementById('whereYouLanded');
    if (!panel) return;

    var decided = topicOrder.filter(function (t) { return !!selections[t]; });
    var total = topicOrder.length;
    if (decided.length < WYL_THRESHOLD) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    var titleEl = document.getElementById('wylTitle');
    var subEl = document.getElementById('wylSub');
    var clearBtn = document.getElementById('wylStartOver');
    if (isSharedView) {
      if (titleEl) titleEl.textContent = 'Where they landed';
      if (subEl) subEl.textContent = 'The positions in the link you followed. Tap Start fresh at the top to pick your own.';
      if (clearBtn) clearBtn.hidden = true;
    } else {
      if (titleEl) titleEl.textContent = 'Where you landed';
      if (subEl) subEl.textContent = 'Your picks so far, grouped by theme.';
      if (clearBtn) clearBtn.hidden = false;
    }

    var progressEl = document.getElementById('wylProgress');
    if (progressEl) {
      var remaining = total - decided.length;
      progressEl.textContent = remaining === 0
        ? 'All ' + total + ' questions answered.'
        : decided.length + ' of ' + total + ' questions answered. ' + remaining + ' still open below.';
    }

    var themesEl = document.getElementById('wylThemes');
    if (themesEl) {
      themesEl.innerHTML = '';
      WYL_THEMES.forEach(function (theme) {
        var answeredInTheme = theme.topics.filter(function (t) { return !!selections[t]; });
        if (answeredInTheme.length === 0) return;

        var group = document.createElement('div');
        group.className = 'wyl-theme';
        group.dataset.theme = theme.key;

        var h = document.createElement('h3');
        h.className = 'wyl-theme-title';
        h.textContent = theme.label;
        group.appendChild(h);

        var ul = document.createElement('ul');
        ul.className = 'wyl-theme-list';
        answeredInTheme.forEach(function (topic) {
          var li = document.createElement('li');
          li.className = 'wyl-theme-item';
          var ans = selections[topic];

          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wyl-topic-link';
          btn.dataset.topic = topic;
          btn.addEventListener('click', function () {
            switchTopic(topic);
            window.scrollTo(0, 0);
          });

          var label = document.createElement('span');
          label.className = 'wyl-topic-label';
          label.textContent = WYL_TOPIC_LABELS[topic] || topic;
          btn.appendChild(label);

          var chev = document.createElement('span');
          chev.className = 'wyl-topic-chev';
          chev.setAttribute('aria-hidden', 'true');
          chev.textContent = '\u203A';
          btn.appendChild(chev);

          var detail = document.createElement('span');
          detail.className = 'wyl-topic-detail';
          if (ans === 'u') {
            detail.classList.add('wyl-topic-detail--unsure');
            detail.textContent = 'Marked not sure yet.';
          } else {
            var summary = getAnswerSummary(topic, ans);
            detail.textContent = summary
              || (landingCards[topic]
                  && landingCards[topic].answerHeadings
                  && landingCards[topic].answerHeadings[ans])
              || ('Picked ' + ans.toUpperCase());
          }
          btn.appendChild(detail);

          li.appendChild(btn);
          ul.appendChild(li);
        });
        group.appendChild(ul);
        themesEl.appendChild(group);
      });
    }

    var openEl = document.getElementById('wylOpen');
    var openListEl = document.getElementById('wylOpenList');
    var unanswered = topicOrder.filter(function (t) { return !selections[t]; });
    if (openEl && openListEl) {
      if (unanswered.length === 0) {
        openEl.hidden = true;
      } else {
        openEl.hidden = false;
        openListEl.innerHTML = '';
        unanswered.forEach(function (topic) {
          var li = document.createElement('li');
          li.className = 'wyl-open-item';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wyl-topic-link wyl-topic-link--open';
          btn.dataset.topic = topic;
          btn.textContent = WYL_TOPIC_LABELS[topic] || topic;
          btn.addEventListener('click', function () {
            switchTopic(topic);
            window.scrollTo(0, 0);
          });
          li.appendChild(btn);
          openListEl.appendChild(li);
        });
      }
    }
  }

  // "Clear my picks" in the synthesis panel reuses the existing Delete-my-data
  // confirm + reset path, keeping one place that wipes local state.
  (function wireSynthesisActions() {
    var clearBtn = document.getElementById('wylStartOver');
    var resetBtn = document.getElementById('statsReset');
    if (clearBtn && resetBtn) {
      clearBtn.addEventListener('click', function () { resetBtn.click(); });
    }
  })();

  // Cross-links in evidence blocks use <a href="#" data-topic="slug">; intercept
  // and route through switchTopic so the reader jumps to the related question
  // without a page reload.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-topic]');
    if (!a) return;
    var topic = a.getAttribute('data-topic');
    if (!topic) return;
    e.preventDefault();
    switchTopic(topic);
    window.scrollTo(0, 0);
  });

  /* ── Copy-link buttons (top + bottom) ── */
  var shareTopEl = document.getElementById('shareTop');
  document.querySelectorAll('[data-copy-positions]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pairs = [];
      Object.keys(selections).forEach(function (topic) {
        pairs.push(topic + ':' + selections[topic]);
      });
      if (!pairs.length) return;
      var url = window.location.origin + window.location.pathname + '?positions=' + pairs.join(',');
      navigator.clipboard.writeText(url).then(function () {
        // Flash all copy-link buttons to "copied" state
        document.querySelectorAll('[data-copy-positions]').forEach(function (b) {
          var original = b.querySelector('span').textContent;
          b.classList.add('copied');
          b.querySelector('span').textContent = 'Copied!';
          setTimeout(function () {
            b.classList.remove('copied');
            b.querySelector('span').textContent = original;
          }, 2000);
        });
        bumpYourShares();
        incrementPageShare();
        updateStatsStrip();
        if (typeof posthog !== 'undefined') {
          posthog.capture('explore_positions_shared', { count: pairs.length, source: 'landing' });
        }
      });
    });
  });

  /* ── Answer selection (lock) vs. viewing (browse) ── */

  // selectAnswer: locks your position (checkmark). Also opens evidence.
  // Place or move a vote via the server. Server is authoritative about
  // what the user previously picked, so vote changes are safe. The
  // response also carries a "moves" count -- the number of times anyone
  // has changed their pick on this topic -- so the reconsideration line
  // under the distribution bar refreshes immediately after a switch.
  function submitVote(topic, answer) {
    fetch(API_BASE + '/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic, answer: answer })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.picks) {
          if (!socialCounts[topic]) socialCounts[topic] = { decided: 0, views: 0, shares: 0, moves: 0 };
          socialCounts[topic].picks = data.picks;
          if (typeof data.moves === 'number') {
            socialCounts[topic].moves = data.moves;
          }
          showPickDistribution(topic);
          updateSocialDisplays();
        }
      })
      .catch(function () {});
  }

  function selectAnswer(question, answer) {
    if (typeof posthog !== 'undefined') {
      posthog.capture('explore_answer_selected', { topic: question, answer: answer });
    }
    // Capture pre-pick state so we can tell if this is the user's very first
    // pick. Anything else ("you already have picks, you're just making another")
    // should not trigger the first-pick tutorial.
    var wasFirstPick = Object.keys(selections).length === 0;
    // Update checkmark: only the selected card gets .selected
    document.querySelectorAll('.answer-card[data-question="' + question + '"]').forEach(function (c) {
      c.classList.remove('selected');
      if (c.dataset.answer === answer) c.classList.add('selected');
    });
    // Update unsure button state
    var unsureBtn = document.querySelector('.unsure-btn[data-question="' + question + '"]');
    if (unsureBtn) unsureBtn.classList.toggle('selected', answer === 'u');
    updateAnswerCheckTitles();

    selections[question] = answer;
    // Selecting an answer is an in-place state change on the current topic,
    // so replace the current history entry rather than pushing a new one.
    writeURL(question, answer, true);
    persistSelections();
    updateQuestionHeader(question);

    // Also view this answer's evidence
    viewEvidence(question, answer);

    // Social proof: increment decided count + submit vote to server
    incrementSocial('q', question);
    submitVote(question, answer);

    // Show answer distribution now that the user has picked
    showPickDistribution(question);

    // First-time tutorial -- only on the user's actual first-ever pick
    if (wasFirstPick && !tutorialSeen) showTutorial();

    // Show browse hint (after tutorial is seen)
    updateBrowseHint(question);

    // Update stats strip and question social bar
    updateStatsStrip();
    updateQuestionSocialBar(question);

    // Hide prompt, show next button
    var screen = document.querySelector('.question-screen[data-topic="' + question + '"]');
    var prompt = screen && screen.querySelector('.answers-prompt');
    if (prompt) prompt.classList.add('hidden');
    var nextBtn = screen && screen.querySelector('.next-question');
    if (nextBtn) nextBtn.classList.add('visible');
  }

  // viewEvidence: opens one evidence panel, closes others. Does NOT change selection.
  var _lastEvidence = null;
  function viewEvidence(question, answer) {
    var evKey = question + '-' + answer;
    if (evKey !== _lastEvidence && typeof posthog !== 'undefined') {
      posthog.capture('explore_evidence_viewed', { topic: question, answer: answer });
    }
    _lastEvidence = evKey;
    // Remove viewing highlight from all cards (but keep .selected)
    document.querySelectorAll('.answer-card[data-question="' + question + '"]').forEach(function (c) {
      c.classList.remove('viewing', 'dimmed');
      if (c.dataset.answer === answer && !c.classList.contains('selected')) {
        c.classList.add('viewing');
      }
    });

    // Toggle evidence panels
    var openedPanel = null;
    document.querySelectorAll('.evidence').forEach(function (e) {
      if (e.dataset.evidence && e.dataset.evidence.startsWith(question + '-')) {
        if (e.dataset.evidence === question + '-' + answer) {
          e.classList.add('open');
          openedPanel = e;
        } else {
          e.classList.remove('open');
        }
      }
    });

    // Scroll the tapped card to the top of the viewport so the user
    // sees their pick confirmed, with evidence visible below it.
    // Only scroll if the card isn't already near the top.
    var tappedCard = document.querySelector(
      '.answer-card[data-question="' + question + '"][data-answer="' + answer + '"]'
    );
    if (tappedCard) {
      setTimeout(function () {
        var rect = tappedCard.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight * 0.4) {
          tappedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    }
  }

  // Keep each checkmark's tooltip in sync with whether that card is
  // currently the user's pick. Called after any selection state change.
  function updateAnswerCheckTitles() {
    document.querySelectorAll('.answer-card').forEach(function (card) {
      var check = card.querySelector('.answer-check');
      if (!check) return;
      check.title = card.classList.contains('selected')
        ? 'Clear this view'
        : 'Make this my view';
    });
  }

  function deselectAnswer(question) {
    if (typeof posthog !== 'undefined') {
      posthog.capture('explore_answer_deselected', { topic: question });
    }
    document.querySelectorAll('.answer-card[data-question="' + question + '"]').forEach(function (c) {
      c.classList.remove('selected', 'dimmed', 'viewing');
    });
    var unsureBtn = document.querySelector('.unsure-btn[data-question="' + question + '"]');
    if (unsureBtn) unsureBtn.classList.remove('selected');
    document.querySelectorAll('.evidence').forEach(function (e) {
      if (e.dataset.evidence && e.dataset.evidence.startsWith(question + '-')) {
        e.classList.remove('open');
      }
    });
    delete selections[question];
    writeURL(question, null, true);
    persistSelections();
    updateQuestionHeader(question);
    updateAnswerCheckTitles();

    // Hide the "next question" button until they pick again
    var screen = document.querySelector('.question-screen[data-topic="' + question + '"]');
    var nextBtn = screen && screen.querySelector('.next-question');
    if (nextBtn) nextBtn.classList.remove('visible');

    updateBrowseHint(question);
    updateStatsStrip();
    updateQuestionSocialBar(question);
  }

  // Card body click: always opens evidence for browsing. Picking is done
  // via the "This resonates" button inside the evidence panel or the
  // checkmark shortcut. "Not sure yet" is the one exception -- it still
  // selects directly since its evidence panel is just a placeholder.
  //
  // Touch guard: on mobile, a finger touch that turns into a scroll (or a
  // tap-to-stop during iOS momentum scroll) can still fire a synthetic
  // click, which would apply .viewing / .selected to a card the user
  // didn't mean to pick. We ignore clicks where (a) the finger moved past
  // the tap slop, (b) the document scrolled between touchstart and click,
  // or (c) the page was actively scrolling in the moment before the click
  // (tap-to-stop-momentum case, where scrollY at touchstart and click are
  // the same because the tap halted the scroll).
  var TAP_SLOP_PX = 10;
  var _lastScrollAt = 0;
  window.addEventListener('scroll', function () {
    _lastScrollAt = Date.now();
  }, { passive: true });
  document.querySelectorAll('.answer-card').forEach(function (card) {
    var tStartX = 0, tStartY = 0, tStartScrollY = 0, tStartAt = 0, tMoved = false;
    card.addEventListener('touchstart', function (e) {
      tStartAt = Date.now();
      if (!e.touches || e.touches.length !== 1) { tMoved = true; return; }
      tStartX = e.touches[0].clientX;
      tStartY = e.touches[0].clientY;
      tStartScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      // If a scroll event fired very recently, the page is mid-momentum
      // and this touch is likely a stop-scroll gesture, not a tap.
      tMoved = (tStartAt - _lastScrollAt) < 150;
    }, { passive: true });
    card.addEventListener('touchmove', function (e) {
      if (tMoved || !e.touches || e.touches.length !== 1) return;
      var dx = Math.abs(e.touches[0].clientX - tStartX);
      var dy = Math.abs(e.touches[0].clientY - tStartY);
      if (dx > TAP_SLOP_PX || dy > TAP_SLOP_PX) tMoved = true;
    }, { passive: true });
    card.addEventListener('click', function (e) {
      // Don't fire if they clicked the checkmark (handled separately)
      if (e.target.closest('.answer-check')) return;

      // Only apply touch-scroll guards when this click actually followed
      // a recent touchstart. On desktop (mouse clicks) tStartAt stays 0,
      // so the guards are skipped and scroll position is irrelevant.
      if (tStartAt && (Date.now() - tStartAt) < 1000) {
        var nowScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (tMoved || Math.abs(nowScrollY - tStartScrollY) > TAP_SLOP_PX) {
          tMoved = false;
          tStartAt = 0;
          return;
        }
      }
      tMoved = false;
      tStartAt = 0;

      var question = this.dataset.question;
      var answer   = this.dataset.answer;

      // Always browse -- let the evidence buttons handle commitment
      viewEvidence(question, answer);
    });
  });

  /* ── Evidence collapse buttons ── */
  document.querySelectorAll('.evidence-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = this.closest('.evidence');
      panel.classList.remove('open');
    });
  });

  /* ── Inject "This resonates" / "Not for me" action buttons ── */
  document.querySelectorAll('.evidence').forEach(function (panel) {
    var ev = panel.dataset.evidence; // e.g. "override-a"
    if (!ev) return;
    var parts = ev.split('-');
    var answer = parts.pop();
    var question = parts.join('-');

    var actions = document.createElement('div');
    actions.className = 'evidence-actions';

    var yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'evidence-action evidence-action--yes';
    yesBtn.textContent = 'This resonates';
    yesBtn.addEventListener('click', function () {
      selectAnswer(question, answer);
      updateNotesPill();
      updateNotesPanel();
      // Scroll back to the question so the reader can see the selected
      // state on the answer card, the Next question button, and (on a
      // first pick) the tutorial -- all of which live above the evidence
      // panel and would otherwise be off-screen. Mirrors "Not for me".
      var screen = document.querySelector('.question-screen[data-topic="' + question + '"]');
      if (screen) {
        screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    var noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'evidence-action evidence-action--no';
    noBtn.textContent = 'Not for me';
    noBtn.addEventListener('click', function () {
      // If this answer is currently the user's pick, "Not for me" should
      // also clear it, not just hide the evidence. Server tally is left
      // alone (matches the checkmark-to-unpick flow).
      if (selections[question] === answer) {
        deselectAnswer(question);
      } else {
        panel.classList.remove('open');
      }
      // Scroll back to the question so they can try another answer
      var screen = document.querySelector('.question-screen[data-topic="' + question + '"]');
      if (screen) {
        screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    panel.appendChild(actions);
  });

  /* ── Notes system ── */
  var NOTES_KEY = 'explore-position-notes'; // { "override-a": "my note", ... }

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
    } catch (e) { return {}; }
  }

  function saveNote(topic, answer, text) {
    var notes = loadNotes();
    var key = topic + '-' + answer;
    if (text.trim()) {
      notes[key] = text;
    } else {
      delete notes[key];
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    updateCardBadges();
  }

  function getNote(topic, answer) {
    var notes = loadNotes();
    return notes[topic + '-' + answer] || '';
  }

  function getPositionCount() {
    return Object.keys(selections).length;
  }

  function updateNotesPill() {
    var count = getPositionCount();
    notesPillCount.textContent = count;
    if (count > 0) {
      notesPill.classList.add('visible');
      // Pulse animation
      notesPill.classList.remove('pulse');
      void notesPill.offsetWidth; // reflow
      notesPill.classList.add('pulse');
    } else {
      notesPill.classList.remove('visible');
      if (panelOpen) closePanel();
    }
  }

  function updateNotesPanel() {
    notesPanelBody.innerHTML = '';
    var keys = Object.keys(selections);
    if (!keys.length) {
      var empty = document.createElement('p');
      empty.className = 'notes-empty';
      empty.textContent = 'Pick positions on the questions above';
      notesPanelBody.appendChild(empty);
      return;
    }

    var notes = loadNotes();
    keys.forEach(function (topic) {
      var answer = selections[topic];
      var card = document.querySelector(
        '.answer-card[data-question="' + topic + '"][data-answer="' + answer + '"]'
      );
      if (!card) return;
      var heading = card.querySelector('h2').textContent;
      var questionEl = document.querySelector(
        '.question-screen[data-topic="' + topic + '"] .question-block h1'
      );
      var qText = questionEl ? questionEl.textContent.trim() : topic;
      var noteKey = topic + '-' + answer;
      var noteVal = notes[noteKey] || '';

      var entry = document.createElement('div');
      entry.className = 'notes-entry';

      // Clickable head: jumps back to this question.
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'notes-entry-head';
      head.setAttribute('aria-label', 'Revisit question: ' + qText);

      var headText = document.createElement('span');
      headText.className = 'notes-entry-head-text';

      var topicEl = document.createElement('span');
      topicEl.className = 'notes-entry-topic';
      topicEl.textContent = qText;
      headText.appendChild(topicEl);

      var posEl = document.createElement('span');
      posEl.className = 'notes-entry-position';
      posEl.textContent = heading;
      headText.appendChild(posEl);

      head.appendChild(headText);

      var chev = document.createElement('span');
      chev.className = 'notes-entry-chevron';
      chev.setAttribute('aria-hidden', 'true');
      chev.textContent = '\u203A'; // single right-pointing angle quotation
      head.appendChild(chev);

      head.addEventListener('click', function () {
        closePanel();
        switchTopic(topic);
        window.scrollTo(0, 0);
      });

      entry.appendChild(head);

      // Collapsible note section.
      var noteWrap = document.createElement('div');
      noteWrap.className = 'notes-entry-note';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'notes-entry-note-toggle';
      var hasNote = noteVal.trim().length > 0;
      toggle.setAttribute('aria-expanded', hasNote ? 'true' : 'false');
      if (hasNote) toggle.dataset.hasNote = 'true';
      toggle.textContent = hasNote ? 'Your note' : 'Add a note';
      noteWrap.appendChild(toggle);

      var noteBody = document.createElement('div');
      noteBody.className = 'notes-entry-note-body';
      if (!hasNote) noteBody.hidden = true;

      var textarea = document.createElement('textarea');
      textarea.className = 'notes-entry-textarea';
      textarea.rows = 3;
      textarea.placeholder = 'Why did you pick this? What would change your mind?';
      textarea.value = noteVal;
      noteBody.appendChild(textarea);

      var privacy = document.createElement('p');
      privacy.className = 'notes-entry-note-privacy';
      privacy.textContent = 'Saved in your browser. Never sent anywhere, not even when you share your positions.';
      noteBody.appendChild(privacy);

      noteWrap.appendChild(noteBody);
      entry.appendChild(noteWrap);

      toggle.addEventListener('click', function () {
        var isOpen = !noteBody.hidden;
        noteBody.hidden = isOpen;
        toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (!isOpen) textarea.focus();
      });

      // Debounced save (1s) to match the community-pulse note cadence.
      var saveTimer = null;
      textarea.addEventListener('input', function () {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          saveNote(topic, answer, textarea.value);
          var filled = textarea.value.trim().length > 0;
          if (filled) {
            toggle.dataset.hasNote = 'true';
          } else {
            delete toggle.dataset.hasNote;
          }
          toggle.textContent = filled ? 'Your note' : 'Add a note';
        }, 1000);
      });

      notesPanelBody.appendChild(entry);
    });
  }

  function updateCardBadges() {
    var notes = loadNotes();
    // Remove all existing badges
    document.querySelectorAll('.answer-note-badge').forEach(function (b) { b.remove(); });
    // Add badges where notes exist
    Object.keys(notes).forEach(function (key) {
      if (!notes[key].trim()) return;
      var parts = key.split('-');
      var answer = parts.pop();
      var topic = parts.join('-');
      var card = document.querySelector(
        '.answer-card[data-question="' + topic + '"][data-answer="' + answer + '"]'
      );
      if (card && !card.querySelector('.answer-note-badge')) {
        var badge = document.createElement('span');
        badge.className = 'answer-note-badge';
        badge.textContent = 'Notes';
        card.appendChild(badge);
      }
    });
  }

  function isMobileViewport() {
    return window.innerWidth <= 599;
  }

  function openPanel() {
    if (typeof posthog !== 'undefined') {
      posthog.capture('explore_notes_opened', { position_count: getPositionCount() });
    }
    updateNotesPanel();
    notesPanel.classList.add('open');
    notesPanel.style.transform = ''; // clear any leftover drag offset
    notesPill.classList.remove('visible');
    panelOpen = true;
    if (notesBackdrop) {
      notesBackdrop.hidden = false;
      // requestAnimationFrame so the browser applies hidden-false before we fade in
      requestAnimationFrame(function () { notesBackdrop.classList.add('visible'); });
    }
    if (isMobileViewport()) {
      document.body.classList.add('notes-panel-locked');
    }
  }

  function closePanel() {
    notesPanel.classList.remove('open');
    notesPanel.style.transform = '';
    panelOpen = false;
    if (notesBackdrop) {
      notesBackdrop.classList.remove('visible');
      // Wait for the fade-out before hiding so clicks don't bleed through
      setTimeout(function () {
        if (!panelOpen) notesBackdrop.hidden = true;
      }, 250);
    }
    document.body.classList.remove('notes-panel-locked');
    if (getPositionCount() > 0) {
      notesPill.classList.add('visible');
    }
  }

  // Pill click
  notesPill.addEventListener('click', openPanel);

  // Close button
  document.getElementById('notesClose').addEventListener('click', closePanel);

  // Tap-outside to close (backdrop)
  if (notesBackdrop) {
    notesBackdrop.addEventListener('click', closePanel);
  }

  // Escape to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelOpen) closePanel();
  });

  // Swipe-to-dismiss: drag the grip at the top of the sheet to pull it down.
  (function () {
    if (!notesGrip) return;
    var dragStartY = null;
    var dragCurrentY = 0;
    var dragStartTime = 0;
    var panelHeight = 0;
    var dragMoved = false;
    var DISMISS_FRACTION = 0.30;   // dismiss if dragged > 30% of panel height
    var DISMISS_VELOCITY = 0.5;    // or if release velocity > 0.5 px/ms

    function onStart(e) {
      var point = e.touches ? e.touches[0] : e;
      dragStartY = point.clientY;
      dragCurrentY = dragStartY;
      dragStartTime = Date.now();
      dragMoved = false;
      panelHeight = notesPanel.offsetHeight || 1;
      notesPanel.classList.add('dragging');
    }
    function onMove(e) {
      if (dragStartY == null) return;
      var point = e.touches ? e.touches[0] : e;
      dragCurrentY = point.clientY;
      var delta = Math.max(0, dragCurrentY - dragStartY);
      if (delta > 2) dragMoved = true;
      notesPanel.style.transform = 'translateY(' + delta + 'px)';
      if (e.cancelable && delta > 0) e.preventDefault();
    }
    function onEnd() {
      if (dragStartY == null) return;
      var delta = Math.max(0, dragCurrentY - dragStartY);
      var elapsed = Math.max(1, Date.now() - dragStartTime);
      var velocity = delta / elapsed;
      notesPanel.classList.remove('dragging');
      var shouldClose = delta > panelHeight * DISMISS_FRACTION || velocity > DISMISS_VELOCITY;
      dragStartY = null;
      if (shouldClose) {
        closePanel();
      } else {
        notesPanel.style.transform = '';
      }
    }

    notesGrip.addEventListener('touchstart', onStart, { passive: true });
    notesGrip.addEventListener('touchmove', onMove, { passive: false });
    notesGrip.addEventListener('touchend', onEnd);
    notesGrip.addEventListener('touchcancel', onEnd);
    // Plain-click fallback (keyboard, non-touch): tap the grip to close.
    notesGrip.addEventListener('click', function () {
      if (!dragMoved) closePanel();
    });
  })();

  // Share button
  document.getElementById('notesShare').addEventListener('click', function () {
    var params = new URLSearchParams();
    var keys = Object.keys(selections);
    keys.forEach(function (topic, i) {
      if (i === 0) {
        params.set('q', topic);
        params.set('pos', selections[topic]);
      }
      // Encode all positions in a compact param
    });
    // Build a multi-position share format: ?positions=override:a,schools:c,trust:b
    var posStr = keys.map(function (t) { return t + ':' + selections[t]; }).join(',');
    params.set('positions', posStr);
    var url = window.location.origin + window.location.pathname + '?' + params.toString();
    navigator.clipboard.writeText(url).then(function () {
      var btn = document.getElementById('notesShare');
      btn.textContent = 'Copied link';
      setTimeout(function () { btn.textContent = 'Share'; }, 1500);
      bumpYourShares();
      incrementPageShare();
      updateStatsStrip();
      if (typeof posthog !== 'undefined') {
        posthog.capture('explore_positions_shared', { count: keys.length, source: 'notes_panel' });
      }
    });
  });

  // Restore notes badges on load
  updateCardBadges();

  // Restore selections from localStorage. The 45-card rewrite changed card
  // semantics (not just copy) on most questions, so selections saved under
  // a prior version would silently misrepresent the reader's position.
  // Bumping SELECTIONS_VERSION wipes stale picks and posts a one-time notice.
  var SELECTIONS_VERSION = '2026-04-rewrite';
  var VERSION_KEY = 'explore-selections-version';
  var savedVersion = null;
  try { savedVersion = localStorage.getItem(VERSION_KEY); } catch (e) {}
  var savedSelections = null;
  if (savedVersion === SELECTIONS_VERSION) {
    try { savedSelections = JSON.parse(localStorage.getItem('explore-selections')); } catch (e) {}
  } else {
    // Stale or missing version: drop prior picks. If the reader had any,
    // surface a one-time banner so they know to revisit.
    var hadPriorPicks = false;
    try {
      var prior = JSON.parse(localStorage.getItem('explore-selections'));
      hadPriorPicks = prior && Object.keys(prior).length > 0;
    } catch (e) {}
    try {
      localStorage.removeItem('explore-selections');
      localStorage.setItem(VERSION_KEY, SELECTIONS_VERSION);
    } catch (e) {}
    if (hadPriorPicks) {
      try { sessionStorage.setItem('explore-reset-notice', '1'); } catch (e) {}
    }
  }
  if (savedSelections) {
    Object.keys(savedSelections).forEach(function (topic) {
      selections[topic] = savedSelections[topic];
    });
    updateNotesPill();
  }
  // Surface the one-time reset notice on the landing page.
  (function showResetNoticeIfAny() {
    var show = false;
    try { show = sessionStorage.getItem('explore-reset-notice') === '1'; } catch (e) {}
    if (!show) return;
    try { sessionStorage.removeItem('explore-reset-notice'); } catch (e) {}
    var head = document.querySelector('.explore-landing-head');
    if (!head) return;
    var notice = document.createElement('p');
    notice.className = 'explore-reset-notice';
    notice.textContent = 'Questions were updated. Please revisit to record your stances.';
    head.appendChild(notice);
  })();

  // Persist selections
  function persistSelections() {
    localStorage.setItem('explore-selections', JSON.stringify(selections));
    try { localStorage.setItem(VERSION_KEY, SELECTIONS_VERSION); } catch (e) {}
  }

  /* ── Restore state on load ── */
  // Priority: URL positions param > URL q param > localStorage > landing
  var initial = readURL();

  // Check for shared positions URL: ?positions=override:a,schools:c
  var positionsParam = new URLSearchParams(window.location.search).get('positions');
  var isSharedView = false;
  if (positionsParam) {
    isSharedView = true;
    var pairs = positionsParam.split(',');
    if (typeof posthog !== 'undefined') {
      posthog.capture('explore_shared_viewed', { position_count: pairs.length });
    }

    // Save the viewer's own selections so we can restore them later.
    var savedOwnSelections = {};
    Object.keys(selections).forEach(function (k) { savedOwnSelections[k] = selections[k]; });

    // Temporarily overwrite selections with the shared picks for display.
    Object.keys(selections).forEach(function (k) { delete selections[k]; });
    pairs.forEach(function (pair) {
      var parts = pair.split(':');
      if (parts.length === 2) {
        selections[parts[0]] = parts[1];
      }
    });
    // Don't persist: these are someone else's picks, not the viewer's
    showLanding();
    updateNotesPill();

    // Swap heading and show shared banner
    var headingEl = document.querySelector('.explore-landing-head h1');
    var subEl = document.querySelector('.explore-landing-head p');
    if (headingEl) headingEl.textContent = 'Someone shared their positions';
    if (subEl) subEl.textContent = 'See how they answered, then explore the questions yourself.';
    var sharedBanner = document.getElementById('sharedBanner');
    if (sharedBanner) sharedBanner.classList.add('visible');
    document.querySelector('.explore-landing').classList.add('shared-mode');

    // Hide copy-link buttons in shared view
    if (shareStripEl) shareStripEl.style.display = 'none';
    if (shareTopEl) shareTopEl.style.display = 'none';

    // "Start fresh" restores the viewer's own picks (not blank)
    document.getElementById('sharedFresh').addEventListener('click', function () {
      if (typeof posthog !== 'undefined') {
        posthog.capture('explore_shared_start_fresh');
      }
      // Restore viewer's own selections
      Object.keys(selections).forEach(function (k) { delete selections[k]; });
      Object.keys(savedOwnSelections).forEach(function (k) { selections[k] = savedOwnSelections[k]; });
      isSharedView = false;
      if (headingEl) headingEl.textContent = 'Do we need an override?';
      if (subEl) subEl.textContent = 'Each question shows the strongest case for every answer. Pick the one you agree with. Your picks build into a set of positions you can review or share.';
      sharedBanner.classList.remove('visible');
      document.querySelector('.explore-landing').classList.remove('shared-mode');
      if (shareStripEl) shareStripEl.style.display = '';
      if (shareTopEl) shareTopEl.style.display = '';
      // Clear positions param from URL
      var cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('positions');
      history.replaceState(null, '', cleanUrl);
      showLanding();
      updateNotesPill();
      updateNotesPanel();
    });
  } else if (initial.topic) {
    // Restoring from URL: don't create a second history entry for what
    // the browser is already showing.
    suppressURLWrite = true;
    switchTopic(initial.topic);
    if (initial.pos) {
      selectAnswer(initial.topic, initial.pos);
    }
    suppressURLWrite = false;
    updateNotesPill();
  } else {
    // Always show landing -- positions are visible on the cards
    suppressURLWrite = true;
    showLanding();
    suppressURLWrite = false;
    updateNotesPill();
  }

  // Handle back/forward navigation
  window.addEventListener('popstate', function () {
    var state = readURL();
    // The browser already moved the history pointer; just sync the UI
    // without touching history again.
    suppressURLWrite = true;
    if (state.topic) {
      switchTopic(state.topic);
      if (state.pos) {
        selectAnswer(state.topic, state.pos);
      }
    } else {
      showLanding();
    }
    suppressURLWrite = false;
  });

  // ── Init: fetch decided counts and show stats ──
  fetchAllCounts(topicOrder);
  updateStatsStrip();

  // ── Mini override calculator (only on questions where cost context helps) ──
  (function miniCalc() {
    var AVG = 1291507;
    var KEY = 'mh_override_calc_assessed_value';
    var R = { 1: 168, 2: 362, 3: 556 };
    var LABELS = { 1: '$9M', 2: '$12M', 3: '$15M' };

    // Only inject on questions where override cost is relevant context
    var OVERRIDE_TOPICS = ['override', 'mycost', 'size', 'levy', 'taxrank', 'again', 'voteno'];
    // Trash and seniors get a contextual link instead (they have their own calculators)
    var LINK_ONLY = {
      trash:   { href: 'question-2-trash.html#cost-by-home-value', text: 'Trash levy vs. fee calculator' },
      seniors: { href: 'senior-tax-relief.html',                   text: 'Senior relief calculator' }
    };

    function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
    function parse(raw) {
      var n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      return (n > 0 && isFinite(n)) ? n : AVG;
    }
    function load() {
      try { var n = parseFloat(localStorage.getItem(KEY)); return (n > 0 && isFinite(n)) ? n : null; }
      catch (e) { return null; }
    }
    function save(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} }

    var calcs = [];

    document.querySelectorAll('.question-screen').forEach(function (screen) {
      var topic = screen.getAttribute('data-topic');

      // Link-only topics: just add a contextual chart link
      if (LINK_ONLY[topic]) {
        var link = document.createElement('a');
        link.className = 'evidence-chart-link';
        link.href = LINK_ONLY[topic].href;
        link.textContent = LINK_ONLY[topic].text;
        link.style.marginTop = '18px';
        screen.appendChild(link);
        return;
      }

      // Skip topics where a calculator is irrelevant
      if (OVERRIDE_TOPICS.indexOf(topic) === -1) return;

      var el = document.createElement('div');
      el.className = 'mini-calc';
      el.innerHTML =
        '<div class="mini-calc-header">' +
          '<span class="mini-calc-title">What this costs your household (Year 1)</span>' +
          '<div class="mini-calc-input">' +
            '<label>Home value</label>' +
            '<input type="text" inputmode="numeric" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<div class="mini-calc-tiers">' +
          '<div class="mini-calc-tier" data-t="1"><div class="mini-calc-tier-label">Tier 1 ' + LABELS[1] + '</div><div class="mini-calc-tier-cost"><span class="mc-mo"></span><span class="mini-calc-tier-unit">/mo</span></div><div class="mini-calc-tier-annual"><span class="mc-yr"></span>/yr</div></div>' +
          '<div class="mini-calc-tier" data-t="2"><div class="mini-calc-tier-label">Tier 2 ' + LABELS[2] + '</div><div class="mini-calc-tier-cost"><span class="mc-mo"></span><span class="mini-calc-tier-unit">/mo</span></div><div class="mini-calc-tier-annual"><span class="mc-yr"></span>/yr</div></div>' +
          '<div class="mini-calc-tier" data-t="3"><div class="mini-calc-tier-label">Tier 3 ' + LABELS[3] + '</div><div class="mini-calc-tier-cost"><span class="mc-mo"></span><span class="mini-calc-tier-unit">/mo</span></div><div class="mini-calc-tier-annual"><span class="mc-yr"></span>/yr</div></div>' +
        '</div>' +
        '<a class="mini-calc-link" href="charts/override_calculator.html">Full calculator with phase-in and income context &rarr;</a>';

      screen.appendChild(el);
      calcs.push(el);
    });

    function updateAll(assessed) {
      calcs.forEach(function (el) {
        [1, 2, 3].forEach(function (t) {
          var annual = R[t] * (assessed / AVG);
          var tier = el.querySelector('[data-t="' + t + '"]');
          tier.querySelector('.mc-mo').textContent = fmt(annual / 12);
          tier.querySelector('.mc-yr').textContent = fmt(annual);
        });
      });
    }

    var inputs = calcs.map(function (el) { return el.querySelector('input'); });
    var stored = load();
    var initial = stored || AVG;

    inputs.forEach(function (inp) {
      inp.value = '$' + Math.round(initial).toLocaleString('en-US');
      inp.addEventListener('input', function () {
        var v = parse(inp.value);
        save(v);
        inputs.forEach(function (other) {
          if (other !== inp) other.value = '$' + Math.round(v).toLocaleString('en-US');
        });
        updateAll(v);
      });
      inp.addEventListener('blur', function () {
        var v = parse(inp.value);
        inp.value = '$' + Math.round(v).toLocaleString('en-US');
      });
    });

    updateAll(initial);
  })();

})();
