// lib/validate-narrative.js

// Palabras en mayúscula que NO son tickers de acciones
const NON_TICKER_WORDS = new Set([
  'RSI','EPS','ROE','DPA','TTM','PE','MA','SMA','EMA','ATH','YTD',
  'QOQ','YOY','CEO','CFO','IPO','ETF','GDP','CPI','FED','USD','EUR',
  'SP','DJ','VIX','AI','US','UK','EU','IA','BTC','ETH','FX','MACD',
  'NN','NI','NA','NB','ND','OK','NO','KO',
])

// Reúne todo el texto narrativo en un string para búsquedas
function collectText(narrative) {
  return [
    narrative.technical_summary,
    narrative.fundamental_summary,
    narrative.analyst_summary,
    narrative.key_opportunity,
    narrative.key_risk,
    narrative.what_to_do?.tienes,
    narrative.what_to_do?.entras,
    narrative.what_to_do?.sales,
  ].filter(Boolean).join(' ')
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// R1: ningún número porcentual atribuido a un ticker que no sea el analizado
function r1NoPeerNumbers(text, ticker) {
  const issues = []
  // Busca: TICKER (2-5 letras mayúsculas) seguido de hasta 30 chars y un número%
  const re = /\b([A-Z]{2,5})\b[^.]{0,30}?(\d+(?:\.\d+)?)\s*%/g
  let m
  while ((m = re.exec(text)) !== null) {
    const found = m[1]
    if (found !== ticker && !NON_TICKER_WORDS.has(found)) {
      issues.push(
        `R1: número de peer detectado — "${found} … ${m[2]}%" en narrativa. Solo se pueden citar cifras de ${ticker}`
      )
    }
  }
  return issues
}

// R2: validación numérica cruzada ±2% contra el dataset
function r2NumericCrossValidation(text, dataset) {
  const issues = []
  const TOL = 0.02

  const fields = [
    { label: 'RSI',        val: dataset.rsi,      keywords: ['rsi'] },
    { label: 'MA50',       val: dataset.ma50,      keywords: ['ma50', 'media 50', 'sma50', 'promedio 50'] },
    { label: 'MA200',      val: dataset.ma200,     keywords: ['ma200', 'media 200', 'sma200', 'promedio 200'] },
    { label: 'cambio 1 mes', val: dataset.change1m, keywords: ['último mes', 'en el mes', '1 mes', 'mes pasado'] },
    { label: 'precio',     val: dataset.price,     keywords: ['precio actual', 'cotiza a', 'opera a', 'cierra en'] },
  ]

  const lower = text.toLowerCase()

  for (const { label, val, keywords } of fields) {
    if (val == null) continue
    const absVal = Math.abs(Number(val))
    if (absVal === 0) continue

    for (const kw of keywords) {
      const idx = lower.indexOf(kw)
      if (idx === -1) continue
      // Solo buscamos el número DESPUÉS del keyword (máx 25 chars) para evitar
      // capturar cifras de otro campo que aparezca antes en el texto
      const after = lower.slice(idx + kw.length, idx + kw.length + 25)
      const numMatch = after.match(/[\s:$de]{0,5}(\d+(?:\.\d+)?)/)
      if (!numMatch) continue
      const mentioned = parseFloat(numMatch[1])
      if (isNaN(mentioned)) continue
      const diff = Math.abs(mentioned - absVal) / absVal
      if (diff > TOL) {
        issues.push(
          `R2: ${label} en narrativa (${mentioned}) difiere del dataset (${val}) en ${(diff * 100).toFixed(1)}% — supera tolerancia ±2%`
        )
      }
      break
    }
  }

  return issues
}

// R3: consistencia de tendencia — "alcista" no puede coexistir con RSI<40 Y precio<MA200
function r3TrendConsistency(text, dataset) {
  const issues = []
  const t = text.toLowerCase()
  const { rsi, price, ma200, panelTrend } = dataset

  if (rsi != null && price != null && ma200 != null && rsi < 40 && price < ma200) {
    if (/tendencia\s+alcista/.test(t)) {
      issues.push(
        `R3: narrativa dice "tendencia alcista" pero RSI=${rsi} (<40) y precio $${price} < MA200 $${ma200}`
      )
    }
  }

  if (panelTrend === 'Tendencia bajista') {
    const bullPhrases = [
      'señal de compra', 'excelente momento para comprar',
      'fuerte oportunidad de compra', 'momento ideal para entrar',
    ]
    if (bullPhrases.some(p => t.includes(p))) {
      issues.push(
        `R3: veredicto del panel es "Tendencia bajista" pero la narrativa usa tono de compra sin matiz`
      )
    }
  }

  return issues
}

// R4: sin recomendaciones directas ("comprá"/"vendé" sin condicional)
function r4NoDirectRecs(text) {
  const issues = []
  const t = text.toLowerCase()

  const patterns = [
    { re: /\bcomprá\s+(?!si\b|cuando\b|con\b|en\b|solo\b|gradual)/, label: '"comprá" sin condicional' },
    { re: /\bvendé\s+(?!si\b|cuando\b|con\b|en\b|solo\b|gradual)/,  label: '"vendé" sin condicional' },
    { re: /\bcomprá\s+ahora\b/,                                       label: '"comprá ahora"' },
    { re: /\bvendé\s+ahora\b/,                                        label: '"vendé ahora"' },
    { re: /\bes\s+el\s+momento\s+(?:ideal\s+)?de\s+comprar\b/,        label: '"es el momento de comprar"' },
    { re: /\bes\s+el\s+momento\s+(?:ideal\s+)?de\s+vender\b/,         label: '"es el momento de vender"' },
  ]

  for (const { re, label } of patterns) {
    if (re.test(t)) {
      issues.push(`R4: recomendación directa sin matiz — ${label}`)
    }
  }

  return issues
}

// R5: fechas válidas (earnings futuros no pasados, noticias ≤14 días si se habla de "reciente")
function r5DateValidity(narrative, dataset) {
  const issues = []
  const { nextEarningsDate, nextEarningsDays, news } = dataset

  if (nextEarningsDate && nextEarningsDays != null && nextEarningsDays < 0) {
    const t = collectText(narrative).toLowerCase()
    if (/próximo\s+earning|próximo\s+reporte|en\s+\d+\s+días/.test(t)) {
      issues.push(
        `R5: narrativa usa lenguaje de "próximo earnings" pero ${nextEarningsDate} ya pasó (hace ${Math.abs(nextEarningsDays)} días)`
      )
    }
  }

  if (Array.isArray(news) && news.length > 0) {
    const allStale = news.every(n => n.published && !isWithinDays(n.published, 14))
    if (allStale) {
      const t = collectText(narrative).toLowerCase()
      const recentLanguage = /esta\s+semana|en\s+los\s+últimos\s+días|recientemente\s+(?:se\s+anunció|publicó|reportó|informó)/.test(t)
      if (recentLanguage) {
        issues.push(`R5: narrativa usa lenguaje de "esta semana / recientemente" pero todas las noticias tienen más de 14 días`)
      }
    }
  }

  return issues
}

// R6: si la dispersión de precios objetivo supera 20%, la narrativa debe mencionar "consenso disperso"
function r6AnalystDispersion(narrative, dataset) {
  const issues = []
  const { analystTargets } = dataset
  if (!Array.isArray(analystTargets) || analystTargets.length < 2) return issues

  const prices = analystTargets.map(Number).filter(n => !isNaN(n) && n > 0)
  if (prices.length < 2) return issues

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  const stdDev = Math.sqrt(prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length)
  const cvPercent = (stdDev / mean) * 100

  if (cvPercent > 20) {
    const t = collectText(narrative).toLowerCase()
    const mentionsDispersion = /consenso\s+disperso|opiniones\s+divid|estimaciones\s+muy\s+dif|alta\s+dispersión|targets?\s+muy\s+dif/.test(t)
    if (!mentionsDispersion) {
      issues.push(
        `R6: dispersión de analistas alta (CV=${cvPercent.toFixed(1)}%) — narrativa debe incluir "consenso disperso"`
      )
    }
  }

  return issues
}

// R7: sanity check con Haiku — stub, implementado en sub-tarea 1.2
// eslint-disable-next-line no-unused-vars
async function r7HaikuSanityCheck(_narrative, _dataset) {
  return { hasIssues: false, issues: [] }
}

/**
 * Valida la narrativa generada contra el dataset de mercado.
 *
 * dataset shape (campos usados por cada regla):
 *   R1/R3/R4: { price, ma50, ma200, rsi, panelTrend }
 *   R2:       + { change1m }
 *   R5:       + { nextEarningsDate, nextEarningsDays, news: [{published}] }
 *   R6:       + { analystTargets: number[] }
 *   R7:       dataset completo
 *
 * @param {{ narrative: object, dataset: object, ticker: string }} params
 * @returns {Promise<{ valid: boolean, issues: string[], shouldRegenerate: boolean }>}
 */
export async function validateNarrative({ narrative, dataset, ticker }) {
  if (!narrative || typeof narrative !== 'object') {
    return { valid: false, issues: ['Narrativa vacía o inválida'], shouldRegenerate: true }
  }

  const text = collectText(narrative)

  const r1 = r1NoPeerNumbers(text, ticker)
  const r2 = r2NumericCrossValidation(text, dataset)
  const r3 = r3TrendConsistency(text, dataset)
  const r4 = r4NoDirectRecs(text)
  const r5 = r5DateValidity(narrative, dataset)
  const r6 = r6AnalystDispersion(narrative, dataset)
  const r7 = await r7HaikuSanityCheck(narrative, dataset)

  const issues = [...r1, ...r2, ...r3, ...r4, ...r5, ...r6, ...r7.issues]

  // Violaciones duras (R1-R4, R7) disparan regeneración; R5-R6 son advertencias
  const hardIssues = [...r1, ...r2, ...r3, ...r4, ...r7.issues]
  const shouldRegenerate = hardIssues.length > 0

  console.log(
    `[validate-narrative] ${ticker} — R1:${r1.length} R2:${r2.length} R3:${r3.length} R4:${r4.length} R5:${r5.length} R6:${r6.length} R7:${r7.issues.length}`,
    issues.length ? `| ISSUES: ${issues.join(' · ')}` : '| OK'
  )

  return { valid: issues.length === 0, issues, shouldRegenerate }
}
