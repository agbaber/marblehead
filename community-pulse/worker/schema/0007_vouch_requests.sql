-- Peer-vouch-on-demand: lets a non-FB resident generate a shareable link
-- that any verified neighbor can confirm to vouch for them.
-- See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

CREATE TABLE IF NOT EXISTS vouch_requests (
  token              TEXT PRIMARY KEY,
  requester_hash     TEXT NOT NULL,
  requester_name     TEXT NOT NULL,
  requester_address  TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  vouched_by         TEXT,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  resolved_at        INTEGER
);

-- Status enum (enforced in Worker handlers since SQLite ALTER doesn't
-- accept CHECK on added columns): 'pending', 'verified', 'declined', 'expired'.

-- Lookup index for the "one active request per requester" guard.
CREATE INDEX IF NOT EXISTS idx_vouch_requests_requester
  ON vouch_requests(requester_hash) WHERE status = 'pending';
