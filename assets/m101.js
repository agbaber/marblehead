/*
 * Marblehead 101 — drawer + progress
 *
 * Drawer: toggles `body.m101-drawer-open` for the mobile chapter list.
 * Progress: tracks per-chapter "viewed" state in localStorage under the
 * key "marblehead-101-progress" as a JSON map { "01": true, "02": true, ... }.
 *
 * A chapter is marked viewed once the user scrolls past 50% of the .m101-main
 * height OR stays on the page for 30 seconds, whichever comes first.
 *
 * Checkmarks are rendered into the desktop sidebar (.m101-syllabus li),
 * the mobile drawer (.m101-drawer li), and the landing-page chapter cards
 * (.m101-ch). The HTML ships without `.done` class; this script adds it
 * on load by reading localStorage.
 *
 * If localStorage is unavailable (private browsing, disabled), the course
 * is fully functional without checkmarks — nothing breaks.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'marblehead-101-progress';

  // ---- Storage helpers (safe in private browsing) ----
  function readProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function writeProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function markViewed(num) {
    var p = readProgress();
    if (p[num]) return;
    p[num] = true;
    writeProgress(p);
    paintCheckmarks();
  }

  // ---- Drawer ----
  function bindDrawer() {
    var btn = document.querySelector('.m101-stickybar .toc-btn');
    var scrim = document.querySelector('.m101-drawer-scrim');
    if (!btn || !scrim) return;
    btn.addEventListener('click', function () {
      document.body.classList.toggle('m101-drawer-open');
    });
    scrim.addEventListener('click', function () {
      document.body.classList.remove('m101-drawer-open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.body.classList.remove('m101-drawer-open');
    });
  }

  // ---- Checkmark painting (works on chapter pages AND landing) ----
  function paintCheckmarks() {
    var p = readProgress();
    // Sidebar + drawer use data-chapter on the <li>
    document.querySelectorAll('[data-chapter]').forEach(function (el) {
      var num = el.getAttribute('data-chapter');
      if (p[num] && !el.classList.contains('cur')) {
        el.classList.add('done');
      }
    });
  }

  // ---- Mark-viewed observer (chapter pages only) ----
  function bindViewTracking() {
    var main = document.querySelector('.m101-main');
    var chapterNum = document.body.getAttribute('data-current-chapter');
    if (!main || !chapterNum) return;

    var marked = false;
    function trigger() { if (marked) return; marked = true; markViewed(chapterNum); }

    // Scroll-past-50% trigger
    function onScroll() {
      if (marked) return;
      var rect = main.getBoundingClientRect();
      var totalScrollable = main.offsetHeight + rect.top;
      var scrolled = -rect.top;
      if (scrolled / main.offsetHeight >= 0.5) trigger();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // catch short pages where 50% is already visible

    // 30-second fallback
    setTimeout(trigger, 30000);
  }

  function init() {
    bindDrawer();
    paintCheckmarks();
    bindViewTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
