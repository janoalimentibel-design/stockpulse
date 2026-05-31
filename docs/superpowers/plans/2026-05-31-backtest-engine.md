# Backtest Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el motor de backtesting de 3 setups técnicos (Golden Cross, RSI Oversold, MACD Bull), exponerlos vía `/api/backtest/[ticker]`, mostrarlos en un componente `BacktestSection` en la página principal, y agregar el cron de actualización diaria incremental.

**Architecture:** Tres módulos ESM puros en `lib/backtest/` (una función por archivo, sin dependencias entre ellos). El API route los llama con datos de Supabase. El componente React los consume con `useEffect + fetch`. El cron route llama a Polygon por el último día y upsertea en Supabase.

**Tech Stack:** Next.js 14 App Router, ESM, Supabase JS client (ya instalado), Tailwind CSS, Node.js 18+ native test runner (`node:test`), Polygon API.

---

## Archivos que se crean/modifican

| Path | Acción |
|---|---|
| `lib/backtest/golden-cross.js` | Crear |
| `lib/backtest/rsi-oversold.js` | Crear |
| `lib/backtest/macd-bull.js` | Crear |
| `__tests__/backtest/golden-cross.test.mjs` | Crear |
| `__tests__/backtest/rsi-oversold.test.mjs` | Crear |
| `__tests__/backtest/macd-bull.test.mjs` | Crear |
| `app/api/backtest/[ticker]/route.js` | Crear |
| `components/BacktestSection.js` | Crear |
| `app/page.js` | Modificar (agregar BacktestSection) |
| `app/api/cron/daily/route.js` | Crear |

---

## Task 1: Crear branch feature/backtest-engine

- [ ] **Step 1: Crear y cambiar al branch**

```bash
git checkout -b feature/backtest-engine
```

Expected: `Switched to a new branch 'feature/backtest-engine'`

---

## Task 2: Golden Cross — TDD

**Files:**
- Create: `lib/backtest/golden-cross.js`
- Create: `__tests__/backtest/golden-cross.test.mjs`

**Qué hace:** Detecta cruces de MA50 > MA200 en datos históricos. Para cada cruce calcula el retorno a 30 y 60 barras de trading.

### Señal: `ma50[i] > ma200[i]` AND `ma50[i-1] <= ma200[i-1]`
### Warm-up mínimo: 201 barras (necesita [i-1] con i=200)
### Retornos: `(close[i+N] - close[i]) / close[i] * 100`, null si i+N >= length

- [ ] **Step 1: Crear directorio de tests y escribir el test**

```bash
mkdir -p __tests__/backtest
```

Crear `__tests__/backtest/golden-cross.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goldenCross } from '../../lib/backtest/golden-cross.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = goldenCross([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (200 bars) returns zero result', () => {
  const r = goldenCross(makeOHLCV(Array(200).fill(100)))
  assert.equal(r.totalCount, 0)
  assert.equal(r.occurrences.length, 0)
})

test('detects golden cross and computes returns correctly', () => {
  // bars 0-199: close=100 → MA50=100, MA200=100 (equal, no cross yet)
  // bar 200: close=200 → MA50=(49×100+200)/50=102, MA200=(199×100+200)/200=100.5 → CROSS
  // bars 201-260: close=220 → return30d=(220-200)/200×100=10.0, return60d=10.0
  const closes = [...Array(200).fill(100), 200, ...Array(60).fill(220)]
  const arr = makeOHLCV(closes)  // 261 bars total
  const r = goldenCross(arr)

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].signalPrice, 200)
  assert.equal(r.occurrences[0].return30d, 10.0)
  assert.equal(r.occurrences[0].return60d, 10.0)
  assert.equal(r.winsCount, 1)
  assert.equal(r.avgReturn30d, 10.0)
  assert.ok(r.lastOccurrence, 'lastOccurrence debe ser una fecha')
})

test('signal at end of array has null returns and does not count as win', () => {
  // 201 bars: crossover at bar 200, no bars left for 30d/60d returns
  const closes = [...Array(200).fill(100), 200]
  const r = goldenCross(makeOHLCV(closes))

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].return30d, null)
  assert.equal(r.occurrences[0].return60d, null)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
})
```

- [ ] **Step 2: Correr el test para verificar que falla (archivo no existe)**

```bash
node --test __tests__/backtest/golden-cross.test.mjs
```

Expected: Error `Cannot find module '../../lib/backtest/golden-cross.js'`

- [ ] **Step 3: Crear `lib/backtest/golden-cross.js`**

```bash
mkdir -p lib/backtest
```

Crear `lib/backtest/golden-cross.js`:

```js
function ma(closes, i, period) {
  let sum = 0
  for (let j = i - period + 1; j <= i; j++) sum += closes[j]
  return sum / period
}

function summarize(occurrences) {
  const totalCount = occurrences.length
  const withReturn = occurrences.filter(o => o.return30d !== null)
  const winsCount = withReturn.filter(o => o.return30d > 0).length
  const avgReturn30d = withReturn.length > 0
    ? parseFloat((withReturn.reduce((s, o) => s + o.return30d, 0) / withReturn.length).toFixed(2))
    : null
  const lastOccurrence = totalCount > 0 ? occurrences[totalCount - 1].date : null
  return { occurrences, totalCount, winsCount, avgReturn30d, lastOccurrence }
}

export function goldenCross(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 201) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length
  const occurrences = []

  for (let i = 200; i < n; i++) {
    const ma50  = ma(closes, i,     50)
    const ma200 = ma(closes, i,     200)
    const ma50p = ma(closes, i - 1, 50)
    const ma200p = ma(closes, i - 1, 200)
    if (ma50p <= ma200p && ma50 > ma200) {
      const signalPrice = closes[i]
      const return30d = i + 30 < n
        ? parseFloat(((closes[i + 30] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      const return60d = i + 60 < n
        ? parseFloat(((closes[i + 60] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      occurrences.push({ date: ohlcvArray[i].date, signalPrice, return30d, return60d })
    }
  }
  return summarize(occurrences)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
node --test __tests__/backtest/golden-cross.test.mjs
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/backtest/golden-cross.js __tests__/backtest/golden-cross.test.mjs
git commit -m "$(cat <<'EOF'
feat: golden cross backtest module + tests (Task 2.3)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: RSI Oversold — TDD

**Files:**
- Create: `lib/backtest/rsi-oversold.js`
- Create: `__tests__/backtest/rsi-oversold.test.mjs`

**Qué hace:** Detecta el momento en que RSI cruza de < 30 a >= 30 (salida de zona sobrevendida). Usa Wilder smoothing para la serie RSI.

### Señal: `rsi[i-1] < 30` AND `rsi[i] >= 30`
### Warm-up mínimo: 16 barras (primera RSI válida en índice 14, necesitamos índice i-1 >= 14 → i >= 15 → necesita barra 15 → 16 barras)

- [ ] **Step 1: Escribir el test**

Crear `__tests__/backtest/rsi-oversold.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rsiOversold } from '../../lib/backtest/rsi-oversold.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = rsiOversold([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (15 bars) returns zero result', () => {
  const r = rsiOversold(makeOHLCV(Array(15).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('flat prices produce no RSI signals', () => {
  // All closes = 100 → all diffs = 0 → avgLoss = 0 → RSI = 100 always, never below 30
  const r = rsiOversold(makeOHLCV(Array(100).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('detects RSI exit from oversold and computes returns', () => {
  // bars 0-14: [100,99,...,86] — 14 consecutive drops of 1
  //   → RSI[14] = 0 (avgGain=0, avgLoss=1) — in oversold
  // bar 15: close=100 → diff=+14 → RSI[15] ≈ 51.85 → exits oversold
  // bars 16-75: close=110 — for return computation
  //   → signalPrice=100, return30d=(110-100)/100×100=10.0
  const closes = [
    100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86,
    100,
    ...Array(60).fill(110),
  ]
  const arr = makeOHLCV(closes)  // 76 bars
  const r = rsiOversold(arr)

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].signalPrice, 100)
  assert.equal(r.occurrences[0].return30d, 10.0)
  assert.equal(r.occurrences[0].return60d, 10.0)
  assert.equal(r.winsCount, 1)
  assert.equal(r.avgReturn30d, 10.0)
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
node --test __tests__/backtest/rsi-oversold.test.mjs
```

Expected: Error `Cannot find module '../../lib/backtest/rsi-oversold.js'`

- [ ] **Step 3: Crear `lib/backtest/rsi-oversold.js`**

Crear `lib/backtest/rsi-oversold.js`:

```js
function rsiArray(closes, period = 14) {
  if (closes.length <= period) return closes.map(() => null)
  const result = []
  for (let i = 0; i < period; i++) result.push(null)

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += -diff
  }
  avgGain /= period
  avgLoss /= period
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return result
}

function summarize(occurrences) {
  const totalCount = occurrences.length
  const withReturn = occurrences.filter(o => o.return30d !== null)
  const winsCount = withReturn.filter(o => o.return30d > 0).length
  const avgReturn30d = withReturn.length > 0
    ? parseFloat((withReturn.reduce((s, o) => s + o.return30d, 0) / withReturn.length).toFixed(2))
    : null
  const lastOccurrence = totalCount > 0 ? occurrences[totalCount - 1].date : null
  return { occurrences, totalCount, winsCount, avgReturn30d, lastOccurrence }
}

export function rsiOversold(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 16) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length
  const rsi = rsiArray(closes)
  const occurrences = []

  for (let i = 1; i < n; i++) {
    if (rsi[i - 1] === null || rsi[i] === null) continue
    if (rsi[i - 1] < 30 && rsi[i] >= 30) {
      const signalPrice = closes[i]
      const return30d = i + 30 < n
        ? parseFloat(((closes[i + 30] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      const return60d = i + 60 < n
        ? parseFloat(((closes[i + 60] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      occurrences.push({ date: ohlcvArray[i].date, signalPrice, return30d, return60d })
    }
  }
  return summarize(occurrences)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
node --test __tests__/backtest/rsi-oversold.test.mjs
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/backtest/rsi-oversold.js __tests__/backtest/rsi-oversold.test.mjs
git commit -m "$(cat <<'EOF'
feat: RSI oversold backtest module + tests (Task 2.4)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: MACD Bull — TDD

**Files:**
- Create: `lib/backtest/macd-bull.js`
- Create: `__tests__/backtest/macd-bull.test.mjs`

**Qué hace:** Detecta cruces alcistas de la línea MACD sobre la señal. Implementa EMA9 real de la línea MACD (no la aproximación de `lib/indicators.js`).

### Señal: `macdLine[i] > signalLine[i]` AND `macdLine[i-1] <= signalLine[i-1]`
### Warm-up: EMA26 válida en índice 25, EMA9(MACD) válida en índice 33. Para detectar cruce necesitamos signal[i] y signal[i-1] no-null → primer cruce posible en índice 34 → mínimo 35 barras.

- [ ] **Step 1: Escribir el test**

Crear `__tests__/backtest/macd-bull.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { macdBull } from '../../lib/backtest/macd-bull.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = macdBull([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (34 bars) returns zero result', () => {
  const r = macdBull(makeOHLCV(Array(34).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('flat prices produce no MACD crossovers', () => {
  // All closes = 100 → EMA12=EMA26=100 → MACD=0 → signal=0
  // macdLine[i] > signalLine[i] is 0>0=false → no crossover
  const r = macdBull(makeOHLCV(Array(100).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('trend reversal produces at least one MACD bull crossover', () => {
  // 50 bars declining (100→51), then 50 bars at 200
  // MACD (fast EMA) will recover faster than signal, producing crossover
  const closes = [
    ...Array.from({ length: 50 }, (_, i) => 100 - i),
    ...Array(50).fill(200),
  ]
  const r = macdBull(makeOHLCV(closes))

  assert.ok(r.totalCount >= 1, 'debe detectar al menos un cruce MACD alcista')
  assert.ok(r.occurrences.every(o => typeof o.date === 'string'), 'todas las ocurrencias tienen date')
  assert.ok(r.occurrences.every(o => typeof o.signalPrice === 'number'), 'todas tienen signalPrice numérico')
  assert.ok(typeof r.totalCount === 'number')
  assert.ok(typeof r.winsCount === 'number')
  assert.ok(r.winsCount <= r.totalCount)
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
node --test __tests__/backtest/macd-bull.test.mjs
```

Expected: Error `Cannot find module '../../lib/backtest/macd-bull.js'`

- [ ] **Step 3: Crear `lib/backtest/macd-bull.js`**

Crear `lib/backtest/macd-bull.js`:

```js
function emaArray(values, period) {
  const result = new Array(values.length).fill(null)
  const start = values.findIndex(v => v !== null)
  if (start === -1 || values.length - start < period) return result

  const k = 2 / (period + 1)
  let sum = 0
  for (let i = start; i < start + period; i++) sum += values[i]

  const firstIdx = start + period - 1
  result[firstIdx] = sum / period
  let ema = result[firstIdx]

  for (let i = firstIdx + 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

function summarize(occurrences) {
  const totalCount = occurrences.length
  const withReturn = occurrences.filter(o => o.return30d !== null)
  const winsCount = withReturn.filter(o => o.return30d > 0).length
  const avgReturn30d = withReturn.length > 0
    ? parseFloat((withReturn.reduce((s, o) => s + o.return30d, 0) / withReturn.length).toFixed(2))
    : null
  const lastOccurrence = totalCount > 0 ? occurrences[totalCount - 1].date : null
  return { occurrences, totalCount, winsCount, avgReturn30d, lastOccurrence }
}

export function macdBull(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 35) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length

  const ema12 = emaArray(closes, 12)
  const ema26 = emaArray(closes, 26)
  const macdLine = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null
  )
  const signalLine = emaArray(macdLine, 9)

  const occurrences = []
  for (let i = 1; i < n; i++) {
    if (macdLine[i - 1] === null || signalLine[i - 1] === null) continue
    if (macdLine[i] === null || signalLine[i] === null) continue
    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) {
      const signalPrice = closes[i]
      const return30d = i + 30 < n
        ? parseFloat(((closes[i + 30] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      const return60d = i + 60 < n
        ? parseFloat(((closes[i + 60] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      occurrences.push({ date: ohlcvArray[i].date, signalPrice, return30d, return60d })
    }
  }
  return summarize(occurrences)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
node --test __tests__/backtest/macd-bull.test.mjs
```

Expected: 4 tests pass, 0 failures.

- [ ] **Step 5: Correr todos los tests juntos**

```bash
node --test __tests__/backtest/golden-cross.test.mjs __tests__/backtest/rsi-oversold.test.mjs __tests__/backtest/macd-bull.test.mjs
```

Expected: 12 tests pass, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add lib/backtest/macd-bull.js __tests__/backtest/macd-bull.test.mjs
git commit -m "$(cat <<'EOF'
feat: MACD bull backtest module + tests (Task 2.5)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: API Endpoint `/api/backtest/[ticker]`

**Files:**
- Create: `app/api/backtest/[ticker]/route.js`

**Qué hace:** GET route que lee datos de Supabase para el ticker, llama a los 3 setups y retorna los resultados combinados.

**Nota:** `supabase` es el cliente singleton de `lib/supabase.js`. Las funciones de backtest son síncronas, el `Promise.all` es por uniformidad.

- [ ] **Step 1: Crear la ruta**

```bash
mkdir -p app/api/backtest/\[ticker\]
```

Crear `app/api/backtest/[ticker]/route.js`:

```js
import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'
import { goldenCross } from '@/lib/backtest/golden-cross'
import { rsiOversold } from '@/lib/backtest/rsi-oversold'
import { macdBull } from '@/lib/backtest/macd-bull'

export async function GET(request, { params }) {
  try {
    const ticker = validateTicker(params.ticker)
    if (!ticker) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    if (!supabase) return Response.json({ error: 'Base de datos no configurada.' }, { status: 500 })

    const { data, error } = await supabase
      .from('ohlcv_daily')
      .select('date, open, high, low, close, volume')
      .eq('ticker', ticker)
      .order('date', { ascending: true })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      return Response.json({ error: 'Sin datos históricos para este ticker.' }, { status: 404 })
    }

    const [gc, rsi, macd] = await Promise.all([
      Promise.resolve(goldenCross(data, ticker)),
      Promise.resolve(rsiOversold(data, ticker)),
      Promise.resolve(macdBull(data, ticker)),
    ])

    return Response.json({
      ticker,
      dataPoints: data.length,
      fromDate: data[0].date,
      toDate: data[data.length - 1].date,
      setups: {
        goldenCross: gc,
        rsiOversold: rsi,
        macdBull: macd,
      },
    })
  } catch (err) {
    console.error('[backtest]', err?.message)
    return Response.json({ error: 'Error al calcular backtesting.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar que `lib/validate.js` tiene `validateTicker`**

```bash
grep -n 'validateTicker' lib/validate.js
```

Expected: aparece `export function validateTicker` o similar. Si no existe, usar:
```js
function validateTicker(t) {
  if (!t || typeof t !== 'string') return null
  const clean = t.trim().toUpperCase()
  return /^[A-Z]{1,5}$/.test(clean) ? clean : null
}
```

- [ ] **Step 3: Verificar la ruta manualmente (requiere dev server y Supabase configurado)**

```bash
# Solo si el servidor está corriendo y hay datos en ohlcv_daily
curl http://localhost:3000/api/backtest/AAPL | head -c 500
```

Expected (con datos en DB): JSON con `ticker`, `dataPoints`, `setups.goldenCross`, etc.
Expected (sin datos): `{"error":"Sin datos históricos para este ticker."}`

- [ ] **Step 4: Commit**

```bash
git add app/api/backtest/
git commit -m "$(cat <<'EOF'
feat: GET /api/backtest/[ticker] endpoint (Task 2.7)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: BacktestSection component

**Files:**
- Create: `components/BacktestSection.js`
- Modify: `app/page.js`

**Qué hace:** Componente cliente que fetcha `/api/backtest/[ticker]` y muestra las estadísticas históricas de los 3 setups con etiquetado honesto (sin lenguaje predictivo). Se integra en `app/page.js` dentro del bloque `hasResults`.

- [ ] **Step 1: Crear `components/BacktestSection.js`**

```js
'use client'
import { useState, useEffect } from 'react'

const SETUPS = {
  goldenCross: { name: 'Golden Cross',     desc: 'MA50 cruza sobre MA200' },
  rsiOversold: { name: 'RSI Sobrevendido', desc: 'Salida de zona RSI < 30' },
  macdBull:    { name: 'MACD Alcista',     desc: 'MACD cruza sobre señal' },
}

function formatDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SetupCard({ label, data }) {
  const winRate = data && data.totalCount > 0
    ? Math.round(data.winsCount / data.totalCount * 100)
    : null

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>{label.name}</p>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>{label.desc}</p>
      </div>
      {!data ? (
        <div className="animate-pulse h-16 rounded" style={{ background: 'var(--bg3)' }} />
      ) : data.totalCount === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text3)' }}>Sin señales en el período analizado</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text2)' }}>
            {data.totalCount} {data.totalCount === 1 ? 'vez' : 'veces'} en 5 años
          </p>
          {data.lastOccurrence && (
            <p className="text-xs" style={{ color: 'var(--text3)' }}>
              Última: {formatDate(data.lastOccurrence)}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
            Subió en 30 días:{' '}
            <span className="font-semibold" style={{ color: 'var(--text1)' }}>
              {data.winsCount} de {data.totalCount} ({winRate}%)
            </span>
          </p>
          {data.avgReturn30d !== null && (
            <p className="text-xs" style={{ color: data.avgReturn30d >= 0 ? 'var(--green)' : 'var(--red)' }}>
              Ret. prom. histórico 30d: {data.avgReturn30d > 0 ? '+' : ''}{data.avgReturn30d}%
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function BacktestSection({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    fetch(`/api/backtest/${encodeURIComponent(ticker)}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text1)' }}>
          Señales técnicas históricas
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          Describe el comportamiento histórico del precio luego de estas condiciones técnicas.
          No predice resultados futuros.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(SETUPS).map(([key, label]) => (
          <SetupCard
            key={key}
            label={label}
            data={loading ? null : (data?.setups?.[key] ?? { totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null })}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Agregar BacktestSection en `app/page.js`**

Abrir `app/page.js`. Localizar el bloque `hasResults` (alrededor de la línea 161). Agregar el import en la sección de imports y el componente después del `ManualForm`.

**Import a agregar** (junto a los otros imports al inicio):
```js
import BacktestSection from '../components/BacktestSection'
```

**Bloque a modificar** (la línea `</div>` que cierra el bloque `hasResults`, después de ManualForm):

Antes:
```js
            <div className="mt-6">
              <ManualForm
                values={manualData}
                onChange={setManualData}
                onAnalyze={() => {
                  const result = computeAnalysis({ ...marketData, ...(marketData.fundamentals || {}), ...manualData })
                  setAnalysis(result)
                  setActiveTab('resultado')
                  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </div>
          </div>
```

Después:
```js
            <div className="mt-6">
              <ManualForm
                values={manualData}
                onChange={setManualData}
                onAnalyze={() => {
                  const result = computeAnalysis({ ...marketData, ...(marketData.fundamentals || {}), ...manualData })
                  setAnalysis(result)
                  setActiveTab('resultado')
                  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </div>
            <BacktestSection ticker={marketData.ticker} />
          </div>
```

- [ ] **Step 3: Verificar que el servidor compila sin errores**

```bash
npm run dev
```

Expected: compila sin errores de TypeScript o import. En el browser, al analizar un ticker (ej. AAPL), aparece la sección "Señales técnicas históricas" debajo del formulario manual, con skeleton mientras carga y datos al resolver (o mensaje "Sin señales" si no hay datos en Supabase).

- [ ] **Step 4: Commit**

```bash
git add components/BacktestSection.js app/page.js
git commit -m "$(cat <<'EOF'
feat: BacktestSection component + integration in main page (Task 2.8)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Cron daily route

**Files:**
- Create: `app/api/cron/daily/route.js`

**Qué hace:** GET protegido por `CRON_SECRET` que actualiza el último día de datos en `ohlcv_daily` para los 50 tickers. Sleep de 12s entre tickers para respetar el rate limit de Polygon free tier (5 req/min).

**Limitación documentada:** Vercel Hobby tiene timeout de 60s. El loop completo toma ~600s. Usar manualmente con `node scripts/download-history.js` hasta migrar a Vercel Pro/Enterprise o adoptar otro runner (GitHub Actions, Railway).

- [ ] **Step 1: Crear la ruta**

```bash
mkdir -p app/api/cron/daily
```

Crear `app/api/cron/daily/route.js`:

```js
// LIMITACIÓN: Vercel Hobby timeout = 60s. Para 50 tickers necesitás Pro/Enterprise
// o correr manualmente: node scripts/download-history.js
import { createClient } from '@supabase/supabase-js'
import tickers from '@/scripts/tickers-priority.json'

export const maxDuration = 800

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const polygonKey = process.env.POLYGON_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!polygonKey || !supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const date = yesterday()
  const details = []
  let ok = 0, errors = 0

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    try {
      const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${date}/${date}?adjusted=true&sort=asc&limit=2&apiKey=${polygonKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const bars = json.results || []
      if (bars.length === 0) {
        console.warn(`[cron] ${ticker}: sin datos para ${date} (feriado o fin de semana)`)
        details.push({ ticker, status: 'no-data', date })
        ok++
      } else {
        const rows = bars.map(bar => ({
          ticker,
          date: new Date(bar.t).toISOString().split('T')[0],
          open: bar.o, high: bar.h, low: bar.l, close: bar.c,
          volume: Math.round(bar.v),
        }))
        const { error } = await supabase
          .from('ohlcv_daily')
          .upsert(rows, { onConflict: 'ticker,date' })
        if (error) throw new Error(error.message)
        details.push({ ticker, status: 'ok', date: rows[0].date })
        ok++
      }
    } catch (err) {
      console.error(`[cron] ${ticker} ERROR:`, err.message)
      details.push({ ticker, status: 'error', error: err.message })
      errors++
    }
    if (i < tickers.length - 1) await sleep(12_000)
  }

  return Response.json({ ok, errors, date, details })
}
```

- [ ] **Step 2: Agregar `CRON_SECRET` a `.env.local` (documentar, no exponer)**

En `.env.local` agregar:
```
CRON_SECRET=un_secreto_largo_aleatorio
```

Generar con: `openssl rand -hex 32`

- [ ] **Step 3: Verificar que el archivo compila**

```bash
npm run build 2>&1 | tail -20
```

Expected: build exitoso sin errores en `app/api/cron/daily/route.js`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/daily/route.js
git commit -m "$(cat <<'EOF'
feat: daily cron route for incremental ohlcv_daily update (Task 2.9)

NOTE: Vercel Hobby 60s timeout prevents running all 50 tickers.
Run manually with: node scripts/download-history.js

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage Check

| Requisito | Task |
|---|---|
| `lib/backtest/golden-cross.js` con firma `(ohlcvArray, ticker)` | Task 2 |
| `lib/backtest/rsi-oversold.js` | Task 3 |
| `lib/backtest/macd-bull.js` | Task 4 |
| Retorno `{occurrences, totalCount, winsCount, avgReturn30d, lastOccurrence}` | Task 2-4 |
| Tests en `__tests__/backtest/` | Task 2-4 |
| Test edge case array vacío | Task 2-4 |
| Test edge case datos insuficientes | Task 2-4 |
| Test señal sintética conocida | Task 2-4 |
| `GET /api/backtest/[ticker]` con los 3 setups | Task 5 |
| `BacktestSection` con etiquetado honesto | Task 6 |
| Sin lenguaje predictivo | Task 6 |
| Skeleton loading | Task 6 |
| Integrado en página principal | Task 6 |
| `app/api/cron/daily/route.js` con update incremental | Task 7 |
| 1 call por ticker, último día | Task 7 |
| Protección con CRON_SECRET | Task 7 |
| Limitación Vercel Hobby documentada | Task 7 |
| Branch `feature/backtest-engine` | Task 1 |
| Commits incrementales por tarea | Todos |
| RSI: señal = salida de sobrevendido (rsi[i-1]<30 → rsi[i]>=30) | Task 3 |
| MACD: EMA9 real (no aproximación ×0.85) | Task 4 |
