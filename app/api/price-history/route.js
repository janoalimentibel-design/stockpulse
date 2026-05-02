// app/api/price-history/route.js
export async function POST(request) {
  try {
    const { ticker, range } = await request.json()
    if (!ticker) return Response.json({ error: 'Falta ticker.' }, { status: 400 })

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ error: 'Polygon API key no configurada.' }, { status: 500 })

    const t = ticker.toUpperCase().trim()
    const now = new Date()

    if (range === '5A' || range === 'MAX') {
      return Response.json({ needsPro: true })
    }

    // 1D: barras de 15 minutos del día de hoy (o último día hábil)
    if (range === '1D') {
      const toStr   = now.toISOString().split('T')[0]
      const from    = new Date(now)
      from.setDate(from.getDate() - 4) // hasta 4 días atrás para cubrir fin de semana
      const fromStr = from.toISOString().split('T')[0]

      const url = `https://api.polygon.io/v2/aggs/ticker/${t}/range/15/minute/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=200&apiKey=${polygonKey}`
      const res  = await fetch(url)
      const data = await res.json()

      if (!data.results || data.results.length === 0) {
        // degradar silenciosamente — el componente muestra "Sin datos disponibles" sin error rojo
        return Response.json({ ticker: t, range, points: [], change: null })
      }

      // solo el último día de trading
      const lastDay = new Date(data.results[data.results.length - 1].t)
      const lastDayStr = lastDay.toISOString().split('T')[0]
      const filtered = data.results.filter(r => {
        const d = new Date(r.t).toISOString().split('T')[0]
        return d === lastDayStr
      })

      const points = (filtered.length > 0 ? filtered : data.results).map(r => ({
        t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v,
      }))
      const first  = points[0].c
      const last   = points[points.length - 1].c
      const change = parseFloat(((last - first) / first * 100).toFixed(2))
      return Response.json({ ticker: t, range, points, change })
    }

    const config = {
      '1M': { multiplier: 1, timespan: 'day',  days: 30,  limit: 30  },
      '6M': { multiplier: 1, timespan: 'day',  days: 180, limit: 180 },
      '1A': { multiplier: 1, timespan: 'week', days: 365, limit: 365 },
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
      // degradar silenciosamente en vez de mostrar error rojo
      return Response.json({ ticker: t, range, points: [], change: null })
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
