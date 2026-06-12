/* Data Lab — browser-side SQLite query UI.
 *
 * Loads sql-wasm + the prebuilt marbleheaddata.sqlite, renders the table
 * directory from _meta, lets the user type SQL and see results, and fires
 * a PostHog event per query so we can see what people actually ask.
 */
(function () {
  'use strict';

  var SQL_WASM_BASE = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';
  var DB_URL = (document.querySelector('a[href$="marbleheaddata.sqlite"]') || {}).href
            || '/assets/data/marbleheaddata.sqlite';

  var db = null;
  var lastResultRows = null;
  var lastResultColumns = null;

  // ---- Example queries. Each is a real, runnable SELECT against the DB.
  var EXAMPLES = [
    {
      label: 'Every Marblehead override vote, most recent first',
      note: 'Showing all Prop 2½ override votes Marblehead has held, with the margin.',
      sql: "SELECT fiscal_year, win_loss, yes_votes, no_votes, description\n" +
           "FROM ma_overrides\n" +
           "WHERE municipality = 'Marblehead'\n" +
           "ORDER BY fiscal_year DESC, vote_date DESC;"
    },
    {
      label: 'Top 20 MA towns by average single-family tax bill (FY26)',
      note: 'Compare the absolute tax-bill scale across the state.',
      sql: "SELECT municipality, avg_sf_tax_bill, residential_tax_rate, total_tax_levy\n" +
           "FROM ma_towns_fy26\n" +
           "ORDER BY avg_sf_tax_bill DESC\n" +
           "LIMIT 20;"
    },
    {
      label: 'MA towns with a similar income profile to Marblehead',
      note: 'Within ±15% of Marblehead\'s per-capita income, sorted by tax burden.',
      sql: "WITH mh AS (SELECT dor_income_per_capita FROM ma_towns_fy26 WHERE municipality='Marblehead')\n" +
           "SELECT municipality, dor_income_per_capita, avg_sf_tax_bill, bill_pct_income\n" +
           "FROM ma_towns_fy26, mh\n" +
           "WHERE dor_income_per_capita BETWEEN mh.dor_income_per_capita * 0.85 AND mh.dor_income_per_capita * 1.15\n" +
           "ORDER BY bill_pct_income DESC;"
    },
    {
      label: 'Override pass rate by decade, statewide',
      note: 'How often Massachusetts towns vote yes on overrides, by decade.',
      sql: "SELECT (fiscal_year/10)*10 AS decade,\n" +
           "       COUNT(*) AS votes,\n" +
           "       SUM(CASE WHEN win_loss='WIN' THEN 1 ELSE 0 END) AS wins,\n" +
           "       ROUND(100.0 * SUM(CASE WHEN win_loss='WIN' THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_pct\n" +
           "FROM ma_overrides\n" +
           "WHERE fiscal_year >= 1990\n" +
           "GROUP BY decade\n" +
           "ORDER BY decade;"
    },
    {
      label: 'School Committee meeting topics by frequency, last 18 months',
      note: 'What the School Committee actually deliberated on.',
      sql: "SELECT topic, COUNT(*) AS mentions\n" +
           "FROM minutes_catalog\n" +
           "WHERE body = 'school_committee' AND meeting_date >= '2025-01-01'\n" +
           "GROUP BY topic\n" +
           "ORDER BY mentions DESC;"
    },
    {
      label: 'Every Marblehead debt exclusion since 1988',
      note: 'Capital projects voters approved outside the levy limit.',
      sql: "SELECT fiscal_year, vote_date, description, department, win_loss\n" +
           "FROM ma_debt_exclusions\n" +
           "WHERE municipality = 'Marblehead'\n" +
           "ORDER BY vote_date DESC;"
    }
  ];

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, isError) {
    var el = $('lab-status');
    el.textContent = msg || '';
    el.classList.toggle('lab-error', !!isError);
  }

  function capture(event, props) {
    if (typeof window.posthog === 'undefined' || !window.posthog.capture) return;
    try { window.posthog.capture(event, props); } catch (e) { /* ignore */ }
  }

  function isNumeric(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return true;
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return true;
    return false;
  }

  function formatCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) >= 1000 && Number.isInteger(v)) {
      return v.toLocaleString('en-US');
    }
    return String(v);
  }

  function renderResults(res) {
    var box = $('lab-results');
    if (!res || res.length === 0) {
      box.innerHTML = '<div class="lab-empty">Query returned no rows.</div>';
      lastResultRows = lastResultColumns = null;
      $('lab-export').disabled = true;
      return 0;
    }
    var result = res[0]; // First statement only for the result view.
    var cols = result.columns;
    var rows = result.values;
    lastResultColumns = cols;
    lastResultRows = rows;
    $('lab-export').disabled = rows.length === 0;

    var html = '<table><thead><tr>';
    for (var i = 0; i < cols.length; i++) {
      html += '<th>' + escapeHtml(cols[i]) + '</th>';
    }
    html += '</tr></thead><tbody>';
    // Cap rendered rows to avoid huge DOM; user can export full result.
    var renderCap = 500;
    var renderRows = rows.slice(0, renderCap);
    for (var r = 0; r < renderRows.length; r++) {
      html += '<tr>';
      for (var c = 0; c < renderRows[r].length; c++) {
        var v = renderRows[r][c];
        var cls = isNumeric(v) ? ' class="lab-num"' : '';
        html += '<td' + cls + '>' + escapeHtml(formatCell(v)) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    if (rows.length > renderCap) {
      html += '<div class="lab-empty">Showing first ' + renderCap.toLocaleString() +
              ' of ' + rows.length.toLocaleString() + ' rows. Export to CSV for the full result.</div>';
    }
    box.innerHTML = html;
    return rows.length;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function runQuery() {
    if (!db) return;
    var sql = $('lab-sql').value.trim();
    if (!sql) { setStatus('Type a SQL query above.', true); return; }
    var start = performance.now();
    try {
      var res = db.exec(sql);
      var rows = renderResults(res);
      var ms = Math.round(performance.now() - start);
      setStatus(rows + ' row' + (rows === 1 ? '' : 's') + ' in ' + ms + ' ms', false);
      capture('data_lab_query_run', {
        sql_truncated: sql.length > 500 ? sql.slice(0, 500) + '…' : sql,
        sql_length: sql.length,
        rows_returned: rows,
        duration_ms: ms
      });
    } catch (e) {
      setStatus(String(e.message || e), true);
      $('lab-results').innerHTML = '<div class="lab-empty">No result &ndash; see error above.</div>';
      lastResultRows = lastResultColumns = null;
      $('lab-export').disabled = true;
      capture('data_lab_query_error', {
        sql_truncated: sql.length > 500 ? sql.slice(0, 500) + '…' : sql,
        error: String(e.message || e).slice(0, 200)
      });
    }
  }

  function exportCsv() {
    if (!lastResultRows || !lastResultColumns) return;
    var cols = lastResultColumns;
    var rows = lastResultRows;
    var lines = [cols.map(csvCell).join(',')];
    for (var i = 0; i < rows.length; i++) {
      lines.push(rows[i].map(csvCell).join(','));
    }
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'marbleheaddata-query.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    capture('data_lab_export_csv', { rows: rows.length, columns: cols.length });
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function renderTables() {
    var meta;
    try {
      meta = db.exec('SELECT "table", description, row_count FROM _meta ORDER BY "table"');
    } catch (e) {
      $('lab-table-list').innerHTML = '<li>Could not load table list.</li>';
      return;
    }
    if (!meta.length) {
      $('lab-table-list').innerHTML = '<li>No tables found.</li>';
      return;
    }
    var rows = meta[0].values;
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i][0], desc = rows[i][1], n = rows[i][2];
      html += '<li>' +
              '<button class="lab-table-pick" type="button" data-table="' + escapeHtml(t) + '">' +
              '<code>' + escapeHtml(t) + '</code>' +
              ' <span class="lab-table-desc">' + escapeHtml(desc || '') +
              ' &middot; ' + Number(n).toLocaleString() + ' rows</span>' +
              '</button></li>';
    }
    $('lab-table-list').innerHTML = html;
  }

  function renderExamples() {
    var html = '';
    for (var i = 0; i < EXAMPLES.length; i++) {
      var e = EXAMPLES[i];
      html += '<li>' +
              '<button class="lab-example" type="button" data-example="' + i + '">' +
              escapeHtml(e.label) +
              '</button>' +
              '<span class="lab-example-note">' + escapeHtml(e.note) + '</span>' +
              '</li>';
    }
    $('lab-example-list').innerHTML = html;
  }

  function onTablePick(table) {
    $('lab-sql').value = 'SELECT * FROM ' + table + ' LIMIT 50;';
    $('lab-sql').focus();
    capture('data_lab_table_pick', { table: table });
  }

  function onExamplePick(idx) {
    var e = EXAMPLES[idx];
    if (!e) return;
    $('lab-sql').value = e.sql;
    $('lab-sql').focus();
    capture('data_lab_example_pick', { example: e.label });
  }

  async function boot() {
    setStatus('Loading SQL engine and database…');
    try {
      if (typeof initSqlJs === 'undefined') {
        throw new Error('SQL engine failed to load (check network).');
      }
      var SQL = await initSqlJs({ locateFile: function (f) { return SQL_WASM_BASE + f; } });
      var resp = await fetch(DB_URL);
      if (!resp.ok) throw new Error('Database file not found (' + resp.status + ').');
      var buf = await resp.arrayBuffer();
      db = new SQL.Database(new Uint8Array(buf));
      renderTables();
      renderExamples();
      $('lab-run').disabled = false;
      $('lab-run').textContent = 'Run';
      setStatus('Ready. Click a table or example to start.');
      capture('data_lab_loaded', { db_bytes: buf.byteLength });
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('lab-run').addEventListener('click', runQuery);
    $('lab-export').addEventListener('click', exportCsv);
    $('lab-sql').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runQuery();
      }
    });
    document.getElementById('lab-table-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-table]');
      if (btn) onTablePick(btn.getAttribute('data-table'));
    });
    document.getElementById('lab-example-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-example]');
      if (btn) onExamplePick(Number(btn.getAttribute('data-example')));
    });
    boot();
  });
})();
