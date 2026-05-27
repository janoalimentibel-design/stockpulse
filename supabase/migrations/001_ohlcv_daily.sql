CREATE TABLE IF NOT EXISTS ohlcv_daily (
  ticker TEXT   NOT NULL,
  date   DATE   NOT NULL,
  open   NUMERIC,
  high   NUMERIC,
  low    NUMERIC,
  close  NUMERIC,
  volume BIGINT,
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker ON ohlcv_daily (ticker);
CREATE INDEX IF NOT EXISTS idx_ohlcv_date   ON ohlcv_daily (date);
