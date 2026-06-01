import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rsiOversold } from '../../lib/backtest/rsi-oversold.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = rsiOversold([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (15 bars) returns zero result', () => {
  const r = rsiOversold(makeOHLCV(Array(15).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('flat prices produce no RSI signals', () => {
  // All closes = 100 → all diffs = 0 → avgLoss = 0 → RSI = 100 always, never below 30
  const r = rsiOversold(makeOHLCV(Array(100).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('detects RSI exit from oversold and computes returns', () => {
  // bars 0-14: [100,99,...,86] — 14 consecutive drops of 1
  //   → RSI[14] = 0 (avgGain=0, avgLoss=1) — in oversold
  // bar 15: close=100 → diff=+14 → RSI[15] ≈ 51.85 → exits oversold
  // bars 16-75: close=110 — for return computation
  //   → signalPrice=100, return30d=(110-100)/100×100=10.0
  const closes = [
    100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86,
    100,
    ...Array(60).fill(110),
  ]
  const arr = makeOHLCV(closes)  // 76 bars
  const r = rsiOversold(arr)

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].signalPrice, 100)
  assert.equal(r.occurrences[0].return30d, 10.0)
  assert.equal(r.occurrences[0].return60d, 10.0)
  assert.equal(r.winsCount, 1)
  assert.equal(r.avgReturn30d, 10.0)
})

test('signal at end of array has null returns and does not count as win', () => {
  // 16 bars: RSI dips below 30, then bar 15 exits — no room for 30d/60d returns
  const closes = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 100]
  const r = rsiOversold(makeOHLCV(closes))
  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].return30d, null)
  assert.equal(r.occurrences[0].return60d, null)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
})
