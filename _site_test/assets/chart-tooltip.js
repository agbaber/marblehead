/*
  chart-tooltip.js
  ----------------
  Universal line-chart tooltip. Opt in on a .chart-wrapper by adding
  `data-chart-tooltip`. Series + year data lives in a JSON
  <script type="application/json" class="chart-tooltip-data"> inside
  the wrapper. Data shape:

    {
      "xLabels":      ["FY06","FY07",...],   // strings shown in tooltip
      "xPositions":   [60,87,...],           // SVG x coords, same length
      "valuePrefix":  "$",                   // optional, default ""
      "valueSuffix":  "M",                   // optional, default ""
      "valueDecimals": 1,                    // optional, default auto
      "projectedFromIndex": 18,              // optional, marks years >= this
      "series": [
        {
          "name":      "Total tax levy",
          "className": "s-revenue",          // color class for swatch
          "values":    [50.1, 51.6, ..., null],
          "yPositions":[246,242, ...],       // optional per-year SVG y; if
                                             // omitted, we auto-detect from
                                             // polylines in the SVG
          "valuePrefix": "$",                // optional, per-series override
          "valueSuffix": "M",                // optional, per-series override
          "valueDecimals": 2,                // optional, per-series override
          "visibleWhen": "#view-tier1.active"// optional, CSS selector. The
                                             // series is only rendered when
                                             // the selector currently matches
                                             // something in the document.
                                             // Used by tabbed charts to show
                                             // different series per view.
        },
        ...
      ]
    }

  Interaction model matches charts/statewide_tax_burden.html:
  - Mouse move anywhere over the SVG finds the nearest x in xPositions,
    snaps a vertical crosshair to it, drops colored dots on each series,
    and renders an HTML tooltip above the snap point.
  - On touch devices (no mouseleave), tapping the chart snaps to the
    nearest point; tapping outside the chart dismisses.
*/
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function parseJSON(el) {
    try { return JSON.parse(el.textContent); }
    catch (e) { return null; }
  }

  // Parse a polyline "points" attribute (e.g. "60,246 87,242 ...") into
  // an array of {x, y} objects.
  function parsePoints(str) {
    if (!str) return [];
    var out = [];
    var pairs = str.trim().split(/\s+/);
    for (var i = 0; i < pairs.length; i++) {
      var xy = pairs[i].split(',');
      if (xy.length !== 2) continue;
      var x = parseFloat(xy[0]);
      var y = parseFloat(xy[1]);
      if (!isFinite(x) || !isFinite(y)) continue;
      out.push({ x: x, y: y });
    }
    return out;
  }

  // For a given series, collect all (x,y) pairs from any polyline in
  // the SVG that carries the series' className. Multiple polylines are
  // merged (handles split solid/dashed projections). Duplicates on the
  // same x are deduped, keeping the first one encountered.
  function collectSeriesPoints(svg, className) {
    var polylines = svg.querySelectorAll('polyline.' + className);
    var seen = {};
    var out = [];
    for (var i = 0; i < polylines.length; i++) {
      var pts = parsePoints(polylines[i].getAttribute('points'));
      for (var j = 0; j < pts.length; j++) {
        var key = pts[j].x.toFixed(2);
        if (seen[key]) continue;
        seen[key] = true;
        out.push(pts[j]);
      }
    }
    return out;
  }

  // Given the series points and a target x, return the y at the
  // closest-matching x (within 2px), or null if no match.
  function yAtX(points, targetX) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < points.length; i++) {
      var d = Math.abs(points[i].x - targetX);
      if (d < bestD) { bestD = d; best = points[i]; }
    }
    if (best && bestD <= 2.5) return best.y;
    return null;
  }

  // Format a raw value. Per-series prefix/suffix/decimals override the
  // chart-level defaults; otherwise fall back to cfg's values.
  function formatValue(raw, cfg, series) {
    if (raw === null || raw === undefined) return '\u2014'; // em dash placeholder
    var num = Number(raw);
    if (!isFinite(num)) return String(raw);
    var prefix = (series && series.valuePrefix !== undefined)
      ? series.valuePrefix
      : (cfg.valuePrefix || '');
    var suffix = (series && series.valueSuffix !== undefined)
      ? series.valueSuffix
      : (cfg.valueSuffix || '');
    var decimals;
    if (series && typeof series.valueDecimals === 'number') {
      decimals = series.valueDecimals;
    } else if (typeof cfg.valueDecimals === 'number') {
      decimals = cfg.valueDecimals;
    } else {
      // Auto: 0 if integer-looking, else 1
      decimals = (Math.abs(num - Math.round(num)) < 0.05) ? 0 : 1;
    }
    var s = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return prefix + s + suffix;
  }

  function initChart(wrap) {
    var svg = wrap.querySelector('svg.chart');
    if (!svg) return;
    var dataEl = wrap.querySelector('script.chart-tooltip-data');
    if (!dataEl) return;
    var cfg = parseJSON(dataEl);
    if (!cfg || !cfg.xPositions || !cfg.xLabels || !cfg.series) return;
    if (cfg.xPositions.length !== cfg.xLabels.length) return;

    // Auto-harvest y positions for any series that didn't supply them.
    var series = cfg.series.map(function (s) {
      var yPositions = s.yPositions;
      if (!yPositions && s.className) {
        var pts = collectSeriesPoints(svg, s.className);
        yPositions = cfg.xPositions.map(function (x) {
          return yAtX(pts, x);
        });
      }
      return {
        name: s.name,
        className: s.className || 's-neutral',
        values: s.values || [],
        yPositions: yPositions || [],
        valuePrefix: s.valuePrefix,
        valueSuffix: s.valueSuffix,
        valueDecimals: s.valueDecimals,
        visibleWhen: s.visibleWhen
      };
    });

    // Build SVG overlay elements: vertical crosshair line + one dot per
    // series. They live in the same SVG so they scale with the chart.
    var hoverLine = document.createElementNS(SVG_NS, 'line');
    hoverLine.setAttribute('class', 'chart-tooltip-hover-line');
    hoverLine.setAttribute('x1', '0');
    hoverLine.setAttribute('x2', '0');
    hoverLine.setAttribute('y1', '0');
    hoverLine.setAttribute('y2', '0');
    svg.appendChild(hoverLine);

    var dots = series.map(function (s) {
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'chart-tooltip-dot ' + s.className);
      dot.setAttribute('r', '4');
      dot.setAttribute('cx', '0');
      dot.setAttribute('cy', '0');
      svg.appendChild(dot);
      return dot;
    });

    // Figure out the vertical extent of the crosshair line. Explicit
    // plotTop / plotBottom in the JSON wins (needed for multi-panel
    // charts where there's more than one .axis-base). Otherwise:
    //   - bottomY = the LAST .axis-base y1 (covers multi-panel charts
    //     where the full plot area runs from the top panel to the
    //     bottom panel's baseline)
    //   - topY   = the smallest y among harvested series points, minus
    //     a small margin, clamped to the viewBox.
    var vb = svg.viewBox.baseVal;
    var topY, bottomY;
    if (typeof cfg.plotTop === 'number') {
      topY = cfg.plotTop;
    } else {
      topY = vb ? vb.y + 4 : 0;
    }
    if (typeof cfg.plotBottom === 'number') {
      bottomY = cfg.plotBottom;
    } else {
      var axisBases = svg.querySelectorAll('.axis-base');
      var lastBase = null;
      for (var bi = 0; bi < axisBases.length; bi++) {
        if (axisBases[bi].getAttribute('y1') !== null) lastBase = axisBases[bi];
      }
      if (lastBase) {
        bottomY = parseFloat(lastBase.getAttribute('y1'));
      } else if (vb) {
        bottomY = vb.y + vb.height - 20;
      } else {
        bottomY = 300;
      }
    }
    if (typeof cfg.plotTop !== 'number') {
      // Expand topY to cover series highs if available.
      var dataTop = Infinity;
      series.forEach(function (s) {
        s.yPositions.forEach(function (y) {
          if (y !== null && y !== undefined && y < dataTop) dataTop = y;
        });
      });
      if (isFinite(dataTop)) topY = Math.max(topY, dataTop - 6);
    }

    // Tooltip HTML div (absolutely positioned relative to wrapper).
    var tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    wrap.appendChild(tip);

    var lastIdx = -1;

    function hide() {
      tip.classList.remove('visible');
      hoverLine.classList.remove('visible');
      dots.forEach(function (d) { d.classList.remove('visible'); });
      lastIdx = -1;
    }

    function svgXFromClient(clientX) {
      var pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = 0;
      var ctm = svg.getScreenCTM();
      if (!ctm) return null;
      return pt.matrixTransform(ctm.inverse()).x;
    }

    function showAtClient(clientX) {
      var mx = svgXFromClient(clientX);
      if (mx === null) return;
      var xs = cfg.xPositions;
      // Guard against being well outside the plot horizontally.
      var first = xs[0], last = xs[xs.length - 1];
      if (mx < first - 10 || mx > last + 10) { hide(); return; }
      // Find nearest index.
      var idx = 0;
      var bestD = Math.abs(mx - xs[0]);
      for (var i = 1; i < xs.length; i++) {
        var d = Math.abs(mx - xs[i]);
        if (d < bestD) { bestD = d; idx = i; }
      }
      if (idx === lastIdx) return;
      lastIdx = idx;

      var snappedX = xs[idx];
      hoverLine.setAttribute('x1', snappedX);
      hoverLine.setAttribute('x2', snappedX);
      hoverLine.setAttribute('y1', topY);
      hoverLine.setAttribute('y2', bottomY);
      hoverLine.classList.add('visible');

      // Resolve per-series visibility. A series with `visibleWhen` set
      // to a CSS selector is only shown if that selector currently
      // matches something in the document. This lets tabbed charts
      // (e.g. sustainability.html) show override tiers only for the
      // active tab without any other runtime plumbing.
      var visibleFlags = series.map(function (s) {
        if (!s.visibleWhen) return true;
        try { return !!document.querySelector(s.visibleWhen); }
        catch (e) { return true; }
      });

      // Position dots on the snapped x at each series' y.
      series.forEach(function (s, k) {
        var y = s.yPositions[idx];
        var v = s.values[idx];
        if (!visibleFlags[k] || y === null || y === undefined || v === null || v === undefined) {
          dots[k].classList.remove('visible');
          return;
        }
        dots[k].setAttribute('cx', snappedX);
        dots[k].setAttribute('cy', y);
        dots[k].classList.add('visible');
      });

      // Build tooltip HTML.
      var isProjected = (typeof cfg.projectedFromIndex === 'number')
        && idx >= cfg.projectedFromIndex;
      var html = '<div class="chart-tooltip-year">' + escapeHtml(cfg.xLabels[idx]);
      if (isProjected) {
        html += '<span class="chart-tooltip-projected">projected</span>';
      }
      html += '</div>';
      series.forEach(function (s, k) {
        var v = s.values[idx];
        if (v === null || v === undefined) return;
        if (!visibleFlags[k]) return;
        html += '<div class="chart-tooltip-row ' + escapeHtml(s.className) + '">' +
          '<span class="chart-tooltip-swatch"></span>' +
          '<span class="chart-tooltip-label">' + escapeHtml(s.name) + '</span>' +
          '<span class="chart-tooltip-value">' + escapeHtml(formatValue(v, cfg, s)) + '</span>' +
          '</div>';
      });
      tip.innerHTML = html;
      tip.classList.add('visible');

      // Position tooltip above the snapped point.
      var wrapRect = wrap.getBoundingClientRect();
      var ctm = svg.getScreenCTM();
      if (!ctm) return;
      // Convert (snappedX, topY) from SVG to client coords, then to
      // wrapper-relative coords.
      var pt = svg.createSVGPoint();
      pt.x = snappedX;
      pt.y = topY;
      var clientPoint = pt.matrixTransform(ctm);
      var px = clientPoint.x - wrapRect.left;
      var py = clientPoint.y - wrapRect.top;

      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var tx = px - tw / 2;
      var ty = py - th - 10;
      if (tx < 4) tx = 4;
      if (tx + tw > wrapRect.width - 4) tx = wrapRect.width - tw - 4;
      if (ty < 4) {
        // Flip below the snapped x (use bottomY instead).
        var pt2 = svg.createSVGPoint();
        pt2.x = snappedX;
        pt2.y = bottomY;
        var cb = pt2.matrixTransform(ctm);
        ty = (cb.y - wrapRect.top) + 10;
      }
      tip.style.left = tx + 'px';
      tip.style.top = ty + 'px';
    }

    function escapeHtml(s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    svg.addEventListener('mousemove', function (e) { showAtClient(e.clientX); });
    svg.addEventListener('mouseleave', hide);

    // Touch / tap: snap to the tapped x, dismiss on a tap outside.
    svg.addEventListener('click', function (e) { showAtClient(e.clientX); });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) hide();
    });
    // On touch devices, touchstart beats click latency.
    svg.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length) showAtClient(e.touches[0].clientX);
    }, { passive: true });
  }

  function initAll() {
    var wraps = document.querySelectorAll('.chart-wrapper[data-chart-tooltip]');
    for (var i = 0; i < wraps.length; i++) initChart(wraps[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
