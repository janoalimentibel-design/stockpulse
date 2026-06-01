'use client'
import { useState, useEffect } from 'react'

const SETUPS = {
  goldenCross: { name: 'Golden Cross',     desc: 'MA50 cruza sobre MA200' },
  rsiOversold: { name: 'RSI Sobrevendido', desc: 'Salida de zona RSI < 30' },
  macdBull:    { name: 'MACD Alcista',     desc: 'MACD cruza sobre señal' },
}

function formatDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SetupCard({ label, data }) {
  const winRate = data && data.totalCount > 0
    ? Math.round(data.winsCount / data.totalCount * 100)
    : null

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>{label.name}</p>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>{label.desc}</p>
      </div>
      {!data ? (
        <div className="animate-pulse h-16 rounded" style={{ background: 'var(--bg3)' }} />
      ) : data.totalCount === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text3)' }}>Sin señales en el período analizado</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text2)' }}>
            {data.totalCount} {data.totalCount === 1 ? 'vez' : 'veces'} en 5 años
          </p>
          {data.lastOccurrence && (
            <p className="text-xs" style={{ color: 'var(--text3)' }}>
              Última: {formatDate(data.lastOccurrence)}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
            Subió en 30 días:{' '}
            <span className="font-semibold" style={{ color: 'var(--text1)' }}>
              {data.winsCount} de {data.totalCount} ({winRate}%)
            </span>
          </p>
          {data.avgReturn30d !== null && (
            <p className="text-xs" style={{ color: data.avgReturn30d >= 0 ? 'var(--green)' : 'var(--red)' }}>
              Ret. prom. histórico 30d: {data.avgReturn30d > 0 ? '+' : ''}{data.avgReturn30d}%
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function BacktestSection({ ticker }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setData(null)
    fetch(`/api/backtest/${encodeURIComponent(ticker)}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text1)' }}>
          Señales técnicas históricas
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          Describe el comportamiento histórico del precio luego de estas condiciones técnicas.
          No predice resultados futuros.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(SETUPS).map(([key, label]) => (
          <SetupCard
            key={key}
            label={label}
            data={loading ? null : (data?.setups?.[key] ?? { totalCount: 0, winsCount: 0, avgReturn30d: null, lastOccurrence: null })}
          />
        ))}
      </div>
    </section>
  )
}
