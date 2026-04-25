// app/api/narrative/route.js
// UNA sola llamada a Claude que devuelve:
// - datos numéricos (precio, RSI, MA50, MA200, etc.)
// - narrativa completa en español
// Así evitamos el rate limit por llamadas dobles.

export async function POST(request) {
  try {
    const { data, claudeKey } = await request.json()
    if (!data || !claudeKey) {
      return Response.json({ error: 'Faltan datos o API key de Anthropic.' }, { status: 400 })
    }

    const { ticker, companyName, sector, news } = data

    const today = new Date().toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const newsContext = news?.length
      ? news.map(n => `- ${n.title} (${n.publisher || ''}, ${n.published?.split('T')[0] || ''})`).join('\n')
      : 'No hay noticias disponibles.'

    const prompt = `Hoy es ${today}. Sos un analista financiero experto escribiendo para el inversor hispanoparlante no profesional.

Buscá los datos más recientes de la acción ${ticker} (${companyName || ticker}${sector ? ', ' + sector : ''}) y respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "extraData": {
    "price": número_precio_actual,
    "priceChangeToday": número_variación_hoy_en_pct,
    "ma50": número_ma50,
    "ma200": número_ma200,
    "high52": número_máximo_52_semanas,
    "low52": número_mínimo_52_semanas,
    "change1m": número_cambio_1_mes_en_pct,
    "rsi": número_rsi_14,
    "macd": número_macd,
    "macdSignal": número_señal_macd,
    "relVol": número_volumen_relativo,
    "pe": número_pe_ratio,
    "peSector": número_pe_del_sector,
    "epsGrowth": número_crecimiento_eps_anual_pct,
    "netMargin": número_margen_neto_pct,
    "de": número_deuda_patrimonio,
    "roe": número_roe_pct,
    "divYield": número_dividend_yield_pct
  },
  "technical_summary": "2-3 oraciones sobre la situación técnica actual. Mencioná tendencia, medias móviles, RSI y momentum con los números reales.",
  "fundamental_summary": "2-3 oraciones sobre el contexto fundamental. Mencioná valuación vs sector, crecimiento y márgenes.",
  "market_sentiment": "2-3 oraciones sobre el sentimiento de mercado actual para esta acción y su sector.",
  "analyst_summary": "2-3 oraciones sobre lo más relevante para el inversor ahora mismo. Oportunidades y riesgos balanceados.",
  "news_context": ["titular 1 en español con una línea de contexto de impacto", "titular 2", "titular 3"],
  "key_opportunity": "Una oración concreta sobre la oportunidad principal ahora.",
  "key_risk": "Una oración concreta sobre el riesgo principal ahora.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte"
}

Noticias disponibles de Polygon:
${newsContext}

Usá null para valores numéricos no disponibles. Todos los valores en extraData deben ser números, no strings.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return Response.json(
        { error: err.error?.message || `Error Anthropic HTTP ${res.status}` },
        { status: res.status }
      )
    }

    const anthropicData = await res.json()
    const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    if (s === -1 || e === -1) throw new Error('Claude no devolvió JSON válido.')

    const parsed = JSON.parse(raw.slice(s, e + 1))
    return Response.json(parsed)
  } catch (err) {
    return Response.json({ error: err.message || 'Error generando narrativa.' }, { status: 500 })
  }
}
