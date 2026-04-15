-- Anonymous ballot-pick aggregation.
-- Stores full ballot combinations so we can derive per-question
-- breakdowns AND combination/convergence patterns.

CREATE TABLE IF NOT EXISTS ballot_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo TEXT NOT NULL,          -- canonical sorted key, e.g. "1A:Y,1B:Y,1C:Y,2:N"
  page TEXT NOT NULL,           -- "what-is-the-override" or "question-2-trash"
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ballot_picks_page ON ballot_picks(page);

-- One submission per IP, ever. Separate from ballot_picks so there
-- is no join path from a pick row to an identity.

CREATE TABLE IF NOT EXISTS ballot_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  submitted_at INTEGER NOT NULL
);
