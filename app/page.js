'use client'
import { useState, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'
import { computeAnalysis } from '../lib/analyze'
import Navbar from '../components/Navbar'
import SearchBox from '../components/SearchBox'
import ResultCard from '../components/ResultCard'
import ManualForm from '../components/ManualForm'

function friendlyError(raw) {
  if (!raw) return 'Ocurrió un error inesperado. Intentá de nuevo.'
  const msg = raw.toLowerCase()
  if (msg.includes('ticker') || msg.includes('not found') || msg.includes('no results'))
    return 'No encontramos datos para ese ticker. Verificá que sea un símbolo válido del NYSE o NASDAQ: AAPL, NVDA, MELI, GOOGL.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Demasiadas consultas seguidas. Esperá unos segundos e intentá de nuevo.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.'
  if (msg.includes('claude') || msg.includes('anthropic'))
    return 'Error al generar el análisis con IA. Los datos técnicos están disponibles igual.'
  return 'No pudimos obtener datos para este ticker. Probá con: AAPL, NVDA, MELI, GOOGL, AMZN.'
}

export default function Home() {
  const posthog = usePostHog()
  const [ticker,     setTicker]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error,      setError]      = useState('')
  const [marketData, setMarketData] = useState(null)
  const [narrative,  setNarrative]  = useState(null)
  const [analysis,   setAnalysis]   = useState(null)
  const [manualData, setManualData] = useState({})
  const [activeTab,  setActiveTab]  = useState('resultado')
  const resultRef = useRef(null)

  const msgs = [
    'Buscando datos de mercado...',
    'Obteniendo noticias recientes...',
    'Calculando indicadores técnicos...',
    'Generando análisis con IA...',
    'Casi listo...',
  ]

  async function runAnalysis(searchTicker) {
    const t = (searchTicker || ticker).toUpperCase().trim()
    if (!t) return

    setLoading(true)
    setError('')
    setMarketData(null)
    setNarrative(null)
    setAnalysis(null)
    setActiveTab('resultado')

    let msgIdx = 0
    setLoadingMsg(msgs[0])
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length
      setLoadingMsg(msgs[msgIdx])
    }, 2000)

    try {
      const mdRes = await fetch('/api/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: t }),
      })
      const md = await mdRes.json()
      if (!mdRes.ok || md.error) throw new Error(md.error || 'ticker_not_found')
      setMarketData(md)

      const enrichedForAnalysis = { ...md, ...(md.fundamentals || {}), ...manualData }
      const prelimResult = computeAnalysis(enrichedForAnalysis)
      setAnalysis(prelimResult)

      setLoadingMsg('Generando análisis completo con IA...')
      const narRes = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            ...md,
            panelData: {
              trend:      prelimResult.trend,
              signal:     prelimResult.signal,
              score:      prelimResult.score,
              sentiment:  prelimResult.sentiment,
              macd:       prelimResult.macd,
              macdSignal: prelimResult.macdSignal,
            },
          },
        }),
      })
      const nar = await narRes.json()
      setNarrative(nar.error ? { _error: nar.error } : nar)
      posthog?.capture('analysis_completed', {
        ticker: t,
        score: prelimResult.score,
        trend: prelimResult.trend,
        has_fundamentals: !!(md.fundamentals?.de || md.fundamentals?.roe),
        narrative_ok: !nar.error,
      })

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      const friendlyMsg = friendlyError(err.message)
      setError(friendlyMsg)
      posthog?.capture('analysis_error', { ticker: t, error: err.message })
    } finally {
      clearInterval(msgInterval)
      setLoading(false)
    }
  }

  const hasResults = analysis && marketData

  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[1280px] mx-auto px-5 pb-20 pt-6">

        {/* Landing mínima */}
        <div className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            Análisis de acciones
          </h1>
          <p className="text-sm mb-3" style={{ color: 'var(--text2)' }}>
            ¿No sabés si comprar, vender o esperar? Escribí una acción y en segundos te lo explicamos.
          </p>
          <div className="flex gap-2 flex-wrap">
            {['Técnico · 8 indicadores', 'Fundamental · D/E, ROE, márgenes', 'Narrativa IA en español', 'Gratis · sin registro'].map((tag, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Buscador */}
        <SearchBox
          ticker={ticker}
          setTicker={setTicker}
          onSearch={runAnalysis}
          loading={loading}
        />

        {!hasResults && !loading && (
          <p className="text-[11px] mt-3" style={{ color: 'var(--text3)' }}>
            ⚠️ Herramienta informativa — no constituye asesoramiento financiero ni recomendación de inversión.
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-6 rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse-soft" style={{ background: 'var(--accent)' }} />
              <span className="text-sm" style={{ color: 'var(--text2)' }}>{loadingMsg}</span>
            </div>
            <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
              <div className="h-full rounded-full animate-slide-bar" style={{ background: 'var(--accent)' }} />
            </div>
          </div>
        )}

        {/* Error amigable */}
        {error && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--red)' }}>No pudimos completar el análisis</p>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>{error}</p>
          </div>
        )}

        {/* Resultado */}
        {hasResults && (
          <div ref={resultRef} className="mt-6 animate-fade-up">
            <ResultCard
              ticker={marketData.ticker}
              companyName={marketData.companyName}
              marketData={marketData}
              analysis={analysis}
              narrative={narrative}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasClaude={true}
            />
            <div className="mt-6">
              <ManualForm
                values={manualData}
                onChange={setManualData}
                onAnalyze={() => {
                  const result = computeAnalysis({ ...marketData, ...(marketData.fundamentals || {}), ...manualData })
                  setAnalysis(result)
                  setActiveTab('resultado')
                  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!hasResults && !loading && !error && (
          <div className="text-center py-16" style={{ color: 'var(--text3)' }}>
            <p className="text-5xl mb-5">📈</p>
            <p className="text-sm mb-1">Escribí un ticker o nombre de empresa para ver el análisis completo.</p>
            <p className="text-xs">Ej: AAPL · NVDA · MELI · GOOGL · MSFT · AMZN · KO · TSLA</p>
          </div>
        )}
      </main>
    </div>
  )
}
