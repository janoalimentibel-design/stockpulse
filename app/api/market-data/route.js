// app/api/market-data/route.js
import { calcMA, calcRSI, calcMACD, calcRelVol, calcChange1M, calcHigh52Low52 } from '../../../lib/indicators'

export async function POST(request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return Response.json({ error: 'Falta ticker.' }, { status: 400 })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ error: 'Polygon API key no configurada en el servidor.' }, { status: 500 })

    const t = ticker.toUpperCase().trim()

    // 1 — Datos de la empresa
    let companyName = t, sector = null
    try {
      const detRes = await fetch(`https://api.polygon.io/v3/reference/tickers/${t}?apiKey=${polygonKey}`)
      const det = await detRes.json()
      companyName = det.results?.name || t
      sector = det.results?.sic_description || null
    } catch {}

    // 2 — Precio actual + variación del día (snapshot)
    let price = null, priceChangeToday = null, open = null, high = null, low = null
    try {
      const snapRes = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${t}?apiKey=${polygonKey}`)
      const snap = await snapRes.json()
      const tkr = snap.ticker
      const day = tkr?.day
      const prevDay = tkr?.prevDay
      const prevClose = prevDay?.c

      if (day?.c && day.c > 0) {
        price = day.c
        open  = day.o
        high  = day.h
        low   = day.l
      } else if (prevClose && prevClose > 0) {
        price = prevClose
        open  = prevDay.o
        high  = prevDay.h
        low   = prevDay.l
      }

      if (tkr?.todayChangePercent != null) {
        priceChangeToday = parseFloat(Number(tkr.todayChangePercent).toFixed(2))
      } else if (price && prevClose && price !== prevClose) {
        priceChangeToday = parseFloat(((price - prevClose) / prevClose * 100).toFixed(2))
      }
    } catch {}

    // 3 — Histórico 1 año para calcular indicadores técnicos
    let ma50 = null, ma200 = null, rsi = null, macd = null, macdSignal = null
    let relVol = null, change1m = null, high52 = null, low52 = null

    try {
      const to = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const histRes = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${t}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=365&apiKey=${polygonKey}`
      )
      const hist = await histRes.json()
      const bars = hist.results || []

      if (bars.length >= 20) {
        const closes  = bars.map(b => b.c)
        const highs   = bars.map(b => b.h)
        const lows    = bars.map(b => b.l)
        const volumes = bars.map(b => b.v)

        ma50       = calcMA(closes, 50)
        ma200      = calcMA(closes, 200)
        rsi        = calcRSI(closes, 14)
        const macdResult = calcMACD(closes)
        macd       = macdResult.macd
        macdSignal = macdResult.macdSignal
        relVol     = calcRelVol(volumes)
        change1m   = calcChange1M(closes)
        const range52 = calcHigh52Low52(highs, lows)
        high52     = range52.high52
        low52      = range52.low52
      }
    } catch {}

    // 4 — Noticias
    let news = []
    try {
      const newsRes = await fetch(`https://api.polygon.io/v2/reference/news?ticker=${t}&limit=5&order=desc&sort=published_utc&apiKey=${polygonKey}`)
      const newsData = await newsRes.json()
      news = (newsData.results || []).slice(0, 5).map(n => ({
        title: n.title, published: n.published_utc,
        url: n.article_url, publisher: n.publisher?.name,
      }))
    } catch {}

    return Response.json({
      ticker: t, companyName, sector, news,
      price, priceChangeToday, open, high, low,
      ma50, ma200, rsi, macd, macdSignal,
      relVol, change1m, high52, low52,
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
