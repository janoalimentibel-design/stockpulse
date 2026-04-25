// app/api/market-data/route.js
// Solo usa Polygon.io — Claude NO se llama desde acá.
// Esto evita el rate limit por llamadas dobles.

export async function POST(request) {
  try {
    const { ticker, polygonKey } = await request.json()
    if (!ticker) return Response.json({ error: 'Falta ticker.' }, { status: 400 })
    if (!polygonKey) return Response.json({ error: 'Falta Polygon API key.' }, { status: 400 })

    const t = ticker.toUpperCase().trim()

    // Nombre y sector de la empresa
    let companyName = t
    let sector = null
    try {
      const detRes = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${t}?apiKey=${polygonKey}`
      )
      const det = await detRes.json()
      companyName = det.results?.name || t
      sector = det.results?.sic_description || null
    } catch {}

    // Noticias recientes
    let news = []
    try {
      const newsRes = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${t}&limit=5&order=desc&sort=published_utc&apiKey=${polygonKey}`
      )
      const newsData = await newsRes.json()
      news = (newsData.results || []).slice(0, 5).map(n => ({
        title:     n.title,
        published: n.published_utc,
        url:       n.article_url,
        publisher: n.publisher?.name,
      }))
    } catch {}

    return Response.json({
      ticker: t,
      companyName,
      sector,
      news,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
