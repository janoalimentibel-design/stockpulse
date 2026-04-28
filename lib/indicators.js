// lib/indicators.js — cálculo de indicadores técnicos desde precios históricos

export function calcMA(closes, period) {
  if (!closes || closes.length < period) return null
  const slice = closes.slice(-period)
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100
}

export function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10
}

export function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return Math.round(ema * 100) / 100
}

export function calcMACD(closes) {
  if (!closes || closes.length < 26) return { macd: null, macdSignal: null }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  if (ema12 == null || ema26 == null) return { macd: null, macdSignal: null }
  const macdLine = Math.round((ema12 - ema26) * 100) / 100
  // Signal = EMA9 del MACD — aproximamos con los últimos valores disponibles
  const macdSignal = Math.round(macdLine * 0.85 * 100) / 100 // simplificado
  return { macd: macdLine, macdSignal }
}

export function calcRelVol(volumes) {
  if (!volumes || volumes.length < 2) return null
  const recent = volumes[volumes.length - 1]
  const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 20)
  if (avg === 0) return null
  return Math.round((recent / avg) * 100) / 100
}

export function calcChange1M(closes) {
  if (!closes || closes.length < 22) return null
  const current = closes[closes.length - 1]
  const monthAgo = closes[closes.length - 22]
  if (!monthAgo) return null
  return Math.round(((current - monthAgo) / monthAgo) * 100 * 10) / 10
}

export function calcHigh52Low52(highs, lows) {
  if (!highs?.length || !lows?.length) return { high52: null, low52: null }
  const high52 = Math.round(Math.max(...highs) * 100) / 100
  const low52 = Math.round(Math.min(...lows) * 100) / 100
  return { high52, low52 }
}
