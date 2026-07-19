-- 0008_warrant_corpus.sql
-- Town Meeting warrant corpus: recurring article series and their
-- per-year instances. Facts layer only; no voting tables here.
-- Sources: data/town_meeting_results.csv (see data/DATA_CATALOG.md).

CREATE TABLE IF NOT EXISTS article_series (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('budget_line','money_article','other_article','consent')),
  first_year INTEGER,
  last_year  INTEGER,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS article_instances (
  series_slug           TEXT NOT NULL,
  meeting_year          INTEGER NOT NULL,
  meeting_type          TEXT NOT NULL DEFAULT 'annual' CHECK (meeting_type IN ('annual','special')),
  meeting_date          TEXT,
  article_number        INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  amount                REAL,
  fincom_recommendation TEXT,
  tm_result             TEXT CHECK (tm_result IN ('adopted','defeated','indefinitely_postponed','withdrawn','not_taken_up')),
  tm_vote_yes           INTEGER,
  tm_vote_no            INTEGER,
  in_effect             INTEGER,
  notes                 TEXT,
  source_doc            TEXT,
  source_url            TEXT,
  PRIMARY KEY (meeting_year, meeting_type, article_number)
);

CREATE INDEX IF NOT EXISTS idx_article_instances_series
  ON article_instances (series_slug, meeting_year);
