'use client'
import { useState, useEffect } from 'react'
import { useKeys } from '../../lib/useKeys'
import Navbar from '../../components/Navbar'

export default function ConfigPage() {
  const { polygonKey, claudeKey, savePolygonKey, saveClaudeKey, hasPolygon, hasClaude } = useKeys()
  const [poly, setPoly] = useState('')
  const [claude, setClaude] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (polygonKey) setPoly(polygonKey)
    if (claudeKey) setClaude(claudeKey)
  }, [polygonKey, claudeKey])

  function handleSave() {
    if (poly.trim().length > 10) savePolygonKey(poly.trim())
    if (claude.trim().startsWith('sk-ant-')) saveClaudeKey(claude.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[600px] mx-auto px-5 pb-20 pt-6">

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>⚙ API Keys</h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            Tus keys se guardan solo en este navegador. Nunca se envían a nuestros servidores.
          </p>
        </div>

        {/* Status actual */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl p-4" style={{ background: hasPolygon ? 'var(--green-bg)' : 'var(--bg2)', border: `1px solid ${hasPolygon ? 'var(--green-border)' : 'var(--border)'}` }}>
            <p className="text-xs font-medium mb-1" style={{ color: hasPolygon ? 'var(--green)' : 'var(--text3)' }}>
              {hasPolygon ? '● Polygon conectado' : '○ Polygon no configurado'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>Datos de mercado, noticias, búsqueda</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: hasClaude ? 'var(--accent-bg)' : 'var(--bg2)', border: `1px solid ${hasClaude ? 'var(--accent-border)' : 'var(--border)'}` }}>
            <p className="text-xs font-medium mb-1" style={{ color: hasClaude ? 'var(--accent)' : 'var(--text3)' }}>
              {hasClaude ? '● Claude conectado' : '○ Claude no configurado'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>Narrativa IA, datos numéricos</p>
          </div>
        </div>

        {/* Polygon */}
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Polygon.io API Key</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Gratis en polygon.io — sin tarjeta de crédito</p>
            </div>
            <a href="https://polygon.io" target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
              Obtener →
            </a>
          </div>
          <input
            type="password"
            value={poly}
            onChange={e => setPoly(e.target.value)}
            placeholder="Pegá tu Polygon API key"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
              outline: 'none', fontFamily: 'monospace' }}
          />
          <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--bg3)' }}>
            <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text3)' }}>Cómo obtenerla:</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>
              1. Andá a <strong style={{ color: 'var(--text2)' }}>polygon.io</strong> → Sign up gratis<br/>
              2. En el dashboard copiá tu API Key<br/>
              3. Pegala arriba y guardá
            </p>
          </div>
        </div>

        {/* Claude */}
        <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Anthropic API Key</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Requiere créditos — ~$0.01 por análisis completo</p>
            </div>
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
              Obtener →
            </a>
          </div>
          <input
            type="password"
            value={claude}
            onChange={e => setClaude(e.target.value)}
            placeholder="sk-ant-..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
              outline: 'none', fontFamily: 'monospace' }}
          />
          <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--bg3)' }}>
            <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text3)' }}>Cómo obtenerla:</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>
              1. Andá a <strong style={{ color: 'var(--text2)' }}>console.anthropic.com</strong><br/>
              2. Billing → Add credits (mínimo $5 USD)<br/>
              3. API Keys → Create Key → copiá la key<br/>
              4. Pegala arriba y guardá
            </p>
          </div>
        </div>

        <button onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: saved ? 'var(--green)' : 'var(--accent)', color: '#fff' }}>
          {saved ? '✓ Keys guardadas correctamente' : 'Guardar keys'}
        </button>

        <p className="text-[11px] text-center mt-4" style={{ color: 'var(--text3)' }}>
          Las keys se almacenan en localStorage de tu navegador. No se envían a ningún servidor externo.
        </p>

      </main>
    </div>
  )
}
