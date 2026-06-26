// lib/market.js
export const SUFFIX_CURRENCY = {
  '.AS': 'EUR', '.DE': 'EUR', '.PA': 'EUR', '.L':  'GBP',
  '.MI': 'EUR', '.MC': 'EUR', '.ST': 'SEK', '.HE': 'EUR',
  '.CO': 'DKK', '.OL': 'NOK', '.VI': 'EUR', '.SW': 'CHF',
  '.BR': 'EUR', '.LS': 'EUR', '.IR': 'EUR', '.AT': 'EUR',
  '.T':  'JPY',
}

export function isInternational(ticker) {
  if (!ticker) return false
  const dot = ticker.lastIndexOf('.')
  if (dot === -1) return false
  return ticker.slice(dot).toUpperCase() in SUFFIX_CURRENCY
}

export function getCurrency(ticker) {
  if (!ticker) return 'USD'
  const dot = ticker.lastIndexOf('.')
  if (dot === -1) return 'USD'
  return SUFFIX_CURRENCY[ticker.slice(dot).toUpperCase()] || 'USD'
}

export function getFxTicker(currency) {
  if (!currency || currency === 'USD') return null
  return `${currency}USD=X`
}
