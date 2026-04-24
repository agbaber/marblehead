-- Track each user's ballot stance (yes/no on each ballot question).
-- Used for cross-tab comparisons: "of others who voted like you..."

CREATE TABLE IF NOT EXISTS ballot_stances (
  ip_hash    TEXT PRIMARY KEY,
  q1a        TEXT NOT NULL CHECK (q1a IN ('yes', 'no')),
  q1b        TEXT NOT NULL CHECK (q1b IN ('yes', 'no')),
  q1c        TEXT NOT NULL CHECK (q1c IN ('yes', 'no')),
  trash      TEXT NOT NULL CHECK (trash IN ('yes', 'no')),
  updated_at INTEGER NOT NULL DEFAULT 0
);
