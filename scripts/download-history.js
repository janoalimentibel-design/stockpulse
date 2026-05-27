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
  return {
    ticker,
    date:   new Date(bar.t).toISOString().split('T')[0],
    open:   bar.o,
    high:   bar.h,
    low:    bar.l,
    close:  bar.c,
    volume: bar.v,
  }
}

if (require.main === module) {
  // implemented in Task 5
}

module.exports = { buildDateRange, mapBar }
