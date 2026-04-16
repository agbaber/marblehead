-- Neighbor Verification Network tables.

-- Verified residents. One row per adult.
CREATE TABLE IF NOT EXISTS residents (
  identity_hash TEXT PRIMARY KEY,
  invited_by TEXT,
  branch_root TEXT,
  invites_remaining INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

-- One-time invite tokens with two-sided handshake.
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  recipient_hash TEXT NOT NULL,
  consumed_by TEXT,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);

-- Recovery keys. One active key per resident, stored as hash.
CREATE TABLE IF NOT EXISTS recovery_keys (
  identity_hash TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Verified votes. One per adult per topic/section.
CREATE TABLE IF NOT EXISTS verified_votes (
  identity_hash TEXT NOT NULL,
  topic TEXT NOT NULL,
  answer TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, topic)
);

-- Branch name proposals.
CREATE TABLE IF NOT EXISTS branch_names (
  branch_root TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  proposed_at INTEGER NOT NULL,
  PRIMARY KEY (branch_root, proposed_name)
);

-- Branch name votes. One vote per resident per branch.
CREATE TABLE IF NOT EXISTS branch_name_votes (
  identity_hash TEXT NOT NULL,
  branch_root TEXT NOT NULL,
  voted_name TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, branch_root)
);
