/* Finance-story shared engine: reveal-on-view + chart loader. */
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

  // ---------- Chart loader ----------
  // Lazy-load Observable Plot only if the page has a chart container.
  const chartHosts = document.querySelectorAll('[data-fs-chart]');
  if (chartHosts.length === 0) return;

  // chartBuilders is populated below. Each entry takes (Plot, data, host)
  // and returns a Plot.plot(...) figure.
  const chartBuilders = {};

  // §1 General Fund: horizontal bar chart of where $109.78M goes.
  chartBuilders.general_fund = (Plot, data, host) => {
    return Plot.plot({
      marginLeft: 160,
      x: { tickFormat: (d) => '$' + (d / 1e6).toFixed(0) + 'M', label: null },
      y: { label: null },
      marks: [
        Plot.barX(data, {
          x: 'amount',
          y: 'category',
          sort: { y: 'x', reverse: true },
          fill: 'var(--c-navy)'
        }),
        Plot.text(data, {
          x: 'amount',
          y: 'category',
          text: (d) => '$' + (d.amount / 1e6).toFixed(1) + 'M',
          dx: 6,
          textAnchor: 'start',
          fill: 'var(--text)'
        })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '14px "Source Sans 3", sans-serif' }
    });
  };

  // §2 Enterprise: three small multiples (water, sewer, harbor). Revenue vs cost.
  chartBuilders.enterprise = (Plot, data, host) => {
    return Plot.plot({
      facet: { data: data.rows, x: 'utility' },
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$M', grid: true, tickFormat: (d) => '$' + d.toFixed(1) },
      marks: [
        Plot.lineY(data.rows, { x: 'fy', y: 'revenue', stroke: 'var(--series-revenue)', strokeWidth: 2 }),
        Plot.lineY(data.rows, { x: 'fy', y: 'cost',    stroke: 'var(--series-cost)',    strokeWidth: 2 })
      ],
      width: Math.min(host.parentElement.clientWidth || 720, 720),
      height: 220,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };

  // §3 Capital: stacked area of debt service, inside-cap vs excluded.
  chartBuilders.capital = (Plot, data, host) => {
    return Plot.plot({
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$M', grid: true, tickFormat: (d) => '$' + d.toFixed(1) },
      color: { legend: true, range: ['var(--c-navy)', 'var(--c-buoy)'] },
      marks: [
        Plot.areaY(data, { x: 'fy', y: 'amount', fill: 'kind', stroke: 'white', strokeWidth: 0.5 })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };

  // §4 Restricted: grant capture per year, stacked by department.
  chartBuilders.restricted = (Plot, data, host) => {
    return Plot.plot({
      x: { label: 'FY', tickFormat: 'd' },
      y: { label: '$ thousands', grid: true },
      color: { legend: true },
      marks: [
        Plot.barY(data, { x: 'fy', y: 'amount', fill: 'department' })
      ],
      width: Math.min(host.parentElement.clientWidth || 700, 700),
      height: 320,
      style: { background: 'transparent', font: '13px "Source Sans 3", sans-serif' }
    });
  };

  import('https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm').then(async (Plot) => {
    for (const host of chartHosts) {
      const chartName = host.dataset.fsChart;
      const dataUrl = host.dataset.fsData;
      if (!dataUrl) continue;
      try {
        const data = await fetch(dataUrl).then((r) => r.json());
        const builder = chartBuilders[chartName];
        if (!builder) {
          console.warn('No chart builder for', chartName);
          continue;
        }
        const plot = builder(Plot, data, host);
        host.replaceChildren(plot);
      } catch (err) {
        console.error('Chart load failed for', chartName, err);
      }
    }
  }).catch((err) => {
    console.error('Plot module failed to load', err);
  });
})();
