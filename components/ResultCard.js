'use client'

const sentimentColors = {
  bull: { bg: 'var(--green-bg)', border: 'var(--green-border)', text: 'var(--green)' },
  bear: { bg: 'var(--red-bg)',   border: 'var(--red-border)',   text: 'var(--red)'   },
  neut: { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
}

function SigBadge({ dir }) {
  const labels = { bull: 'Alcista', bear: 'Bajista', neut: 'Neutral' }
  const c = sentimentColors[dir] || sentimentColors.neut
  return (
    <span className="text-[11px] px-2.5 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {labels[dir] || 'Neutral'}
    </span>
  )
}

function IndicatorRow({ ind }) {
  return (
    <div>
      <div className="flex items-center justify-between py-2.5 gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm" style={{ color: 'var(--text2)', flex: 1 }}>{ind.name}</span>
        <span className="text-xs" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{ind.displayVal}</span>
        <SigBadge dir={ind.dir} />
      </div>
      {ind.note && (
        <p className="text-xs py-1.5 pb-2.5" style={{ color: 'var(--text3)' }}>{ind.note}</p>
      )}
    </div>
  )
}

function ScoreRing({ score, sentiment }) {
  const radius = 36
  const circ   = 2 * Math.PI * radius
  const offset = circ * (1 - score / 100)
  const color  = sentiment === 'bull' ? 'var(--green)' : sentiment === 'bear' ? 'var(--red)' : 'var(--amber)'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--bg4)" strokeWidth="5" />
      <circle cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="44" y="48" textAnchor="middle" fontSize="16" fontWeight="600"
        fill={color} fontFamily="DM Mono, monospace">{score}%</text>
    </svg>
  )
}

function consensusColor(c) {
  if (!c) return 'var(--text3)'
  if (c.includes('Compra')) return 'var(--green)'
  if (c.includes('Venta'))  return 'var(--red)'
  return 'var(--amber)'
}

const TABS = [
  { id: 'resultado',  label: 'Veredicto'    },
  { id: 'tecnico',    label: 'Técnico'      },
  { id: 'fundamental',label: 'Fundamental'  },
  { id: 'narrativa',  label: 'IA Narrativa' },
  { id: 'resumen',    label: 'Resumen'      },
  { id: 'noticias',   label: 'Noticias'     },
]

export default function ResultCard({
  ticker, companyName, marketData, analysis,
  narrative, activeTab, setActiveTab, hasClaude,
}) {
  const { score, sentiment, trend, signal, bull, bear, neutral, total, confidence, indicators } = analysis
  const colors    = sentimentColors[sentiment] || sentimentColors.neut
  const techInds  = indicators.filter(i => i.isTech)
  const fundInds  = indicators.filter(i => !i.isTech)
  const signalPill = colors

  return (
    <div>
      {/* ── Header: ticker + precio ─────────────────────── */}
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>{ticker}</h2>
            {companyName && companyName !== ticker && (
              <span className="text-sm" style={{ color: 'var(--text3)' }}>{companyName}</span>
            )}
          </div>
          {marketData?.sector && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{marketData.sector}</p>
          )}
        </div>
        {marketData?.price && (
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ fontFamily: 'DM Mono' }}>${marketData.price}</div>
            {marketData.priceChangeToday != null && (
              <div className="text-sm" style={{ color: marketData.priceChangeToday >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {marketData.priceChangeToday >= 0 ? '+' : ''}{marketData.priceChangeToday}% hoy
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: activeTab === t.id ? 'var(--bg3)'    : 'transparent',
              color:      activeTab === t.id ? 'var(--text)'   : 'var(--text2)',
              border:     `1px solid ${activeTab === t.id ? 'var(--border2)' : 'transparent'}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB: VEREDICTO
      ══════════════════════════════════════════════════ */}
      {activeTab === 'resultado' && (
        <div>
          <div className="rounded-xl p-5 mb-4"
            style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-5">
              <ScoreRing score={score} sentiment={sentiment} />
              <div className="flex-1">
                <div className="text-xl font-bold mb-1" style={{ color: colors.text, fontFamily: 'Syne' }}>{trend}</div>
                <div className="text-xs mb-3" style={{ color: 'var(--text2)' }}>
                  {bull} alcistas · {bear} bajistas · {neutral} neutrales sobre {total} señales
                </div>
                <span className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: signalPill.bg, color: signalPill.text, border: `1px solid ${signalPill.border}` }}>
                  {signal}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Score alcista', val: `${score}%`,  sub: `${total} indicadores`,              color: colors.text        },
              { label: 'Señales bull',  val: bull,          sub: `${Math.round(bull/total*100)}%`,    color: 'var(--green)'     },
              { label: 'Señales bear',  val: bear,          sub: `${Math.round(bear/total*100)}%`,    color: 'var(--red)'       },
              { label: 'Confianza',     val: confidence,    sub: `${total} métricas`,                 color: 'var(--text)'      },
            ].map((m, i) => (
              <div key={i} className="rounded-xl p-3"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] mb-1.5" style={{ color: 'var(--text3)' }}>{m.label}</div>
                <div className="text-xl font-bold" style={{ color: m.color, fontFamily: 'DM Mono' }}>{m.val}</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-medium mb-3"
              style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Distribución de señales
            </p>
            {[
              { label: `Alcistas (${bull})`,  pct: Math.round(bull/total*100),    color: 'var(--green)' },
              { label: `Bajistas (${bear})`,  pct: Math.round(bear/total*100),    color: 'var(--red)'   },
              { label: `Neutras (${neutral})`,pct: Math.round(neutral/total*100), color: 'var(--amber)' },
            ].map((b, i) => (
              <div key={i} className="mb-3">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text3)' }}>
                  <span>{b.label}</span><span>{b.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: TÉCNICO
      ══════════════════════════════════════════════════ */}
      {activeTab === 'tecnico' && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-3"
            style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Indicadores técnicos
          </p>
          {techInds.length
            ? techInds.map((ind, i) => <IndicatorRow key={i} ind={ind} />)
            : <p className="text-sm" style={{ color: 'var(--text3)' }}>Sin datos técnicos disponibles.</p>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: FUNDAMENTAL
      ══════════════════════════════════════════════════ */}
      {activeTab === 'fundamental' && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-3"
            style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Indicadores fundamentales
          </p>
          {fundInds.length
            ? fundInds.map((ind, i) => <IndicatorRow key={i} ind={ind} />)
            : (
              <div>
                <p className="text-sm mb-2" style={{ color: 'var(--text3)' }}>
                  Los datos fundamentales (P/E, EPS, márgenes) no están disponibles en el plan gratuito de Polygon.
                  Podés ingresarlos manualmente en el formulario de abajo.
                </p>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  Fuentes: Yahoo Finance, Macrotrends, o la sección de fundamentales de tu broker.
                </p>
              </div>
            )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: IA NARRATIVA
      ══════════════════════════════════════════════════ */}
      {activeTab === 'narrativa' && (
        <div className="space-y-3">
          {!hasClaude && (
            <div className="rounded-xl p-4"
              style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--amber)' }}>Claude API key no configurada</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>
                Configurala en ⚙ API Keys para ver el análisis narrativo.
              </p>
            </div>
          )}
          {narrative?._error && (
            <div className="rounded-xl p-4"
              style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--red)' }}>Error generando narrativa</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>{narrative._error}</p>
            </div>
          )}
          {narrative && !narrative._error && (
            <>
              {narrative.analysts_consensus && (
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>Consenso estimado (IA)</span>
                  <span className="text-sm font-semibold"
                    style={{ color: consensusColor(narrative.analysts_consensus) }}>
                    {narrative.analysts_consensus}
                  </span>
                </div>
              )}
              {[
                { title: 'Lectura técnica',        body: narrative.technical_summary   },
                { title: 'Situación fundamental',  body: narrative.fundamental_summary },
                { title: 'Sentimiento de mercado', body: narrative.market_sentiment    },
                { title: 'Para el inversor',       body: narrative.analyst_summary     },
              ].filter(s => s.body).map((s, i) => (
                <div key={i} className="rounded-xl p-4"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-medium mb-2"
                    style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{s.body}</p>
                </div>
              ))}
              {(narrative.key_opportunity || narrative.key_risk) && (
                <div className="grid grid-cols-2 gap-3">
                  {narrative.key_opportunity && (
                    <div className="rounded-xl p-4"
                      style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
                      <p className="text-[10px] font-medium mb-2"
                        style={{ color: 'var(--green)', textTransform: 'uppercase' }}>Oportunidad</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{narrative.key_opportunity}</p>
                    </div>
                  )}
                  {narrative.key_risk && (
                    <div className="rounded-xl p-4"
                      style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                      <p className="text-[10px] font-medium mb-2"
                        style={{ color: 'var(--red)', textTransform: 'uppercase' }}>Riesgo</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{narrative.key_risk}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: RESUMEN (métricas clave en un vistazo)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'resumen' && (
        <div className="space-y-3">
          {/* Métricas clave */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-medium mb-3"
              style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Métricas clave
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'RSI (14)',   val: marketData?.rsi      ? Number(marketData.rsi).toFixed(1)                                          : 'N/D' },
                { label: 'MA50',       val: marketData?.ma50      ? '$' + marketData.ma50                                                      : 'N/D' },
                { label: 'MA200',      val: marketData?.ma200     ? '$' + marketData.ma200                                                     : 'N/D' },
                { label: 'Máx 52W',   val: marketData?.high52    ? '$' + marketData.high52                                                    : 'N/D' },
                { label: 'Mín 52W',   val: marketData?.low52     ? '$' + marketData.low52                                                     : 'N/D' },
                { label: 'Cambio 1M', val: marketData?.change1m != null ? (marketData.change1m > 0 ? '+' : '') + marketData.change1m + '%'   : 'N/D' },
                { label: 'P/E',        val: marketData?.pe         ? marketData.pe                                                             : 'N/D' },
                { label: 'ROE',        val: marketData?.roe        ? marketData.roe + '%'                                                      : 'N/D' },
                { label: 'Vol. rel.',  val: marketData?.relVol     ? marketData.relVol + 'x'                                                   : 'N/D' },
              ].map((m, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text3)' }}>{m.label}</div>
                  <div className="text-sm font-medium" style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Consenso si hay narrativa */}
          {narrative && !narrative._error && narrative.analysts_consensus && (
            <div className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>Consenso estimado (IA)</span>
              <span className="text-sm font-semibold"
                style={{ color: consensusColor(narrative.analysts_consensus) }}>
                {narrative.analysts_consensus}
              </span>
            </div>
          )}

          {/* Oportunidad / Riesgo */}
          {narrative && !narrative._error && (narrative.key_opportunity || narrative.key_risk) && (
            <div className="grid grid-cols-2 gap-3">
              {narrative.key_opportunity && (
                <div className="rounded-xl p-4"
                  style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
                  <p className="text-[10px] font-medium mb-2"
                    style={{ color: 'var(--green)', textTransform: 'uppercase' }}>Oportunidad</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{narrative.key_opportunity}</p>
                </div>
              )}
              {narrative.key_risk && (
                <div className="rounded-xl p-4"
                  style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
                  <p className="text-[10px] font-medium mb-2"
                    style={{ color: 'var(--red)', textTransform: 'uppercase' }}>Riesgo</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{narrative.key_risk}</p>
                </div>
              )}
            </div>
          )}

          {!hasClaude && (
            <div className="rounded-xl p-4"
              style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)' }}>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>
                Configurá tu Claude API key para ver consenso, oportunidad y riesgo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: NOTICIAS
      ══════════════════════════════════════════════════ */}
      {activeTab === 'noticias' && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-3"
            style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Noticias recientes
          </p>
          {marketData?.news?.length > 0
            ? marketData.news.map((n, i) => (
                <div key={i} className="py-3"
                  style={{ borderBottom: i < marketData.news.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm hover:underline" style={{ color: 'var(--text2)' }}>
                    {n.title}
                  </a>
                  <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                    {n.publisher} · {n.published?.split('T')[0]}
                  </p>
                </div>
              ))
            : <p className="text-sm" style={{ color: 'var(--text3)' }}>No hay noticias disponibles para este ticker.</p>
          }
        </div>
      )}

      <p className="text-[11px] mt-4" style={{ color: 'var(--text3)' }}>
        ⚠️ Análisis informativo. No constituye asesoramiento financiero. Datos con delay de ~15 min.
      </p>
    </div>
  )
}
