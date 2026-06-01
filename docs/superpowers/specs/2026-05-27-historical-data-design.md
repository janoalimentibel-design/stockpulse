# Sprint 2A — Historical Data Setup

**Date:** 2026-05-27
**Branch:** feature/historical-data

## Scope

Two deliverables:

1. **Tarea 2.1** — Supabase SQL migration for `ohlcv_daily` table
2. **Tarea 2.2** — Node.js script `scripts/download-history.js` to backfill 5 years of OHLCV data

---

## Tarea 2.1 — Migration SQL

**File:** `supabase/migrations/001_ohlcv_daily.sql`

Applied by pasting into the Supabase dashboard SQL Editor. No CLI, no deps.

```sql
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
```

---

## Tarea 2.2 — Download Script

**File:** `scripts/download-history.js`

### Environment

- Module format: CommonJS (`require`), consistent with `package.json` (no `"type": "module"`).
- Env vars loaded from `.env.local` via `dotenv` (devDependency to add).
  - `POLYGON_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_KEY`

### Input

- Ticker list: `scripts/tickers-priority.json` — JSON array of 50 ticker strings.
- Date range: `from` = today minus 5 years, `to` = today (ISO date strings `YYYY-MM-DD`).

### Polygon API call

```
GET /v2/aggs/ticker/{T}/range/1/day/{from}/{to}
  ?adjusted=true&sort=asc&limit=5000&apiKey={POLYGON_API_KEY}
```

- 5 years ≈ 1,260 trading days — well within Polygon's 5,000-result limit. One call per ticker, no pagination.
- If the response includes `next_url`, log a warning but do not fail.

### Data mapping

Polygon result fields → table columns:

| Polygon | ohlcv_daily |
|---------|-------------|
| `t` (ms epoch) | `date` (ISO date string) |
| `o` | `open` |
| `h` | `high` |
| `l` | `low` |
| `c` | `close` |
| `v` | `volume` |

### Upsert

```js
supabase.from('ohlcv_daily').upsert(rows, { onConflict: 'ticker,date' })
```

Safe to re-run: existing rows are overwritten with fresh data.

### Rate limiting

- Sleep 12,000 ms between tickers (5 req/min = 12 s/req).
- Sleep is skipped after the last ticker.

### Logging

```
[1/50] AAPL → fetching...
[1/50] AAPL → 1263 barras → OK
[2/50] MSFT → ERROR: <message> (continuando)
```

### Error handling

- Each ticker is wrapped in try/catch.
- On error: log the error message and continue to the next ticker.
- Exit code 0 regardless (partial success is acceptable for a backfill run).

---

## Dependencies

- `dotenv` — add as devDependency (`npm install --save-dev dotenv`)

---

## Files created

| Path | Purpose |
|------|---------|
| `supabase/migrations/001_ohlcv_daily.sql` | Table + indexes DDL |
| `scripts/tickers-priority.json` | 50-ticker list |
| `scripts/download-history.js` | Backfill script |

---

## How to run (after user sets up .env.local)

```bash
npm install
node scripts/download-history.js
```
