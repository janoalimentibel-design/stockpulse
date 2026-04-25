export async function POST(request) {
  try {
    const { query, polygonKey } = await request.json()
    if (!query || !polygonKey) return Response.json({ results: [] })
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&order=desc&limit=6&sort=relevance&apiKey=${polygonKey}`
    )
    const data = await res.json()
    const results = (data.results || []).map(t => ({
      ticker: t.ticker,
      name: t.name,
      market: t.primary_exchange,
    }))
    return Response.json({ results })
  } catch {
    return Response.json({ results: [] })
  }
}
