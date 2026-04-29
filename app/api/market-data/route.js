// app/api/market-data/route.js
// Indicadores técnicos inline — sin dependencia de import externo

function calcMA(closes, period) {
  if (!closes || closes.length < period) return null
  const slice = closes.slice(-period)
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100
}

function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10
}

function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return Math.round(ema * 100) / 100
}

function calcMACD(closes) {
  if (!closes || closes.length < 26) return { macd: null, macdSignal: null }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  if (ema12 == null || ema26 == null) return { macd: null, macdSignal: null }
  const macdLine = Math.round((ema12 - ema26) * 100) / 100
  const macdSignal = Math.round(macdLine * 0.85 * 100) / 100
  return { macd: macdLine, macdSignal }
}

function calcRelVol(volumes) {
  if (!volumes || volumes.length < 2) return null
  const recent = volumes[volumes.length - 1]
  const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20)
  if (avg === 0) return null
  return Math.round((recent / avg) * 100) / 100
}

function calcChange1M(closes) {
  if (!closes || closes.length < 22) return null
  const current = closes[closes.length - 1]
  const monthAgo = closes[closes.length - 22]
  if (!monthAgo) return null
  return Math.round(((current - monthAgo) / monthAgo) * 100 * 10) / 10
}

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

    // 2 — Histórico 1 año → precio + indicadores técnicos
    // Usamos aggs que SÍ está disponible en free tier (snapshot NO está disponible)
    let price = null, priceChangeToday = null, open = null, high = null, low = null
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

      if (bars.length >= 2) {
        const last = bars[bars.length - 1]
        const prev = bars[bars.length - 2]

        // Precio del último bar disponible
        price = last.c
        open  = last.o
        high  = last.h
        low   = last.l

        // % cambio respecto al cierre anterior
        if (prev?.c && prev.c > 0) {
          priceChangeToday = parseFloat(((last.c - prev.c) / prev.c * 100).toFixed(2))
        }
      }

      if (bars.length >= 20) {
        const closes  = bars.map(b => b.c)
        const highs   = bars.map(b => b.h)
        const lows    = bars.map(b => b.l)
        const volumes = bars.map(b => b.v)

        ma50       = calcMA(closes, 50)
        ma200      = calcMA(closes, 200)
        rsi        = calcRSI(closes, 14)
        const m    = calcMACD(closes)
        macd       = m.macd
        macdSignal = m.macdSignal
        relVol     = calcRelVol(volumes)
        change1m   = calcChange1M(closes)
        high52     = Math.round(Math.max(...highs) * 100) / 100
        low52      = Math.round(Math.min(...lows) * 100) / 100
      }
    } catch {}

    // 3 — Noticias
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
