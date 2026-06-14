-- Self-serve verification: FB-authed residents + private parcel-owner table.
-- See docs/superpowers/specs/2026-06-14-self-serve-verification-design.md

-- Extend residents to support multiple auth/claim paths and FB identity.
-- All defaults preserve the behavior of existing invite-vouched residents.
ALTER TABLE residents ADD COLUMN auth_source     TEXT    NOT NULL DEFAULT 'invite';
ALTER TABLE residents ADD COLUMN claim_source    TEXT    NOT NULL DEFAULT 'vouched';
ALTER TABLE residents ADD COLUMN display_name    TEXT;
ALTER TABLE residents ADD COLUMN public_identity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE residents ADD COLUMN fb_user_id      TEXT;
ALTER TABLE residents ADD COLUMN fb_profile_url  TEXT;
CREATE INDEX IF NOT EXISTS idx_residents_fb_user_id ON residents(fb_user_id);

-- Private. Owner names are PII. NEVER read by any GET endpoint.
-- Rebuilt at deploy time from the gitignored parcels_full.csv via
-- scripts/sync_parcel_owners.mjs.
CREATE TABLE IF NOT EXISTS parcel_owners (
  address_normalized TEXT PRIMARY KEY,
  owner_name         TEXT NOT NULL,
  parcel_id          TEXT,
  fy                 INTEGER,
  updated_at         INTEGER NOT NULL
);
