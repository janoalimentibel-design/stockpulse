'use strict'

function buildDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 5)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function mapBar(ticker, bar) {
  // implemented in Task 4
}

if (require.main === module) {
  // implemented in Task 5
}

module.exports = { buildDateRange, mapBar }
