// app/api/price-history/route.js
// Trae datos históricos de Polygon para el gráfico de precio.
// Soporta rangos: 1D, 1M, 6M, 1A, 5A, MAX

export async function POST(request) {
  try {
    const { ticker, range, polygonKey } = await request.json()
    if (!ticker || !polygonKey) return Response.json({ error: 'Faltan parámetros.' }, { status: 400 })

    const t = ticker.toUpperCase().trim()
    const now = new Date()

    // Configuración por rango
    const config = {
      '1D': { multiplier: 5,  timespan: 'minute', days: 1,    limit: 300 },
      '1M': { multiplier: 1,  timespan: 'day',    days: 30,   limit: 30  },
      '6M': { multiplier: 1,  timespan: 'day',    days: 180,  limit: 180 },
      '1A': { multiplier: 1,  timespan: 'week',   days: 365,  limit: 52  },
      '5A': { multiplier: 1,  timespan: 'month',  days: 1825, limit: 60  },
      'MAX':{ multiplier: 3,  timespan: 'month',  days: 5000, limit: 120 },
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

    // Formatear resultados
    const points = data.results.map(r => ({
      t: r.t,   // timestamp ms
      o: r.o,   // open
      h: r.h,   // high
      l: r.l,   // low
      c: r.c,   // close
      v: r.v,   // volume
    }))

    // Calcular cambio del período
    const first = points[0].c
    const last  = points[points.length - 1].c
    const change = parseFloat(((last - first) / first * 100).toFixed(2))

    return Response.json({ ticker: t, range, points, change })
  } catch (err) {
    return Response.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
