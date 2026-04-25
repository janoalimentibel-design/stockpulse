'use client'
import { useState } from 'react'
import { useKeys } from '../lib/useKeys'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TECH_TAG = { bg: 'rgba(108,127,255,0.12)', border: 'rgba(108,127,255,0.28)', text: '#6c7fff' }
const FUND_TAG = { bg: 'rgba(212,149,74,0.12)',  border: 'rgba(212,149,74,0.28)',  text: '#d4954a' }
const S_BULL   = { bg: 'rgba(78,187,121,0.10)',  border: 'rgba(78,187,121,0.28)',  text: '#4ebb79' }
const S_BEAR   = { bg: 'rgba(224,80,80,0.10)',   border: 'rgba(224,80,80,0.28)',   text: '#e05050' }

function GuideItem({ name, tag, tagColor, desc, signals }) {
  return (
    <div className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{name}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
          style={{ background: tagColor.bg, color: tagColor.text, border: `1px solid ${tagColor.border}` }}>
          {tag}
        </span>
      </div>
      <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text2)' }}>{desc}</p>
      <div className="flex gap-1.5 flex-wrap">
        {signals.map((s, i) => (
          <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full"
            style={{ background: s.bull ? S_BULL.bg : S_BEAR.bg, color: s.bull ? S_BULL.text : S_BEAR.text, border: `1px solid ${s.bull ? S_BULL.border : S_BEAR.border}` }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function GuiaModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl pb-8"
        style={{ background: 'var(--bg)', border: '1px solid var(--border2)' }}>

        <div className="sticky top-0 flex items-center justify-between px-6 py-4 rounded-t-2xl z-10"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'Syne' }}>Guía de indicadores</h2>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Cómo leer cada señal y qué combinaciones importan.</p>
          </div>
          <button onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            ✕ Cerrar
          </button>
        </div>

        <div className="px-6 pt-4 space-y-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indicadores técnicos</p>
            <GuideItem name="Precio vs MA50 y MA200" tag="Técnico" tagColor={TECH_TAG}
              desc="Las medias móviles suavizan el precio. La MA50 refleja tendencia de corto-medio plazo; la MA200 la de largo plazo."
              signals={[{ bull: true, label: 'Alcista: precio > MA50 y MA200' }, { bull: false, label: 'Bajista: precio < MA50 y MA200' }]} />
            <GuideItem name="Golden Cross / Death Cross" tag="Técnico" tagColor={TECH_TAG}
              desc="MA50 cruza por encima de MA200 = Golden Cross (alcista). Lo contrario = Death Cross (bajista de largo plazo)."
              signals={[{ bull: true, label: 'Golden Cross: MA50 > MA200' }, { bull: false, label: 'Death Cross: MA50 < MA200' }]} />
            <GuideItem name="RSI — Relative Strength Index" tag="Técnico" tagColor={TECH_TAG}
              desc="Mide momentum en escala 0-100. Valores extremos sugieren que el mercado exageró en una dirección."
              signals={[{ bull: true, label: 'Sobrevendido: RSI < 30 → posible rebote' }, { bull: false, label: 'Sobrecomprado: RSI > 70 → posible corrección' }]} />
            <GuideItem name="MACD" tag="Técnico" tagColor={TECH_TAG}
              desc="Compara medias móviles exponenciales para detectar cambios de momentum. MACD sobre señal = impulso alcista."
              signals={[{ bull: true, label: 'Alcista: MACD > Señal' }, { bull: false, label: 'Bajista: MACD < Señal' }]} />
            <GuideItem name="Volumen relativo" tag="Técnico" tagColor={TECH_TAG}
              desc="Volumen actual vs promedio histórico. Alto volumen confirma el movimiento; bajo volumen puede ser ruido."
              signals={[{ bull: true, label: 'Confirmación: volumen > 1.2x' }, { bull: false, label: 'Debilidad: volumen < 0.8x' }]} />
            <div style={{ borderBottom: 'none' }}>
              <GuideItem name="Posición en rango 52 semanas" tag="Técnico" tagColor={TECH_TAG}
                desc="Dónde está el precio dentro del rango del último año. Zona alta = fortaleza, zona baja = debilidad o posible oportunidad."
                signals={[{ bull: true, label: 'Fortaleza: precio en 60–100% del rango' }, { bull: false, label: 'Debilidad: precio en 0–40% del rango' }]} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indicadores fundamentales</p>
            <GuideItem name="P/E ratio vs sector" tag="Fundamental" tagColor={FUND_TAG}
              desc="Precio de la acción relativo a ganancias, comparado con el sector. Solo tiene sentido en contexto."
              signals={[{ bull: true, label: 'Subvaluada: P/E < 85% del sector' }, { bull: false, label: 'Sobrevaluada: P/E > 120% del sector' }]} />
            <GuideItem name="Crecimiento EPS" tag="Fundamental" tagColor={FUND_TAG}
              desc="Ganancias por acción creciendo año a año = empresa generando más valor real."
              signals={[{ bull: true, label: 'Fuerte: EPS > +10% anual' }, { bull: false, label: 'Alerta: EPS negativo o en caída' }]} />
            <GuideItem name="Margen neto" tag="Fundamental" tagColor={FUND_TAG}
              desc="Porcentaje de cada venta que queda como ganancia final. Margen alto = poder de precios y eficiencia."
              signals={[{ bull: true, label: 'Saludable: margen > 12%' }, { bull: false, label: 'Vulnerable: margen < 5%' }]} />
            <GuideItem name="Deuda/Patrimonio (D/E)" tag="Fundamental" tagColor={FUND_TAG}
              desc="Deuda por cada peso de capital propio. Bajo = solidez financiera y resistencia a subidas de tasas."
              signals={[{ bull: true, label: 'Sólido: D/E < 0.5' }, { bull: false, label: 'Riesgo: D/E > 1.5' }]} />
            <GuideItem name="ROE — Return on Equity" tag="Fundamental" tagColor={FUND_TAG}
              desc="Ganancia por cada peso de capital propio. Favorito de Buffett. Alto y sostenido = ventaja competitiva."
              signals={[{ bull: true, label: 'Excelente: ROE > 15%' }, { bull: false, label: 'Bajo: ROE < 8%' }]} />
            <div style={{ borderBottom: 'none' }}>
              <GuideItem name="Dividend yield" tag="Fundamental" tagColor={FUND_TAG}
                desc="% del precio pagado como dividendo anual. Verificar siempre que sea sostenible con el payout ratio."
                signals={[{ bull: true, label: 'Atractivo: yield > 3% sostenible' }, { bull: false, label: 'Alerta: yield > 8% puede ser insostenible' }]} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-medium mb-3" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Combinaciones clave</p>
            {[
              { color: 'var(--green)', label: 'Señales alcistas', items: [
                { bold: 'Golden Cross + RSI 50–65:', rest: ' tendencia alcista consolidada sin sobrecompra. Escenario ideal de entrada.' },
                { bold: 'MACD cruza señal + volumen > 1.2x:', rest: ' impulso alcista con convicción del mercado.' },
                { bold: 'P/E < sector + ROE > 15% + D/E < 0.5:', rest: ' empresa subvaluada, rentable y financieramente sólida.' },
              ]},
              { color: 'var(--red)', label: 'Señales bajistas', items: [
                { bold: 'Death Cross + Precio < MA50/200 + volumen alto:', rest: ' tendencia bajista confirmada. Señal de salida o espera.' },
                { bold: 'RSI > 70 + precio en máximo 52W:', rest: ' sobrecompra con posible agotamiento. Momento de cautela.' },
                { bold: 'EPS negativo + D/E > 1.5 + márgenes cayendo:', rest: ' deterioro fundamental real.' },
              ]},
              { color: 'var(--amber)', label: 'Señales contradictorias — qué hacer', items: [
                { bold: 'Técnico alcista + fundamentales débiles:', rest: ' posible rebote especulativo. Esperar confirmación.' },
                { bold: 'Fundamentales sólidos + técnico bajista:', rest: ' empresa buena bajo presión. Oportunidad de acumulación gradual.' },
              ]},
            ].map((group, gi) => (
              <div key={gi} className="rounded-lg p-3 mb-2 last:mb-0" style={{ background: 'var(--bg3)' }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.label}</p>
                {group.items.map((item, i) => (
                  <div key={i} className="flex gap-2 py-1.5" style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: group.color }} />
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                      <strong style={{ color: 'var(--text)' }}>{item.bold}</strong>{item.rest}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Navbar() {
  const { hasPolygon, hasClaude } = useKeys()
  const path = usePathname()
  const [guiaOpen, setGuiaOpen] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,10,12,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <div className="max-w-[900px] mx-auto px-5 h-14 flex items-center justify-between gap-6">

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}>S</div>
            <span className="font-bold text-sm tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>StockPulse</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link href="/"
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all"
              style={{
                background: path === '/' ? 'var(--bg3)' : 'transparent',
                color: path === '/' ? 'var(--text)' : 'var(--text2)',
                border: `1px solid ${path === '/' ? 'var(--border2)' : 'transparent'}`,
              }}>
              Analizador
            </Link>

            <button onClick={() => setGuiaOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all"
              style={{
                background: 'transparent',
                color: 'var(--text2)',
                border: '1px solid transparent',
              }}>
              Guía
            </button>

            <Link href="/config"
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all"
              style={{
                background: path === '/config' ? 'var(--bg3)' : 'transparent',
                color: path === '/config' ? 'var(--text)' : 'var(--text2)',
                border: `1px solid ${path === '/config' ? 'var(--border2)' : 'transparent'}`,
              }}>
              ⚙ API Keys
            </Link>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
              background: hasPolygon ? 'var(--green-bg)' : 'var(--bg3)',
              color: hasPolygon ? 'var(--green)' : 'var(--text3)',
              border: `1px solid ${hasPolygon ? 'var(--green-border)' : 'var(--border)'}`,
            }}>
              {hasPolygon ? '● Polygon' : '○ Polygon'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
              background: hasClaude ? 'var(--accent-bg)' : 'var(--bg3)',
              color: hasClaude ? 'var(--accent)' : 'var(--text3)',
              border: `1px solid ${hasClaude ? 'var(--accent-border)' : 'var(--border)'}`,
            }}>
              {hasClaude ? '● Claude' : '○ Claude'}
            </span>
          </div>
        </div>
      </nav>

      {guiaOpen && <GuiaModal onClose={() => setGuiaOpen(false)} />}
    </>
  )
}
