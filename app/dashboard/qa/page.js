'use client'
// app/dashboard/qa/page.js
import { useEffect, useState } from 'react'

const C = {
  bg:'#0b0d12', bg2:'#12151c', bg3:'#1a1e28', bg4:'#222633',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  text:'#edeef2', text2:'#8a8d9a', text3:'#484c5a',
  green:'#4ebb79', red:'#e05050', amber:'#d4954a', accent:'#6c7fff', purple:'#a78bfa',
  greenBg:'rgba(78,187,121,0.10)',   greenBd:'rgba(78,187,121,0.28)',
  redBg:'rgba(224,80,80,0.10)',      redBd:'rgba(224,80,80,0.28)',
  amberBg:'rgba(212,149,74,0.10)',   amberBd:'rgba(212,149,74,0.28)',
  accentBg:'rgba(108,127,255,0.10)', accentBd:'rgba(108,127,255,0.28)',
  purpleBg:'rgba(167,139,250,0.10)', purpleBd:'rgba(167,139,250,0.28)',
}

function Box({ children, style }) {
  return (
    <div style={{ background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:10, padding:'14px 16px', ...style }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return (
    <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:C.text3, marginBottom:6 }}>
      {children}
    </p>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'hace un momento'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  return `hace ${days} día${days !== 1 ? 's' : ''}`
}

function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

function StatChip({ value, label, color, bg, border }) {
  return (
    <div style={{
      background: bg || C.bg3,
      border: `1px solid ${border || C.border2}`,
      borderRadius: 10,
      padding: '12px 16px',
      textAlign: 'center',
      flex: 1,
      minWidth: 0,
    }}>
      <p style={{ fontSize: 24, fontWeight: 600, color: color || C.text, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: C.text3, margin: '4px 0 0' }}>{label}</p>
    </div>
  )
}

function NarrativeBlock({ narrative }) {
  if (!narrative) return <p style={{ fontSize:12, color:C.text3, marginTop:8 }}>Sin narrativa en caché.</p>
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {narrative.technical_summary && (
        <div>
          <p style={{ fontSize:10, color:C.text3, marginBottom:3, textTransform:'uppercase', letterSpacing:'.06em' }}>Técnico</p>
          <p style={{ fontSize:12, color:C.text2, lineHeight:1.6 }}>{narrative.technical_summary}</p>
        </div>
      )}
      {narrative.fundamental_summary && (
        <div>
          <p style={{ fontSize:10, color:C.text3, marginBottom:3, textTransform:'uppercase', letterSpacing:'.06em' }}>Fundamental</p>
          <p style={{ fontSize:12, color:C.text2, lineHeight:1.6 }}>{narrative.fundamental_summary}</p>
        </div>
      )}
      {narrative.analyst_summary && (
        <div>
          <p style={{ fontSize:10, color:C.text3, marginBottom:3, textTransform:'uppercase', letterSpacing:'.06em' }}>Analistas</p>
          <p style={{ fontSize:12, color:C.text2, lineHeight:1.6 }}>{narrative.analyst_summary}</p>
        </div>
      )}
    </div>
  )
}

function WarningCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: C.amberBg,
      border: `1px solid ${C.amberBd}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.ticker}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>{timeAgo(item.cachedAt)}</span>
        </div>
        <span style={{ fontSize: 11, color: C.amber, background: C.amberBg, border: `1px solid ${C.amberBd}`, borderRadius: 999, padding: '2px 8px' }}>
          ⚠️ warning
        </span>
      </div>
      <p style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: expanded ? 0 : 6 }}>
        {expanded ? (item.narrative?.technical_summary || '—') : truncate(item.narrative?.technical_summary, 120)}
      </p>
      {expanded && <NarrativeBlock narrative={item.narrative} />}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          marginTop: 8,
          fontSize: 11,
          color: C.amber,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {expanded ? 'Cerrar ▲' : 'Ver completo ▼'}
      </button>
    </div>
  )
}

function FeedbackItem({ item }) {
  const [expanded, setExpanded] = useState(false)
  const isUp = item.rating === 'up'
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      padding: '10px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{isUp ? '👍' : '👎'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.ticker}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>{timeAgo(item.createdAt)}</span>
          {item.hasWarning && (
            <span style={{ fontSize: 10, color: C.amber, background: C.amberBg, border: `1px solid ${C.amberBd}`, borderRadius: 999, padding: '1px 7px' }}>
              ⚠️ warning
            </span>
          )}
        </div>
        {item.narrative && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              fontSize: 11,
              color: C.accent,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {expanded ? 'Cerrar ▲' : 'Ver narrativa ▼'}
          </button>
        )}
      </div>
      {expanded && <NarrativeBlock narrative={item.narrative} />}
    </div>
  )
}

export default function QAPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/dashboard/qa', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => { setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const baseStyle = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: 'system-ui,sans-serif',
    padding: '16px',
  }

  if (loading) {
    return (
      <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, fontSize: 13 }}>
        Cargando...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red, fontSize: 13 }}>
        Error al cargar datos de QA.
      </div>
    )
  }

  const stats          = data?.stats          || {}
  const recentFeedback = data?.recentFeedback || []
  const warnings       = data?.warnings       || []
  const isEmpty        = stats.totalFeedback === 0 && stats.warningCount === 0

  const upRateColor = stats.upRate >= 70 ? C.green : stats.upRate < 50 ? C.red : C.amber
  const upRateBg    = stats.upRate >= 70 ? C.greenBg : stats.upRate < 50 ? C.redBg : C.amberBg
  const upRateBd    = stats.upRate >= 70 ? C.greenBd : stats.upRate < 50 ? C.redBd : C.amberBd

  return (
    <div style={baseStyle}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>QA de Narrativas</h1>
          <a
            href="/dashboard"
            style={{ fontSize: 12, color: C.accent, textDecoration: 'none', background: C.accentBg, border: `1px solid ${C.accentBd}`, borderRadius: 999, padding: '5px 14px' }}
          >
            ← Volver al Dashboard
          </a>
        </div>

        {/* Stats */}
        <Box style={{ marginBottom: 16 }}>
          <Label>Resumen</Label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatChip value={stats.totalFeedback ?? 0} label="feedbacks" />
            <StatChip
              value={`${stats.upRate ?? 0}% 👍`}
              label="aprobación"
              color={upRateColor}
              bg={upRateBg}
              border={upRateBd}
            />
            <StatChip value={stats.cachedNarratives ?? 0} label="en caché" color={C.accent} bg={C.accentBg} border={C.accentBd} />
            <StatChip
              value={`${stats.warningCount ?? 0} ⚠️`}
              label="warnings"
              color={stats.warningCount > 0 ? C.amber : C.text3}
              bg={stats.warningCount > 0 ? C.amberBg : C.bg3}
              border={stats.warningCount > 0 ? C.amberBd : C.border2}
            />
          </div>
        </Box>

        {/* Empty state */}
        {isEmpty && (
          <Box>
            <p style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: '20px 0' }}>
              Sin datos de QA. Generá análisis desde el Analizador y usá los botones de feedback.
            </p>
          </Box>
        )}

        {/* Warnings section */}
        {!isEmpty && warnings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ NARRATIVAS CON WARNINGS
            </p>
            {warnings.map((item, i) => (
              <WarningCard key={`${item.ticker}-${i}`} item={item} />
            ))}
          </div>
        )}

        {/* Recent feedback */}
        {!isEmpty && (
          <Box>
            <Label>Feedback reciente</Label>
            {recentFeedback.length === 0 ? (
              <p style={{ fontSize: 12, color: C.text3 }}>Sin feedback registrado aún.</p>
            ) : (
              recentFeedback.map((item, i) => (
                <FeedbackItem key={`${item.ticker}-${item.createdAt}-${i}`} item={item} />
              ))
            )}
          </Box>
        )}

      </div>
    </div>
  )
}
