const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildDateRange, mapBar } = require('./download-history')

test('buildDateRange devuelve hoy y hace 5 años como YYYY-MM-DD', () => {
  const { from, to } = buildDateRange()

  // Verify format
  assert.match(from, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(to,   /^\d{4}-\d{2}-\d{2}$/)

  // 'to' must be today
  const today = new Date().toISOString().split('T')[0]
  assert.equal(to, today)

  // 'from' must be ~5 years before 'to' — verify via day count, not by re-running the algorithm
  // Any 5-year span has 1825–1827 days depending on how many Feb 29s it contains
  const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)
  assert.ok(
    diffDays >= 1825 && diffDays <= 1827,
    `Se esperaban ~1825-1827 días de diferencia, se obtuvo ${diffDays}`
  )
})

test('mapBar convierte una barra de Polygon a fila ohlcv_daily', () => {
  // 1609459200000 ms = 2021-01-01T00:00:00.000Z
  const bar = { t: 1609459200000, o: 100.5, h: 105.0, l: 99.0, c: 103.2, v: 50000000 }
  const row = mapBar('AAPL', bar)

  assert.deepEqual(row, {
    ticker: 'AAPL',
    date:   '2021-01-01',
    open:   100.5,
    high:   105.0,
    low:    99.0,
    close:  103.2,
    volume: 50000000,
  })
})

test('mapBar redondea volumen float a entero (datos ajustados por splits)', () => {
  const bar = { t: 1609459200000, o: 100.5, h: 105.0, l: 99.0, c: 103.2, v: 37308155.220558 }
  const row = mapBar('AAPL', bar)
  assert.equal(row.volume, 37308155)
  assert.equal(typeof row.volume, 'number')
  assert.equal(row.volume % 1, 0)
})
