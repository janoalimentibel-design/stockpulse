// app/api/dashboard/qa/route.js
import { supabase } from '@/lib/supabase'

export async function GET(request) {
  if (!supabase) {
    return Response.json({ error: 'Supabase no configurado' }, { status: 500 })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [feedbackResult, cacheResult] = await Promise.all([
    supabase
      .from('narrative_feedback')
      .select('ticker, rating, created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('narrative_cache')
      .select('ticker, data, created_at'),
  ])

  const feedbackRows = feedbackResult.data || []
  const cacheRows    = cacheResult.data  || []

  // Build a map from ticker -> cache row for fast lookup
  const cacheMap = {}
  for (const row of cacheRows) {
    cacheMap[row.ticker] = row
  }

  // Stats
  const totalFeedback    = feedbackRows.length
  const thumbsUp         = feedbackRows.filter(f => f.rating === 'up').length
  const thumbsDown       = feedbackRows.filter(f => f.rating === 'down').length
  const upRate           = totalFeedback > 0 ? Math.round(thumbsUp / totalFeedback * 100) : 0
  const cachedNarratives = cacheRows.length
  const warningCount     = cacheRows.filter(r => r.data && r.data._validation_warning === true).length

  // Recent feedback (last 20)
  const recentFeedback = feedbackRows.slice(0, 20).map(f => {
    const cached = cacheMap[f.ticker] || null
    return {
      ticker:     f.ticker,
      rating:     f.rating,
      createdAt:  f.created_at,
      narrative:  cached ? cached.data : null,
      hasWarning: cached && cached.data && cached.data._validation_warning === true,
    }
  })

  // Warnings: all caches with _validation_warning === true, sorted by created_at DESC
  const warnings = cacheRows
    .filter(r => r.data && r.data._validation_warning === true)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(r => ({
      ticker:    r.ticker,
      cachedAt:  r.created_at,
      narrative: r.data,
    }))

  return Response.json({
    stats: { totalFeedback, thumbsUp, thumbsDown, upRate, cachedNarratives, warningCount },
    recentFeedback,
    warnings,
  })
}
