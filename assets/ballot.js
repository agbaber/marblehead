/*
 * Clickable sample-ballot runtime.
 *
 * Makes the .ballot-box buttons on sample-ballot blocks interactive so
 * readers can practice marking the ballot they'll see on June 9, 2026.
 * Enforces per-row "at most one of Yes/No marked" semantics. There is
 * no persistence, no tally, and no content reveal: clicking a box
 * toggles its aria-pressed attribute, and the X drawing is handled
 * entirely by CSS (stroke-dashoffset transition keyed to aria-pressed).
 *
 * Markup contract:
 *
 *   <div class="ballot-row">
 *     ...
 *     <div class="ballot-choices">
 *       <span class="ballot-choice">
 *         <button type="button" class="ballot-box"
 *                 aria-pressed="false" aria-label="Mark Yes">
 *           <svg class="ballot-box-x" ...>...</svg>
 *         </button>
 *         Yes
 *       </span>
 *       ... (No)
 *     </div>
 *   </div>
 *
 * Clicks anywhere on .ballot-choice (including the visible "Yes"/"No"
 * label text) are routed to the .ballot-box inside it, which gives the
 * label text an extended tap target on mobile where the 16px box is
 * below the 44px WCAG recommendation.
 *
 * Pages with no .ballot-box elements are early-returned, matching the
 * pattern used by assets/citations.js.
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
    if (!document.querySelector('.ballot-box')) {
      return;
    }

    document.addEventListener('click', function (event) {
      var choice = event.target.closest('.ballot-choice');
      if (!choice) return;
      var row = choice.closest('.ballot-row');
      if (!row) return;
      var box = choice.querySelector('.ballot-box');
      if (!box) return;

      var isPressed = box.getAttribute('aria-pressed') === 'true';

      if (isPressed) {
        box.setAttribute('aria-pressed', 'false');
        return;
      }

      var siblings = row.querySelectorAll('.ballot-box[aria-pressed="true"]');
      for (var i = 0; i < siblings.length; i++) {
        siblings[i].setAttribute('aria-pressed', 'false');
      }
      box.setAttribute('aria-pressed', 'true');
    });
  });
})();
