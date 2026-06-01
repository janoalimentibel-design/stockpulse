// app/api/feedback/route.js
import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { ticker: rawTicker, rating } = body ?? {}

  const ticker = validateTicker(rawTicker)
  if (!ticker) {
    return Response.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  if (rating !== 'up' && rating !== 'down') {
    return Response.json({ error: 'Invalid rating — must be "up" or "down"' }, { status: 400 })
  }

  if (!supabase) {
    console.warn('[feedback] Supabase not configured — running in degraded mode, feedback not persisted')
    return Response.json({ ok: true })
  }

  const { error } = await supabase
    .from('narrative_feedback')
    .insert({ ticker, rating })

  if (error) {
    console.error('[feedback] Supabase insert error:', error)
    return Response.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
