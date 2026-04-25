'use client'
import { useState } from 'react'
import { useKeys } from '../lib/useKeys'

export default function KeysBanner() {
  const { hasPolygon, hasClaude, loaded, savePolygonKey, saveClaudeKey } = useKeys()
  const [open, setOpen] = useState(false)
  const [poly, setPoly] = useState('')
  const [claude, setClaude] = useState('')
  const [saved, setSaved] = useState(false)

  if (!loaded || (hasPolygon && hasClaude)) return null

  function handleSave() {
    if (poly.trim().length > 10) savePolygonKey(poly.trim())
    if (claude.trim().startsWith('sk-ant-')) saveClaudeKey(claude.trim())
    setSaved(true)
    setTimeout(() => { setOpen(false); setSaved(false) }, 1200)
  }

  return (
    <>
      {/* Banner */}
      <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--amber)' }}>
            {!hasPolygon && !hasClaude ? 'Configurá tus API keys para usar StockPulse'
              : !hasPolygon ? 'Falta la Polygon API key'
              : 'Falta la Claude API key para narrativa con IA'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {!hasPolygon ? 'Polygon.io — gratis, sin tarjeta' : ''}
            {!hasPolygon && !hasClaude ? ' · ' : ''}
            {!hasClaude ? 'Anthropic — necesitás créditos cargados' : ''}
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="shrink-0 text-xs px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--amber)', color: '#0a0a0c' }}>
          Configurar →
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)' }}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ fontFamily: 'Syne' }}>Configurar API Keys</h2>
              <button onClick={() => setOpen(false)}
                className="text-sm px-2 py-1 rounded-lg"
                style={{ color: 'var(--text3)', background: 'var(--bg3)' }}>✕</button>
            </div>

            {/* Polygon */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
                  Polygon.io API Key {hasPolygon && <span style={{ color: 'var(--green)' }}>✓ configurada</span>}
                </label>
                <a href="https://polygon.io" target="_blank" rel="noopener noreferrer"
                  className="text-[10px]" style={{ color: 'var(--accent)' }}>Obtener gratis →</a>
              </div>
              <input type="password" value={poly} onChange={e => setPoly(e.target.value)}
                placeholder={hasPolygon ? '••••••••••••••••' : 'Pegá tu Polygon API key'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
                  background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'monospace' }} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                Gratis en polygon.io · Sin tarjeta de crédito
              </p>
            </div>

            {/* Claude */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
                  Anthropic API Key {hasClaude && <span style={{ color: 'var(--green)' }}>✓ configurada</span>}
                </label>
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer"
                  className="text-[10px]" style={{ color: 'var(--accent)' }}>Obtener →</a>
              </div>
              <input type="password" value={claude} onChange={e => setClaude(e.target.value)}
                placeholder={hasClaude ? '••••••••••••••••' : 'sk-ant-...'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
                  background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'monospace' }} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                Requiere créditos cargados en console.anthropic.com · ~$0.01 por análisis
              </p>
            </div>

            <button onClick={handleSave}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: saved ? 'var(--green)' : 'var(--accent)', color: '#fff' }}>
              {saved ? '✓ Keys guardadas' : 'Guardar keys'}
            </button>

            <p className="text-[10px] text-center mt-3" style={{ color: 'var(--text3)' }}>
              Se guardan solo en tu navegador. Nunca se envían a nuestros servidores.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
