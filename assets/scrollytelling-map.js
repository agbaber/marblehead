/*
 * Scrollytelling map for the school-building-maintenance page.
 *
 * As the reader scrolls through the operating-school cards, the Mapbox
 * Static map at the top (sticky on desktop) updates so the pin for the
 * currently-in-view school is enlarged. Cards are tagged with
 * data-school-idx; the wrapper map is identified by .sbm-school-map-wrap.
 *
 * Implementation:
 *   - On load, parse the access token + base style URL out of the existing
 *     <img src> attributes so the JS doesn't need its own copy of the token.
 *   - Build all 5 active-variant URLs per theme (light + dark) and preload
 *     them via the Image() constructor so swaps are instant.
 *   - IntersectionObserver watches each .sbm-school-cards .sbm-card. The
 *     card whose vertical center is closest to the viewport center wins.
 *   - On change, swap both light + dark map img srcs to the active variant.
 *
 * Graceful degradation: if IntersectionObserver isn't available, the
 * default static URL (rendered by Jekyll) stays in place.
 */

(function () {
  'use strict';

  var SCHOOLS = [
    { idx: 1, lng: -70.86837,  lat: 42.49185  },
    { idx: 2, lng: -70.86223,  lat: 42.49806  },
    { idx: 3, lng: -70.8666,   lat: 42.50317  },
    { idx: 4, lng: -70.879751, lat: 42.490166 },
    { idx: 5, lng: -70.87134,  lat: 42.496745 }
  ];

  var LIGHT_ACTIVE   = '1B3A57';
  var LIGHT_INACTIVE = '8A8A8A';
  var DARK_ACTIVE    = 'B8860B';
  var DARK_INACTIVE  = '555555';

  function buildPinSegment(school, activeIdx, activeColor, inactiveColor) {
    var size  = school.idx === activeIdx ? 'l' : 's';
    var color = school.idx === activeIdx ? activeColor : inactiveColor;
    return 'pin-' + size + '-' + school.idx + '+' + color +
           '(' + school.lng + ',' + school.lat + ')';
  }

  function buildUrl(template, activeIdx, activeColor, inactiveColor) {
    var pins = SCHOOLS.map(function (s) {
      return buildPinSegment(s, activeIdx, activeColor, inactiveColor);
    }).join(',');
    return template.prefix + pins + template.suffix;
  }

  function parseTemplate(src) {
    // Match the static-image URL up to the pin segments and after them.
    // The original URL is:
    //   https://api.mapbox.com/styles/v1/mapbox/<style>/static/<pins>/auto/720x360@2x?access_token=...
    var m = src.match(/^(.*\/static\/)[^/]+(\/auto\/.+)$/);
    if (!m) return null;
    return { prefix: m[1], suffix: m[2] };
  }

  function preloadAll(template, activeColor, inactiveColor) {
    SCHOOLS.forEach(function (s) {
      var img = new Image();
      img.src = buildUrl(template, s.idx, activeColor, inactiveColor);
    });
  }

  function init() {
    var wrap = document.querySelector('.sbm-school-map-wrap');
    if (!wrap) return;
    var lightImg = wrap.querySelector('.sbm-school-map--light');
    var darkImg  = wrap.querySelector('.sbm-school-map--dark');
    if (!lightImg || !darkImg) return;
    if (typeof IntersectionObserver === 'undefined') return;

    var lightTpl = parseTemplate(lightImg.getAttribute('src'));
    var darkTpl  = parseTemplate(darkImg.getAttribute('src'));
    if (!lightTpl || !darkTpl) return;

    preloadAll(lightTpl, LIGHT_ACTIVE, LIGHT_INACTIVE);
    preloadAll(darkTpl,  DARK_ACTIVE,  DARK_INACTIVE);

    var cards = document.querySelectorAll('.sbm-school-cards .sbm-card[data-school-idx]');
    if (!cards.length) return;

    var currentIdx = null;
    function setActive(idx) {
      if (idx === currentIdx) return;
      currentIdx = idx;
      lightImg.src = buildUrl(lightTpl, idx, LIGHT_ACTIVE, LIGHT_INACTIVE);
      darkImg.src  = buildUrl(darkTpl,  idx, DARK_ACTIVE,  DARK_INACTIVE);
      wrap.setAttribute('data-active-school', String(idx));
    }

    // Track ratios per card; on any change pick the most-visible card.
    var ratios = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var idx = parseInt(entry.target.getAttribute('data-school-idx'), 10);
        ratios[idx] = entry.intersectionRatio;
      });
      var bestIdx = null, bestRatio = 0;
      Object.keys(ratios).forEach(function (k) {
        if (ratios[k] > bestRatio) { bestRatio = ratios[k]; bestIdx = parseInt(k, 10); }
      });
      if (bestIdx !== null && bestRatio > 0) setActive(bestIdx);
    }, {
      // Bias toward the upper half of the viewport so the active card feels
      // tied to where the user is currently reading, not the bottom edge.
      rootMargin: '-20% 0px -40% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    cards.forEach(function (card) { observer.observe(card); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
