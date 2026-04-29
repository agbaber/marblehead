// Site search: opens a modal that lazy-loads Pagefind UI on first use.
// Pagefind assets ship under /pagefind/ via `npm run build` (see package.json).
// In local `npm run dev` (jekyll-only) those assets do not exist; the
// modal will show a load error rather than crash. Use `npm run preview:search`
// to test search locally end-to-end.
(function () {
  var btn = document.querySelector('.search-toggle');
  var modal = document.getElementById('search-modal');
  if (!btn || !modal) return;

  var loaded = false;
  function ensureLoaded() {
    if (loaded) return Promise.resolve();
    loaded = true;
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/pagefind/pagefind-ui.css';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = '/pagefind/pagefind-ui.js';
      script.onload = function () {
        try {
          new PagefindUI({
            element: '#search',
            showSubResults: true,
            showImages: false,
            resetStyles: false,
            translations: {
              placeholder: 'Search marbleheaddata.org',
              zero_results: 'No matches for [SEARCH_TERM]'
            }
          });
          resolve();
        } catch (e) {
          loaded = false;
          reject(e);
        }
      };
      script.onerror = function () {
        loaded = false;
        reject(new Error('pagefind-ui.js failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  function openModal() {
    ensureLoaded().then(function () {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
      var input = modal.querySelector('input[type="text"]');
      if (input) setTimeout(function () { input.focus(); }, 50);
      if (typeof posthog !== 'undefined') posthog.capture('search_opened');
    }).catch(function () {
      // Local jekyll-only dev: no /pagefind/ assets. Show a one-time hint.
      if (!modal.dataset.errShown) {
        modal.dataset.errShown = '1';
        var note = document.createElement('p');
        note.textContent = 'Search index not built. Run `npm run preview:search` locally, or wait for the PR preview.';
        note.style.cssText = 'padding:12px;color:var(--text-subtle);font-size:0.875rem;';
        modal.querySelector('#search').appendChild(note);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
    });
  }
  function closeModal() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  btn.addEventListener('click', openModal);
  modal.querySelector('.search-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openModal();
    }
  });
})();
