// app/api/narrative/route.js
import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'
import { checkRateLimit, getIP } from '@/lib/rate-limit'
import { validateNarrative } from '@/lib/validate-narrative'

const CACHE_TTL_HOURS = 4
const EARNINGS_CACHE_BYPASS_DAYS = 7

async function getCached(ticker) {
  if (!supabase) return null
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
  if (!supabase) return
  try {
    await supabase.from('narrative_cache').upsert({ ticker, data: payload, created_at: new Date().toISOString() })
  } catch (e) {
    console.error('[narrative] Error guardando caché Supabase:', e.message)
  }
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// Formatea fecha ISO a "5 ago 2026" (formato LATAM legible)
function formatDate(dateStr) {
  if (!dateStr) return dateStr
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${day} ${months[month - 1]} ${year}`
  } catch {
    return dateStr
  }
}

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

function sanitizePromptInput(str, maxLen = 120) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/[\n\r]/g, ' ')
    .replace(/━/g, '-')
    .replace(/[<>]/g, '')
    .slice(0, maxLen)
    .trim()
}


export async function POST(request) {
  try {
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
      lastEarningsDate,
      lastEarningsReportDate,  // fecha real del reporte (ej. "2026-05-07")
      lastEarningsBeat,
      panelData,
      analystTargets,
    } = body.data

    const ticker = validateTicker(rawTicker)
    if (!ticker) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    const companyName = sanitizePromptInput(rawCompanyName, 80) || ticker
    const sector      = sanitizePromptInput(rawSector, 60) || null

    const news = Array.isArray(rawNews)
      ? rawNews.slice(0, 5).map(n => ({
          ...n,
          title:     sanitizePromptInput(n.title, 150),
          publisher: sanitizePromptInput(n.publisher, 60),
        }))
      : []

    const cacheKey = ticker

    // Cache bypass: si reportó en los últimos 7 días, narrativa siempre fresh.
    // Usar lastEarningsReportDate (fecha real del reporte desde calendario Finnhub),
    // NO lastEarningsDate que es el período fiscal (ej. "2026-03-31").
    const recentEarnings = isWithinDays(lastEarningsReportDate, EARNINGS_CACHE_BYPASS_DAYS)
    if (recentEarnings) {
      console.log(`[narrative] Cache BYPASS: ${ticker} reportó el ${lastEarningsReportDate} (hace menos de ${EARNINGS_CACHE_BYPASS_DAYS} días)`)
      if (supabase) { try { await supabase.from('narrative_cache').delete().eq('ticker', ticker) } catch {} }
    } else {
      const cached = await getCached(cacheKey)
      if (cached) {
        console.log(`[narrative] Cache HIT (Supabase): ${cacheKey}`)
        return Response.json(cached)
      }
      console.log(`[narrative] Cache MISS: ${cacheKey} — llamando a Claude`)
    }

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

    // Contexto de earnings: prioridad al reporte reciente con beat/miss
    let earningsContext = ''
    const reportDateForContext = lastEarningsReportDate || lastEarningsDate
    if (reportDateForContext && isWithinDays(reportDateForContext, 30)) {
      const beatLabel = lastEarningsBeat === true
        ? 'SUPERÓ estimados (beat)'
        : lastEarningsBeat === false
          ? 'NO alcanzó estimados (miss)'
          : 'resultado vs estimados no disponible'
      const daysAgo = Math.round((Date.now() - new Date(reportDateForContext).getTime()) / (1000 * 60 * 60 * 24))
      earningsContext = `⚠️ EARNINGS RECIENTE: reportó el ${formatDate(reportDateForContext)} (hace ${daysAgo} días) — ${beatLabel}. OBLIGATORIO: mencioná este resultado y su impacto en el precio en analyst_summary.`
      if (nextEarningsDate && nextEarningsDays != null && nextEarningsDays > 0) {
        earningsContext += ` Próximo earnings: ${formatDate(nextEarningsDate)} (en ${nextEarningsDays} días).`
      }
    } else if (nextEarningsDate && nextEarningsDays != null && nextEarningsDays > 0) {
      earningsContext = nextEarningsDays <= 14
        ? `⚠️ PRÓXIMO EARNINGS: ${formatDate(nextEarningsDate)} (en ${nextEarningsDays} días) — MENCIONAR OBLIGATORIAMENTE en analyst_summary`
        : `Próximo earnings: ${formatDate(nextEarningsDate)} (en ${nextEarningsDays} días)`
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

━━━ CALENDARIO DE EARNINGS ━━━
${earningsContext || `Sin datos de earnings disponibles. Usá tu conocimiento actualizado: ¿reportó recientemente (últimas 4 semanas)? Si reportó, mencioná EPS real vs estimado. Si hay earnings próximos en menos de 14 días, es OBLIGATORIO mencionarlo en analyst_summary.`}

${panelVeredicto}

━━━ NOTICIAS ÚLTIMOS 7-30 DÍAS (fuente: Polygon) ━━━
${newsContext || `Sin noticias indexadas en Polygon para este período. Usá tu conocimiento para mencionar upgrades/downgrades de analistas o noticias corporativas relevantes de las últimas 4 semanas para ${ticker}.`}

━━━ REGLAS CRÍTICAS ━━━
1. NUNCA inventes números. Solo podés citar cifras explícitamente presentes en los datos de arriba.
2. Si un fundamental no está en los datos, no lo menciones.
3. NUNCA compares con competidores usando cifras específicas.
4. Si hay Death Cross, NUNCA describas "tendencia alcista de largo plazo".
5. Si RSI > 70, SIEMPRE mencioná el riesgo de sobrecompra.
6. Si el panel es Bajista, NO uses tono de compra.
7. Si hay earnings próximos en ≤14 días, MENCIONARLO en analyst_summary.
8. Si hubo earnings reciente con miss/beat, EXPLICAR el impacto en el precio en analyst_summary.
9. Si no hay noticias específicas, decí "Sin catalizadores específicos en las últimas semanas."
10. Español neutro profesional pero accesible.
11. Breve y preciso antes que extenso e inventado.
12. P/E: si no aparece en FUNDAMENTALES, NO lo menciones ni estimes.

━━━ FORMATO ━━━
Respondé ÚNICAMENTE con este JSON válido, sin markdown, sin texto antes ni después:

{
  "technical_summary": "2-3 oraciones sobre situación técnica. Mencionar cruce de medias, RSI y momentum.",
  "fundamental_summary": "2-3 oraciones sobre fundamentales usando SOLO los datos provistos.",
  "analyst_summary": "2-3 oraciones. Si hubo earnings reciente con miss/beat, explicar el impacto en el precio.",
  "key_opportunity": "Una oración concreta sobre la oportunidad principal.",
  "key_risk": "Una oración concreta sobre el riesgo principal.",
  "analysts_consensus": "Compra fuerte|Compra|Mantener|Venta|Venta fuerte",
  "what_to_do": {
    "tienes": "Una oración para quien ya tiene la acción.",
    "entras": "Una oración para quien quiere entrar.",
    "sales": "Una oración para quien considera salir."
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
        console.error('[narrative] Error Anthropic:', err.error?.message || `HTTP ${res.status}`)
        throw new Error('Error al generar análisis narrativo.')
      }
      const anthropicData = await res.json()
      const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
      if (s === -1 || e === -1) throw new Error('Respuesta de IA en formato inesperado.')
      return JSON.parse(raw.slice(s, e + 1))
    }

    let parsed = await callClaude(prompt)

    let validationWarning = false

    const validationDataset = {
      ticker,
      price, ma50, ma200, rsi, change1m,
      panelTrend: panelData?.trend,
      macd, macdSignal,
      nextEarningsDate, nextEarningsDays,
      news: news || [],
      analystTargets: Array.isArray(analystTargets) ? analystTargets : [],
    }
    const firstResult = await validateNarrative({ narrative: parsed, dataset: validationDataset, ticker })
    if (firstResult.shouldRegenerate) {
      console.warn(`[narrative] Validación lib fallida para ${ticker}:`, firstResult.issues)
      const firstParsed = parsed
      const retryPrompt = `${prompt}\n\n━━━ CORRECCIÓN NECESARIA ━━━\nProblemas detectados:\n${firstResult.issues.map(i => `• ${i}`).join('\n')}\n\nReescribí la narrativa corrigiendo estos problemas.`
      try {
        parsed = await callClaude(retryPrompt)
        const retryResult = await validateNarrative({ narrative: parsed, dataset: validationDataset, ticker })
        if (retryResult.shouldRegenerate) {
          console.warn(`[narrative] Segundo intento también falló — usando primera respuesta con warning`)
          parsed = firstParsed
          validationWarning = true
        }
      } catch (retryErr) {
        console.error(`[narrative] Error en reintento:`, retryErr.message)
        parsed = firstParsed
        validationWarning = true
      }
    }

    const sanitized = sanitizeNarrative(parsed)
    if (validationWarning) sanitized._validation_warning = true
    await setCached(cacheKey, sanitized)
    return Response.json(sanitized)

  } catch (err) {
    console.error('[narrative]', err?.message)
    return Response.json({ error: 'Error al generar el análisis. Intentá de nuevo.' }, { status: 500 })
  }
}
