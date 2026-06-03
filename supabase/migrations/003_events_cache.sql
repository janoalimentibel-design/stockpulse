-- Migration 003: events_cache table
-- Stores recent events per ticker (6h TTL, managed by app)
CREATE TABLE IF NOT EXISTS events_cache (
  ticker      text        PRIMARY KEY,
  data        jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events_cache ENABLE ROW LEVEL SECURITY;
