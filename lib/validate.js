// lib/validate.js

/**
 * Acepta solo tickers reales: letras, números, punto y guión.
 * Máximo 12 caracteres. Devuelve el ticker normalizado o null.
 */
export function validateTicker(raw) {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.toUpperCase().trim()
  if (t.length < 1 || t.length > 12) return null
  if (!/^[A-Z0-9.\-]+$/.test(t)) return null
  return t
}

/**
 * Valida el rango de tiempo para el gráfico histórico.
 * Si viene algo inesperado, devuelve el fallback seguro '1M'.
 */
export function validateRange(raw) {
  const allowed = new Set(['1D', '1M', '6M', '1A', '5A', 'MAX'])
  return allowed.has(raw) ? raw : '1M'
}

/**
 * Valida una query de búsqueda libre (nombre de empresa).
 * Limita longitud para evitar requests desproporcionadas a Polygon.
 */
export function validateQuery(raw) {
  if (!raw || typeof raw !== 'string') return null
  const q = raw.trim()
  if (q.length < 1 || q.length > 50) return null
  return q
}
