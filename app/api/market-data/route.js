// app/api/market-data/route.js
import { validateTicker } from '@/lib/validate'
import { checkRateLimit, getIP } from '@/lib/rate-limit'
import { isInternational, getCurrency, getFxTicker } from '@/lib/market'

function calcMA(closes, period) {
  if (!closes || closes.length < period) return null
  const slice = closes.slice(-period)
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100
}

function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10
}

function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return Math.round(ema * 100) / 100
}

function calcMACD(closes) {
  if (!closes || closes.length < 26) return { macd: null, macdSignal: null }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  if (ema12 == null || ema26 == null) return { macd: null, macdSignal: null }
  const macdLine = Math.round((ema12 - ema26) * 100) / 100
  const macdSignal = Math.round(macdLine * 0.85 * 100) / 100
  return { macd: macdLine, macdSignal }
}

function calcRelVol(volumes) {
  if (!volumes || volumes.length < 2) return null
  const recent = volumes[volumes.length - 1]
  const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20)
  if (avg === 0) return null
  return Math.round((recent / avg) * 100) / 100
}

function calcChange1M(closes) {
  if (!closes || closes.length < 22) return null
  const current = closes[closes.length - 1]
  const monthAgo = closes[closes.length - 22]
  if (!monthAgo) return null
  return Math.round(((current - monthAgo) / monthAgo) * 100 * 10) / 10
}

function calcFundamentals(financials, currentPrice) {
  try {
    const results = financials?.results
    if (!results?.length) return null
    const latest = results[0]
    const income = latest?.financials?.income_statement
    const balance = latest?.financials?.balance_sheet
    if (!income || !balance) return null
    const netIncome   = income?.net_income_loss?.value ?? null
    const revenue     = income?.revenues?.value ?? null
    const eps         = income?.basic_earnings_per_share?.value ?? null
    const totalEquity = balance?.equity?.value ?? null
    const longTermDebt        = balance?.long_term_debt?.value ?? 0
    const currentLongTermDebt = balance?.current_portion_of_long_term_debt?.value ?? 0
    const shortTermDebt       = balance?.short_term_debt?.value ?? 0
    const financialDebt       = longTermDebt + currentLongTermDebt + shortTermDebt
    const totalLiabilities    = balance?.liabilities?.value ?? null
    const debtForRatio        = financialDebt > 0 ? financialDebt : (totalLiabilities ?? 0)
    const de = debtForRatio && totalEquity && totalEquity > 0
      ? Math.round((debtForRatio / totalEquity) * 100) / 100 : null
    const netMargin = revenue && netIncome
      ? Math.round((netIncome / revenue) * 1000) / 10 : null
    const roe = netIncome && totalEquity && totalEquity > 0
      ? Math.round((netIncome / totalEquity) * 1000) / 10 : null
    const pe = currentPrice && eps && eps > 0
      ? Math.round((currentPrice / eps) * 10) / 10 : null
    let epsGrowth = null
    if (results.length >= 5 && eps != null) {
      const yearAgo = results[4]?.financials?.income_statement?.basic_earnings_per_share?.value ?? null
      if (yearAgo != null && yearAgo !== 0) {
        epsGrowth = Math.round(((eps - yearAgo) / Math.abs(yearAgo)) * 1000) / 10
      }
    }
    return { netMargin, de, roe, pe, epsGrowth }
  } catch {
    return null
  }
}

// Devuelve null si la fecha es hoy o pasada
function calcEarningsDays(earningsDate) {
  if (!earningsDate) return null
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eDate = new Date(earningsDate)
    eDate.setHours(0, 0, 0, 0)
    const days = Math.round((eDate - today) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : null
  } catch {
    return null
  }
}

function isFutureDate(dateStr) {
  if (!dateStr) return false
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return d > today
  } catch {
    return false
  }
}

async function fetchEarnings(ticker, finnhubKey) {
  if (!finnhubKey) return {}

  const today    = new Date().toISOString().split('T')[0]
  const in90days = new Date(Date.now() + 90  * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ago30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let nextEarningsDate = null
  let lastEarningsDate = null      // fecha fiscal del período (ej. "2026-03-31")
  let lastEarningsReportDate = null // fecha real en que reportó (ej. "2026-05-07") — para el cache bypass
  let lastEarningsBeat = null

  // 1 — Próximos earnings (solo fechas futuras)
  try {
    const calRes = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(ticker)}&from=${today}&to=${in90days}&token=${finnhubKey}`,
      { headers: { 'X-Finnhub-Token': finnhubKey } }
    )
    if (calRes.ok) {
      const calData = await calRes.json()
      const candidates = (calData?.earningsCalendar || []).filter(e => isFutureDate(e.date))
      if (candidates.length) nextEarningsDate = candidates[0].date
    }
  } catch {}

  // 2 — Último earnings histórico: beat/miss desde endpoint de estimados
  try {
    const histRes = await fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(ticker)}&limit=4&token=${finnhubKey}`,
      { headers: { 'X-Finnhub-Token': finnhubKey } }
    )
    if (histRes.ok) {
      const histData = await histRes.json()
      if (histData?.length) {
        const last = histData[0]
        lastEarningsDate = last.period ?? null  // período fiscal (YYYY-MM-DD)
        if (last.actual != null && last.estimate != null) lastEarningsBeat = last.actual >= last.estimate
      }
    }
  } catch {}

  // 3 — Fecha real del reporte reciente desde el calendario hacia atrás (últimos 30 días)
  // Esto es distinto a lastEarningsDate (período fiscal) — es la fecha en que la empresa
  // efectivamente publicó resultados. Se usa para el cache bypass en narrative.
  try {
    const pastRes = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(ticker)}&from=${ago30days}&to=${today}&token=${finnhubKey}`,
      { headers: { 'X-Finnhub-Token': finnhubKey } }
    )
    if (pastRes.ok) {
      const pastData = await pastRes.json()
      const pastEarnings = pastData?.earningsCalendar || []
      // Tomar el más reciente que sea hoy o antes (no futuro)
      const pastDates = pastEarnings
        .filter(e => e.date && !isFutureDate(e.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      if (pastDates.length) lastEarningsReportDate = pastDates[0].date
    }
  } catch {}

  return { nextEarningsDate, lastEarningsDate, lastEarningsReportDate, lastEarningsBeat }
}

async function alertYahooDown(ticker, errorMsg) {
  const resendKey  = process.env.RESEND_API_KEY
  const alertEmail = process.env.ALERT_EMAIL
  if (!resendKey || !alertEmail) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'alerts@tuasesorfinanciero.com',
        to: alertEmail,
        subject: `[Tu Asesor Financiero] Yahoo Finance no responde — ${ticker}`,
        html: `<p><strong>Yahoo Finance no respondió</strong> para <code>${ticker}</code>.</p><p><strong>Error:</strong> ${errorMsg}</p><p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>`,
      }),
    })
  } catch {
    console.error('[alert] No se pudo enviar alerta de Yahoo Finance')
  }
}

let lastYahooAlertAt = 0
const YAHOO_ALERT_COOLDOWN_MS = 30 * 60 * 1000

async function fetchInternationalData(ticker) {
  const currency = getCurrency(ticker)
  const fxSym = getFxTicker(currency)
  const YH = { 'User-Agent': 'Mozilla/5.0' }

  const [chartRes, summaryRes, fxRes] = await Promise.all([
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`, { headers: YH }),
    fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData,defaultKeyStatistics,assetProfile`, { headers: YH }),
    fxSym
      ? fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fxSym)}?interval=1d&range=1d`, { headers: YH })
      : Promise.resolve(null),
  ])

  let price = null, priceChangeToday = null, open = null, high = null, low = null
  let companyName = ticker, sector = null, exchange = null
  let ma50 = null, ma200 = null, rsi = null, macd = null, macdSignal = null
  let relVol = null, change1m = null, high52 = null, low52 = null

  if (chartRes.ok) {
    const chart = await chartRes.json()
    const result = chart?.chart?.result?.[0]
    const meta = result?.meta
    if (meta) {
      price            = meta.regularMarketPrice ?? null
      priceChangeToday = meta.regularMarketPrice && meta.previousClose
        ? parseFloat(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
        : null
      open     = meta.regularMarketOpen ?? null
      high     = meta.regularMarketDayHigh ?? null
      low      = meta.regularMarketDayLow ?? null
      companyName = meta.longName || meta.shortName || ticker
      exchange = meta.fullExchangeName || meta.exchangeName || null
    }
    const quotes  = result?.indicators?.quote?.[0] || {}
    const closes  = (quotes.close  || []).filter(v => v != null)
    const highs   = (quotes.high   || []).filter(v => v != null)
    const lows    = (quotes.low    || []).filter(v => v != null)
    const volumes = (quotes.volume || []).filter(v => v != null)
    if (closes.length >= 20) {
      ma50       = calcMA(closes, 50)
      ma200      = calcMA(closes, 200)
      rsi        = calcRSI(closes, 14)
      const m    = calcMACD(closes)
      macd       = m.macd
      macdSignal = m.macdSignal
      relVol     = calcRelVol(volumes)
      change1m   = calcChange1M(closes)
      high52     = Math.round(Math.max(...highs) * 100) / 100
      low52      = Math.round(Math.min(...lows) * 100) / 100
    }
  }

  let fundamentals = null
  if (summaryRes.ok) {
    const summary = await summaryRes.json()
    const r       = summary?.quoteSummary?.result?.[0]
    const fin     = r?.financialData
    const stats   = r?.defaultKeyStatistics
    const profile = r?.assetProfile
    if (profile?.sector) sector = profile.sector
    if (fin || stats) {
      fundamentals = {
        pe:        stats?.trailingPE?.raw ?? null,
        netMargin: fin?.profitMargins?.raw   != null ? Math.round(fin.profitMargins.raw   * 1000) / 10 : null,
        roe:       fin?.returnOnEquity?.raw  != null ? Math.round(fin.returnOnEquity.raw  * 1000) / 10 : null,
        de:        fin?.debtToEquity?.raw    != null ? Math.round(fin.debtToEquity.raw    * 100)  / 100 : null,
        epsGrowth: fin?.earningsGrowth?.raw  != null ? Math.round(fin.earningsGrowth.raw  * 1000) / 10 : null,
      }
    }
  }

  let fxRate = null
  if (fxRes?.ok) {
    const fxData = await fxRes.json()
    fxRate = fxData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  }

  return { companyName, sector, exchange, currency, fxRate, price, priceChangeToday, open, high, low, ma50, ma200, rsi, macd, macdSignal, relVol, change1m, high52, low52, fundamentals }
}

export async function POST(request) {
  try {
    const ip = getIP(request)
    const { allowed, retryAfter } = await checkRateLimit(ip, 'market-data')
    if (!allowed) {
      return Response.json(
        { error: 'Demasiadas consultas. Intentá de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json().catch(() => null)
    const t = validateTicker(body?.ticker)
    if (!t) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    const polygonKey = process.env.POLYGON_API_KEY
    const finnhubKey = process.env.FINNHUB_API_KEY
    if (!polygonKey) return Response.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })

    // International stocks: Yahoo Finance path
    if (isInternational(t)) {
      const intlData = await fetchInternationalData(t)

      const { nextEarningsDate, lastEarningsDate, lastEarningsReportDate, lastEarningsBeat } = await fetchEarnings(t, finnhubKey)
      const nextEarningsDays = calcEarningsDays(nextEarningsDate)

      let news = []
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const newsRes = await fetch(
          `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(t)}&limit=5&order=desc&sort=published_utc&published_utc.gte=${thirtyDaysAgo}&apiKey=${polygonKey}`
        )
        const newsData = await newsRes.json()
        news = (newsData.results || []).slice(0, 5).map(n => ({
          title: n.title, published: n.published_utc,
          url: n.article_url, publisher: n.publisher?.name,
        }))
      } catch {}

      return Response.json({
        ticker: t,
        ...intlData,
        news,
        nextEarningsDate, nextEarningsDays,
        lastEarningsDate, lastEarningsReportDate, lastEarningsBeat,
        fetchedAt: new Date().toISOString(),
      })
    }

    // 1 — Datos de la empresa
    let companyName = t, sector = null
    try {
      const detRes = await fetch(`https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(t)}?apiKey=${polygonKey}`)
      const det = await detRes.json()
      companyName = det.results?.name || t
      sector = det.results?.sic_description || null
    } catch {}

    // 2 — Precio en tiempo real (Yahoo Finance)
    let price = null, priceChangeToday = null, open = null, high = null, low = null
    try {
      const yhRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      if (!yhRes.ok) throw new Error(`Yahoo respondió ${yhRes.status}`)
      const yhData = await yhRes.json()
      const meta = yhData?.chart?.result?.[0]?.meta
      if (!meta) throw new Error('Respuesta de Yahoo sin datos de precio')
      price            = meta.regularMarketPrice ?? meta.previousClose ?? null
      priceChangeToday = meta.regularMarketPrice && meta.previousClose
        ? parseFloat(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2))
        : null
      open  = meta.regularMarketOpen ?? null
      high  = meta.regularMarketDayHigh ?? null
      low   = meta.regularMarketDayLow ?? null
    } catch (yahooErr) {
      console.error(`[market-data] Yahoo Finance falló para ${t}:`, yahooErr?.message)
      if (Date.now() - lastYahooAlertAt > YAHOO_ALERT_COOLDOWN_MS) {
        lastYahooAlertAt = Date.now()
        alertYahooDown(t, yahooErr?.message)
      }
    }

    // 3 — Histórico 1 año → indicadores técnicos
    let ma50 = null, ma200 = null, rsi = null, macd = null, macdSignal = null
    let relVol = null, change1m = null, high52 = null, low52 = null
    try {
      const to   = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const histRes = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=365&apiKey=${polygonKey}`
      )
      const hist = await histRes.json()
      const bars = hist.results || []
      if (bars.length >= 20) {
        const closes  = bars.map(b => b.c)
        const highs   = bars.map(b => b.h)
        const lows    = bars.map(b => b.l)
        const volumes = bars.map(b => b.v)
        ma50       = calcMA(closes, 50)
        ma200      = calcMA(closes, 200)
        rsi        = calcRSI(closes, 14)
        const m    = calcMACD(closes)
        macd       = m.macd
        macdSignal = m.macdSignal
        relVol     = calcRelVol(volumes)
        change1m   = calcChange1M(closes)
        high52     = Math.round(Math.max(...highs) * 100) / 100
        low52      = Math.round(Math.min(...lows) * 100) / 100
      }
    } catch {}

    // 4 — Fundamentales TTM
    let fundamentals = null
    try {
      const finRes = await fetch(
        `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(t)}&limit=5&timeframe=quarterly&sort=period_of_report_date&order=desc&apiKey=${polygonKey}`
      )
      const finData = await finRes.json()
      fundamentals = calcFundamentals(finData, price)
    } catch {}

    // 5 — Earnings (Finnhub) — ahora incluye lastEarningsReportDate
    const { nextEarningsDate, lastEarningsDate, lastEarningsReportDate, lastEarningsBeat } = await fetchEarnings(t, finnhubKey)
    const nextEarningsDays = calcEarningsDays(nextEarningsDate)

    // 6 — Noticias
    let news = []
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const newsRes = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(t)}&limit=10&order=desc&sort=published_utc&published_utc.gte=${sevenDaysAgo}&apiKey=${polygonKey}`
      )
      const newsData = await newsRes.json()
      if (!newsData.results?.length) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const newsRes2 = await fetch(
          `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(t)}&limit=5&order=desc&sort=published_utc&published_utc.gte=${thirtyDaysAgo}&apiKey=${polygonKey}`
        )
        const newsData2 = await newsRes2.json()
        news = (newsData2.results || []).slice(0, 5).map(n => ({
          title: n.title, published: n.published_utc,
          url: n.article_url, publisher: n.publisher?.name,
        }))
      } else {
        news = newsData.results.slice(0, 5).map(n => ({
          title: n.title, published: n.published_utc,
          url: n.article_url, publisher: n.publisher?.name,
        }))
      }
    } catch {}

    return Response.json({
      ticker: t, companyName, sector, news,
      price, priceChangeToday, open, high, low,
      ma50, ma200, rsi, macd, macdSignal,
      relVol, change1m, high52, low52,
      fundamentals,
      nextEarningsDate, nextEarningsDays,
      lastEarningsDate,
      lastEarningsReportDate,  // fecha real del reporte — usada para cache bypass en narrative
      lastEarningsBeat,
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('[market-data]', err?.message)
    return Response.json({ error: 'Error al obtener datos del mercado.' }, { status: 500 })
  }
}
