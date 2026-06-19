-- Backing and reps: residents publicly back ideas on what-can-we-do.html.
-- See docs/superpowers/specs/2026-06-09-backing-and-reps-design.md (Part A).
--
-- residents.display_name already exists (0006_self_serve_verification.sql), so
-- named backing/rep reuses it; this migration only adds the engagement table.

-- Per-target engagement. v1 only writes target_type='idea'; the column exists
-- so v2 (warrant articles) and v3 (curated polls) reuse this table without
-- a migration. State is overwriting (like-button semantics), not append-only.
CREATE TABLE IF NOT EXISTS engagement (
  identity_hash TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK (target_type IN ('idea','warrant','poll')),
  target_id     TEXT NOT NULL,           -- e.g. 'idea-06', 'atm-2027-article-17'
  state         TEXT NOT NULL CHECK (state IN ('back_anon','back_named','rep')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_engagement_target ON engagement(target_type, target_id, state);
