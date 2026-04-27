// app/api/market-data/route.js
export async function POST(request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return Response.json({ error: 'Falta ticker.' }, { status: 400 })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ error: 'Polygon API key no configurada en el servidor.' }, { status: 500 })

    const t = ticker.toUpperCase().trim()

    let companyName = t, sector = null
    try {
      const detRes = await fetch(`https://api.polygon.io/v3/reference/tickers/${t}?apiKey=${polygonKey}`)
      const det = await detRes.json()
      companyName = det.results?.name || t
      sector = det.results?.sic_description || null
    } catch {}

    let news = []
    try {
      const newsRes = await fetch(`https://api.polygon.io/v2/reference/news?ticker=${t}&limit=5&order=desc&sort=published_utc&apiKey=${polygonKey}`)
      const newsData = await newsRes.json()
      news = (newsData.results || []).slice(0, 5).map(n => ({
        title: n.title, published: n.published_utc,
        url: n.article_url, publisher: n.publisher?.name,
      }))
    } catch {}

    return Response.json({ ticker: t, companyName, sector, news, fetchedAt: new Date().toISOString() })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
