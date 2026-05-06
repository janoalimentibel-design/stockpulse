// app/api/price-history/route.js
import { validateTicker, validateRange } from '@/lib/validate'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)

    const t = validateTicker(body?.ticker)
    if (!t) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    const range = validateRange(body?.range)

    const polygonKey = process.env.POLYGON_API_KEY
    if (!polygonKey) return Response.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })

    const now = new Date()

    if (range === '5A' || range === 'MAX') {
      return Response.json({ needsPro: true })
    }

    if (range === '1D') {
      const toStr   = now.toISOString().split('T')[0]
      const from    = new Date(now)
      from.setDate(from.getDate() - 4)
      const fromStr = from.toISOString().split('T')[0]

      const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/range/15/minute/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=200&apiKey=${polygonKey}`
      const res  = await fetch(url)
      const data = await res.json()

      if (!data.results || data.results.length === 0) {
        return Response.json({ ticker: t, range, points: [], change: null })
      }

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

    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/range/${cfg.multiplier}/${cfg.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${cfg.limit}&apiKey=${polygonKey}`
    const res  = await fetch(url)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return Response.json({ ticker: t, range, points: [], change: null })
    }

    const points = data.results.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }))
    const first  = points[0].c
    const last   = points[points.length - 1].c
    const change = parseFloat(((last - first) / first * 100).toFixed(2))

    return Response.json({ ticker: t, range, points, change })
  } catch (err) {
    console.error('[price-history]', err?.message)
    return Response.json({ error: 'Error al obtener historial de precios.' }, { status: 500 })
  }
}
