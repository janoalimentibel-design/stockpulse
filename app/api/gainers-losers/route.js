// app/api/gainers-losers/route.js
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

  const key = process.env.POLYGON_API_KEY
  if (!key) return NextResponse.json({ error: 'POLYGON_API_KEY no configurada.' }, { status: 500 })

  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks?tickers=${WATCHLIST.join(',')}&apiKey=${key}`
    const res = await fetch(url)
    const json = await res.json()

    // Exponer error real de Polygon si lo hay
    if (!res.ok || json.status === 'ERROR') {
      return NextResponse.json({ error: `Polygon: ${json.error || json.message || res.status}` }, { status: 500 })
    }

    const tickers = (json.tickers || []).map(t => {
      const price = t.day?.c || t.prevDay?.c || t.lastTrade?.p || 0
      return {
        ticker: t.ticker,
        price: +price.toFixed(2),
        change: +(t.todaysChangePerc ?? 0).toFixed(2),
      }
    }).filter(t => t.price > 0)

    const sorted = [...tickers].sort((a, b) => b.change - a.change)

    const data = {
      gainers: sorted.filter(t => t.change > 0).slice(0, 8),
      losers:  sorted.filter(t => t.change < 0).reverse().slice(0, 8),
      _debug: { total: tickers.length, status: json.status }
    }

    _cache = data
    _cacheTs = Date.now()

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: `Excepción: ${err.message}` }, { status: 500 })
  }
}
