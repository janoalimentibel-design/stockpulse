const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildDateRange, mapBar } = require('./download-history')

test('buildDateRange devuelve hoy y hace 5 años como YYYY-MM-DD', () => {
  const { from, to } = buildDateRange()

  const today = new Date().toISOString().split('T')[0]
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const expectedFrom = fiveYearsAgo.toISOString().split('T')[0]

  assert.equal(to, today)
  assert.equal(from, expectedFrom)
  assert.match(from, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(to, /^\d{4}-\d{2}-\d{2}$/)
})
