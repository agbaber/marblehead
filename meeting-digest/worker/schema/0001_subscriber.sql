-- Weekly board-meeting digest subscriptions.
-- One row per email.

CREATE TABLE IF NOT EXISTS subscriber (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained')),
  confirmation_token    TEXT,
  confirmation_expires  INTEGER,
  manage_token          TEXT NOT NULL,
  boards                TEXT NOT NULL,
  topics                TEXT NOT NULL,
  cadence               TEXT NOT NULL DEFAULT 'weekly',
  created_at            INTEGER NOT NULL,
  confirmed_at          INTEGER,
  unsubscribed_at       INTEGER,
  last_sent_at          INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_email ON subscriber(email);
CREATE INDEX IF NOT EXISTS idx_subscriber_status ON subscriber(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_manage_token ON subscriber(manage_token);
CREATE INDEX IF NOT EXISTS idx_subscriber_confirmation_token ON subscriber(confirmation_token);

CREATE TABLE IF NOT EXISTS delivery_log (
  id                   TEXT PRIMARY KEY,
  subscriber_id        TEXT NOT NULL,
  sent_at              INTEGER NOT NULL,
  n_meetings           INTEGER NOT NULL,
  provider_message_id  TEXT,
  status               TEXT NOT NULL CHECK (status IN ('queued','delivered','bounced','complained','failed')),
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_subscriber ON delivery_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_provider_message_id ON delivery_log(provider_message_id);
