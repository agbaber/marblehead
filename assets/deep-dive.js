// Deep-dive collapsible sections: smooth animation, scroll-to-open, expand-all.
// Works with <details class="deep-dive"> elements. Progressive enhancement:
// everything works without this script via native <details> behavior.
(function () {
  var dives = document.querySelectorAll('details.deep-dive');
  if (!dives.length) return;

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Smooth animation ---
  if (!prefersReduced) {
    dives.forEach(function (el) {
      var body = el.querySelector('.deep-dive-body');
      if (!body) return;

      el.addEventListener('click', function (e) {
        if (!e.target.closest('summary')) return;

        if (el.open) {
          e.preventDefault();
          body.style.overflow = 'hidden';
          var startH = body.scrollHeight;
          body.style.maxHeight = startH + 'px';
          requestAnimationFrame(function () {
            body.style.transition = 'max-height 0.25s ease';
            body.style.maxHeight = '0px';
          });
          body.addEventListener('transitionend', function handler() {
            body.removeEventListener('transitionend', handler);
            el.open = false;
            body.style.maxHeight = '';
            body.style.overflow = '';
            body.style.transition = '';
          });
        }
      });

      el.addEventListener('toggle', function () {
        if (!el.open || !body) return;
        var targetH = body.scrollHeight;
        body.style.overflow = 'hidden';
        body.style.maxHeight = '0px';
        body.style.transition = 'max-height 0.3s ease';
        requestAnimationFrame(function () {
          body.style.maxHeight = targetH + 'px';
        });
        body.addEventListener('transitionend', function handler() {
          body.removeEventListener('transitionend', handler);
          body.style.maxHeight = '';
          body.style.overflow = '';
          body.style.transition = '';
        });
      });
    });
  }

  // --- Scroll-to-open ---
  function openForHash() {
    var hash = window.location.hash;
    if (!hash) return;
    var target = document.querySelector(hash);
    if (!target) return;
    var parent = target.closest('details.deep-dive');
    if (parent && !parent.open) {
      parent.open = true;
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
  openForHash();
  window.addEventListener('hashchange', openForHash);

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute('href');
    var target = document.querySelector(hash);
    if (!target) return;
    var parent = target.closest('details.deep-dive');
    if (parent && !parent.open) {
      e.preventDefault();
      parent.open = true;
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      history.pushState(null, '', hash);
    }
  });

  // --- Expand all / Collapse all ---
  if (dives.length >= 3) {
    var btn = document.createElement('button');
    btn.className = 'deep-dive-expand-all';
    btn.type = 'button';

    function updateLabel() {
      var allOpen = Array.from(dives).every(function (d) { return d.open; });
      btn.textContent = allOpen ? 'Collapse all sections' : 'Expand all sections';
    }

    btn.addEventListener('click', function () {
      var allOpen = Array.from(dives).every(function (d) { return d.open; });
      dives.forEach(function (d) { d.open = !allOpen; });
      updateLabel();
    });

    dives.forEach(function (d) {
      d.addEventListener('toggle', updateLabel);
    });

    updateLabel();

    var toc = document.querySelector('.page-toc');
    if (toc) {
      toc.parentNode.insertBefore(btn, toc.nextSibling);
    } else {
      dives[0].parentNode.insertBefore(btn, dives[0]);
    }
  }
})();
