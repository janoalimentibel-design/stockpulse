// lib/validate-events.js
// Validates and sanitizes the events payload returned by Claude web search

const VALID_EVENT_TYPES = new Set([
  'estrategia', 'regulacion', 'earnings', 'producto',
  'macro', 'analista', 'M&A', 'geopolitica', 'otro',
])
const VALID_IMPACT = new Set(['alto', 'medio', 'bajo'])
const VALID_METRIC = new Set([
  'revenue', 'margins', 'growth', 'sentiment', 'regulatory', 'supply_chain',
])
const VALID_BIAS = new Set(['positivo', 'negativo', 'neutral', 'ambiguo'])

const MAX_EVENTS   = 5
const MAX_TITLE    = 160
const MAX_SOURCE   = 80
const MAX_SUMMARY  = 320

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<cite[^>]*>/gi, '')
    .replace(/<\/antml:cite>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

/**
 * Validates and sanitizes the raw parsed response from Claude.
 * Returns { valid: boolean, events: [...], issues: [...] }
 */
export function validateEvents(raw) {
  const issues = []

  if (!raw || typeof raw !== 'object') {
    return { valid: false, events: [], issues: ['Response is not an object'] }
  }

  const rawEvents = Array.isArray(raw.events) ? raw.events : []
  if (rawEvents.length === 0) {
    return { valid: false, events: [], issues: ['No events array found'] }
  }

  const events = rawEvents
    .slice(0, MAX_EVENTS)
    .map((e, i) => {
      if (!e || typeof e !== 'object') {
        issues.push(`Event ${i}: not an object`)
        return null
      }

      const title = sanitizeText(e.title || '').slice(0, MAX_TITLE)
      if (!title) {
        issues.push(`Event ${i}: missing title`)
        return null
      }

      return {
        title,
        source:           sanitizeText(e.source || '').slice(0, MAX_SOURCE) || null,
        url:              isValidUrl(e.url) ? e.url : null,
        date:             isValidDate(e.date) ? e.date : null,
        event_type:       VALID_EVENT_TYPES.has(e.event_type)     ? e.event_type     : 'otro',
        impact_magnitude: VALID_IMPACT.has(e.impact_magnitude)    ? e.impact_magnitude : 'medio',
        affected_metric:  VALID_METRIC.has(e.affected_metric)     ? e.affected_metric  : 'sentiment',
        summary:          sanitizeText(e.summary || '').slice(0, MAX_SUMMARY),
        directional_bias: VALID_BIAS.has(e.directional_bias)      ? e.directional_bias : 'ambiguo',
      }
    })
    .filter(Boolean)

  return {
    valid:  events.length > 0,
    events,
    issues,
  }
}
