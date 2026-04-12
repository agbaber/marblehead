/*
 * Clickable sample-ballot runtime.
 *
 * Makes the .ballot-oval buttons on sample-ballot blocks interactive so
 * readers can practice marking the ballot they'll see on June 9, 2026.
 * Enforces per-row "at most one of Yes/No marked" semantics. There is
 * no persistence, no tally, and no content reveal: clicking an oval
 * toggles its aria-pressed attribute, and the fill-in animation is
 * handled entirely by CSS (fill-opacity transition on the inner
 * <ellipse>, keyed to the button's aria-pressed state).
 *
 * Markup contract:
 *
 *   <div class="ballot-row">
 *     ...
 *     <div class="ballot-choices">
 *       <span class="ballot-choice">
 *         <span class="ballot-choice-label">Yes</span>
 *         <button type="button" class="ballot-oval"
 *                 aria-pressed="false" aria-label="Mark Yes">
 *           <svg class="ballot-oval-fill" ...>
 *             <ellipse .../>
 *           </svg>
 *         </button>
 *       </span>
 *       ... (No)
 *     </div>
 *   </div>
 *
 * Clicks anywhere on .ballot-choice (including the visible Yes/No
 * label text) are routed to the .ballot-oval inside it, which gives
 * the label text an extended tap target on mobile where the 22x14
 * oval is below the 44px WCAG recommendation.
 *
 * Pages with no .ballot-oval elements are early-returned, matching
 * the pattern used by assets/citations.js.
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
    if (!document.querySelector('.ballot-oval')) {
      return;
    }

    document.addEventListener('click', function (event) {
      var choice = event.target.closest('.ballot-choice');
      if (!choice) return;
      var row = choice.closest('.ballot-row');
      if (!row) return;
      var box = choice.querySelector('.ballot-oval');
      if (!box) return;

      var isPressed = box.getAttribute('aria-pressed') === 'true';

      if (isPressed) {
        box.setAttribute('aria-pressed', 'false');
        return;
      }

      var siblings = row.querySelectorAll('.ballot-oval[aria-pressed="true"]');
      for (var i = 0; i < siblings.length; i++) {
        siblings[i].setAttribute('aria-pressed', 'false');
      }
      box.setAttribute('aria-pressed', 'true');
    });
  });
})();
