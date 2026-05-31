// LIMITACIÓN: Vercel Hobby timeout = 60s. Para 50 tickers necesitás Pro/Enterprise
// o correr manualmente: node scripts/download-history.js
import { createClient } from '@supabase/supabase-js'
import tickers from '@/scripts/tickers-priority.json'

export const maxDuration = 800

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const polygonKey = process.env.POLYGON_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!polygonKey || !supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const date = yesterday()
  const details = []
  let ok = 0, errors = 0

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    try {
      const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${date}/${date}?adjusted=true&sort=asc&limit=2&apiKey=${polygonKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const bars = json.results || []
      if (bars.length === 0) {
        console.warn(`[cron] ${ticker}: sin datos para ${date} (feriado o fin de semana)`)
        details.push({ ticker, status: 'no-data', date })
        ok++
      } else {
        const rows = bars.map(bar => ({
          ticker,
          date: new Date(bar.t).toISOString().split('T')[0],
          open: bar.o, high: bar.h, low: bar.l, close: bar.c,
          volume: Math.round(bar.v),
        }))
        const { error } = await supabase
          .from('ohlcv_daily')
          .upsert(rows, { onConflict: 'ticker,date' })
        if (error) throw new Error(error.message)
        details.push({ ticker, status: 'ok', date: rows[0].date })
        ok++
      }
    } catch (err) {
      console.error(`[cron] ${ticker} ERROR:`, err.message)
      details.push({ ticker, status: 'error', error: err.message })
      errors++
    }
    if (i < tickers.length - 1) await sleep(12_000)
  }

  return Response.json({ ok, errors, date, details })
}
