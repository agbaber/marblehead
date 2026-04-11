-- Community pulse reactions counter.
-- One row per section. Reactions are directionless.

CREATE TABLE IF NOT EXISTS reactions (
  section_id TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL DEFAULT 0,
  count_24h INTEGER NOT NULL DEFAULT 0,
  window_24h_start INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Per-IP fixed-window rate limit state.
-- Rows with window_start older than 2 hours can be deleted lazily on write.

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  section_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, section_id, window_start)
);
