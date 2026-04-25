'use client'
import { useState } from 'react'
import { useKeys } from '../../lib/useKeys'
import Navbar from '../../components/Navbar'
import KeysBanner from '../../components/KeysBanner'
import SearchBox from '../../components/SearchBox'

export default function ResumenPage() {
  const { polygonKey, claudeKey, hasPolygon, hasClaude } = useKeys()
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const msgs = ['Consultando datos...', 'Buscando noticias...', 'Generando analisis...', 'Casi listo...']

  async function loadSummary(searchTicker) {
    const t = (searchTicker || ticker).toUpperCase().trim()
    if (!t) return
    if (!hasPolygon) { setError('Configura tu Polygon API key primero.'); return }
    setLoading(true); setError(''); setResult(null)
    let idx = 0; setLoadingMsg(msgs[0])
    const interval = setInterval(() => { idx = (idx + 1) % msgs.length; setLoadingMsg(msgs[idx]) }, 2200)
    try {
      const mdRes = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: t, polygonKey, claudeKey })
      })
      const md = await mdRes.json()
      if (!mdRes.ok || md.error) throw new Error(md.error || 'Error obteniendo datos.')
      let nar = null
      if (hasClaude && claudeKey) {
        const narRes = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: md, claudeKey })
        })
        const narData = await narRes.json()
        if (!narData.error) nar = narData
      }
      setResult({ md, nar })
    } catch (err) {
      setError(err.message)
    } finally {
      clearInterval(interval); setLoading(false)
    }
  }

  const cc = (c) => {
    if (!c) return 'var(--text3)'
    if (c.includes('Compra')) return 'var(--green)'
    if (c.includes('Venta')) return 'var(--red)'
    return 'var(--amber)'
  }

  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[900px] mx-auto px-5 pb-20 pt-6">
        <KeysBanner />
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Resumen de mercado</h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Datos de Polygon + narrativa por Claude.</p>
        </div>
        <div className="mb-6">
          <SearchBox ticker={ticker} setTicker={setTicker} onSearch={loadSummary} loading={loading} hasPolygon={hasPolygon} polygonKey={polygonKey} />
        </div>
        {loading && (
          <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
              <span className="text-sm" style={{ color: 'var(--text2)' }}>{loadingMsg}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
              <div className="h-full rounded-full animate-slide-bar" style={{ background: 'var(--accent)' }} />
            </div>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl text-sm mb-4" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)' }}>{error}</div>
        )}
        {result && (
          <div className="space-y-3">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>{result.md.ticker}</h2>
                  {result.md.companyName && <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>{result.md.companyName}</p>}
                  {result.md.sector && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{result.md.sector}</p>}
                </div>
                {result.md.price && (
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ fontFamily: 'DM Mono' }}>${result.md.price}</div>
                    {result.md.priceChangeToday != null && (
                      <div className="text-sm" style={{ color: result.md.priceChangeToday >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {result.md.priceChangeToday >= 0 ? '+' : ''}{result.md.priceChangeToday}% hoy
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: 'RSI (14)', val: result.md.rsi ? Number(result.md.rsi).toFixed(1) : 'N/D' },
                  { label: 'MA50', val: result.md.ma50 ? '$' + result.md.ma50 : 'N/D' },
                  { label: 'MA200', val: result.md.ma200 ? '$' + result.md.ma200 : 'N/D' },
                  { label: 'Max 52W', val: result.md.high52 ? '$' + result.md.high52 : 'N/D' },
                  { label: 'Min 52W', val: result.md.low52 ? '$' + result.md.low52 : 'N/D' },
                  { label: 'Cambio 1M', val: result.md.change1m != null ? (result.md.change1m > 0 ? '+' : '') + result.md.change1m + '%' : 'N/D' },
                ].map((m, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg3)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text3)' }}>{m.label}</div>
                    <div className="text-sm font-medium" style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
            {result.nar && (
              <div className="space-y-3">
                {result.nar.analysts_consensus && (
                  <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text3)' }}>Consenso estimado (IA)</span>
                    <span className="text-sm font-semibold" style={{ color: cc(result.nar.analysts_consensus) }}>{result.nar.analysts_consensus}</span>
                  </div>
                )}
                {[
                  { title: 'Lectura tecnica', body: result.nar.technical_summary },
                  { title: 'Situacion fundamental', body: result.nar.fundamental_summary },
                  { title: 'Sentimiento de mercado', body: result.nar.market_sentiment },
                  { title: 'Para el inversor', body: result.nar.analyst_summary },
                ].filter(s => s.body).map((s, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{s.body}</p>
                  </div>
                ))}
                {(result.nar.key_opportunity || result.nar.key_risk) && (
                  <div className="grid grid-cols-2 gap-3">
                    {result.nar.key_opportunity && (
                      <div className="rounded-xl p-4" style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--green)', textTransform: 'uppercase' }}>Oportunidad</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{result.nar.key_opportunity}</p>
                      </div>
                    )}
                    {result.nar.key_risk && (
                      <div className="rounded-xl p-4" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--red)', textTransform: 'uppercase' }}>Riesgo</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{result.nar.key_risk}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {result.md.news && result.md.news.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Noticias recientes</p>
                {result.md.news.map((n, i) => (
                  <div key={i} className="py-2" style={{ borderBottom: i < result.md.news.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: 'var(--text2)' }}>{n.title}</a>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{n.publisher} - {n.published && n.published.split('T')[0]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!result && !loading && !error && (
          <div className="text-center py-16" style={{ color: 'var(--text3)' }}>
            <p className="text-4xl mb-4">📈</p>
            <p className="text-sm">Ingresa un ticker o nombre de empresa para ver el resumen.</p>
          </div>
        )}
      </main>
    </div>
  )
}
