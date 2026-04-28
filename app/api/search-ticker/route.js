// app/api/search-ticker/route.js
export async function POST(request) {
  try {
    const { query } = await request.json()
    if (!query) return Response.json({ results: [] })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ results: [] })

    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=8&apiKey=${polygonKey}`
    )
    const data = await res.json()

    const q = query.toUpperCase()
    const results = (data.results || [])
      .map(t => ({ ticker: t.ticker, name: t.name, market: t.primary_exchange }))
      .sort((a, b) => {
        // Ticker exacto primero
        if (a.ticker === q) return -1
        if (b.ticker === q) return 1
        // Ticker que empieza con la query
        const aStarts = a.ticker.startsWith(q)
        const bStarts = b.ticker.startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
      .slice(0, 6)

    return Response.json({ results })
  } catch {
    return Response.json({ results: [] })
  }
}
