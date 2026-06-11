/* Finance-story shared engine: reveal-on-view + sticky progress bar. */
(function () {
  // ---------- Reveal-on-view ----------
  if ('IntersectionObserver' in window) {
    const reveals = document.querySelectorAll('.fs-reveal');
    if (reveals.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    }, { threshold: 0.18 });
    reveals.forEach((r) => io.observe(r));
  } else {
    document.querySelectorAll('.fs-reveal').forEach((r) => r.classList.add('in-view'));
  }
})();
