'use strict'

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const tickers = require('./tickers-priority.json')

function buildDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 5)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function mapBar(ticker, bar) {
  return {
    ticker,
    date:   new Date(bar.t).toISOString().split('T')[0],
    open:   bar.o,
    high:   bar.h,
    low:    bar.l,
    close:  bar.c,
    volume: Math.round(bar.v),
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchTicker(ticker, from, to, apiKey) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const data = await res.json()
  if (data.next_url) {
    console.warn(`  [warn] ${ticker}: respuesta paginada, pueden faltar datos`)
  }
  return (data.results || []).map(bar => mapBar(ticker, bar))
}

async function upsertRows(supabase, rows) {
  const { error } = await supabase
    .from('ohlcv_daily')
    .upsert(rows, { onConflict: 'ticker,date' })
  if (error) throw new Error(error.message)
}

async function main() {
  const POLYGON_API_KEY = process.env.POLYGON_API_KEY
  if (!POLYGON_API_KEY) {
    console.error('ERROR: POLYGON_API_KEY no configurada en .env.local')
    process.exit(1)
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_URL o SUPABASE_KEY no configuradas en .env.local')
    process.exit(1)
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

  const { from, to } = buildDateRange()
  console.log(`Descargando datos: ${from} → ${to}`)
  console.log(`Tickers: ${tickers.length}`)
  console.log('---')

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    const prefix = `[${i + 1}/${tickers.length}] ${ticker}`
    try {
      console.log(`${prefix} → fetching...`)
      const rows = await fetchTicker(ticker, from, to, POLYGON_API_KEY)
      await upsertRows(supabase, rows)
      console.log(`${prefix} → ${rows.length} barras → OK`)
    } catch (err) {
      console.error(`${prefix} → ERROR: ${err.message} (continuando)`)
    }
    if (i < tickers.length - 1) await sleep(12_000)
  }

  console.log('---')
  console.log('Descarga completada.')
}

if (require.main === module) main()

module.exports = { buildDateRange, mapBar }
