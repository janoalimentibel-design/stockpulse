# Sprint 2B — Backtesting Engine

**Date:** 2026-05-31
**Branch:** feature/backtest-engine
**Scope:** Tareas 2.3–2.9

---

## Contexto

Los datos históricos OHLCV ya están cargados en `ohlcv_daily` (Supabase) por el Sprint 2A. Este sprint agrega el motor de backtesting que analiza señales técnicas históricas y las muestra como estadística descriptiva de comportamiento pasado.

---

## Tarea 2.3–2.5 — Módulos de backtesting (`lib/backtest/`)

### Archivos

- `lib/backtest/golden-cross.js`
- `lib/backtest/rsi-oversold.js`
- `lib/backtest/macd-bull.js`

### Firma de cada función

```js
setup(ohlcvArray, ticker) → BacktestResult
```

`ohlcvArray`: array de objetos `{ date, open, high, low, close, volume }` ordenado ASC (como sale de Supabase).

```ts
BacktestResult {
  occurrences:   Array<{ date: string, signalPrice: number, return30d: number|null, return60d: number|null }>
  totalCount:    number
  winsCount:     number        // return30d > 0, ignorando nulls
  avgReturn30d:  number|null   // promedio de return30d no-nulos; null si no hay ocurrencias
  lastOccurrence: string|null  // fecha ISO más reciente; null si no hay señales
}
```

### Definiciones de señal

| Setup | Condición (día `i`) | Warm-up mínimo |
|---|---|---|
| `goldenCross` | `ma50[i] > ma200[i]` AND `ma50[i-1] <= ma200[i-1]` | 201 barras |
| `rsiOversold` | `rsi[i] >= 30` AND `rsi[i-1] < 30` (salida de sobrevendido) | 16 barras |
| `macdBull`    | `macdLine[i] > signal[i]` AND `macdLine[i-1] <= signal[i-1]` | 35 barras (26+9) |

### Cálculo de retornos

```
signalPrice = close[i]
return30d   = (close[i+30] - close[i]) / close[i] * 100   → null si i+30 >= length
return60d   = (close[i+60] - close[i]) / close[i] * 100   → null si i+60 >= length
```

Retornos en días de trading (barras), no días calendario.

### Series de indicadores (internas a cada archivo)

**`emaArray(closes, period)`**
- Devuelve array de misma longitud que `closes`
- Primeros `period-1` valores: `null`
- Valor `period-1`: promedio simple de los primeros `period` valores
- Desde `period` en adelante: EMA multiplicativa con `k = 2 / (period + 1)`

**`rsiArray(closes, period=14)`**
- Implementa Wilder smoothing (no la aproximación de `lib/indicators.js`)
- Primeros `period` valores: `null`
- Valor `period`: RSI basado en promedio simple de ganancias/pérdidas de los `period` períodos anteriores
- Desde `period+1`: smoothing `avgGain = (avgGain * (period-1) + gain) / period`

**`macdBull` internamente calcula:**
1. `ema12 = emaArray(closes, 12)`
2. `ema26 = emaArray(closes, 26)`
3. `macdLine[i] = ema12[i] - ema26[i]` (null si cualquiera es null; primeros 25 valores son null)
4. Extraer valores no-null de macdLine desde índice 25, calcular `emaArray(slice, 9)`, reconectar: `signalLine[i] = ema9resultado[i - 25]` para `i >= 33`
5. Primer cruce detectable: índice 34 (se necesita `signal[i]` y `signal[i-1]` no-null → ambos requieren i-1 ≥ 33)

### Edge cases

- Array vacío o menor al warm-up: retorna `{ occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }`
- Señal detectada pero `i+30 >= length`: la ocurrencia se registra con `return30d: null`, `return60d: null`, y no cuenta para `winsCount` ni `avgReturn30d`

---

## Tarea 2.6 — Tests unitarios (`__tests__/backtest/`)

### Archivos

- `__tests__/backtest/golden-cross.test.mjs`
- `__tests__/backtest/rsi-oversold.test.mjs`
- `__tests__/backtest/macd-bull.test.mjs`

### Formato

ESM (`.mjs`), usando `node:test` + `node:assert/strict`. Corren con:
```bash
node --test '__tests__/backtest/*.test.mjs'
```

### Datos de prueba

Sintéticos, construidos a mano. No datos reales de mercado (inestables y requieren DB).

**Golden Cross sintético:** array de 210 barras donde se fuerzan precios que generan MA50 > MA200 exactamente en la barra 200, con fecha ISO controlada. Permite verificar `date`, `signalPrice`, `return30d` con exactitud.

### Casos por setup (mínimo)

1. **Array vacío** → `totalCount: 0`, `avgReturn30d: null`, `lastOccurrence: null`
2. **Datos insuficientes** (< warm-up mínimo) → mismo resultado vacío
3. **Señal sintética conocida** → `totalCount === 1`, fecha correcta, `return30d` calculado exactamente
4. **Señal sin datos de retorno** (señal al final del array, < 30 barras restantes) → `return30d: null`, no cuenta en `winsCount`

---

## Tarea 2.7 — Endpoint `GET /api/backtest/[ticker]`

**Archivo:** `app/api/backtest/[ticker]/route.js`

### Flujo

1. Valida ticker con `validateTicker` (existente en `lib/validate.js`)
2. Fetch de Supabase: todos los rows de `ohlcv_daily` para ese ticker, `order: date ASC`
3. Si no hay rows: 404 `{ error: 'Sin datos históricos para este ticker.' }`
4. Corre los 3 setups en `Promise.all` (son síncronos, el `Promise.all` es por uniformidad)
5. Devuelve respuesta

### Response

```json
{
  "ticker": "AAPL",
  "dataPoints": 1260,
  "fromDate": "2021-05-31",
  "toDate": "2026-05-30",
  "setups": {
    "goldenCross": { "occurrences": [...], "totalCount": 3, "winsCount": 2, "avgReturn30d": 4.7, "lastOccurrence": "2023-03-21" },
    "rsiOversold":  { "occurrences": [...], "totalCount": 7, "winsCount": 5, "avgReturn30d": 6.2, "lastOccurrence": "2024-01-05" },
    "macdBull":     { "occurrences": [...], "totalCount": 12, "winsCount": 8, "avgReturn30d": 3.1, "lastOccurrence": "2024-04-02" }
  }
}
```

### Errores

| Caso | Status | Body |
|---|---|---|
| Ticker inválido | 400 | `{ error: 'Ticker inválido.' }` |
| Sin datos en DB | 404 | `{ error: 'Sin datos históricos para este ticker.' }` |
| Error interno | 500 | `{ error: 'Error al calcular backtesting.' }` |

---

## Tarea 2.8 — Componente `BacktestSection`

**Archivo:** `components/BacktestSection.js`

**Integración:** Se agrega en `/analisis/[ticker]` (o la página de análisis de ticker existente), debajo de los indicadores actuales, como una sección más.

### Estructura visual

```
Señales técnicas históricas
Describe el comportamiento histórico del precio luego de estas condiciones técnicas.
No predice resultados futuros.

┌──────────────────┬──────────────────┬─────────────────────┐
│  Golden Cross    │  RSI Sobrevendido│  MACD Alcista       │
│  MA50 > MA200    │  Salida < 30     │  Cruce señal        │
│                  │                  │                     │
│  3 veces         │  7 veces         │  12 veces           │
│  Última: 21 mar  │  Última: 5 ene   │  Última: 2 abr      │
│                  │                  │                     │
│  Subió en 30d:   │  Subió en 30d:   │  Subió en 30d:      │
│  2 de 3 (67%)    │  5 de 7 (71%)    │  8 de 12 (67%)      │
│  Ret. prom.: +4.7%│ Ret. prom.: +6.2%│ Ret. prom.: +3.1% │
└──────────────────┴──────────────────┴─────────────────────┘
```

### Reglas de etiquetado honesto

- Título de sección: "Señales técnicas históricas" (nunca "señales de compra")
- Disclaimer fijo: *"Describe el comportamiento histórico del precio luego de estas condiciones técnicas. No predice resultados futuros."*
- Win rate: "subió en los 30 días siguientes en X de Y ocasiones" (nunca "probabilidad de subida")
- Retorno: "retorno promedio histórico a 30 días" (nunca "retorno esperado")
- `totalCount === 0`: mostrar "Sin señales en el período analizado"
- `lastOccurrence` null: omitir la línea de fecha

### Estados del componente

1. **Loading:** skeleton de 3 cards grises
2. **Datos cargados:** cards con estadísticas
3. **Error:** no bloquea el resto de la página, muestra nada o mensaje mínimo

---

## Tarea 2.9 — Cron `GET /api/cron/daily/route.js`

**Archivo:** `app/api/cron/daily/route.js`

### Protección

Header `Authorization: Bearer ${CRON_SECRET}`. Retorna 401 si falta o no coincide.

### Flujo por ticker

1. Calcula `yesterday` como el día hábil más reciente (`YYYY-MM-DD`)
2. Fetch Polygon: `/v2/aggs/ticker/{T}/range/1/day/{yesterday}/{yesterday}?adjusted=true&sort=asc&limit=2&apiKey={key}`
3. Si `results.length === 0`: loguea warning, continúa
4. Upsert en `ohlcv_daily` con `onConflict: 'ticker,date'`
5. Sleep 12s antes del siguiente ticker (excepto el último)

### Config Vercel

```js
export const maxDuration = 800
```

Necesario para 50 tickers × 12s = ~600s en Vercel Pro/Enterprise.

### Response

```json
{ "ok": 48, "errors": 2, "details": [{ "ticker": "AAPL", "status": "ok" }, ...] }
```

---

## Archivos creados/modificados

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
| `app/api/cron/daily/route.js` | Crear |

---

## Branch

```bash
git checkout -b feature/backtest-engine
```

Commits incrementales por tarea (2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9).
