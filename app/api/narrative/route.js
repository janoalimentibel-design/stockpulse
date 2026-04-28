// app/api/narrative/route.js
const cache = new Map()
const CACHE_TTL = 4 * 60 * 60 * 1000

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}
function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

export async function POST(request) {
  try {
    const { data } = await request.json()
    if (!data) return Response.json({ error: 'Faltan datos.' }, { status: 400 })

    const claudeKey = process.env.ANTHROPIC_API_KEY
    if (!claudeKey) return Response.json({ error: 'Claude API key no configurada en el servidor.' }, { status: 500 })

    const { ticker, companyName, sector, news, price, priceChangeToday, high, low } = data

    const cacheKey = ticker?.toUpperCase()
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[narrative] Cache HIT: ${cacheKey}`)
      return Response.json(cached)
    }
    console.log(`[narrative] Cache MISS: ${cacheKey} — llamando a Claude`)

    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const newsContext = news?.length
      ? news.map(n => `- ${n.title} (${n.publisher || ''}, ${n.published?.split('T')[0] || ''})`).join('\n')
      : 'No hay noticias disponibles.'

    const priceContext = price
      ? `Precio actual: $${price} (${priceChangeToday >= 0 ? '+' : ''}${priceChangeToday}% hoy) · Rango día: $${low} – $${high}`
      : 'Precio no disponible.'

    const prompt = `Hoy es ${today}. Sos un analista financiero experto escribiendo para el inversor hispanoparlante no profesional.

Acción: ${ticker} — ${companyName || ticker}${sector ? ' · ' + sector : ''}
${priceContext}

NOTICIAS DE HOY (fuente: Polygon):
${newsContext}

Tu tarea: escribir un análisis narrativo de esta acción usando tu conocimiento actualizado de los fundamentales, valuación, situación técnica y consenso de analistas de ${ticker}. Usá los datos de precio y noticias de arriba cuando sean relevantes.

Respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "technical_summary": "2-3 oraciones sobre la situación técnica actual — tendencia, medias móviles, momentum.",
  "fundamental_summary": "2-3 oraciones sobre fundamentales y valuación — P/E, crecimiento, márgenes, deuda.",
  "analyst_summary": "2-3 oraciones sobre lo más relevante para el inversor ahora, integrando las noticias recientes.",
  "key_opportunity": "Una oración concreta sobre la oportunidad principal en este momento.",
  "key_risk": "Una oración concreta sobre el riesgo principal en este momento.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte"
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return Response.json({ error: err.error?.message || `Error Anthropic HTTP ${res.status}` }, { status: res.status })
    }

    const anthropicData = await res.json()
    const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
    if (s === -1 || e === -1) throw new Error('Claude no devolvió JSON válido.')
    const parsed = JSON.parse(raw.slice(s, e + 1))

    setCached(cacheKey, parsed)
    return Response.json(parsed)

  } catch (err) {
    return Response.json({ error: err.message || 'Error generando narrativa.' }, { status: 500 })
  }
}
