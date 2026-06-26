// app/api/search-ticker/route.js
import { validateQuery } from '@/lib/validate'
import { isInternational } from '@/lib/market'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    const query = validateQuery(body?.query)
    if (!query) return Response.json({ results: [] })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ results: [] })

    const q = query.toUpperCase().trim()
    const YH = { 'User-Agent': 'Mozilla/5.0' }

    const fetchPolygon = async (url) => {
      const r = await fetch(url)
      if (r.status === 429) return { results: [], rateLimited: true }
      const data = await r.json()
      if (!r.ok) return { results: [] }
      return data
    }

    const [byName, byTicker, yahoo] = await Promise.all([
      fetchPolygon(`https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=8&apiKey=${polygonKey}`)
        .catch(() => ({ results: [] })),
      fetchPolygon(`https://api.polygon.io/v3/reference/tickers?ticker=${encodeURIComponent(q)}&active=true&market=stocks&limit=4&apiKey=${polygonKey}`)
        .catch(() => ({ results: [] })),
      fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`, { headers: YH })
        .then(r => r.ok ? r.json() : { quotes: [] })
        .catch(() => ({ quotes: [] })),
    ])

    if (byName.rateLimited || byTicker.rateLimited) {
      return Response.json({ results: [], rateLimited: true })
    }

    // Polygon results (US stocks)
    const polygonResults = [
      ...(byTicker.results || []),
      ...(byName.results || []),
    ].map(t => ({ ticker: t.ticker, name: t.name, market: t.primary_exchange, exchange: null }))

    // Yahoo results — solo Equity con sufijo internacional conocido
    const yahooIntl = (yahoo.quotes || [])
      .filter(t => t.typeDisp === 'Equity' && isInternational(t.symbol))
      .map(t => ({ ticker: t.symbol, name: t.shortname || t.longname || t.symbol, market: t.exchange || null, exchange: t.exchDisp || null }))

    // Merge: internacionales primero, luego US; dedup por ticker
    const seen = new Set()
    const merged = []
    for (const t of [...yahooIntl, ...polygonResults]) {
      if (!seen.has(t.ticker)) {
        seen.add(t.ticker)
        merged.push(t)
      }
    }

    // Ordenar: exact match primero, luego internacionales, luego US
    merged.sort((a, b) => {
      if (a.ticker === q) return -1
      if (b.ticker === q) return 1
      const aIntl = isInternational(a.ticker)
      const bIntl = isInternational(b.ticker)
      if (aIntl && !bIntl) return -1
      if (!aIntl && bIntl) return 1
      return 0
    })

    return Response.json({ results: merged.slice(0, 6) })
  } catch (err) {
    console.error('[search-ticker]', err?.message)
    return Response.json({ results: [] })
  }
}
