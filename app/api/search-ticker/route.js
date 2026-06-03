// app/api/search-ticker/route.js
import { validateQuery } from '@/lib/validate'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)

    const query = validateQuery(body?.query)
    if (!query) return Response.json({ results: [] })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ results: [] })

    const q = query.toUpperCase().trim()

    const fetchTickers = async (url) => {
      const r = await fetch(url)
      if (r.status === 429) return { results: [], rateLimited: true }
      const data = await r.json()
      // Only treat 429 as rateLimited, not generic Polygon errors
      if (!r.ok) return { results: [] }
      return data
    }

    const [byName, byTicker] = await Promise.all([
      fetchTickers(`https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=8&apiKey=${polygonKey}`)
        .catch(() => ({ results: [] })),
      fetchTickers(`https://api.polygon.io/v3/reference/tickers?ticker=${encodeURIComponent(q)}&active=true&market=stocks&limit=4&apiKey=${polygonKey}`)
        .catch(() => ({ results: [] })),
    ])

    if (byName.rateLimited || byTicker.rateLimited) {
      return Response.json({ results: [], rateLimited: true })
    }

    const seen = new Set()
    const merged = []
    for (const t of [...(byTicker.results || []), ...(byName.results || [])]) {
      if (!seen.has(t.ticker)) {
        seen.add(t.ticker)
        merged.push({ ticker: t.ticker, name: t.name, market: t.primary_exchange })
      }
    }

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
  } catch (err) {
    console.error('[search-ticker]', err?.message)
    return Response.json({ results: [] })
  }
}
