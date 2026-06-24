'use client'
import { useEffect, useState } from 'react'

const EVENT_ICONS = {
  earnings:   '📊',
  estrategia: '🎯',
  regulacion: '⚖️',
  producto:   '🚀',
  macro:      '🌐',
  analista:   '👁️',
  'M&A':      '🤝',
  geopolitica:'🌍',
  otro:       '📰',
}

const BIAS_COLORS = {
  positivo: { bg: 'var(--green-bg)',  border: 'var(--green-border)',  text: 'var(--green)' },
  negativo: { bg: 'var(--red-bg)',    border: 'var(--red-border)',    text: 'var(--red)'   },
  neutral:  { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
  ambiguo:  { bg: 'var(--bg3)',       border: 'var(--border)',        text: 'var(--text3)' },
}

const IMPACT_LABELS = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${day} ${months[month - 1]} ${year}`
  } catch {
    return dateStr
  }
}

function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false)
  const colors = BIAS_COLORS[event.directional_bias] || BIAS_COLORS.ambiguo
  const icon   = EVENT_ICONS[event.event_type] || EVENT_ICONS.otro

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
              {event.title}
            </span>
            <span style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 999,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {event.directional_bias}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {event.source && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{event.source}</span>
            )}
            {event.date && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {formatDate(event.date)}</span>
            )}
            {event.impact_magnitude && (
              <span style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--bg4)',
                color: 'var(--text3)',
                border: '1px solid var(--border)',
              }}>
                {IMPACT_LABELS[event.impact_magnitude] || event.impact_magnitude}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {event.summary && (
        <div style={{ marginTop: 8, marginLeft: 28 }}>
          {!expanded && (
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              {event.summary.length > 120 ? event.summary.slice(0, 120) + '…' : event.summary}
            </p>
          )}
          {expanded && (
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              {event.summary}
            </p>
          )}
          {event.summary.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              style={{
                marginTop: 4,
                fontSize: 11,
                color: 'var(--accent)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Menos ▲' : 'Más ▼'}
            </button>
          )}
        </div>
      )}

      {/* Link */}
      {event.url && (
        <div style={{ marginTop: 8, marginLeft: 28 }}>
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
          >
            Ver fuente →
          </a>
        </div>
      )}
    </div>
  )
}

export default function EventsSection({ ticker }) {
  const [state,  setState]  = useState('idle')  // 'idle' | 'loading' | 'done' | 'error'
  const [data,   setData]   = useState(null)
  const [error,  setError]  = useState(null)

  function load() {
    setState('loading')
    setError(null)
    fetch(`/api/events/${encodeURIComponent(ticker)}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || `HTTP ${res.status}`) })
        return res.json()
      })
      .then(json => { setData(json); setState('done') })
      .catch(e  => { setError(e.message); setState('error') })
  }

  // Load on mount
  useEffect(() => { if (ticker) load() }, [ticker])

  const sectionLabel = {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text3)',
    marginBottom: 12, marginTop: 20,
    display: 'flex', alignItems: 'center', gap: 8,
  }

  if (state === 'idle') return null

  if (state === 'loading') {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={sectionLabel}>🔍 Eventos recientes</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>
          Buscando noticias recientes…
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={sectionLabel}>🔍 Eventos recientes</div>
        <div style={{
          fontSize: 12, color: 'var(--text3)',
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error || 'No se pudieron cargar los eventos.'}</span>
          <button
            type="button"
            onClick={load}
            style={{
              fontSize: 11, color: 'var(--accent)', background: 'transparent',
              border: 'none', cursor: 'pointer', padding: 0, marginLeft: 12, flexShrink: 0,
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data?.events?.length) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ ...sectionLabel }}>
        🔍 Eventos recientes
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          · últimos 30 días · {data.events.length} evento{data.events.length !== 1 ? 's' : ''}
        </span>
      </div>
      {data.events.map((event, i) => (
        <EventCard key={i} event={event} />
      ))}
      <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, marginBottom: 0 }}>
        Eventos identificados por IA con búsqueda web · pueden contener imprecisiones
      </p>
    </div>
  )
}
