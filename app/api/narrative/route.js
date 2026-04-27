// app/api/narrative/route.js
// Caché en memoria — reduce llamadas a Claude cuando distintos usuarios buscan el mismo ticker
const cache = new Map() // { ticker_RANGE: { data, ts } }
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 horas en ms

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

    const { ticker, companyName, sector, news } = data

    // Intentar caché primero
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

    const prompt = `Hoy es ${today}. Sos un analista financiero experto escribiendo para el inversor hispanoparlante no profesional.

Buscá los datos más recientes de la acción ${ticker} (${companyName || ticker}${sector ? ', ' + sector : ''}) y respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "extraData": {
    "price": precio_actual,
    "priceChangeToday": variacion_hoy_pct,
    "ma50": ma50,
    "ma200": ma200,
    "high52": maximo_52_semanas,
    "low52": minimo_52_semanas,
    "change1m": cambio_1_mes_pct,
    "rsi": rsi_14,
    "macd": macd,
    "macdSignal": senal_macd,
    "relVol": volumen_relativo,
    "pe": pe_ratio,
    "peSector": pe_del_sector,
    "epsGrowth": crecimiento_eps_anual_pct,
    "netMargin": margen_neto_pct,
    "de": deuda_patrimonio,
    "roe": roe_pct,
    "divYield": dividend_yield_pct
  },
  "technical_summary": "2-3 oraciones sobre la situación técnica actual con números reales.",
  "fundamental_summary": "2-3 oraciones sobre el contexto fundamental y valuación.",
  "market_sentiment": "2-3 oraciones sobre el sentimiento de mercado actual.",
  "analyst_summary": "2-3 oraciones sobre lo más relevante para el inversor ahora.",
  "news_context": ["titular 1 con contexto de impacto", "titular 2", "titular 3"],
  "key_opportunity": "Una oración sobre la oportunidad principal ahora.",
  "key_risk": "Una oración sobre el riesgo principal ahora.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte"
}

Noticias de Polygon:
${newsContext}

Usá null para valores no disponibles. Todos los valores en extraData deben ser números.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
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

    // Guardar en caché
    setCached(cacheKey, parsed)

    return Response.json(parsed)
  } catch (err) {
    return Response.json({ error: err.message || 'Error generando narrativa.' }, { status: 500 })
  }
}
