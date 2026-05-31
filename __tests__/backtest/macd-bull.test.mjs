import { test } from 'node:test'
import assert from 'node:assert/strict'
import { macdBull } from '../../lib/backtest/macd-bull.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = macdBull([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (34 bars) returns zero result', () => {
  const r = macdBull(makeOHLCV(Array(34).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('flat prices produce no MACD crossovers', () => {
  // All closes = 100 → EMA12=EMA26=100 → MACD=0 → signal=0
  // 0 > 0 is false → no crossover ever fires
  const r = macdBull(makeOHLCV(Array(100).fill(100)))
  assert.equal(r.totalCount, 0)
})

test('trend reversal produces at least one MACD bull crossover', () => {
  // 50 bars flat at 10 (depressed), then 50 bars at 200
  // Once price jumps, EMA12 (fast) rises before EMA26 (slow) → clean MACD bull crossover
  // at signalPrice=200, well within the recovery zone
  const closes = [
    ...Array(50).fill(10),
    ...Array(50).fill(200),
  ]
  const r = macdBull(makeOHLCV(closes))

  assert.ok(r.totalCount >= 1, 'should detect at least one MACD bull crossover')
  assert.ok(
    r.occurrences.some(o => o.signalPrice >= 150),
    'al menos un cruce debe ocurrir en la zona de recuperación (precio >= 150)'
  )
  assert.ok(r.occurrences.every(o => typeof o.date === 'string'), 'all occurrences have date')
  assert.ok(r.occurrences.every(o => typeof o.signalPrice === 'number'), 'all have numeric signalPrice')
  assert.ok(typeof r.totalCount === 'number')
  assert.ok(typeof r.winsCount === 'number')
  assert.ok(r.winsCount <= r.totalCount)
})
