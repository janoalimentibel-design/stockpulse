'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const RANGES = ['1D', '1M', '6M', '1A', '5A', 'MAX']

export default function PriceChart({ ticker, polygonKey }) {
  const canvasRef    = useRef(null)
  const wrapperRef   = useRef(null)
  const [range, setRange]       = useState('1M')
  const [points, setPoints]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [change, setChange]     = useState(null)
  const [hover, setHover]       = useState(null) // { price, label, x, pct }

  // Fetch datos
  useEffect(() => {
    if (!ticker || !polygonKey) return
    setLoading(true)
    setError('')
    setHover(null)

    fetch('/api/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, range, polygonKey }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPoints([]); return }
        setPoints(d.points || [])
        setChange(d.change)
      })
      .catch(() => setError('Error cargando historial.'))
      .finally(() => setLoading(false))
  }, [ticker, range, polygonKey])

  // Formatear label de tiempo según rango
  function formatLabel(ts) {
    const d = new Date(ts)
    if (range === '1D') return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    if (range === '1M' || range === '6M') return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    if (range === '1A') return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
  }

  // Dibujar gráfico en canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvas.offsetWidth
    const H   = canvas.offsetHeight
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const prices = points.map(p => p.c)
    const minP   = Math.min(...prices)
    const maxP   = Math.max(...prices)
    const padY   = (maxP - minP) * 0.1 || 1
    const lo     = minP - padY
    const hi     = maxP + padY

    const isUp   = prices[prices.length - 1] >= prices[0]
    const color  = isUp ? '#4ebb79' : '#e05050'

    const padL = 0, padR = 0, padT = 8, padB = 24
    const chartW = W - padL - padR
    const chartH = H - padT - padB

    const xOf = i => padL + (i / (points.length - 1)) * chartW
    const yOf = v => padT + (1 - (v - lo) / (hi - lo)) * chartH

    // Limpiar
    ctx.clearRect(0, 0, W, H)

    // Línea de base (precio inicial)
    const baseY = yOf(prices[0])
    ctx.beginPath()
    ctx.setLineDash([3, 5])
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.moveTo(padL, baseY)
    ctx.lineTo(padL + chartW, baseY)
    ctx.stroke()
    ctx.setLineDash([])

    // Área bajo la curva
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH)
    grad.addColorStop(0, isUp ? 'rgba(78,187,121,0.15)' : 'rgba(224,80,80,0.15)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(prices[0]))
    for (let i = 1; i < points.length; i++) {
      const x0 = xOf(i - 1), y0 = yOf(prices[i - 1])
      const x1 = xOf(i),     y1 = yOf(prices[i])
      const cx  = (x0 + x1) / 2
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1)
    }
    ctx.lineTo(xOf(points.length - 1), padT + chartH)
    ctx.lineTo(xOf(0), padT + chartH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Línea principal
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(prices[0]))
    for (let i = 1; i < points.length; i++) {
      const x0 = xOf(i - 1), y0 = yOf(prices[i - 1])
      const x1 = xOf(i),     y1 = yOf(prices[i])
      const cx  = (x0 + x1) / 2
      ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1)
    }
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // Labels del eje X (máx 5)
    const step = Math.max(1, Math.floor(points.length / 5))
    ctx.fillStyle = '#4a4946'
    ctx.font      = '10px DM Mono, monospace'
    ctx.textAlign = 'center'
    for (let i = 0; i < points.length; i += step) {
      if (i === 0) continue
      const x = xOf(i)
      ctx.fillText(formatLabel(points[i].t), x, H - 4)
    }

    // Crosshair si hay hover
    if (hover !== null) {
      const idx = hover.idx
      if (idx >= 0 && idx < points.length) {
        const cx = xOf(idx)
        const cy = yOf(prices[idx])

        // Línea vertical
        ctx.beginPath()
        ctx.setLineDash([3, 3])
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth   = 1
        ctx.moveTo(cx, padT)
        ctx.lineTo(cx, padT + chartH)
        ctx.stroke()
        ctx.setLineDash([])

        // Punto en la curva
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle   = color
        ctx.fill()
        ctx.strokeStyle = '#111114'
        ctx.lineWidth   = 2
        ctx.stroke()
      }
    }
  }, [points, hover, range])

  // Mouse move handler
  const handleMouseMove = useCallback((e) => {
    if (!wrapperRef.current || points.length < 2) return
    const rect   = wrapperRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const W      = rect.width
    const idx    = Math.round((mouseX / W) * (points.length - 1))
    const clamped = Math.max(0, Math.min(points.length - 1, idx))
    const p      = points[clamped]
    const first  = points[0].c
    const pct    = ((p.c - first) / first * 100).toFixed(2)
    setHover({ idx: clamped, price: p.c, label: formatLabel(p.t), pct: parseFloat(pct) })
  }, [points, range])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  const isUp      = change !== null ? change >= 0 : true
  const color     = isUp ? '#4ebb79' : '#e05050'
  const hoverPct  = hover ? hover.pct : change

  return (
    <div className="rounded-xl mb-4 overflow-hidden"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

      {/* Header del gráfico */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-wrap gap-2">
        {/* Info de hover */}
        <div style={{ minHeight: 20 }}>
          {hover ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold"
                style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                ${hover.price.toFixed(2)}
              </span>
              <span className="text-xs"
                style={{ color: hover.pct >= 0 ? '#4ebb79' : '#e05050' }}>
                {hover.pct >= 0 ? '+' : ''}{hover.pct}%
              </span>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{hover.label}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {change !== null && (
                <span className="text-xs font-medium"
                  style={{ color: isUp ? '#4ebb79' : '#e05050' }}>
                  {isUp ? '+' : ''}{change}% en este período
                </span>
              )}
              {loading && (
                <span className="text-xs" style={{ color: 'var(--text3)' }}>Cargando...</span>
              )}
              {error && (
                <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>
              )}
            </div>
          )}
        </div>

        {/* Selector de rango */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="text-[11px] font-medium transition-all"
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: '0.5px solid',
                borderColor: range === r ? 'var(--accent)' : 'transparent',
                background:  range === r ? 'var(--accent-bg)' : 'transparent',
                color:       range === r ? 'var(--accent)'    : 'var(--text3)',
                cursor: 'pointer',
              }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: 160, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loading && points.length === 0 && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin datos disponibles</span>
          </div>
        )}
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Métricas — solo cuando hay hover */}
      {hover && points[hover.idx] && (
        <div className="grid grid-cols-4 gap-0"
          style={{ borderTop: '0.5px solid var(--border)' }}>
          {[
            { label: 'Apertura', val: `$${points[hover.idx].o?.toFixed(2) || 'N/D'}` },
            { label: 'Máximo',   val: `$${points[hover.idx].h?.toFixed(2) || 'N/D'}`, color: '#4ebb79' },
            { label: 'Mínimo',   val: `$${points[hover.idx].l?.toFixed(2) || 'N/D'}`, color: '#e05050' },
            { label: 'Volumen',  val: points[hover.idx].v ? formatVol(points[hover.idx].v) : 'N/D' },
          ].map((m, i) => (
            <div key={i} className="px-4 py-2.5"
              style={{ borderRight: i < 3 ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: m.color || 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{m.val}</div>
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
