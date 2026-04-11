/*
 * Citations runtime.
 *
 * Walks <sup class="cite" data-href="URL" data-source="Label"> markers on any
 * page, numbers them (deduped by href so the same source reused across the
 * page shares a number), fills the marker with the assigned number linked to
 * an in-page anchor, and builds a numbered Sources list at the end of the
 * main content.
 *
 * Authoring convention:
 *
 *   <sup class="cite"
 *        data-href="https://example.com/source.pdf"
 *        data-source="Example Source, page 12"></sup>
 *
 * If a source is cited N times on the page, it gets one numbered entry with
 * N back-links labeled "a, b, c, ...". If cited once, the back-link is a
 * single "↩" character.
 *
 * The Sources section is inserted immediately before the first `.notes` block
 * on the page. If no `.notes` block exists, the section is appended to the
 * document body.
 *
 * Pages that opt out of automatic citation rendering can simply omit any
 * <sup class="cite"> markers. The script early-returns when there are none.
 */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    var cites = document.querySelectorAll('sup.cite[data-href]');
    if (!cites.length) return;

    // href -> { n, source, refs: [refId, ...] }
    var sources = new Map();

    cites.forEach(function (cite, i) {
      var href = cite.getAttribute('data-href');
      var source = cite.getAttribute('data-source') || href;
      var refId = 'ref-' + (i + 1);

      var entry = sources.get(href);
      if (!entry) {
        entry = { n: sources.size + 1, source: source, refs: [] };
        sources.set(href, entry);
      }
      entry.refs.push(refId);

      var a = document.createElement('a');
      a.href = '#fn-' + entry.n;
      a.id = refId;
      a.textContent = String(entry.n);
      cite.textContent = '';
      cite.appendChild(a);
    });

    var section = document.createElement('section');
    section.className = 'sources-list';
    section.id = 'sources';

    var heading = document.createElement('h2');
    heading.className = 'sources-list-heading';
    heading.textContent = 'Sources';
    section.appendChild(heading);

    var list = document.createElement('ol');
    list.className = 'sources-list-ol';
    section.appendChild(list);

    sources.forEach(function (entry, href) {
      var li = document.createElement('li');
      li.id = 'fn-' + entry.n;

      var sourceLink = document.createElement('a');
      sourceLink.href = href;
      sourceLink.textContent = entry.source;
      if (/^https?:/.test(href)) {
        sourceLink.rel = 'noopener';
      }
      li.appendChild(sourceLink);

      entry.refs.forEach(function (refId, i) {
        var back = document.createElement('a');
        back.className = 'sources-backref';
        back.href = '#' + refId;
        back.textContent = entry.refs.length > 1
          ? String.fromCharCode(97 + i)
          : '\u21A9';
        back.setAttribute('aria-label', 'Back to reference ' + (i + 1));
        li.appendChild(document.createTextNode(' '));
        li.appendChild(back);
      });

      list.appendChild(li);
    });

    var notes = document.querySelector('.notes');
    if (notes && notes.parentNode) {
      notes.parentNode.insertBefore(section, notes);
    } else {
      document.body.appendChild(section);
    }
  });
})();
