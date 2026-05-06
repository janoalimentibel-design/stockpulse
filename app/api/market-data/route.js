// app/api/market-data/route.js
import { validateTicker } from '@/lib/validate'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

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

function calcEarningsDays(earningsDate) {
  if (!earningsDate) return null
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eDate = new Date(earningsDate)
    eDate.setHours(0, 0, 0, 0)
    return Math.round((eDate - today) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

async function fetchEarnings(ticker, finnhubKey) {
  if (!finnhubKey) return {}

  const today      = new Date().toISOString().split('T')[0]
  const in90days   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ago180days = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let nextEarningsDate = null, lastEarningsDate = null, lastEarningsBeat = null

  try {
    const calRes = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(ticker)}&from=${today}&to=${in90days}&token=${finnhubKey}`,
      { headers: { 'X-Finnhub-Token': finnhubKey } }
    )
    if (calRes.ok) {
      const calData = await calRes.json()
      if (calData?.earningsCalendar?.length) nextEarningsDate = calData.earningsCalendar[0].date
    }
  } catch {}

  try {
    const histRes = await fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(ticker)}&limit=4&token=${finnhubKey}`,
      { headers: { 'X-Finnhub-Token': finnhubKey } }
    )
    if (histRes.ok) {
      const histData = await histRes.json()
      if (histData?.length) {
        const last = histData[0]
        lastEarningsDate = last.period ?? null
        if (last.actual != null && last.estimate != null) lastEarningsBeat = last.actual >= last.estimate
      }
    }
  } catch {}

  if (!nextEarningsDate) {
    try {
      const pastRes = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(ticker)}&from=${ago180days}&to=${today}&token=${finnhubKey}`,
        { headers: { 'X-Finnhub-Token': finnhubKey } }
      )
      if (pastRes.ok) {
        const pastData = await pastRes.json()
        const pastEarnings = pastData?.earningsCalendar
        if (pastEarnings?.length) nextEarningsDate = pastEarnings[pastEarnings.length - 1].date
      }
    } catch {}
  }

  return { nextEarningsDate, lastEarningsDate, lastEarningsBeat }
}

/**
 * Alerta por email cuando Yahoo Finance falla.
 * Solo llega a ALERT_EMAIL — nunca al usuario.
 * Si Resend no está configurado, falla silenciosamente.
 */
async function alertYahooDown(ticker, errorMsg) {
  const resendKey  = process.env.RESEND_API_KEY
  const alertEmail = process.env.ALERT_EMAIL
  if (!resendKey || !alertEmail) return  // no configurado → silencio

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'alerts@stockpulse.app',  // cambiar a tu dominio verificado en Resend
        to: alertEmail,
        subject: `[StockPulse] Yahoo Finance no responde — ${ticker}`,
        html: `
          <p><strong>Yahoo Finance no respondió</strong> para el ticker <code>${ticker}</code>.</p>
          <p><strong>Error:</strong> ${errorMsg}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p>El precio en tiempo real no estará disponible hasta que se restablezca la conexión.</p>
          <hr>
          <p style="color:#666;font-size:12px">StockPulse · alerta automática</p>
        `,
      }),
    })
  } catch {
    // Si el email falla, solo logueamos — nunca propagar el error
    console.error('[alert] No se pudo enviar alerta de Yahoo Finance')
  }
}

// Control para no enviar la misma alerta repetidamente en la misma instancia del servidor
let lastYahooAlertAt = 0
const YAHOO_ALERT_COOLDOWN_MS = 30 * 60 * 1000 // 1 alerta cada 30 minutos como máximo

export async function POST(request) {
  try {
    // Rate limiting — 30 requests por IP por hora
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
      // Enviar alerta solo si pasó suficiente tiempo desde la última
      if (Date.now() - lastYahooAlertAt > YAHOO_ALERT_COOLDOWN_MS) {
        lastYahooAlertAt = Date.now()
        alertYahooDown(t, yahooErr?.message)  // fire and forget — no await
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

    // 5 — Earnings (Finnhub)
    const { nextEarningsDate, lastEarningsDate, lastEarningsBeat } = await fetchEarnings(t, finnhubKey)
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
      lastEarningsDate, lastEarningsBeat,
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('[market-data]', err?.message)
    return Response.json({ error: 'Error al obtener datos del mercado.' }, { status: 500 })
  }
}
