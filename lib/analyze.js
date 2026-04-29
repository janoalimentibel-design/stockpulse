// lib/analyze.js — motor de análisis estadístico de 14 indicadores

/**
 * Devuelve umbrales de D/E ajustados por sector.
 * D/E "ideal" varía por industria — tech espera poco apalancamiento,
 * consumer defensive/utilities/financials tienen apalancamiento estructuralmente alto.
 */
function getSectorialDERule(sector) {
  const defaultRule = { bullish: 0.5, bearish: 2.5 }
  if (!sector) return defaultRule

  const s = String(sector).toUpperCase()

  // Consumer Defensive: KO, PEP, PG, WMT — D/E alto es normal y eficiente
  if (s.includes('BEVERAGE') || s.includes('FOOD') || s.includes('TOBACCO') ||
      s.includes('HOUSEHOLD') || s.includes('PERSONAL CARE') || s.includes('GROCERY') ||
      s.includes('RETAIL-VARIETY') || s.includes('CONSUMER STAPLES'))
    return { bullish: 1.5, bearish: 3.5 }

  // Utilities: estructuralmente apalancadas — NEE, DUK, SO
  if (s.includes('UTILITIES') || s.includes('ELECTRIC SERVICES') ||
      s.includes('GAS DISTRIBUTION') || s.includes('WATER SUPPLY'))
    return { bullish: 1.5, bearish: 4.0 }

  // Financials: D/E no es métrica útil para bancos — JPM, BAC, GS
  if (s.includes('BANK') || s.includes('FINANCIAL') || s.includes('INSURANCE') ||
      s.includes('SECURITIES') || s.includes('CREDIT'))
    return { bullish: 5.0, bearish: 15.0 }

  // Real Estate / REITs
  if (s.includes('REAL ESTATE') || s.includes('REIT') || s.includes('PROPERTY'))
    return { bullish: 1.0, bearish: 3.5 }

  // Telecom: capex intensivo — T, VZ, TMUS
  if (s.includes('TELECOM') || s.includes('COMMUNICATION SERVICES') || s.includes('WIRELESS'))
    return { bullish: 1.0, bearish: 3.0 }

  // Auto / Industrial: TSLA, F, GM, BA, CAT
  if (s.includes('MOTOR VEHICLE') || s.includes('AUTO') || s.includes('AIRCRAFT') ||
      s.includes('INDUSTRIAL') || s.includes('MACHINERY') || s.includes('CONSTRUCTION'))
    return { bullish: 0.7, bearish: 2.5 }

  // E-commerce / Business Services: MELI, AMZN
  if (s.includes('SERVICES-BUSINESS') || s.includes('CATALOG') || s.includes('E-COMMERCE'))
    return { bullish: 1.0, bearish: 3.0 }

  // Energy: XOM, CVX, COP
  if (s.includes('PETROLEUM') || s.includes('OIL') || s.includes('GAS') ||
      s.includes('ENERGY') || s.includes('MINING'))
    return { bullish: 0.8, bearish: 2.5 }

  // Healthcare / Pharma: JNJ, PFE, MRK, UNH
  if (s.includes('PHARMACEUTICAL') || s.includes('HEALTH') ||
      s.includes('MEDICAL') || s.includes('BIOLOGICAL'))
    return { bullish: 0.5, bearish: 2.0 }

  // Tech / Software / Semiconductors: NVDA, AAPL, MSFT, GOOGL, META
  if (s.includes('SEMICONDUCTOR') || s.includes('SOFTWARE') || s.includes('COMPUTER') ||
      s.includes('ELECTRONIC') || s.includes('TECHNOLOGY') || s.includes('INTERNET') ||
      s.includes('PREPACKAGED'))
    return { bullish: 0.5, bearish: 1.5 }

  return defaultRule
}

export function computeAnalysis(data) {
  // Forzar conversión a número — Claude a veces devuelve strings en vez de numbers
  const parse = v => {
    if (v == null) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  const price      = parse(data.price)
  const ma50       = parse(data.ma50)
  const ma200      = parse(data.ma200)
  const high52     = parse(data.high52)
  const low52      = parse(data.low52)
  const change1m   = parse(data.change1m)
  const rsi        = parse(data.rsi)
  const macd       = parse(data.macd)
  const macdSignal = parse(data.macdSignal)
  const relVol     = parse(data.relVol)
  const pe         = parse(data.pe)
  const peSector   = parse(data.peSector)
  const epsGrowth  = parse(data.epsGrowth)
  const netMargin  = parse(data.netMargin)
  const de         = parse(data.de)
  const divYield   = parse(data.divYield)
  const roe        = parse(data.roe)

  const indicators = []
  let bull = 0, bear = 0

  function add(name, displayVal, dir, note, isTech) {
    indicators.push({ name, displayVal, dir, note, isTech })
    if (dir === 'bull') bull++
    else if (dir === 'bear') bear++
  }

  const n = v => v != null && !isNaN(v)

  if (n(price) && n(ma50)) {
    const d = ((price - ma50) / ma50 * 100).toFixed(1)
    add('Precio vs MA50', `${d > 0 ? '+' : ''}${d}% vs MA50`, price > ma50 ? 'bull' : 'bear',
      price > ma50 ? 'Precio sobre MA50 → momentum positivo' : 'Precio bajo MA50 → presión vendedora', true)
  }
  if (n(price) && n(ma200)) {
    const d = ((price - ma200) / ma200 * 100).toFixed(1)
    add('Precio vs MA200', `${d > 0 ? '+' : ''}${d}% vs MA200`, price > ma200 ? 'bull' : 'bear',
      price > ma200 ? 'Tendencia largo plazo alcista' : 'Tendencia largo plazo bajista', true)
  }
  if (n(ma50) && n(ma200)) {
    const gc = ma50 > ma200
    add('Cruce MA50/200', gc ? 'Golden Cross' : 'Death Cross', gc ? 'bull' : 'bear',
      gc ? 'MA50 sobre MA200: señal clásica alcista' : 'MA50 bajo MA200: señal clásica bajista', true)
  }
  if (n(price) && n(high52) && n(low52)) {
    const rng = high52 - low52
    const pos = rng > 0 ? Math.round((price - low52) / rng * 100) : 50
    const dir = pos > 60 ? 'bull' : pos < 40 ? 'bear' : 'neut'
    add('Posición en rango 52W', `${pos}% del rango`, dir,
      pos > 60 ? 'Zona alta → fortaleza relativa' : pos < 40 ? 'Zona baja → debilidad' : 'Zona media del rango', true)
  }
  if (n(change1m)) {
    const dir = change1m > 3 ? 'bull' : change1m < -3 ? 'bear' : 'neut'
    add('Momentum 1 mes', `${change1m > 0 ? '+' : ''}${change1m}%`, dir, 'Variación del último mes', true)
  }
  if (n(rsi)) {
    const dir = rsi < 30 ? 'bull' : rsi > 70 ? 'bear' : 'neut'
    add('RSI (14)', Number(rsi).toFixed(0), dir,
      rsi < 30 ? 'Sobrevendido: posible rebote' : rsi > 70 ? 'Sobrecomprado: riesgo de corrección' : 'Zona neutral (30–70)', true)
  }
  if (n(macd) && n(macdSignal)) {
    const dir = macd > macdSignal ? 'bull' : 'bear'
    add('MACD vs Señal', `MACD ${macd > 0 ? '+' : ''}${Number(macd).toFixed(2)}`, dir,
      macd > macdSignal ? 'MACD sobre señal → cruce alcista' : 'MACD bajo señal → cruce bajista', true)
  }
  if (n(relVol)) {
    const dir = relVol > 1.2 ? 'bull' : relVol < 0.8 ? 'bear' : 'neut'
    add('Volumen relativo', `${Number(relVol).toFixed(2)}x`, dir,
      relVol > 1.2 ? 'Volumen elevado: movimiento con convicción' : relVol < 0.8 ? 'Volumen bajo: sin respaldo' : 'Volumen normal', true)
  }
  if (n(pe) && n(peSector)) {
    const dir = pe < peSector * 0.85 ? 'bull' : pe > peSector * 1.2 ? 'bear' : 'neut'
    add('P/E vs sector', `P/E ${pe} (sector ${peSector})`, dir,
      pe < peSector ? 'Subvaluada vs sector' : pe > peSector ? 'Sobrevaluada vs sector' : 'Valuación en línea', false)
  }
  if (n(epsGrowth)) {
    const dir = epsGrowth > 10 ? 'bull' : epsGrowth < 0 ? 'bear' : 'neut'
    add('Crecimiento EPS', `${epsGrowth > 0 ? '+' : ''}${epsGrowth}%`, dir,
      epsGrowth > 10 ? 'Crecimiento fuerte' : epsGrowth < 0 ? 'Caída en ganancias: alerta' : 'Crecimiento moderado', false)
  }
  if (n(netMargin)) {
    const dir = netMargin > 12 ? 'bull' : netMargin < 5 ? 'bear' : 'neut'
    add('Margen neto', `${Number(netMargin).toFixed(1)}%`, dir,
      netMargin > 12 ? 'Margen saludable' : netMargin < 5 ? 'Margen estrecho → vulnerable' : 'Margen aceptable', false)
  }
  if (n(de)) {
    // D/E con umbrales sectoriales — evita falsos negativos en consumer defensive, financials, utilities
    const sector = data.sector || data.sicDescription || data.companyName || ''
    const { bullish, bearish } = getSectorialDERule(sector)
    const deDir = de < bullish ? 'bull' : de > bearish ? 'bear' : 'neut'
    const deNote = de < bullish
      ? 'Bajo apalancamiento para el sector'
      : de > bearish
        ? 'Alto apalancamiento → riesgo financiero'
        : 'Apalancamiento normal para el sector'
    add('Deuda/Patrimonio D/E', Number(de).toFixed(2), deDir, deNote, false)
  }
  if (n(roe)) {
    const dir = roe > 15 ? 'bull' : roe < 8 ? 'bear' : 'neut'
    add('ROE', `${Number(roe).toFixed(1)}%`, dir,
      roe > 15 ? 'Alta rentabilidad' : roe < 8 ? 'Baja rentabilidad' : 'ROE aceptable', false)
  }
  if (n(divYield)) {
    const dir = divYield > 2 ? 'bull' : 'neut'
    add('Dividend yield', `${Number(divYield).toFixed(2)}%`, dir,
      divYield > 3 ? 'Dividendo atractivo' : divYield > 0 ? 'Dividendo moderado' : 'Sin dividendo', false)
  }

  const total = indicators.length
  const score = total > 0 ? Math.round(bull / total * 100) : 0
  const neutralCount = total - bull - bear

  let trend, signal, sentiment
  if (score >= 65)      { trend = 'Tendencia alcista'; signal = score >= 75 ? 'Señal de compra' : 'Posible zona de entrada'; sentiment = 'bull' }
  else if (score <= 35) { trend = 'Tendencia bajista'; signal = 'Señal de venta / espera'; sentiment = 'bear' }
  else                  { trend = 'Tendencia neutral'; signal = 'Mantener · esperar confirmación'; sentiment = 'neut' }

  const confidence = total >= 8 ? 'Alta' : total >= 5 ? 'Media' : 'Baja'

  return { indicators, bull, bear, neutral: neutralCount, total, score, trend, signal, sentiment, confidence }
}
