// app/api/gainers-losers/route.js
// Usa snapshot de tickers curados — más confiable que el endpoint gainers/losers
// en free tier y en weekends. Ordena por todaysChangePerc.
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
  if (!key) return NextResponse.json({ error: 'Config.' }, { status: 500 })

  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks?tickers=${WATCHLIST.join(',')}&apiKey=${key}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Polygon ${res.status}`)
    const json = await res.json()

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
    }

    _cache = data
    _cacheTs = Date.now()

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los movimientos.' }, { status: 500 })
  }
}
