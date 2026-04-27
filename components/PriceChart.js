'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const RANGES = ['1D', '1M', '6M', '1A', '5A', 'MAX']

export default function PriceChart({ ticker }) {
  const canvasRef  = useRef(null)
  const wrapperRef = useRef(null)
  const [range, setRange]     = useState('1M')
  const [points, setPoints]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [change, setChange]   = useState(null)
  const [hover, setHover]     = useState(null)
  const [needsPro, setNeedsPro] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError('')
    setHover(null)
    setNeedsPro(false)
    fetch('/api/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, range }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.needsPro) { setNeedsPro(true); setPoints([]); return }
        if (d.error) { setError(d.error); setPoints([]); return }
        setPoints(d.points || [])
        setChange(d.change)
      })
      .catch(() => setError('Error cargando historial.'))
      .finally(() => setLoading(false))
  }, [ticker, range])

  function formatLabel(ts) {
    const d = new Date(ts)
    if (range === '1D') return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    if (range === '1M' || range === '6M') return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    if (range === '1A') return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const prices = points.map(p => p.c)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    const padY = (maxP - minP) * 0.1 || 1
    const lo = minP - padY
    const hi = maxP + padY

    const isUp  = prices[prices.length - 1] >= prices[0]
    const color = isUp ? '#4ebb79' : '#e05050'

    const padL = 0, padR = 0, padT = 8, padB = 24
    const chartW = W - padL - padR
    const chartH = H - padT - padB

    const xOf = i => padL + (i / (points.length - 1)) * chartW
    const yOf = v => padT + (1 - (v - lo) / (hi - lo)) * chartH

    ctx.clearRect(0, 0, W, H)

    // Línea base
    const baseY = yOf(prices[0])
    ctx.beginPath()
    ctx.setLineDash([3, 5])
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.moveTo(padL, baseY)
    ctx.lineTo(padL + chartW, baseY)
    ctx.stroke()
    ctx.setLineDash([])

    // Área
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH)
    grad.addColorStop(0, isUp ? 'rgba(78,187,121,0.14)' : 'rgba(224,80,80,0.14)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(prices[0]))
    for (let i = 1; i < points.length; i++) {
      const x0 = xOf(i-1), y0 = yOf(prices[i-1])
      const x1 = xOf(i),   y1 = yOf(prices[i])
      const cx = (x0 + x1) / 2
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1)
    }
    ctx.lineTo(xOf(points.length - 1), padT + chartH)
    ctx.lineTo(xOf(0), padT + chartH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Línea
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(prices[0]))
    for (let i = 1; i < points.length; i++) {
      const x0 = xOf(i-1), y0 = yOf(prices[i-1])
      const x1 = xOf(i),   y1 = yOf(prices[i])
      const cx = (x0 + x1) / 2
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Labels X
    const step = Math.max(1, Math.floor(points.length / 5))
    ctx.fillStyle = '#484c5a'
    ctx.font = '10px DM Mono, monospace'
    ctx.textAlign = 'center'
    for (let i = step; i < points.length; i += step) {
      ctx.fillText(formatLabel(points[i].t), xOf(i), H - 4)
    }

    // Crosshair
    if (hover !== null && hover.idx >= 0 && hover.idx < points.length) {
      const cx = xOf(hover.idx)
      const cy = yOf(prices[hover.idx])
      ctx.beginPath()
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.moveTo(cx, padT)
      ctx.lineTo(cx, padT + chartH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#0b0d12'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [points, hover, range])

  const handleMouseMove = useCallback((e) => {
    if (!wrapperRef.current || points.length < 2) return
    const rect   = wrapperRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const idx    = Math.round((mouseX / rect.width) * (points.length - 1))
    const clamped = Math.max(0, Math.min(points.length - 1, idx))
    const p = points[clamped]
    const pct = ((p.c - points[0].c) / points[0].c * 100).toFixed(2)
    setHover({ idx: clamped, price: p.c, label: formatLabel(p.t), pct: parseFloat(pct), o: p.o, h: p.h, l: p.l, v: p.v })
  }, [points, range])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  const isUp   = change !== null ? change >= 0 : true
  const active = hover || null
  const lastPoint   = points.length > 0 ? points[points.length - 1] : null
  const displayPoint = active ? active : lastPoint ? { price: lastPoint.c, o: lastPoint.o, h: lastPoint.h, l: lastPoint.l, v: lastPoint.v, pct: change } : null

  return (
    <div className="rounded-xl mb-4 overflow-hidden"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-wrap gap-2">
        <div style={{ minHeight: 22 }}>
          {active ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                ${active.price.toFixed(2)}
              </span>
              <span className="text-xs" style={{ color: active.pct >= 0 ? '#4ebb79' : '#e05050' }}>
                {active.pct >= 0 ? '+' : ''}{active.pct}%
              </span>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{active.label}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {change !== null && !loading && (
                <span className="text-xs font-medium" style={{ color: isUp ? '#4ebb79' : '#e05050' }}>
                  {isUp ? '+' : ''}{change}% en este período
                </span>
              )}
              {loading && <span className="text-xs" style={{ color: 'var(--text3)' }}>Cargando...</span>}
              {error && <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>}
              {needsPro && (
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  Historial extendido próximamente
                </span>
              )}
            </div>
          )}
        </div>

        {/* Selector de rango */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{
                padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                border: '0.5px solid',
                borderColor: range === r ? 'var(--accent)' : 'transparent',
                background:  range === r ? 'var(--accent-bg)' : 'transparent',
                color: (r === '5A' || r === 'MAX')
                  ? (range === r ? 'var(--accent)' : 'var(--text3)')
                  : (range === r ? 'var(--accent)' : 'var(--text3)'),
                cursor: 'pointer',
                transition: 'all 0.15s',
                opacity: (r === '5A' || r === 'MAX') ? 0.5 : 1,
              }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef}
        style={{ position: 'relative', width: '100%', height: 160, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loading && needsPro && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Historial extendido no disponible aún</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', opacity: 0.6 }}>Probá con 1A o menos</span>
          </div>
        )}
        {!loading && !needsPro && points.length === 0 && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin datos disponibles</span>
          </div>
        )}
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Métricas */}
      {displayPoint && (
        <div className="grid grid-cols-4" style={{ borderTop: '0.5px solid var(--border)' }}>
          {[
            { label: 'Apertura', val: displayPoint.o ? `$${Number(displayPoint.o).toFixed(2)}` : 'N/D', color: 'var(--text)' },
            { label: 'Máximo',   val: displayPoint.h ? `$${Number(displayPoint.h).toFixed(2)}` : 'N/D', color: '#4ebb79'     },
            { label: 'Mínimo',   val: displayPoint.l ? `$${Number(displayPoint.l).toFixed(2)}` : 'N/D', color: '#e05050'     },
            { label: 'Volumen',  val: displayPoint.v ? formatVol(displayPoint.v) : 'N/D',               color: 'var(--text)' },
          ].map((m, i) => (
            <div key={i} style={{
              padding: '10px 16px',
              borderRight: i < 3 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: m.color, fontFamily: 'DM Mono, monospace' }}>{m.val}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function formatVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return v.toString()
}
