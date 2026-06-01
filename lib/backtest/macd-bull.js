function emaArray(values, period) {
  const result = new Array(values.length).fill(null)
  const start = values.findIndex(v => v !== null)
  if (start === -1 || values.length - start < period) return result

  const k = 2 / (period + 1)
  let sum = 0
  for (let i = start; i < start + period; i++) sum += values[i]

  const firstIdx = start + period - 1
  result[firstIdx] = sum / period
  let ema = result[firstIdx]

  for (let i = firstIdx + 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

function summarize(occurrences) {
  const totalCount = occurrences.length
  const withReturn = occurrences.filter(o => o.return30d !== null)
  const winsCount = withReturn.filter(o => o.return30d > 0).length
  const avgReturn30d = withReturn.length > 0
    ? parseFloat((withReturn.reduce((s, o) => s + o.return30d, 0) / withReturn.length).toFixed(2))
    : null
  const lastOccurrence = totalCount > 0 ? occurrences[totalCount - 1].date : null
  return { occurrences, totalCount, winsCount, avgReturn30d, lastOccurrence }
}

export function macdBull(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 35) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length

  const ema12 = emaArray(closes, 12)
  const ema26 = emaArray(closes, 26)
  const macdLine = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null
  )
  const signalLine = emaArray(macdLine, 9)

  const occurrences = []
  for (let i = 1; i < n; i++) {
    if (macdLine[i - 1] === null || signalLine[i - 1] === null) continue
    if (macdLine[i] === null || signalLine[i] === null) continue
    if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) {
      const signalPrice = closes[i]
      const return30d = i + 30 < n
        ? parseFloat(((closes[i + 30] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      const return60d = i + 60 < n
        ? parseFloat(((closes[i + 60] - signalPrice) / signalPrice * 100).toFixed(2))
        : null
      occurrences.push({ date: ohlcvArray[i].date, signalPrice, return30d, return60d })
    }
  }
  return summarize(occurrences)
}
