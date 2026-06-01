CREATE TABLE IF NOT EXISTS narrative_feedback (
  id bigserial PRIMARY KEY,
  ticker text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS narrative_feedback_ticker_idx ON narrative_feedback (ticker);
CREATE INDEX IF NOT EXISTS narrative_feedback_created_at_idx ON narrative_feedback (created_at DESC);
