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
  // Any 5-year span has 1825 or 1826 days depending on how many Feb 29s it contains
  const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)
  assert.ok(
    diffDays >= 1825 && diffDays <= 1827,
    `Se esperaban ~1825-1827 días de diferencia, se obtuvo ${diffDays}`
  )
})
