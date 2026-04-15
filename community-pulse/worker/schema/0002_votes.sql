-- Track each user's pick per topic so vote changes can decrement the old answer.
-- One row per IP hash per topic. The server is authoritative.

CREATE TABLE IF NOT EXISTS votes (
  ip_hash   TEXT NOT NULL,
  topic     TEXT NOT NULL,
  answer    TEXT NOT NULL,
  voted_at  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, topic)
);
