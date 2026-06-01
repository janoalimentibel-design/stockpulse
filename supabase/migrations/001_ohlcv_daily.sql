BEGIN;

CREATE TABLE IF NOT EXISTS ohlcv_daily (
  ticker TEXT    NOT NULL,
  date   DATE    NOT NULL,
  open   NUMERIC NOT NULL,
  high   NUMERIC NOT NULL,
  low    NUMERIC NOT NULL,
  close  NUMERIC NOT NULL,
  volume BIGINT  NOT NULL,
  PRIMARY KEY (ticker, date)
);

ALTER TABLE ohlcv_daily DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON ohlcv_daily (date);

COMMIT;
