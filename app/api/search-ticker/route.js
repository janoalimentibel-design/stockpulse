// app/api/search-ticker/route.js
export async function POST(request) {
  try {
    const { query } = await request.json()
    if (!query) return Response.json({ results: [] })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ results: [] })

    const q = query.toUpperCase().trim()

    // Buscar por nombre Y por ticker en paralelo
    const [byName, byTicker] = await Promise.all([
      fetch(`https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=8&apiKey=${polygonKey}`)
        .then(r => r.json()).catch(() => ({ results: [] })),
      fetch(`https://api.polygon.io/v3/reference/tickers?ticker=${encodeURIComponent(q)}&active=true&market=stocks&limit=4&apiKey=${polygonKey}`)
        .then(r => r.json()).catch(() => ({ results: [] })),
    ])

    // Mergear sin duplicados
    const seen = new Set()
    const merged = []
    for (const t of [...(byTicker.results || []), ...(byName.results || [])]) {
      if (!seen.has(t.ticker)) {
        seen.add(t.ticker)
        merged.push({ ticker: t.ticker, name: t.name, market: t.primary_exchange })
      }
    }

    // Ordenar: ticker exacto primero, luego empieza con query, luego el resto
    merged.sort((a, b) => {
      if (a.ticker === q) return -1
      if (b.ticker === q) return 1
      const aStarts = a.ticker.startsWith(q)
      const bStarts = b.ticker.startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return 0
    })

    return Response.json({ results: merged.slice(0, 6) })
  } catch {
    return Response.json({ results: [] })
  }
}
