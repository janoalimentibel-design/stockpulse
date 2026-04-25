'use client'
import { useKeys } from '../lib/useKeys'
import Link from 'next/link'

export default function KeysBanner() {
  const { hasPolygon, hasClaude, loaded } = useKeys()
  if (!loaded || (hasPolygon && hasClaude)) return null

  return (
    <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--amber)' }}>
          {!hasPolygon && !hasClaude
            ? 'Configurá tus API keys para usar StockPulse'
            : !hasPolygon
              ? 'Falta la Polygon API key para obtener datos de mercado'
              : 'Falta la Claude API key para la narrativa con IA'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
          {!hasPolygon ? 'Polygon.io — gratis, sin tarjeta' : ''}
          {!hasPolygon && !hasClaude ? ' · ' : ''}
          {!hasClaude ? 'Anthropic — necesitás créditos cargados' : ''}
        </p>
      </div>
      <Link href="/config"
        className="shrink-0 text-xs px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--amber)', color: '#0a0a0c' }}>
        Configurar →
      </Link>
    </div>
  )
}
