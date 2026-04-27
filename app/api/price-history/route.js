// app/api/price-history/route.js
export async function POST(request) {
  try {
    const { ticker, range } = await request.json()
    if (!ticker) return Response.json({ error: 'Falta ticker.' }, { status: 400 })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ error: 'Polygon API key no configurada.' }, { status: 500 })

    const t = ticker.toUpperCase().trim()
    const now = new Date()

    // Para 5A y MAX — Polygon free no tiene histórico largo, devolvemos needsPro
    if (range === '5A' || range === 'MAX') {
      return Response.json({ needsPro: true })
    }

    const config = {
      '1D': { multiplier: 1,  timespan: 'day',  days: 5,   limit: 5   }, // fallback a 5 días diarios
      '1M': { multiplier: 1,  timespan: 'day',  days: 30,  limit: 30  },
      '6M': { multiplier: 1,  timespan: 'day',  days: 180, limit: 180 },
      '1A': { multiplier: 1,  timespan: 'week', days: 365, limit: 52  },
    }

    const cfg = config[range] || config['1M']
    const from = new Date(now)
    from.setDate(from.getDate() - cfg.days)
    const fromStr = from.toISOString().split('T')[0]
    const toStr   = now.toISOString().split('T')[0]

    const url = `https://api.polygon.io/v2/aggs/ticker/${t}/range/${cfg.multiplier}/${cfg.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${cfg.limit}&apiKey=${polygonKey}`
    const res  = await fetch(url)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return Response.json({ error: 'Sin datos históricos para este ticker.' }, { status: 404 })
    }

    const points = data.results.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }))
    const first  = points[0].c
    const last   = points[points.length - 1].c
    const change = parseFloat(((last - first) / first * 100).toFixed(2))

    return Response.json({ ticker: t, range, points, change })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
