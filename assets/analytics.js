// Lightweight PostHog event tracking for marbleheaddata.org.
// Tracks: TOC clicks, calculator engagement (boolean only), scroll depth.
// No personal data or input values are captured.
(function () {
  if (typeof posthog === 'undefined') return;

  var page = window.location.pathname;

  // --- TOC link clicks ---
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.page-toc a');
    if (!link) return;
    posthog.capture('toc_click', {
      section: link.textContent.trim(),
      href: link.getAttribute('href'),
      page: page
    });
  });

  // --- Calculator engagement (fire once, no values) ---
  var calcFired = false;
  var calcIds = ['trash-assessed', 'assessed'];
  calcIds.forEach(function (id) {
    var input = document.getElementById(id);
    if (!input) return;
    var handler = function () {
      if (calcFired) return;
      calcFired = true;
      posthog.capture('calculator_used', {
        calculator: id === 'trash-assessed' ? 'q2_trash' : 'override',
        page: page
      });
    };
    input.addEventListener('focus', handler);
    input.addEventListener('input', handler);
  });

  // --- Scroll depth milestones ---
  var milestones = [25, 50, 75, 100];
  var fired = {};
  var ticking = false;

  function checkScroll() {
    var scrollTop = window.pageYOffset;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var percent = Math.round((scrollTop / docHeight) * 100);
    milestones.forEach(function (m) {
      if (!fired[m] && percent >= m) {
        fired[m] = true;
        posthog.capture('scroll_milestone', { depth: m, page: page });
      }
    });
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        checkScroll();
        ticking = false;
      });
    }
  }, { passive: true });
})();
