/* Finance-story shared engine: reveal-on-view + sticky progress bar. */
(function () {
  // ---------- Reveal-on-view ----------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.fs-reveal').forEach((r) => io.observe(r));
  } else {
    document.querySelectorAll('.fs-reveal').forEach((r) => r.classList.add('in-view'));
  }

  // ---------- Sticky bottom progress bar ----------
  const fill = document.getElementById('fs-progress-fill');
  if (fill) {
    let queued = false;
    function tickProgress() {
      const max = document.body.scrollHeight - window.innerHeight;
      const t = max > 0 ? window.scrollY / max : 0;
      fill.style.width = (t * 100).toFixed(2) + '%';
      queued = false;
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(tickProgress);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', tickProgress);
    tickProgress();
  }
})();
