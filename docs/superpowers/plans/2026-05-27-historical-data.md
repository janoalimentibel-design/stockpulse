# Historical Data Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `ohlcv_daily` Supabase table and a Node.js backfill script that downloads 5 years of daily OHLCV data for 50 tickers from Polygon and upserts it into Supabase.

**Architecture:** A standalone SQL migration file applied via the Supabase dashboard, plus a CommonJS Node.js script that reads a ticker list, calls the Polygon aggregates API once per ticker, and upserts results into Supabase. Testable pure functions (`buildDateRange`, `mapBar`) are exported from the script for unit testing with Node's built-in test runner (no extra test framework needed).

**Tech Stack:** Node.js 18+ (native `fetch`, native test runner), `@supabase/supabase-js` (already installed), `dotenv` (devDependency to add), Polygon `/v2/aggs` endpoint.

---

### Task 1: Create branch and SQL migration

**Files:**
- Create: `supabase/migrations/001_ohlcv_daily.sql`

- [ ] **Step 1: Create and checkout the feature branch**

```bash
git checkout -b feature/historical-data
```

Expected: `Switched to a new branch 'feature/historical-data'`

- [ ] **Step 2: Create the migrations directory and SQL file**

Create `supabase/migrations/001_ohlcv_daily.sql` with this exact content:

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

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_ohlcv_daily.sql
git commit -m "feat: add ohlcv_daily migration"
```

---

### Task 2: Install dotenv and create ticker list

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `scripts/tickers-priority.json`

- [ ] **Step 1: Install dotenv as devDependency**

```bash
npm install --save-dev dotenv
```

Expected: `package.json` updated with `"dotenv": "^..."` under `devDependencies`.

- [ ] **Step 2: Create `scripts/tickers-priority.json`**

Create `scripts/tickers-priority.json` with this exact content (50 large-cap US tickers):

```json
[
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL",
  "META", "TSLA", "AVGO", "JPM", "LLY",
  "V",    "MA",   "UNH",  "XOM",  "COST",
  "JNJ",  "WMT",  "NFLX", "HD",   "BAC",
  "ABBV", "CRM",  "PG",   "AMD",  "ORCL",
  "KO",   "MRK",  "CVX",  "WFC",  "TMO",
  "ADBE", "ACN",  "PEP",  "CSCO", "MCD",
  "DIS",  "ABT",  "QCOM", "IBM",  "HON",
  "GE",   "CAT",  "AXP",  "GS",   "SPGI",
  "MDT",  "AMGN", "BKNG", "INTU", "ISRG"
]
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json scripts/tickers-priority.json
git commit -m "feat: add dotenv devDep and 50-ticker priority list"
```

---

### Task 3: TDD — buildDateRange function

**Files:**
- Create: `scripts/download-history.js` (scaffold with just `buildDateRange` + export)
- Create: `scripts/download-history.test.js`

- [ ] **Step 1: Write the failing test**

Create `scripts/download-history.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildDateRange, mapBar } = require('./download-history')

test('buildDateRange devuelve hoy y hace 5 años como YYYY-MM-DD', () => {
  const { from, to } = buildDateRange()

  const today = new Date().toISOString().split('T')[0]
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const expectedFrom = fiveYearsAgo.toISOString().split('T')[0]

  assert.equal(to, today)
  assert.equal(from, expectedFrom)
  assert.match(from, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(to, /^\d{4}-\d{2}-\d{2}$/)
})
```

- [ ] **Step 2: Create scaffold of `scripts/download-history.js` with only `buildDateRange`**

```js
'use strict'

function buildDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 5)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function mapBar(ticker, bar) {
  // implemented in Task 4
}

if (require.main === module) {
  // implemented in Task 5
}

module.exports = { buildDateRange, mapBar }
```

- [ ] **Step 3: Run test to verify `buildDateRange` passes (mapBar test will fail — that's expected)**

```bash
node --test scripts/download-history.test.js
```

Expected: `buildDateRange` test passes. `mapBar` test may not exist yet — that's fine.

- [ ] **Step 4: Commit**

```bash
git add scripts/download-history.js scripts/download-history.test.js
git commit -m "test: add buildDateRange test + scaffold"
```

---

### Task 4: TDD — mapBar function

**Files:**
- Modify: `scripts/download-history.test.js` (add mapBar test)
- Modify: `scripts/download-history.js` (implement mapBar)

- [ ] **Step 1: Add failing test for `mapBar` in `scripts/download-history.test.js`**

Append this test after the existing one:

```js
test('mapBar convierte una barra de Polygon a fila ohlcv_daily', () => {
  // 1609459200000 ms = 2021-01-01T00:00:00.000Z
  const bar = { t: 1609459200000, o: 100.5, h: 105.0, l: 99.0, c: 103.2, v: 50000000 }
  const row = mapBar('AAPL', bar)

  assert.deepEqual(row, {
    ticker: 'AAPL',
    date:   '2021-01-01',
    open:   100.5,
    high:   105.0,
    low:    99.0,
    close:  103.2,
    volume: 50000000,
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
node --test scripts/download-history.test.js
```

Expected: `mapBar` test fails (function returns `undefined`).

- [ ] **Step 3: Implement `mapBar` in `scripts/download-history.js`**

Replace the stub body of `mapBar`:

```js
function mapBar(ticker, bar) {
  return {
    ticker,
    date:   new Date(bar.t).toISOString().split('T')[0],
    open:   bar.o,
    high:   bar.h,
    low:    bar.l,
    close:  bar.c,
    volume: bar.v,
  }
}
```

- [ ] **Step 4: Run tests to confirm both pass**

```bash
node --test scripts/download-history.test.js
```

Expected output (both pass):

```
▶ buildDateRange devuelve hoy y hace 5 años como YYYY-MM-DD
  ✔ buildDateRange devuelve hoy y hace 5 años como YYYY-MM-DD
▶ mapBar convierte una barra de Polygon a fila ohlcv_daily
  ✔ mapBar convierte una barra de Polygon a fila ohlcv_daily
```

- [ ] **Step 5: Commit**

```bash
git add scripts/download-history.js scripts/download-history.test.js
git commit -m "test: add mapBar test + implement mapBar"
```

---

### Task 5: Implement full download script

**Files:**
- Modify: `scripts/download-history.js` (add all logic inside `main()`)

- [ ] **Step 1: Replace `scripts/download-history.js` with the complete implementation**

```js
'use strict'

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const tickers = require('./tickers-priority.json')

function buildDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 5)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function mapBar(ticker, bar) {
  return {
    ticker,
    date:   new Date(bar.t).toISOString().split('T')[0],
    open:   bar.o,
    high:   bar.h,
    low:    bar.l,
    close:  bar.c,
    volume: bar.v,
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchTicker(ticker, from, to, apiKey) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const data = await res.json()
  if (data.next_url) {
    console.warn(`  [warn] ${ticker}: respuesta paginada, pueden faltar datos`)
  }
  return (data.results || []).map(bar => mapBar(ticker, bar))
}

async function upsertRows(supabase, rows) {
  const { error } = await supabase
    .from('ohlcv_daily')
    .upsert(rows, { onConflict: 'ticker,date' })
  if (error) throw new Error(error.message)
}

async function main() {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY
  if (!POLYGON_API_KEY) {
    console.error('ERROR: POLYGON_API_KEY no configurada en .env.local')
    process.exit(1)
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_URL o SUPABASE_KEY no configuradas en .env.local')
    process.exit(1)
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

  const { from, to } = buildDateRange()
  console.log(`Descargando datos: ${from} → ${to}`)
  console.log(`Tickers: ${tickers.length}`)
  console.log('---')

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    const prefix = `[${i + 1}/${tickers.length}] ${ticker}`
    try {
      console.log(`${prefix} → fetching...`)
      const rows = await fetchTicker(ticker, from, to, POLYGON_API_KEY)
      await upsertRows(supabase, rows)
      console.log(`${prefix} → ${rows.length} barras → OK`)
    } catch (err) {
      console.error(`${prefix} → ERROR: ${err.message} (continuando)`)
    }
    if (i < tickers.length - 1) await sleep(12_000)
  }

  console.log('---')
  console.log('Descarga completada.')
}

if (require.main === module) main()

module.exports = { buildDateRange, mapBar }
```

- [ ] **Step 2: Run the unit tests to confirm they still pass**

```bash
node --test scripts/download-history.test.js
```

Expected: both tests pass (the `require('dotenv')` and `createClient` calls run at module load — if `.env.local` doesn't exist yet, dotenv silently continues and the exported functions still work).

- [ ] **Step 3: Commit**

```bash
git add scripts/download-history.js
git commit -m "feat: implement download-history.js backfill script"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite one more time**

```bash
node --test scripts/download-history.test.js
```

Expected: 2 tests pass, 0 failures.

- [ ] **Step 2: Dry-run sanity check (no network, no DB)**

```bash
node -e "const { buildDateRange, mapBar } = require('./scripts/download-history'); console.log(buildDateRange()); console.log(mapBar('TEST', { t: 1609459200000, o: 1, h: 2, l: 0.5, c: 1.5, v: 100 }));"
```

Expected output (dates will reflect today and 5 years ago):

```
{ from: '2021-05-27', to: '2026-05-27' }
{ ticker: 'TEST', date: '2021-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }
```

- [ ] **Step 3: Remind user to apply the SQL migration before running the script**

The SQL file `supabase/migrations/001_ohlcv_daily.sql` must be pasted and executed in the Supabase dashboard SQL Editor before running `node scripts/download-history.js`.

- [ ] **Step 4: Remind user to create `.env.local`**

`.env.local` needs these three lines before running the script:

```
POLYGON_API_KEY=your_polygon_key
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
```

---

## Spec coverage check

| Spec requirement | Covered by |
|---|---|
| Tabla ohlcv_daily con schema exacto | Task 1 |
| Primary key (ticker, date) | Task 1 |
| Indexes en (ticker) y (date) | Task 1 |
| Lee 50 tickers de tickers-priority.json | Task 2, Task 5 |
| Llama Polygon /v2/aggs/ticker/{T}/range/1/day/{from}/{to} | Task 5 |
| from = hace 5 años, to = hoy | Task 3 (TDD buildDateRange) |
| Rate limit 5 req/min (sleep 12s) | Task 5 |
| Upsert en ohlcv_daily | Task 5 |
| Loguea progreso ticker X de 50 | Task 5 |
| Si falla un ticker, loguea y continúa | Task 5 |
| Branch feature/historical-data | Task 1 |
