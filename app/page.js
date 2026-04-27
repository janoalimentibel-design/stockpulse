'use client'
import { useState, useRef } from 'react'
import { computeAnalysis } from '../lib/analyze'
import Navbar from '../components/Navbar'
import SearchBox from '../components/SearchBox'
import ResultCard from '../components/ResultCard'
import ManualForm from '../components/ManualForm'

export default function Home() {
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
    'Consultando precio y métricas...',
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
      if (!mdRes.ok || md.error) throw new Error(md.error || 'No pudimos obtener datos para este ticker. Verificá que sea un símbolo válido: AAPL, NVDA, MELI.')
      setMarketData(md)

      const prelimResult = computeAnalysis({ ...md, ...manualData })
      setAnalysis(prelimResult)

      setLoadingMsg('Generando análisis completo con IA...')
      const narRes = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: md }),
      })
      const nar = await narRes.json()

      if (!nar.error) {
        setNarrative(nar)
        if (nar.extraData) {
          const enrichedData = { ...md, ...nar.extraData }
          setMarketData(enrichedData)
          setAnalysis(computeAnalysis({ ...enrichedData, ...manualData }))
        }
      } else {
        setNarrative({ _error: nar.error })
      }

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setError(err.message)
    } finally {
      clearInterval(msgInterval)
      setLoading(false)
    }
  }

  const hasResults = analysis && marketData

  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[900px] mx-auto px-5 pb-20 pt-6">

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            Análisis de acciones
          </h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            Técnico · Fundamental · Narrativa IA · en español — gratis, sin registro
          </p>
        </div>

        {/* Buscador */}
        <SearchBox
          ticker={ticker}
          setTicker={setTicker}
          onSearch={runAnalysis}
          loading={loading}
        />

        {/* Disclaimer */}
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

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)' }}>
            {error}
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
                  const result = computeAnalysis({ ...marketData, ...manualData })
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
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Ej: AAPL · NVDA · MELI · GOOGL · MSFT · AMZN</p>
          </div>
        )}
      </main>
    </div>
  )
}
