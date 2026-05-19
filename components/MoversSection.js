'use client'
// components/MoversSection.js
import { useState, useEffect } from 'react'

const PALETTE = ['#6c7fff','#4ebb79','#e05050','#d4954a','#a78bfa','#2dd4bf','#f472b6']
const tickerColor = (t) => PALETTE[t.charCodeAt(0) % PALETTE.length]

function Logo({ ticker }) {
  const [err, setErr] = useState(false)
  const color = tickerColor(ticker)

  if (err) {
    return (
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: color + '1a', border: `1.5px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, color,
      }}>
        {ticker.slice(0, 2)}
      </div>
    )
  }

  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
      overflow: 'hidden', background: 'var(--bg3, #1a1e28)',
    }}>
      <img
        src={`https://assets.parqet.com/logos/symbol/${ticker}?format=svg`}
        alt={ticker}
        onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

export default function MoversSection({ onSelect }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('gainers')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gainers-losers')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
      Cargando movimientos del día...
    </div>
  )

  if (!data || data.error || (!data.gainers?.length && !data.losers?.length)) return null

  const items = data[tab] || []

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
          Movimientos del día
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text3)',
          background: 'var(--bg3)', border: '0.5px solid var(--border2)',
          borderRadius: 999, padding: '2px 8px',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ebb79' }} />
          15 min
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['gainers', 'losers'].map(t => {
          const isActive = tab === t
          const isGain = t === 'gainers'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '0.5px solid', transition: 'all .15s',
                ...(isActive && isGain
                  ? { background: 'rgba(78,187,121,0.12)', color: '#3d9e5e', borderColor: 'rgba(78,187,121,0.35)' }
                  : isActive && !isGain
                  ? { background: 'rgba(224,80,80,0.10)', color: '#c04040', borderColor: 'rgba(224,80,80,0.30)' }
                  : { background: 'transparent', color: 'var(--text2)', borderColor: 'var(--border2)' }
                ),
              }}
            >
              {isGain ? '▲ Más subidas' : '▼ Más bajadas'}
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {items.map((item) => {
          const isGain = item.change >= 0
          const changeColor = isGain ? '#3d9e5e' : '#c04040'
          const changeBg = isGain ? 'rgba(78,187,121,0.10)' : 'rgba(224,80,80,0.10)'
          const changeBorder = isGain ? 'rgba(78,187,121,0.25)' : 'rgba(224,80,80,0.25)'
          return (
            <div
              key={item.ticker}
              onClick={() => onSelect?.(item.ticker)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelect?.(item.ticker)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, padding: '14px 10px', borderRadius: 12,
                cursor: 'pointer', border: '0.5px solid var(--border2)',
                background: 'var(--bg2)', transition: 'all .15s', textAlign: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg3)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg2)'
                e.currentTarget.style.borderColor = 'var(--border2)'
              }}
            >
              <Logo ticker={item.ticker} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {item.ticker}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  ${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: changeColor,
                background: changeBg, border: `0.5px solid ${changeBorder}`,
                borderRadius: 999, padding: '3px 10px',
              }}>
                {isGain ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, textAlign: 'center' }}>
        Datos con hasta 15 min de demora · Solo informativo
      </p>
    </div>
  )
}
