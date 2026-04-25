'use client'
import { useKeys } from '../lib/useKeys'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { hasPolygon, hasClaude } = useKeys()
  const path = usePathname()

  const links = [
    { href: '/',       label: 'Analizador' },
    { href: '/guia',   label: 'Guía'       },
    { href: '/config', label: '⚙ API Keys' },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(10,10,12,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
      <div className="max-w-[900px] mx-auto px-5 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>S</div>
          <span className="font-bold text-sm tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>StockPulse</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all"
              style={{
                background: path === l.href ? 'var(--bg3)'    : 'transparent',
                color:      path === l.href ? 'var(--text)'   : 'var(--text2)',
                border:     `1px solid ${path === l.href ? 'var(--border2)' : 'transparent'}`,
              }}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
            background: hasPolygon ? 'var(--green-bg)' : 'var(--bg3)',
            color:      hasPolygon ? 'var(--green)'    : 'var(--text3)',
            border:     `1px solid ${hasPolygon ? 'var(--green-border)' : 'var(--border)'}`,
          }}>
            {hasPolygon ? '● Polygon' : '○ Polygon'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
            background: hasClaude ? 'var(--accent-bg)'    : 'var(--bg3)',
            color:      hasClaude ? 'var(--accent)'       : 'var(--text3)',
            border:     `1px solid ${hasClaude ? 'var(--accent-border)' : 'var(--border)'}`,
          }}>
            {hasClaude ? '● Claude' : '○ Claude'}
          </span>
        </div>
      </div>
    </nav>
  )
}
