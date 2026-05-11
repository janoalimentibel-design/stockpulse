// app/api/gainers-losers/route.js
// Usa Yahoo Finance batch quotes — mismo origen que market-data/route.js, ya funciona.
import { NextResponse } from 'next/server'

let _cache = null
let _cacheTs = 0
const TTL = 15 * 60 * 1000

const WATCHLIST = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','MELI',
  'AMD','INTC','CRM','NFLX','UBER','PYPL','SHOP','BABA',
  'KO','JPM','V','DIS',
]

export async function GET() {
  if (_cache && Date.now() - _cacheTs < TTL) {
    return NextResponse.json(_cache)
  }

  try {
    const symbols = WATCHLIST.join(',')
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,regularMarketPrice,regularMarketChangePercent`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockPulse/1.0)',
        'Accept': 'application/json',
      },
    })

    const raw = await res.text()
    let json
    try {
      json = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: `Yahoo respuesta inválida (${res.status}): ${raw.slice(0, 150)}` },
        { status: 500 }
      )
    }

    const quotes = json?.quoteResponse?.result || []
    if (!quotes.length) {
      return NextResponse.json(
        { error: `Yahoo sin resultados. Status: ${json?.quoteResponse?.error || res.status}` },
        { status: 500 }
      )
    }

    const tickers = quotes
      .filter(q => q.regularMarketPrice > 0)
      .map(q => ({
        ticker: q.symbol,
        price: +q.regularMarketPrice.toFixed(2),
        change: +(q.regularMarketChangePercent ?? 0).toFixed(2),
      }))

    const sorted = [...tickers].sort((a, b) => b.change - a.change)

    const data = {
      gainers: sorted.filter(t => t.change > 0).slice(0, 8),
      losers:  sorted.filter(t => t.change < 0).reverse().slice(0, 8),
    }

    _cache = data
    _cacheTs = Date.now()

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: `Excepción: ${err.message}` }, { status: 500 })
  }
}
