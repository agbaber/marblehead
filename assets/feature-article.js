/* feature-article.js — fade each .reveal block up as it scrolls into view.
   Loaded automatically on pages with `body_class: feature-article`.
   Honors prefers-reduced-motion via the CSS media query (elements stay visible;
   this observer just adds .in, which is a no-op transition under reduced motion). */
(function () {
  var nodes = document.querySelectorAll('.reveal');
  if (!nodes.length || !('IntersectionObserver' in window)) {
    // No observer support: show everything rather than leaving it hidden.
    for (var i = 0; i < nodes.length; i++) { nodes[i].classList.add('in'); }
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  nodes.forEach(function (el) { obs.observe(el); });
})();
