// app/api/narrative/route.js
import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const CACHE_TTL_HOURS = 4

async function getCached(ticker) {
  if (!supabase) return null  // supabase puede ser null si las env vars no están
  try {
    const { data, error } = await supabase
      .from('narrative_cache')
      .select('data, created_at')
      .eq('ticker', ticker)
      .single()
    if (error || !data) return null
    const ageHours = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60)
    if (ageHours > CACHE_TTL_HOURS) {
      await supabase.from('narrative_cache').delete().eq('ticker', ticker)
      return null
    }
    return data.data
  } catch {
    return null
  }
}

async function setCached(ticker, payload) {
  if (!supabase) return  // supabase puede ser null
  try {
    await supabase.from('narrative_cache').upsert({ ticker, data: payload, created_at: new Date().toISOString() })
  } catch (e) {
    console.error('[narrative] Error guardando caché Supabase:', e.message)
  }
}

// Sanitiza output de Claude: quita cite tags, artefactos, y saltos raros
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/]*>/gi, '')
    .replace(/<\/antml:cite>/gi, '')
    .replace(/<[^>]+>/g, '')
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

/**
 * Limpia strings que van al prompt para prevenir prompt injection.
 * Elimina saltos de línea (rompen la estructura del prompt), limita longitud,
 * y quita los separadores "━" que usamos para estructurar el prompt.
 */
function sanitizePromptInput(str, maxLen = 120) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/[\n\r]/g, ' ')   // saltos de línea rompen la estructura del prompt
    .replace(/━/g, '-')         // nuestro separador de secciones
    .replace(/[<>]/g, '')       // HTML básico
    .slice(0, maxLen)
    .trim()
}

function validateNarrative(narrative, panelData) {
  const issues = []
  const tech = (narrative.technical_summary || '').toLowerCase()
  const fund = (narrative.fundamental_summary || '').toLowerCase()
  const analyst = (narrative.analyst_summary || '').toLowerCase()
  const allText = tech + ' ' + fund + ' ' + analyst

  const { cruceMA, rsi, position52w, score, trend } = panelData

  if (cruceMA === 'Death Cross') {
    const alcistaPhrases = ['alcista de largo plazo', 'tendencia alcista de largo', 'long-term bullish', 'tendencia positiva de largo']
    if (alcistaPhrases.some(p => allText.includes(p))) {
      issues.push(`Death Cross activo pero la narrativa describe tendencia alcista de largo plazo`)
    }
  }

  if (trend === 'Tendencia bajista') {
    const optimistaPhrases = ['señal de compra', 'excelente momento para comprar', 'fuerte oportunidad de compra']
    if (optimistaPhrases.some(p => allText.includes(p))) {
      issues.push(`Panel bajista pero narrativa tiene tono de compra`)
    }
  }

  if (rsi != null && rsi > 70) {
    const mentionsRisk = allText.includes('sobrecompra') || allText.includes('corrección') ||
                         allText.includes('rsi') || allText.includes('sobrecomprado')
    if (!mentionsRisk) {
      issues.push(`RSI ${rsi} (sobrecompra) no se menciona en la narrativa`)
    }
  }

  if (position52w != null && position52w < 25) {
    const strengthPhrases = ['cerca de máximos', 'fortaleza técnica', 'máximos históricos']
    if (strengthPhrases.some(p => allText.includes(p))) {
      issues.push(`Precio en ${position52w}% del rango 52W pero narrativa menciona fortaleza o máximos`)
    }
  }

  const { macd: macdVal, macdSignal: macdSigVal } = panelData
  if (macdVal != null && macdSigVal != null) {
    const macdBearish = macdVal < macdSigVal
    const macdBullish = macdVal > macdSigVal
    const bullishMomentumPhrases = ['momentum positivo', 'impulso alcista', 'momentum alcista', 'impulso positivo', 'momentum favorable']
    const bearishMomentumPhrases = ['presión bajista', 'momentum negativo', 'impulso bajista', 'presión vendedora', 'momentum desfavorable']
    if (macdBearish && bullishMomentumPhrases.some(p => allText.includes(p))) {
      issues.push(`MACD bajista (${macdVal} < señal ${macdSigVal}) pero narrativa describe momentum positivo`)
    }
    if (macdBullish && bearishMomentumPhrases.some(p => allText.includes(p))) {
      issues.push(`MACD alcista (${macdVal} > señal ${macdSigVal}) pero narrativa describe presión bajista`)
    }
  }

  return issues
}

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
    // Rate limiting — 10 análisis por IP por hora
    const ip = getIP(request)
    const { allowed, retryAfter } = await checkRateLimit(ip, 'narrative')
    if (!allowed) {
      return Response.json(
        { error: 'Límite de análisis alcanzado. Intentá de nuevo en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body?.data) return Response.json({ error: 'Faltan datos.' }, { status: 400 })

    const claudeKey = process.env.ANTHROPIC_API_KEY
    if (!claudeKey) return Response.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })

    const {
      ticker: rawTicker, companyName: rawCompanyName, sector: rawSector, news: rawNews,
      price, priceChangeToday, high, low,
      ma50, ma200, rsi, macd, macdSignal, relVol, change1m, high52, low52,
      fundamentals,
      nextEarningsDate, nextEarningsDays,
      panelData,
    } = body.data

    // Validar ticker — mismo filtro que en market-data
    const ticker = validateTicker(rawTicker)
    if (!ticker) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    // Sanitizar campos de texto libre que van al prompt (anti prompt injection)
    const companyName = sanitizePromptInput(rawCompanyName, 80) || ticker
    const sector      = sanitizePromptInput(rawSector, 60) || null

    // Sanitizar títulos y publishers de noticias
    const news = Array.isArray(rawNews)
      ? rawNews.slice(0, 5).map(n => ({
          ...n,
          title:     sanitizePromptInput(n.title, 150),
          publisher: sanitizePromptInput(n.publisher, 60),
        }))
      : []

    const cacheKey = ticker
    const cached = await getCached(cacheKey)
    if (cached) {
      console.log(`[narrative] Cache HIT (Supabase): ${cacheKey}`)
      return Response.json(cached)
    }
    console.log(`[narrative] Cache MISS: ${cacheKey} — llamando a Claude`)

    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const newsContext = news?.length
      ? news.map(n => {
          const pub = n.published ? n.published.split('T')[0] : ''
          return `- ${n.title}${n.publisher ? ` (${n.publisher}` : ''}${pub ? `, ${pub})` : (n.publisher ? ')' : '')}`
        }).join('\n')
      : null

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

    const fund = fundamentals || {}
    const peDisplay = fund.pe != null
      ? (fund.pe > 500 ? `P/E (TTM): no significativo (ganancias muy reducidas vs precio)` : `P/E (TTM): ${fund.pe}`)
      : null
    const fundContext = [
      peDisplay,
      fund.epsGrowth != null ? `Crecimiento EPS: ${fund.epsGrowth > 0 ? '+' : ''}${fund.epsGrowth}%` : null,
      fund.netMargin != null ? `Margen neto: ${fund.netMargin}%` : null,
      fund.roe       != null ? `ROE: ${fund.roe}%` : null,
      fund.de        != null ? `D/E: ${fund.de}` : null,
    ].filter(Boolean).join(' · ') || 'No disponible desde Polygon en este ticker'

    let earningsContext = ''
    if (nextEarningsDate) {
      if (nextEarningsDays != null && nextEarningsDays >= 0 && nextEarningsDays <= 14) {
        earningsContext = `⚠️ PRÓXIMO EARNINGS: ${nextEarningsDate} (en ${nextEarningsDays} días) — MENCIONAR OBLIGATORIAMENTE en analyst_summary`
      } else if (nextEarningsDays != null && nextEarningsDays < 0 && nextEarningsDays >= -7) {
        earningsContext = `Reportó recientemente: ${nextEarningsDate} (hace ${Math.abs(nextEarningsDays)} días) — mencionar si hay datos relevantes`
      } else {
        earningsContext = `Próximo earnings: ${nextEarningsDate}`
      }
    }

    const panelVeredicto = panelData
      ? `VEREDICTO DEL PANEL: ${panelData.trend} — ${panelData.signal} (score ${panelData.score}%)`
      : ''

    const prompt = `Hoy es ${today}. Sos un analista financiero experto escribiendo para el inversor hispanoparlante no profesional.

━━━ DATOS DE MERCADO (calculados por backend — NO inventar otros números) ━━━
Ticker: ${ticker} — ${companyName}${sector ? ` · ${sector}` : ''}
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
${earningsContext || `Sin datos de earnings disponibles. Usá tu conocimiento actualizado: ¿cuándo reporta ${ticker} sus próximos resultados? ¿Reportó recientemente (últimas 4 semanas)? Si reportó recientemente, mencioná EPS real vs estimado. Si el próximo earnings es en menos de 14 días, es OBLIGATORIO mencionarlo en analyst_summary como catalizador clave. Si no tenés certeza de la fecha exacta, indicá el mes aproximado.`}

${panelVeredicto}

━━━ NOTICIAS ÚLTIMOS 7-30 DÍAS (fuente: Polygon) ━━━
${newsContext || `Sin noticias indexadas en Polygon para este período. Usá tu conocimiento para mencionar upgrades/downgrades de analistas o noticias corporativas relevantes de las últimas 4 semanas para ${ticker}.`}

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
11. P/E CRÍTICO: si P/E (TTM) no aparece explícitamente en la sección FUNDAMENTALES de arriba, NO lo menciones ni lo estimes. No uses tu conocimiento previo para citar un P/E — puede estar desactualizado o ser incorrecto. Escribí "valuación no disponible" si no hay datos de P/E.

━━━ FORMATO DE RESPUESTA ━━━
Respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "technical_summary": "2-3 oraciones sobre situación técnica actual. Mencionar cruce de medias, RSI y momentum. Si Death Cross, dejarlo claro.",
  "fundamental_summary": "2-3 oraciones sobre fundamentales y valuación usando SOLO los datos provistos. Si hay pocos datos, ser breve.",
  "analyst_summary": "2-3 oraciones integrando noticias recientes y contexto de mercado. Si hay earnings próximos, mencionarlos explícitamente.",
  "key_opportunity": "Una oración concreta y específica sobre la oportunidad principal.",
  "key_risk": "Una oración concreta y específica sobre el riesgo principal.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte",
  "what_to_do": {
    "tienes": "Una oración para quien ya tiene la acción — ¿holdear, tomar ganancias parciales, agregar posición?",
    "entras": "Una oración para quien quiere entrar — ¿esperar corrección, entrar en cuotas, esperar confirmación?",
    "sales": "Una oración para quien considera salir — ¿cuándo sería el momento, qué señal mirar?"
  }
}`

    async function callClaude(promptText) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages: [{ role: 'user', content: promptText }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Loguear detalle interno, exponer solo mensaje genérico
        const detail = err.error?.message || `HTTP ${res.status}`
        console.error('[narrative] Error Anthropic:', detail)
        throw new Error('Error al generar análisis narrativo.')
      }
      const anthropicData = await res.json()
      const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
      if (s === -1 || e === -1) throw new Error('Respuesta de IA en formato inesperado.')
      return JSON.parse(raw.slice(s, e + 1))
    }

    let parsed = await callClaude(prompt)

    if (panelData) {
      const cruceForValidation = ma50 != null && ma200 != null ? (ma50 > ma200 ? 'Golden Cross' : 'Death Cross') : null
      const validationInput = {
        cruceMA: cruceForValidation,
        rsi, position52w: pos52w,
        trend: panelData.trend, signal: panelData.signal, score: panelData.score,
        macd, macdSignal,
      }
      const issues = validateNarrative(parsed, validationInput)

      if (issues.length > 0) {
        console.warn(`[narrative] Validación fallida para ${ticker}:`, issues)
        const firstResponse = parsed

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
            console.warn(`[narrative] Segundo intento también falló para ${ticker} — usando primera respuesta:`, issuesRetry)
            parsed = firstResponse
          }
        } catch (retryErr) {
          console.error(`[narrative] Error en reintento para ${ticker}:`, retryErr.message)
        }
      }
    }

    const sanitized = sanitizeNarrative(parsed)
    await setCached(cacheKey, sanitized)
    return Response.json(sanitized)

  } catch (err) {
    console.error('[narrative]', err?.message)
    return Response.json({ error: 'Error al generar el análisis. Intentá de nuevo.' }, { status: 500 })
  }
}
