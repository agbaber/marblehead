# Verification Network: Pre-Ship Punch List

**Date:** 2026-04-15
**Status:** In progress

## Style / Visual

- [ ] **Dark mode status colors** -- `.status-ok`, `.status-err`, `.status-info` use hardcoded light-mode colors (green/red/blue backgrounds). Need dark-mode variants using CSS custom properties.
- [ ] **Recovery key box in dark mode** -- orange dashed border on dark bg looks harsh. Use theme-aware colors.
- [ ] **Button hover/active states** -- `.btn-primary` has no hover/focus state. Add subtle brightness shift.
- [ ] **Typeahead dropdown in dark mode** -- background/text colors need to respect `--bg`/`--c-text` properly. Currently may flash white.
- [ ] **Input focus rings** -- no visible focus indicator on inputs. Add `outline` or `box-shadow` on `:focus-visible`.
- [ ] **Invite link box** -- monospace link is hard to read on mobile. Consider truncating with ellipsis and a full-width "Copy" button.
- [ ] **Branch badge on dashboard** -- teal badge looks detached. Consider integrating into the card layout better.
- [ ] **Invitee list shows raw hash** -- `b04f39...` is meaningless to users. Show "Neighbor 1", "Neighbor 2" or nothing.
- [ ] **Consistent card spacing** -- some cards have tighter margins than others.
- [ ] **Nav on staging** -- simplified nav works for staging but production pages use the full site nav via Jekyll layout.

## UX Flow

- [ ] **Sign-in error handling** -- if passkey auth fails (user cancels, wrong device), show a friendly message instead of silent console.error.
- [ ] **Loading states** -- "Loading..." text on init is plain. Add a subtle spinner or skeleton.
- [ ] **Empty dashboard sections** -- "People you verified" section shows even when empty (0 invitees). Hide it.
- [ ] **Invite success clears form then re-renders dashboard** -- the success message disappears when dashboard refreshes. Show it persistently or use a toast.
- [ ] **Back button behavior** -- after registration, pressing back goes to the invite form with stale state. Consider `history.replaceState` to clear the hash.
- [ ] **JWT expiry** -- if JWT expires mid-session (24h), the next API call fails silently. Detect 401 and prompt re-auth.
- [ ] **Duplicate class attribute** -- `id="invitees-section" class="hidden"` has a duplicate class attr on the outer div (both `verify-section` and `hidden`). Only the first is applied.
- [ ] **Add device flow** -- uses auth-challenge endpoint (which returns a challenge for signing in, not registering). Should use a dedicated challenge or the register challenge flow.

## Copy / Microcopy

- [ ] **"Verify and create passkey"** then **"Create passkey"** -- two-step flow needs clearer language. First button: "Verify my identity". Second button: "Create passkey (Touch ID / Face ID)".
- [ ] **"Identity verified!"** -- too technical. "You're confirmed! Now save a passkey so you can sign in later."
- [ ] **Recovery key explanation** -- "If you lose access to all your devices" is scary. Softer: "This is your backup code, like a spare key. Keep it somewhere safe."
- [ ] **"People you verified"** -- "verified" sounds formal. "Your neighbors" or "People you invited".
- [ ] **"downstream"** -- technical jargon. "invited N more" or "grew the network by N".
- [ ] **Branch page empty state** -- "No branches yet" should link to verify page with context.

## Accessibility

- [ ] **aria-live regions** for status messages so screen readers announce them.
- [ ] **Focus management** after state transitions (registration -> recovery key -> dashboard).
- [ ] **Typeahead aria-role** -- needs `role="listbox"` on the `<ul>` and `role="option"` on items.
- [ ] **Button disabled states** during async operations to prevent double-clicks.

## Security

- [ ] **Rate limiting on /api/verify/register** -- currently no rate limit. An attacker could brute-force identity hashes against known invite tokens.
- [ ] **JWT_SECRET** -- must be a real secret in production, set via `wrangler secret put`.
- [ ] **Hash salt** -- `marblehead-verify-salt` is in client-side JS (visible to anyone). Consider if this is acceptable or if we need a server-side hash step.
- [ ] **Challenge replay** -- signed challenges are stateless. A challenge could theoretically be reused within the 5-minute TTL. Consider adding a nonce table.

## Pre-Production Deploy

- [ ] Apply migration 0004 to production D1
- [ ] `wrangler secret put JWT_SECRET` for production
- [ ] Seed production DB (SEED resident + genesis invite)
- [ ] Deploy worker to production
- [ ] Push front-end to branch, open PR
- [ ] Add verify/branches links to site nav (or just footer for v1?)
- [ ] Update privacy.html to cover verification data model
- [ ] Update spec with final shipped state

## Deferred (post-ship)

- [ ] Custom branch names when all 30+ themed names are in use
- [ ] Leaderboard (largest branch, most active)
- [ ] Opt-in stance sharing within branch
- [ ] Address autocomplete from full assessor data (numbers + streets)
- [ ] Branch rename vote at 100 members unlocks custom names
- [ ] Widget integration -- verified tally on every page
- [ ] Cascade revocation UI
- [ ] Recovery flow UI (use-key, inviter-initiated)
