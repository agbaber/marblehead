// Finance-story mockup scroll engine.
// Each .fs-panel[data-stage] activates the matching .stage in the pinned canvas
// when at least 40% of the panel is in view.

(function () {
  const canvas = document.querySelector('.fs-canvas');
  if (!canvas) return;

  const stages = canvas.querySelectorAll('.stage');
  const dotsHost = document.querySelector('.fs-dots');
  const panels = document.querySelectorAll('.fs-panel[data-stage]');

  if (dotsHost) {
    panels.forEach((p) => {
      const d = document.createElement('span');
      d.className = 'dot';
      d.dataset.stage = p.dataset.stage;
      dotsHost.appendChild(d);
    });
  }

  function setActive(stageId) {
    stages.forEach((s) => s.classList.toggle('active', s.dataset.stage === stageId));
    if (dotsHost) {
      dotsHost.querySelectorAll('.dot').forEach((d) =>
        d.classList.toggle('active', d.dataset.stage === stageId)
      );
    }
  }

  // Activate first stage by default
  if (panels.length) setActive(panels[0].dataset.stage);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.4) {
          setActive(e.target.dataset.stage);
        }
      });
    },
    { threshold: [0.4, 0.6] }
  );

  panels.forEach((p) => io.observe(p));
})();
