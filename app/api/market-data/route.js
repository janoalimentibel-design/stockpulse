// app/api/market-data/route.js
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
      const day = snap.ticker?.day
      const prevClose = snap.ticker?.prevDay?.c
      if (day?.c) {
        price = day.c
        open  = day.o
        high  = day.h
        low   = day.l
      }
      if (price && prevClose) {
        priceChangeToday = parseFloat(((price - prevClose) / prevClose * 100).toFixed(2))
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
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
