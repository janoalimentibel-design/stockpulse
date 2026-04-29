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

// Sanitiza output de Claude: quita cite tags, artefactos, y saltos raros
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/]*>/gi, '')
    .replace(/<\/antml:cite>/gi, '')
    .replace(/<[^>]+>/g, '')           // cualquier otro tag HTML
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sanitizeNarrative(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const sanitized = {}
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) {
      sanitized[key] = obj[key].map(item => typeof item === 'string' ? sanitizeText(item) : item)
    } else if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeText(obj[key])
    } else {
      sanitized[key] = obj[key]
    }
  }
  return sanitized
}

// Valida que la narrativa no contradiga el panel — Fix #2
function validateNarrative(narrative, panelData) {
  const issues = []
  const tech = (narrative.technical_summary || '').toLowerCase()
  const fund = (narrative.fundamental_summary || '').toLowerCase()
  const analyst = (narrative.analyst_summary || '').toLowerCase()
  const allText = tech + ' ' + fund + ' ' + analyst

  const { cruceMA, rsi, position52w, score, trend } = panelData

  // Caso 1: Death Cross — narrativa NO puede decir "alcista de largo plazo"
  if (cruceMA === 'Death Cross') {
    const alcistaPhrases = ['alcista de largo plazo', 'tendencia alcista de largo', 'long-term bullish', 'tendencia positiva de largo']
    const hasContradiccion = alcistaPhrases.some(p => allText.includes(p))
    if (hasContradiccion) {
      issues.push(`Death Cross activo pero la narrativa describe tendencia alcista de largo plazo`)
    }
  }

  // Caso 2: Tendencia bajista (score <= 35) — narrativa NO puede tener tono optimista sin contexto
  if (trend === 'Tendencia bajista') {
    const optimistaPhrases = ['señal de compra', 'excelente momento para comprar', 'fuerte oportunidad de compra']
    const hasContradiccion = optimistaPhrases.some(p => allText.includes(p))
    if (hasContradiccion) {
      issues.push(`Panel bajista pero narrativa tiene tono de compra`)
    }
  }

  // Caso 3: RSI > 70 — narrativa DEBE mencionar riesgo de corrección
  if (rsi != null && rsi > 70) {
    const mentionsRisk = allText.includes('sobrecompra') || allText.includes('corrección') || 
                         allText.includes('rsi') || allText.includes('sobrecomprado')
    if (!mentionsRisk) {
      issues.push(`RSI ${rsi} (sobrecompra) no se menciona en la narrativa`)
    }
  }

  // Caso 4: Precio en zona baja 52W (< 25%) — narrativa NO puede decir "cerca de máximos" o "fortaleza"
  if (position52w != null && position52w < 25) {
    const strengthPhrases = ['cerca de máximos', 'fortaleza técnica', 'máximos históricos']
    const hasContradiccion = strengthPhrases.some(p => allText.includes(p))
    if (hasContradiccion) {
      issues.push(`Precio en ${position52w}% del rango 52W pero narrativa menciona fortaleza o máximos`)
    }
  }

  return issues
}

// Construye el contexto del panel para pasar al prompt de reintentos
function buildPanelContext(panelData) {
  const { cruceMA, rsi, position52w, trend, signal, score } = panelData
  const parts = []
  if (cruceMA) parts.push(`Cruce MA: ${cruceMA}`)
  if (rsi != null) parts.push(`RSI: ${rsi}${rsi > 70 ? ' (SOBRECOMPRADO)' : rsi < 30 ? ' (SOBREVENDIDO)' : ''}`)
  if (position52w != null) parts.push(`Posición 52W: ${position52w}%`)
  if (trend) parts.push(`Veredicto del panel: ${trend} — ${signal} (score ${score}%)`)
  return parts.join(' · ')
}

export async function POST(request) {
  try {
    const { data } = await request.json()
    if (!data) return Response.json({ error: 'Faltan datos.' }, { status: 400 })

    const claudeKey = process.env.ANTHROPIC_API_KEY
    if (!claudeKey) return Response.json({ error: 'Claude API key no configurada en el servidor.' }, { status: 500 })

    const {
      ticker, companyName, sector, news,
      price, priceChangeToday, high, low,
      // Técnicos
      ma50, ma200, rsi, macd, macdSignal, relVol, change1m, high52, low52,
      // Fundamentales desde Polygon (Fix #1)
      fundamentals,
      // Earnings
      nextEarningsDate, nextEarningsDays,
      // Veredicto del panel para validación (Fix #2)
      panelData,
    } = data

    const cacheKey = ticker?.toUpperCase()
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[narrative] Cache HIT: ${cacheKey}`)
      return Response.json(cached)
    }
    console.log(`[narrative] Cache MISS: ${cacheKey} — llamando a Claude`)

    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    // Construir contexto de noticias con ventana explícita de 7 días
    const newsContext = news?.length
      ? news.map(n => {
          const pub = n.published ? n.published.split('T')[0] : ''
          return `- ${n.title}${n.publisher ? ` (${n.publisher}` : ''}${pub ? `, ${pub})` : (n.publisher ? ')' : '')}`
        }).join('\n')
      : null

    // Construir contexto técnico
    const ma50str  = ma50  != null ? `$${ma50}`  : 'N/D'
    const ma200str = ma200 != null ? `$${ma200}` : 'N/D'
    const cruceMA  = (ma50 != null && ma200 != null) ? (ma50 > ma200 ? 'Golden Cross (MA50 > MA200)' : 'Death Cross (MA50 < MA200)') : 'N/D'
    const rsiStr   = rsi   != null ? `${rsi}` : 'N/D'
    const macdStr  = macd  != null && macdSignal != null ? `${macd} vs señal ${macdSignal}` : 'N/D'
    const volStr   = relVol != null ? `${relVol}x promedio` : 'N/D'
    const pos52w   = (price != null && high52 != null && low52 != null && high52 > low52)
      ? Math.round((price - low52) / (high52 - low52) * 100)
      : null
    const pos52wStr = pos52w != null ? `${pos52w}%` : 'N/D'
    const change1mStr = change1m != null ? `${change1m > 0 ? '+' : ''}${change1m}%` : 'N/D'

    // Construir contexto de fundamentales (solo mostrar lo que tenemos de Polygon)
    const fund = fundamentals || {}
    const fundContext = [
      fund.pe       != null ? `P/E (TTM): ${fund.pe}` : null,
      fund.epsGrowth!= null ? `Crecimiento EPS: ${fund.epsGrowth > 0 ? '+' : ''}${fund.epsGrowth}%` : null,
      fund.netMargin!= null ? `Margen neto: ${fund.netMargin}%` : null,
      fund.roe      != null ? `ROE: ${fund.roe}%` : null,
      fund.de       != null ? `D/E: ${fund.de}` : null,
    ].filter(Boolean).join(' · ') || 'No disponible desde Polygon en este ticker'

    // Construir contexto de earnings
    let earningsContext = ''
    if (nextEarningsDate) {
      if (nextEarningsDays != null && nextEarningsDays >= 0 && nextEarningsDays <= 14) {
        earningsContext = `⚠️ PRÓXIMO EARNINGS: ${nextEarningsDate} (en ${nextEarningsDays} días) — MENCIONAR OBLIGATORIAMENTE en analyst_summary`
      } else if (nextEarningsDays != null && nextEarningsDays < 0 && nextEarningsDays >= -7) {
        earningsContext = `Reportó recientemente: ${nextEarningsDate} (hace ${Math.abs(nextEarningsDays)} días) — mencionar si hay datos relevantes`
      } else if (nextEarningsDate) {
        earningsContext = `Próximo earnings: ${nextEarningsDate}`
      }
    }

    // Veredicto del panel para reglas de coherencia
    const panelVeredicto = panelData
      ? `VEREDICTO DEL PANEL: ${panelData.trend} — ${panelData.signal} (score ${panelData.score}%)`
      : ''

    const prompt = `Hoy es ${today}. Sos un analista financiero experto escribiendo para el inversor hispanoparlante no profesional.

━━━ DATOS DE MERCADO (calculados por backend — NO inventar otros números) ━━━
Ticker: ${ticker} — ${companyName || ticker}${sector ? ` · ${sector}` : ''}
Precio: $${price ?? 'N/D'} (${priceChangeToday != null ? (priceChangeToday >= 0 ? '+' : '') + priceChangeToday + '% hoy' : 'variación N/D'})
Rango día: $${low ?? 'N/D'} – $${high ?? 'N/D'}
MA50: ${ma50str} · MA200: ${ma200str} · Cruce: ${cruceMA}
RSI(14): ${rsiStr} · MACD: ${macdStr}
Volumen relativo: ${volStr}
Rango 52 semanas: $${low52 ?? 'N/D'} – $${high52 ?? 'N/D'} · Posición actual: ${pos52wStr} del rango
Momentum 1 mes: ${change1mStr}

━━━ FUNDAMENTALES (desde Polygon — NO inventar ni completar) ━━━
${fundContext}

━━━ CALENDARIO ━━━
${earningsContext || 'Sin datos de earnings disponibles'}

${panelVeredicto}

━━━ NOTICIAS ÚLTIMOS 7-30 DÍAS (fuente: Polygon) ━━━
${newsContext || 'Sin noticias indexadas en Polygon para este período.'}

━━━ REGLAS CRÍTICAS — LEER ANTES DE RESPONDER ━━━
1. NUNCA inventes números. Solo podés citar cifras que estén explícitamente en los datos de arriba.
2. Si un fundamental no está en los datos (ej. D/E no disponible), no lo menciones en la narrativa.
3. NUNCA hagas comparaciones con competidores usando cifras específicas (ej. "Dell ROE 130%").
4. Si hay Death Cross, NUNCA describas "tendencia alcista de largo plazo" — es una contradicción directa.
5. Si RSI > 70, SIEMPRE mencioná el riesgo de sobrecompra o posible corrección.
6. Si el veredicto del panel es Bajista, NO uses tono de compra en la narrativa.
7. Si hay earnings en los próximos 14 días, MENCIONARLO en analyst_summary.
8. Para noticias: si no hay en 7 días, buscá en el período disponible. Nunca escribas "sin noticias específicas hoy" — si no encontrás nada, decí "Sin catalizadores específicos en las últimas semanas."
9. Tono: español neutro profesional pero accesible, sin jerga técnica excesiva.
10. Preferí ser breve y preciso antes que extenso e inventado.

━━━ FORMATO DE RESPUESTA ━━━
Respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "technical_summary": "2-3 oraciones sobre situación técnica actual. Mencionar cruce de medias, RSI y momentum. Si Death Cross, dejarlo claro.",
  "fundamental_summary": "2-3 oraciones sobre fundamentales y valuación usando SOLO los datos provistos. Si hay pocos datos, ser breve.",
  "analyst_summary": "2-3 oraciones integrando noticias recientes y contexto de mercado. Si hay earnings próximos, mencionarlos explícitamente.",
  "key_opportunity": "Una oración concreta y específica sobre la oportunidad principal.",
  "key_risk": "Una oración concreta y específica sobre el riesgo principal.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte"
}`

    // Función interna para llamar a Claude
    async function callClaude(promptText) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 900,
          messages: [{ role: 'user', content: promptText }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Error Anthropic HTTP ${res.status}`)
      }
      const anthropicData = await res.json()
      const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
      if (s === -1 || e === -1) throw new Error('Claude no devolvió JSON válido.')
      return JSON.parse(raw.slice(s, e + 1))
    }

    // Primera llamada
    let parsed = await callClaude(prompt)

    // Validación cruzada panel ↔ narrativa — Fix #2
    if (panelData) {
      const cruceForValidation = ma50 != null && ma200 != null ? (ma50 > ma200 ? 'Golden Cross' : 'Death Cross') : null
      const validationInput = {
        cruceMA: cruceForValidation,
        rsi: rsi,
        position52w: pos52w,
        trend: panelData.trend,
        signal: panelData.signal,
        score: panelData.score,
      }
      const issues = validateNarrative(parsed, validationInput)

      if (issues.length > 0) {
        console.warn(`[narrative] Validación fallida para ${ticker}:`, issues)

        // Reintento con contexto del conflicto
        const retryPrompt = `${prompt}

━━━ CORRECCIÓN NECESARIA ━━━
Tu respuesta anterior tenía estas contradicciones con el panel de datos:
${issues.map(i => `• ${i}`).join('\n')}

Contexto del panel: ${buildPanelContext(validationInput)}

Reescribí la narrativa corrigiendo estas contradicciones. La narrativa DEBE ser coherente con los datos del panel.`

        try {
          parsed = await callClaude(retryPrompt)
          const issuesRetry = validateNarrative(parsed, validationInput)
          if (issuesRetry.length > 0) {
            console.warn(`[narrative] Segundo intento también falló para ${ticker}:`, issuesRetry)
            // Safe mode: narrative mínima basada solo en datos duros
            parsed = {
              technical_summary: `${ticker} cotiza a $${price ?? 'N/D'}. ${cruceForValidation ? cruceForValidation + ' activo.' : ''} RSI en ${rsi ?? 'N/D'}${rsi > 70 ? ' (zona de sobrecompra)' : rsi < 30 ? ' (zona de sobrevendido)' : ''}. Momentum 1 mes: ${change1mStr}.`,
              fundamental_summary: fundContext !== 'No disponible desde Polygon en este ticker' ? `Datos fundamentales: ${fundContext}.` : 'Datos fundamentales no disponibles desde la fuente.',
              analyst_summary: newsContext ? `Noticias recientes: ${news[0]?.title || 'Ver fuentes externas para más contexto'}.${earningsContext ? ' ' + earningsContext : ''}` : `Sin noticias indexadas en el período reciente.${earningsContext ? ' ' + earningsContext : ''}`,
              key_opportunity: 'Revisar el análisis técnico y fundamental completo antes de tomar decisiones.',
              key_risk: `${panelData.trend} — verificar los indicadores del panel antes de operar.`,
              analysts_consensus: 'Mantener',
            }
            console.warn(`[narrative] Safe mode activado para ${ticker}`)
          }
        } catch (retryErr) {
          console.error(`[narrative] Error en reintento para ${ticker}:`, retryErr.message)
          // Mantener primera respuesta si el reintento falla
        }
      }
    }

    // Sanitizar tags cite y artefactos — Fix cite tags
    const sanitized = sanitizeNarrative(parsed)

    setCached(cacheKey, sanitized)
    return Response.json(sanitized)

  } catch (err) {
    return Response.json({ error: err.message || 'Error generando narrativa.' }, { status: 500 })
  }
}
