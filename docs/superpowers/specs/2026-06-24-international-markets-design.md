# International Markets — Design Spec
Date: 2026-06-24

## Goal
Add support for European (all major exchanges) and Japanese stocks to StockPulse, with full feature parity to US stocks: technical indicators, fundamentals, news, earnings, and AI narrative. Prices always displayed in both local currency and USD equivalent.

## Data Provider Strategy
- **US stocks**: unchanged — Polygon (historical, fundamentals, news) + Yahoo Finance (price)
- **International stocks**: Yahoo Finance for everything (price, historical OHLCV, fundamentals) + Finnhub for earnings (best effort) + Polygon news fallback → Claude web_search
- **FX rates**: Yahoo Finance FX tickers (`EURUSD=X`, `GBPUSD=X`, `JPYUSD=X`) fetched in parallel during market-data call
- No new paid APIs or API keys required

## Supported Exchanges (exchange suffix → currency)
| Suffix | Exchange | Currency |
|--------|----------|----------|
| .AS | Amsterdam (Euronext) | EUR |
| .DE | Frankfurt (XETRA) | EUR |
| .PA | Paris (Euronext) | EUR |
| .L | London (LSE) | GBP |
| .MI | Milan (Borsa Italiana) | EUR |
| .MC | Madrid (BME) | EUR |
| .ST | Stockholm (Nasdaq Nordic) | SEK |
| .HE | Helsinki (Nasdaq Nordic) | EUR |
| .CO | Copenhagen (Nasdaq Nordic) | DKK |
| .OL | Oslo (Oslo Børs) | NOK |
| .VI | Vienna (Wiener Börse) | EUR |
| .SW | Switzerland (SIX) | CHF |
| .BR | Brussels (Euronext) | EUR |
| .LS | Lisbon (Euronext) | EUR |
| .IR | Dublin (Euronext) | EUR |
| .AT | Athens (ATHEX) | EUR |
| .T | Tokyo (TSE) | JPY |

## Architecture

### 1. `lib/market.js` (new)
Small utility module with two exports:
- `isInternational(ticker)` — returns true if ticker contains a known exchange suffix (e.g. `ASML.AS`)
- `SUFFIX_CURRENCY` — map of suffix → ISO currency code (e.g. `{'.AS': 'EUR', '.T': 'JPY', ...}`)
- `getCurrency(ticker)` — returns the currency for a ticker, defaults to `'USD'`
- `getFxTicker(currency)` — returns Yahoo FX ticker (e.g. `'EUR'` → `'EURUSD=X'`), returns null for USD

### 2. `/api/search-ticker` (modified)
Run Polygon search and Yahoo Finance search in parallel, then merge:

```
Yahoo Finance:  GET /v1/finance/search?q={query}&quotesCount=8&newsCount=0
Polygon:        GET /v3/reference/tickers?search={query}&market=stocks&limit=8
```

Merge strategy:
- Dedup by ticker symbol (keep first occurrence)
- Sort: results with a known exchange suffix first, then results without suffix
- This means searching "ASML" shows ASML.AS before any OTC/ADR version; searching "Apple" shows AAPL first (no suffix result leads)
- Max 6 results total

Result shape adds `exchange` field:
```js
{ ticker: "ASML.AS", name: "ASML Holding N.V.", market: "XAMS", exchange: "Amsterdam" }
```

### 3. `/api/market-data` (modified)
Detect international ticker at entry:
```js
const international = isInternational(t)  // e.g. true for "ASML.AS"
const currency = getCurrency(t)           // e.g. "EUR"
```

**International data path** (replaces Polygon calls for these tickers):

**Step 1 — Price + Historical OHLCV (single Yahoo call):**
```
/v8/finance/chart/{ticker}?interval=1d&range=1y
```
Returns: price, priceChangeToday, open, high, low + 1y of daily candles.
Calculates: MA50, MA200, RSI, MACD, RelVol, Change1M, 52W high/low — identical logic to current US path.

**Step 2 — Company name + sector:**
From the chart response meta fields (`longName`, `sector`). Fallback to ticker if missing.

**Step 3 — Fundamentals:**
```
/v10/finance/quoteSummary/{ticker}?modules=financialData,defaultKeyStatistics
```
Maps to existing fundamentals shape:
- `trailingPE` → `pe`
- `trailingEps` + previous EPS → `epsGrowth`
- `profitMargins` → `netMargin`
- `returnOnEquity` → `roe`
- `debtToEquity` → `de`

**Step 4 — FX rate (parallel with fundamentals):**
```
/v8/finance/chart/EURUSD=X?interval=1d&range=1d
```
Returns `fxRate` (e.g. 1.093). Null for USD tickers (skipped).

**Step 5 — Earnings:** Finnhub, same as US. Returns null if no coverage — already handled by narrative.

**Step 6 — News:** Polygon news first. If empty, returns empty array — narrative already falls back to Claude web_search.

**Response additions:**
```js
{
  ...existing fields,
  currency,      // "EUR" | "GBP" | "JPY" | "USD"
  fxRate,        // e.g. 1.093 (EUR→USD), null for USD
  exchange,      // e.g. "Amsterdam" — shown in header
}
```

### 4. UI — `components/ResultCard.js` (modified)
**Price display:** When `currency !== 'USD'` and `fxRate` is set, show both:
```
€593.48           ← local currency, primary
$648.20 USD  ·  1€ = $1.093   ← converted, secondary (smaller, muted)
```
When `currency === 'USD'` or no fxRate: current behavior unchanged.

**Currency symbol helper:**
```js
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', SEK: 'kr', DKK: 'kr', NOK: 'kr', CHF: 'Fr', default: '' }
```
Applied to: price, MA50, MA200, 52W high/low.

**Exchange badge in header:** below company name:
```
ASML   ASML Holding N.V.
       SEMICONDUCTORS · Amsterdam (AEX)
```

### 5. No changes needed
- `lib/validate.js` — already accepts dots and hyphens (covers `.AS`, `.T`, etc.)
- `/api/narrative/route.js` — language-agnostic, works for any ticker
- `/api/events/[ticker]/route.js` — Claude web_search is already global
- `lib/rate-limit.js` — no changes

## Edge Cases
| Scenario | Behavior |
|----------|----------|
| Suffix not in known list | Treated as US ticker, Polygon path |
| Yahoo fundamentals missing | `null` fundamentals — narrative handles gracefully |
| Finnhub no earnings coverage | `null` earnings — narrative handles gracefully |
| Polygon news empty for intl ticker | Empty array — narrative falls back to Claude web_search |
| Yahoo FX rate unavailable | `fxRate: null`, UI shows local currency only without conversion |
| Yahoo historical < 50 bars | Technical indicators return `null` — existing behavior |
| SEK/DKK/NOK/CHF tickers | FX rate fetched from Yahoo (SEKUSD=X etc.), full conversion works |

## What does NOT change
- The narrative prompt sent to Claude — already handles unknown companies naturally
- The scoring/sentiment panel logic
- All existing US ticker behavior
- Rate limiting logic
- Caching (narrative cache works with any ticker string as key)
