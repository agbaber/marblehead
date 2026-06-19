/* /browse/ list-view runtime.
 *
 * Loads sql.js + the SQLite once per session, then renders
 * filterable / sortable / searchable tables for each list-view page.
 *
 * Each /browse/<entity>/ page calls Browse.renderListView(config) with
 * its entity config (columns, filters, sort, search columns).
 *
 * IIFE pattern matches the rest of the site's vanilla-JS conventions
 * (see assets/explore.js, assets/ballot.js).
 */
(function () {
  var SQLJS_URL = "https://sql.js.org/dist/sql-wasm.js";
  var SQLJS_WASM = "https://sql.js.org/dist/sql-wasm.wasm";
  var DB_URL = "/assets/data/marbleheaddata.sqlite";

  var dbPromise = null;  // cached across in-tab navigation

  function ensureSqlJs() {
    if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = SQLJS_URL;
      s.onload = function () { resolve(window.initSqlJs); };
      s.onerror = function () { reject(new Error("sql.js script failed to load")); };
      document.head.appendChild(s);
    });
  }

  function loadDb() {
    if (dbPromise) return dbPromise;
    dbPromise = ensureSqlJs().then(function (initSqlJs) {
      return Promise.all([
        initSqlJs({ locateFile: function () { return SQLJS_WASM; } }),
        fetch(DB_URL).then(function (r) {
          if (!r.ok) throw new Error("DB fetch failed: " + r.status);
          return r.arrayBuffer();
        }),
      ]);
    }).then(function (pair) {
      var SQL = pair[0];
      var buf = pair[1];
      return new SQL.Database(new Uint8Array(buf));
    });
    return dbPromise;
  }

  /* Format helpers. */
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "";
    return "$" + Number(n).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtMoneyRound(n) {
    if (n == null || isNaN(n)) return "";
    return "$" + Math.round(Number(n)).toLocaleString();
  }
  function fmtText(s) { return s == null ? "" : String(s); }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* Slugify a string: lowercase, non-alphanumerics to hyphens, collapsed. */
  function slugify(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* Build a WHERE clause + binding list from active filters and the
     current search term. Returns { sql: "...", params: [...] }. */
  function buildWhere(config, state) {
    var clauses = [];
    var params = [];
    // Filter chips.
    config.filters.forEach(function (filter) {
      var selected = (state.filters[filter.column] || []).slice();
      if (selected.length === 0) return;
      // Multi-select: column IN (?, ?, ...). Single-select: column = ?.
      var qmarks = selected.map(function () { return "?"; }).join(", ");
      clauses.push('"' + filter.column + '" IN (' + qmarks + ')');
      params.push.apply(params, selected);
    });
    // Search term.
    var term = (state.search || "").trim();
    if (term && config.searchColumns && config.searchColumns.length) {
      var likes = config.searchColumns.map(function (c) {
        return '"' + c + '" LIKE ?';
      });
      clauses.push("(" + likes.join(" OR ") + ")");
      var pat = "%" + term + "%";
      config.searchColumns.forEach(function () { params.push(pat); });
    }
    return {
      sql: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
      params: params,
    };
  }

  /* Render the table body from query results. */
  function renderRows(config, rows) {
    var tbody = document.querySelector(".browse-table tbody");
    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="' + config.columns.length +
        '" class="browse-status">No rows match.</td></tr>';
      return;
    }
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html += "<tr>";
      for (var j = 0; j < config.columns.length; j++) {
        var col = config.columns[j];
        var value = row[col.column];
        var formatted;
        if (col.format === "money") formatted = fmtMoney(value);
        else if (col.format === "moneyRound") formatted = fmtMoneyRound(value);
        else formatted = escapeHtml(fmtText(value));
        var classes = [];
        if (col.format === "money" || col.format === "moneyRound") classes.push("is-numeric");
        if (col.format === "date") classes.push("is-date");
        var cell;
        if (col.linkColumn && row[col.linkColumn]) {
          cell = '<a href="' + escapeHtml(row[col.linkColumn]) + '">' + formatted + "</a>";
        } else if (col.linkTemplate && value != null && value !== "") {
          var href = col.linkTemplate.replace(/\{slug\}/g, slugify(value));
          cell = '<a href="' + escapeHtml(href) + '">' + formatted + "</a>";
        } else {
          cell = formatted;
        }
        html += '<td class="' + classes.join(" ") + '">' + cell + "</td>";
      }
      html += "</tr>";
    }
    tbody.innerHTML = html;
  }

  /* Render filter chips. Returns an array of {column, value, el} pairs
     so the event handler can wire up active-state toggling. */
  function renderFilters(config, state, onChange) {
    var wrap = document.querySelector(".browse-filters");
    if (!wrap) return;
    wrap.innerHTML = "";
    config.filters.forEach(function (filter) {
      var group = document.createElement("div");
      group.className = "browse-filter-group";
      var label = document.createElement("span");
      label.className = "browse-filter-label";
      label.textContent = filter.label + ":";
      group.appendChild(label);
      filter.values.forEach(function (value) {
        var chip = document.createElement("button");
        chip.className = "browse-chip";
        chip.type = "button";
        chip.dataset.column = filter.column;
        chip.dataset.value = value;
        chip.textContent = value;
        if ((state.filters[filter.column] || []).indexOf(value) >= 0) {
          chip.classList.add("is-active");
        }
        chip.addEventListener("click", function () {
          var arr = state.filters[filter.column] || [];
          if (filter.multi === false) {
            // Single-select: toggle, replacing.
            state.filters[filter.column] = arr.indexOf(value) >= 0 ? [] : [value];
          } else {
            // Multi-select: toggle this value within the array.
            var idx = arr.indexOf(value);
            if (idx >= 0) arr.splice(idx, 1); else arr.push(value);
            state.filters[filter.column] = arr;
          }
          onChange();
        });
        group.appendChild(chip);
      });
      wrap.appendChild(group);
    });
  }

  /* Wire up sort on column headers. */
  function renderSortHeaders(config, state, onChange) {
    var thead = document.querySelector(".browse-table thead tr");
    if (!thead) return;
    thead.innerHTML = "";
    config.columns.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      if (state.sortColumn === col.column) {
        th.classList.add(state.sortDesc ? "is-sorted-desc" : "is-sorted-asc");
      }
      th.addEventListener("click", function () {
        if (state.sortColumn === col.column) {
          state.sortDesc = !state.sortDesc;
        } else {
          state.sortColumn = col.column;
          state.sortDesc = (col.defaultSort === "desc") || false;
        }
        onChange();
      });
      thead.appendChild(th);
    });
  }

  /* Debounce. */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* Run the query and re-render. */
  function runQuery(db, config, state) {
    var where = buildWhere(config, state);
    var orderBy = "";
    if (state.sortColumn) {
      orderBy = ' ORDER BY "' + state.sortColumn + '" ' +
        (state.sortDesc ? "DESC" : "ASC");
    }
    var limit = state.pageSize ? " LIMIT " + (state.pageSize * state.pages) : "";
    var sql =
      "SELECT * FROM \"" + config.table + "\"" + where.sql + orderBy + limit;
    var stmt = db.prepare(sql);
    stmt.bind(where.params);
    var rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    renderRows(config, rows);
    // Update the row count label.
    var countEl = document.querySelector(".browse-row-count");
    if (countEl) {
      // Total available (no limit) for the count display.
      var countSql =
        'SELECT COUNT(*) AS n FROM "' + config.table + '"' + where.sql;
      var cstmt = db.prepare(countSql);
      cstmt.bind(where.params);
      cstmt.step();
      var total = cstmt.getAsObject().n;
      cstmt.free();
      countEl.textContent = rows.length + " of " + total + " rows";
    }
  }

  function showStatus(msg) {
    var wrap = document.querySelector(".browse-table-wrap");
    if (!wrap) return;
    wrap.innerHTML = '<div class="browse-status">' + escapeHtml(msg) + "</div>";
  }

  /* Public API: render a list view based on config. */
  function renderListView(config) {
    showStatus("Loading data...");
    loadDb().then(function (db) {
      // Restore the table skeleton if we replaced it with a status div.
      var wrap = document.querySelector(".browse-table-wrap");
      if (wrap && !wrap.querySelector("table")) {
        wrap.innerHTML =
          '<table class="browse-table"><thead><tr></tr></thead>' +
          '<tbody></tbody></table>';
      }
      var state = {
        filters: {},
        search: "",
        sortColumn: config.defaultSortColumn || null,
        sortDesc: config.defaultSortDesc !== false,
        pageSize: config.pageSize || 0,
        pages: 1,
      };

      // Fill in dynamic filter values from the DB.
      config.filters.forEach(function (filter) {
        if (filter.valuesFrom === "distinct") {
          var stmt;
          if (filter.topN) {
            // Top-N by row count, descending.
            stmt = db.prepare(
              'SELECT "' + filter.column + '" AS v, COUNT(*) AS c FROM "' +
              config.table + '" WHERE "' + filter.column +
              '" IS NOT NULL GROUP BY "' + filter.column +
              '" ORDER BY c DESC LIMIT ' + filter.topN
            );
          } else {
            // All distinct values, alphabetical.
            stmt = db.prepare(
              'SELECT DISTINCT "' + filter.column + '" AS v FROM "' +
              config.table + '" WHERE "' + filter.column +
              '" IS NOT NULL ORDER BY "' + filter.column + '"'
            );
          }
          var vals = [];
          while (stmt.step()) vals.push(stmt.getAsObject().v);
          stmt.free();
          filter.values = vals;
        }
      });

      function refresh() {
        renderSortHeaders(config, state, refresh);
        renderFilters(config, state, refresh);
        runQuery(db, config, state);
      }
      refresh();

      // Wire up the search input.
      var searchInput = document.querySelector(".browse-search");
      if (searchInput) {
        var onInput = debounce(function () {
          state.search = searchInput.value;
          refresh();
        }, 200);
        searchInput.addEventListener("input", onInput);
      }

      // Wire up the "Load more" button.
      var loadMoreBtn = document.querySelector(".browse-load-more");
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", function () {
          state.pages += 1;
          runQuery(db, config, state);
        });
      }
    }).catch(function (err) {
      showStatus("Couldn't load the database. Reload to try again. (" + err.message + ")");
    });
  }

  window.Browse = { renderListView: renderListView };
})();
