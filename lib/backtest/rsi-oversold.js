function rsiArray(closes, period = 14) {
  if (closes.length <= period) return closes.map(() => null)
  const result = []
  for (let i = 0; i < period; i++) result.push(null)

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += -diff
  }
  avgGain /= period
  avgLoss /= period
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
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

export function rsiOversold(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 16) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length
  const rsi = rsiArray(closes)
  const occurrences = []

  for (let i = 1; i < n; i++) {
    if (rsi[i - 1] === null || rsi[i] === null) continue
    if (rsi[i - 1] < 30 && rsi[i] >= 30) {
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
