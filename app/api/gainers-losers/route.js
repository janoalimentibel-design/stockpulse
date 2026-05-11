import { NextResponse } from 'next/server'

let _cache = null
let _cacheTs = 0
const TTL = 15 * 60 * 1000

const WATCHLIST = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','MELI',
  'AMD','INTC','CRM','NFLX','UBER','PYPL','SHOP','BABA',
  'KO','JPM','V','DIS',
]

async function fetchTicker(ticker) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) return null
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta || !meta.regularMarketPrice) return null
  const price = meta.regularMarketPrice
  const prev  = meta.previousClose ?? meta.chartPreviousClose
  const change = prev
    ? parseFloat(((price - prev) / prev * 100).toFixed(2))
    : 0
  return { ticker, price: parseFloat(price.toFixed(2)), change }
}

export async function GET() {
  if (_cache && Date.now() - _cacheTs < TTL) {
    return NextResponse.json(_cache)
  }

  try {
    const results = await Promise.all(WATCHLIST.map(t => fetchTicker(t).catch(() => null)))

    const tickers = results.filter(Boolean).filter(q => q.price > 0)
    if (!tickers.length) {
      return NextResponse.json({ error: 'No se pudieron obtener datos de Yahoo Finance.' }, { status: 500 })
    }

    const sorted = [...tickers].sort((a, b) => b.change - a.change)

    const data = {
      gainers: sorted.filter(t => t.change > 0).slice(0, 8),
      losers:  sorted.filter(t => t.change < 0).slice(-8).reverse(),
    }

    _cache = data
    _cacheTs = Date.now()

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: `Excepción: ${err.message}` }, { status: 500 })
  }
}
