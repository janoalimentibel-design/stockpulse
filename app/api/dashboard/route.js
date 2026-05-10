// app/api/dashboard/route.js
// Env vars: POSTHOG_PERSONAL_API_KEY · POSTHOG_PROJECT_ID
import { NextResponse } from 'next/server'

const HOST    = 'https://app.posthog.com'
const PROJECT = process.env.POSTHOG_PROJECT_ID
const KEY     = process.env.POSTHOG_PERSONAL_API_KEY

export const revalidate = 60

async function phFetch(path) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    next: { revalidate: 60 },
  }).catch(() => null)
  if (!res?.ok) return null
  return res.json()
}

export async function GET() {
  if (!PROJECT || !KEY)
    return NextResponse.json({ error: 'Missing Posthog env vars' }, { status: 500 })

  const now   = new Date()
  const ago7  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString()
  const ago30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [completedData, searchedData] = await Promise.all([
    phFetch(`/events/?event=analysis_completed&after=${ago30}&limit=1000&orderBy=-timestamp`),
    phFetch(`/events/?event=ticker_searched&after=${ago30}&limit=1000&orderBy=-timestamp`),
  ])

  const completed = completedData?.results || []
  const searched  = searchedData?.results  || []
  const allEvents = [...completed, ...searched]

  const todayStr = now.toDateString()

  // ── Métricas de producto ─────────────────────────────────
  const tickerCounts = {}
  const tickerScores = {}
  const trendCounts  = { alcista: 0, bajista: 0, neutral: 0 }
  const scoreBuckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
  let todayCount = 0, sevenDayCount = 0, narrativeOk = 0, scoreSum = 0, scoreN = 0

  const dailyMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    dailyMap[d.toDateString()] = { label: d.toLocaleDateString('es', { weekday: 'short' }), count: 0 }
  }

  for (const e of completed) {
    const p  = e.properties || {}
    const ts = new Date(e.timestamp)
    const day = ts.toDateString()

    if (day === todayStr) todayCount++
    if (ts >= new Date(ago7)) { sevenDayCount++; if (dailyMap[day]) dailyMap[day].count++ }

    const ticker = p.ticker
    if (ticker) {
      tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1
      if (p.score != null) { tickerScores[ticker] = tickerScores[ticker] || []; tickerScores[ticker].push(Number(p.score)) }
    }

    const trend = (p.trend || '').toLowerCase()
    if (trend in trendCounts) trendCounts[trend]++

    if (p.score != null) {
      const s = Number(p.score); scoreSum += s; scoreN++
      if (s <= 20) scoreBuckets['0-20']++
      else if (s <= 40) scoreBuckets['21-40']++
      else if (s <= 60) scoreBuckets['41-60']++
      else if (s <= 80) scoreBuckets['61-80']++
      else scoreBuckets['81-100']++
    }
    if (p.narrative_ok) narrativeOk++
  }

  const topTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => {
      const scores = tickerScores[name] || []
      return { name, count, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null }
    })

  // ── Inteligencia de usuarios ─────────────────────────────
  const userMap = {}

  for (const e of allEvents) {
    const uid    = e.distinct_id
    const ticker = e.properties?.ticker
    const ts     = new Date(e.timestamp)

    if (!userMap[uid]) userMap[uid] = { analyses: 0, searches: 0, tickers: [], firstSeen: ts, lastSeen: ts }

    const u = userMap[uid]
    if (e.event === 'analysis_completed') u.analyses++
    if (e.event === 'ticker_searched')    u.searches++
    if (ticker && !u.tickers.includes(ticker)) u.tickers.push(ticker)
    if (ts < u.firstSeen) u.firstSeen = ts
    if (ts > u.lastSeen)  u.lastSeen  = ts
  }

  const users = Object.entries(userMap).map(([id, u]) => ({ ...u, id }))
  const totalUsers  = users.length
  const activeToday = users.filter(u => new Date(u.lastSeen).toDateString() === todayStr).length
  const active7d    = users.filter(u => new Date(u.lastSeen) >= new Date(ago7)).length
  const powerUsers  = users.filter(u => u.analyses >= 5).length

  const freqBuckets = { '1': 0, '2-4': 0, '5-9': 0, '10+': 0 }
  for (const u of users) {
    if      (u.analyses === 1) freqBuckets['1']++
    else if (u.analyses <= 4)  freqBuckets['2-4']++
    else if (u.analyses <= 9)  freqBuckets['5-9']++
    else                       freqBuckets['10+']++
  }

  // Co-ocurrencia: tickers que el mismo usuario busca juntos
  const coOccurrence = {}
  for (const u of users) {
    if (u.tickers.length < 2) continue
    for (let i = 0; i < u.tickers.length; i++) {
      for (let j = i + 1; j < u.tickers.length; j++) {
        const [a, b] = [u.tickers[i], u.tickers[j]]
        coOccurrence[a] = coOccurrence[a] || {}; coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1
        coOccurrence[b] = coOccurrence[b] || {}; coOccurrence[b][a] = (coOccurrence[b][a] || 0) + 1
      }
    }
  }

  const pairs = []
  for (const [a, related] of Object.entries(coOccurrence))
    for (const [b, count] of Object.entries(related))
      if (a < b) pairs.push({ a, b, count })
  const topPairs = pairs.sort((x, y) => y.count - x.count).slice(0, 8)

  return NextResponse.json({
    today: todayCount, sevenDays: sevenDayCount, thirtyDays: completed.length,
    uniqueTickers: Object.keys(tickerCounts).length,
    trendCounts, scoreBuckets, topTickers,
    daily: Object.values(dailyMap),
    avgScore:      scoreN ? Math.round(scoreSum / scoreN) : 0,
    narrativeRate: completed.length ? Math.round(narrativeOk / completed.length * 100) : 0,
    recent: completed.slice(0, 15).map(e => ({
      ticker: e.properties?.ticker || '—', score: e.properties?.score ?? null,
      trend: e.properties?.trend || 'neutral', timestamp: e.timestamp,
    })),
    users: {
      total: totalUsers, activeToday, active7d, powerUsers,
      avgPerUser: totalUsers ? +(completed.length / totalUsers).toFixed(1) : 0,
      maxPerUser: users.reduce((m, u) => Math.max(m, u.analyses), 0),
      freqBuckets, topPairs,
      topByVolume: users.sort((a, b) => b.analyses - a.analyses).slice(0, 5).map(u => ({
        id:        u.id.slice(0, 8) + '…',
        analyses:  u.analyses,
        searches:  u.searches,
        tickers:   u.tickers.slice(0, 5),
        lastSeen:  u.lastSeen,
      })),
    },
    generatedAt: now.toISOString(),
  })
}
