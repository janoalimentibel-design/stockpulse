function ma(closes, i, period) {
  let sum = 0
  for (let j = i - period + 1; j <= i; j++) sum += closes[j]
  return sum / period
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

export function goldenCross(ohlcvArray) {
  if (!ohlcvArray || ohlcvArray.length < 201) {
    return { occurrences: [], totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null }
  }
  const closes = ohlcvArray.map(b => b.close)
  const n = closes.length
  const occurrences = []

  for (let i = 200; i < n; i++) {
    const ma50   = ma(closes, i,     50)
    const ma200  = ma(closes, i,     200)
    const ma50p  = ma(closes, i - 1, 50)
    const ma200p = ma(closes, i - 1, 200)
    if (ma50p <= ma200p && ma50 > ma200) {
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
