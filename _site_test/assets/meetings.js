/* ── Recent Meetings loader ── */
(function () {
  var MEETINGS_URL = '/data/meetings.json';
  var SHOW_INITIAL = 5;
  var container = document.getElementById('meetingsList');
  var moreBtn   = document.getElementById('meetingsMore');
  if (!container) return;

  var allMeetings = [];
  var showing = SHOW_INITIAL;

  function formatDate(iso) {
    if (!iso) return 'Date TBD';
    var parts = iso.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1]) - 1] + ' ' + parseInt(parts[2]) + ', ' + parts[0];
  }

  function renderMeetings() {
    var visible = allMeetings.slice(0, showing);
    container.innerHTML = '';
    for (var i = 0; i < visible.length; i++) {
      var m = visible[i];
      var a = document.createElement('a');
      a.className = 'meeting-card';
      a.href = m.url;
      a.target = '_blank';
      a.rel = 'noopener';

      var badge = document.createElement('span');
      badge.className = 'meeting-board-badge';
      badge.setAttribute('data-board', m.board);
      badge.textContent = m.board;

      var info = document.createElement('span');
      info.className = 'meeting-info';
      var dateEl = document.createElement('span');
      dateEl.className = 'meeting-date';
      dateEl.textContent = formatDate(m.date);
      var dur = document.createElement('span');
      dur.className = 'meeting-duration';
      dur.textContent = m.duration_min ? ' \u00B7 ' + m.duration_min + ' min' : '';
      info.appendChild(dateEl);
      info.appendChild(dur);

      if (m.summary && m.summary.summary) {
        var sumEl = document.createElement('span');
        sumEl.className = 'meeting-summary';
        sumEl.textContent = m.summary.summary;
        info.appendChild(sumEl);
      }

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'meeting-play-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('aria-hidden', 'true');
      var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', '5 3 19 12 5 21 5 3');
      svg.appendChild(poly);

      a.appendChild(badge);
      a.appendChild(info);
      a.appendChild(svg);
      container.appendChild(a);
    }

    if (showing < allMeetings.length) {
      moreBtn.style.display = '';
      moreBtn.textContent = 'Show more (' + (allMeetings.length - showing) + ' remaining)';
    } else {
      moreBtn.style.display = 'none';
    }
  }

  fetch(MEETINGS_URL)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allMeetings = (data.videos || []).filter(function (v) {
        return v.board && v.board !== 'Other' && v.duration_min >= 15;
      });
      if (allMeetings.length === 0) {
        container.innerHTML = '<p class="explore-meetings-empty">No recent meetings available.</p>';
        return;
      }
      renderMeetings();
    })
    .catch(function () {
      container.innerHTML = '<p class="explore-meetings-empty">Meeting data unavailable</p>';
    });

  moreBtn.addEventListener('click', function () {
    showing += 10;
    renderMeetings();
  });
})();
