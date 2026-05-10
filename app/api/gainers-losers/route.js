// app/api/gainers-losers/route.js
import { NextResponse } from 'next/server'

let _cache = null
let _cacheTs = 0
const TTL = 15 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() - _cacheTs < TTL) {
    return NextResponse.json(_cache)
  }

  const key = process.env.POLYGON_API_KEY
  if (!key) return NextResponse.json({ error: 'Config.' }, { status: 500 })

  try {
    const [gRes, lRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${key}`),
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${key}`)
    ])

    if (!gRes.ok || !lRes.ok) throw new Error('Polygon error')

    const [gData, lData] = await Promise.all([gRes.json(), lRes.json()])

    const getPrice = (t) => t.day?.c || t.prevDay?.c || t.lastTrade?.p || 0

    const fmt = (t) => ({
      ticker: t.ticker,
      price: +getPrice(t).toFixed(2),
      change: +(t.todaysChangePerc ?? 0).toFixed(2),
    })

    // Filtrar penny stocks (<$5) y tickers con punto (ADRs/ETFs raros)
    // getPrice usa prevDay como fallback para weekends/after-hours donde day.c = 0
    const filter = (arr) => (arr || [])
      .filter(t => getPrice(t) > 5 && !t.ticker.includes('.') && t.ticker.length <= 5)
      .slice(0, 10)
      .map(fmt)

    const data = {
      gainers: filter(gData.tickers),
      losers: filter(lData.tickers),
    }

    _cache = data
    _cacheTs = Date.now()

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los movimientos.' }, { status: 500 })
  }
}
