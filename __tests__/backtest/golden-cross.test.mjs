import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goldenCross } from '../../lib/backtest/golden-cross.js'

function makeOHLCV(closes) {
  const start = new Date('2020-01-02')
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], open: c, high: c, low: c, close: c, volume: 1000 }
  })
}

test('empty array returns zero result', () => {
  const r = goldenCross([])
  assert.equal(r.totalCount, 0)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
  assert.equal(r.lastOccurrence, null)
  assert.deepEqual(r.occurrences, [])
})

test('array below warm-up (200 bars) returns zero result', () => {
  const r = goldenCross(makeOHLCV(Array(200).fill(100)))
  assert.equal(r.totalCount, 0)
  assert.equal(r.occurrences.length, 0)
})

test('detects golden cross and computes returns correctly', () => {
  // bars 0-199: close=100 → MA50=100, MA200=100 (equal, no cross yet)
  // bar 200: close=200 → MA50=(49×100+200)/50=102, MA200=(199×100+200)/200=100.5 → CROSS
  // bars 201-260: close=220 → return30d=(220-200)/200×100=10.0, return60d=10.0
  const closes = [...Array(200).fill(100), 200, ...Array(60).fill(220)]
  const arr = makeOHLCV(closes)  // 261 bars total
  const r = goldenCross(arr)

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].signalPrice, 200)
  assert.equal(r.occurrences[0].return30d, 10.0)
  assert.equal(r.occurrences[0].return60d, 10.0)
  assert.equal(r.winsCount, 1)
  assert.equal(r.avgReturn30d, 10.0)
  assert.ok(r.lastOccurrence, 'lastOccurrence must be a date string')
})

test('signal at end of array has null returns and does not count as win', () => {
  // 201 bars: crossover at bar 200, no bars left for 30d/60d returns
  const closes = [...Array(200).fill(100), 200]
  const r = goldenCross(makeOHLCV(closes))

  assert.equal(r.totalCount, 1)
  assert.equal(r.occurrences[0].return30d, null)
  assert.equal(r.occurrences[0].return60d, null)
  assert.equal(r.winsCount, 0)
  assert.equal(r.avgReturn30d, null)
})
