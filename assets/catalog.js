/* catalog.js – renders referenced catalog entries as anchor targets
   so inline (#entry-...) links resolve to a detail card at the bottom
   of the page.  Loads data/catalog_normalized.csv on demand. */
(function () {
  'use strict';

  /* ---- collect entry IDs referenced by links on this page ---- */
  var links = document.querySelectorAll('a[href^="#entry-"]');
  if (!links.length) return;

  var needed = {};
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1); // drop leading #
    needed[id] = true;
  });

  /* ---- fetch + parse the CSV ---- */
  fetch('/data/catalog_normalized.csv')
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var rows = parseCSV(text);
      if (!rows.length) return;
      var headers = rows[0];
      var idIdx       = headers.indexOf('entry_id');
      var dateIdx     = headers.indexOf('meeting_date');
      var bodyIdx     = headers.indexOf('body');
      var whatIdx     = headers.indexOf('what_was_tried');
      var outcomeIdx  = headers.indexOf('outcome');
      var quoteIdx    = headers.indexOf('evidence_quote');
      var impIdx      = headers.indexOf('importance');
      var topicIdx    = headers.indexOf('topic_pass2');
      if (idIdx < 0) return;

      var entries = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        var entryId = r[idIdx];
        var anchor = 'entry-' + entryId;
        if (!needed[anchor]) continue;
        entries.push({
          anchor:   anchor,
          entryId:  entryId,
          date:     r[dateIdx] || '',
          body:     r[bodyIdx] || '',
          what:     r[whatIdx] || '',
          outcome:  r[outcomeIdx] || '',
          quote:    r[quoteIdx] || '',
          importance: r[impIdx] || '',
          topic:    r[topicIdx] || ''
        });
      }

      if (!entries.length) return;
      render(entries);
    });

  /* ---- render catalog section ---- */
  function render(entries) {
    var section = document.createElement('section');
    section.className = 'catalog-entries';
    section.innerHTML = '<h2>Catalog entries cited</h2>' +
      '<p class="catalog-lead">Each citation in the text above links to an entry below. ' +
      'Entries are drawn from Select Board and School Committee meeting minutes.</p>';

    entries.forEach(function (e) {
      var card = document.createElement('div');
      card.className = 'catalog-card';
      card.id = e.anchor;

      var bodyLabel = e.body === 'select_board' ? 'Select Board'
                    : e.body === 'school_committee' ? 'School Committee'
                    : e.body;
      var dateLabel = formatDate(e.date);
      var topicLabel = e.topic.replace(/_/g, ' ');
      var minutesUrl = '/data/minutes/' + e.body + '/' + e.date + '.cleaned.txt';

      var html = '<div class="catalog-card-head">' +
        '<span class="catalog-body">' + bodyLabel + '</span>' +
        '<span class="catalog-date">' + dateLabel + '</span>' +
        '<span class="catalog-topic">' + topicLabel + '</span>' +
        '</div>';

      if (e.what) {
        html += '<p class="catalog-what">' + escHtml(e.what) + '</p>';
      }
      if (e.outcome) {
        html += '<p class="catalog-outcome"><strong>Outcome:</strong> ' + escHtml(e.outcome) + '</p>';
      }
      if (e.quote) {
        html += '<blockquote class="catalog-quote">' + escHtml(e.quote) + '</blockquote>';
      }
      html += '<a class="catalog-minutes-link" href="' + minutesUrl + '">View full minutes</a>';

      card.innerHTML = html;
      section.appendChild(card);
    });

    /* Insert before the footer */
    var page = document.querySelector('.page');
    var footer = page && page.querySelector('.footer');
    if (footer) {
      page.insertBefore(section, footer);
    } else if (page) {
      page.appendChild(section);
    }

    /* If the URL already has a hash, scroll to it now that anchors exist */
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        setTimeout(function () { target.scrollIntoView({ behavior: 'smooth' }); }, 100);
      }
    }
  }

  /* ---- helpers ---- */
  function formatDate(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Minimal RFC 4180 CSV parser (handles quoted fields with embedded
     commas, newlines, and escaped double-quotes). */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuote = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"'; i++;
          } else {
            inQuote = false;
          }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuote = true;
        } else if (c === ',') {
          row.push(field); field = '';
        } else if (c === '\n') {
          row.push(field); field = '';
          if (row.length > 1 || row[0] !== '') rows.push(row);
          row = [];
        } else if (c === '\r') {
          /* skip */
        } else {
          field += c;
        }
      }
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }
})();
