// app/api/events/[ticker]/route.js
// GET /api/events/:ticker  — returns up to 5 recent events via Claude web search
import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'
import { validateEvents } from '@/lib/validate-events'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const CACHE_TTL_HOURS = 6

async function getCached(ticker) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('events_cache')
      .select('data, created_at')
      .eq('ticker', ticker)
      .single()
    if (error || !data) return null
    const ageHours = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60)
    if (ageHours > CACHE_TTL_HOURS) {
      await supabase.from('events_cache').delete().eq('ticker', ticker)
      return null
    }
    return data.data
  } catch {
    return null
  }
}

async function setCached(ticker, payload) {
  if (!supabase) return
  try {
    await supabase
      .from('events_cache')
      .upsert({ ticker, data: payload, created_at: new Date().toISOString() })
  } catch (e) {
    console.error('[events] Error guardando caché:', e.message)
  }
}

async function callClaudeWithSearch(claudeKey, promptText) {
  const messages = [{ role: 'user', content: promptText }]

  // Up to 6 turns to handle web_search tool loops
  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || `HTTP ${res.status}`
      console.error('[events] Error Anthropic:', msg)
      throw new Error('Error al contactar la IA.')
    }

    const data = await res.json()
    const textBlock = data.content?.find(b => b.type === 'text')

    // Final answer — has a text block (regardless of stop_reason)
    if (textBlock?.text) return textBlock.text

    if (data.stop_reason === 'tool_use') {
      // Claude wants to search — add assistant turn and continue
      messages.push({ role: 'assistant', content: data.content })

      const toolUses = (data.content || []).filter(b => b.type === 'tool_use')
      if (toolUses.length > 0) {
        // For web_search (server-side): Anthropic ran the search.
        // Provide tool_result to continue the conversation.
        messages.push({
          role: 'user',
          content: toolUses.map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: 'Search completed. Please now format the JSON response.',
          })),
        })
      }
      continue
    }

    // Unexpected stop_reason — bail out
    break
  }

  throw new Error('No se obtuvo respuesta de texto de Claude.')
}

export async function GET(request, { params }) {
  try {
    const ticker = validateTicker(params.ticker)
    if (!ticker) {
      return Response.json({ error: 'Ticker inválido.' }, { status: 400 })
    }

    const ip = getIP(request)
    const { allowed, retryAfter } = await checkRateLimit(ip, 'events')
    if (!allowed) {
      return Response.json(
        { error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const claudeKey = process.env.ANTHROPIC_API_KEY
    if (!claudeKey) {
      return Response.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
    }

    // Cache check
    const cached = await getCached(ticker)
    if (cached) {
      console.log(`[events] Cache HIT: ${ticker}`)
      return Response.json(cached)
    }
    console.log(`[events] Cache MISS: ${ticker} — llamando a Claude con web_search`)

    const today = new Date().toISOString().split('T')[0]

    const prompt = `Hoy es ${today}. Buscá en la web y devolvé los 5 eventos o noticias más recientes e importantes de los últimos 30 días que afectan al ticker ${ticker}.

INSTRUCCIONES:
- Buscá noticias reales y recientes (30 días desde hoy)
- Priorizá: earnings, cambios regulatorios, productos nuevos, M&A, upgrades/downgrades de analistas
- Si encontrás menos de 5, devolvé los que encontraste
- Cada URL debe ser real y verificable
- Respondé ÚNICAMENTE con JSON válido, sin texto antes ni después

JSON esperado:
{
  "ticker": "${ticker}",
  "generated_at": "${new Date().toISOString()}",
  "events": [
    {
      "title": "Título descriptivo del evento",
      "source": "Nombre de la fuente (Reuters, Bloomberg, SEC, etc.)",
      "url": "https://url-real-del-articulo.com",
      "date": "YYYY-MM-DD",
      "event_type": "earnings|estrategia|regulacion|producto|macro|analista|M&A|geopolitica|otro",
      "impact_magnitude": "alto|medio|bajo",
      "affected_metric": "revenue|margins|growth|sentiment|regulatory|supply_chain",
      "summary": "1-2 oraciones explicando qué ocurrió y por qué es importante para ${ticker}.",
      "directional_bias": "positivo|negativo|neutral|ambiguo"
    }
  ]
}`

    const rawText = await callClaudeWithSearch(claudeKey, prompt)

    // Extract JSON from response
    const s = rawText.indexOf('{')
    const e = rawText.lastIndexOf('}')
    if (s === -1 || e === -1) {
      console.error('[events] Respuesta sin JSON:', rawText.slice(0, 200))
      throw new Error('Respuesta de IA en formato inesperado.')
    }

    let parsed
    try {
      parsed = JSON.parse(rawText.slice(s, e + 1))
    } catch (parseErr) {
      console.error('[events] Error parseando JSON:', parseErr.message)
      throw new Error('Error al parsear respuesta de IA.')
    }

    const { valid, events, issues } = validateEvents(parsed)
    if (issues.length > 0) {
      console.warn('[events] Advertencias de validación:', issues)
    }
    if (!valid) {
      throw new Error('No se encontraron eventos válidos en la respuesta.')
    }

    const payload = {
      ticker,
      generated_at: new Date().toISOString(),
      events,
    }

    await setCached(ticker, payload)
    return Response.json(payload)

  } catch (err) {
    console.error('[events]', err?.message)
    return Response.json({ error: 'Error al buscar eventos recientes.' }, { status: 500 })
  }
}
