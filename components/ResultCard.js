'use client'
import PriceChart from './PriceChart'

const sentimentColors = {
  bull: { bg: 'var(--green-bg)', border: 'var(--green-border)', text: 'var(--green)' },
  bear: { bg: 'var(--red-bg)',   border: 'var(--red-border)',   text: 'var(--red)'   },
  neut: { bg: 'var(--amber-bg)', border: 'var(--amber-border)', text: 'var(--amber)' },
}

function SigBadge({ dir }) {
  const labels = { bull: 'Alcista', bear: 'Bajista', neut: 'Neutral' }
  const c = sentimentColors[dir] || sentimentColors.neut
  return (
    <span style={{
      fontSize: 10, padding: '2px 10px', borderRadius: 999,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {labels[dir] || 'Neutral'}
    </span>
  )
}

function ScoreRing({ score, sentiment }) {
  const radius = 28
  const circ   = 2 * Math.PI * radius
  const offset = circ * (1 - score / 100)
  const color  = sentiment === 'bull' ? 'var(--green)' : sentiment === 'bear' ? 'var(--red)' : 'var(--amber)'
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--bg4)" strokeWidth="4" />
      <circle cx="34" cy="34" r={radius} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="600"
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

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--text3)',
      marginBottom: 8, marginTop: 16,
    }}>
      {children}
    </div>
  )
}

function IndicatorRow({ ind }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--border)', gap: 8,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{ind.name}</span>
      <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
        {ind.displayVal}
      </span>
      <SigBadge dir={ind.dir} />
    </div>
  )
}

const MOBILE_TABS = [
  { id: 'veredicto', label: 'Veredicto' },
  { id: 'tecnico',   label: 'Técnico'   },
  { id: 'narrativa', label: 'IA'        },
  { id: 'noticias',  label: 'Noticias'  },
]

export default function ResultCard({
  ticker, companyName, marketData, analysis,
  narrative, activeTab, setActiveTab, hasClaude,
}) {
  const { score, sentiment, trend, signal, bull, bear, neutral, total, confidence, indicators } = analysis
  const colors   = sentimentColors[sentiment] || sentimentColors.neut
  const techInds = indicators.filter(i => i.isTech)
  const fundInds = indicators.filter(i => !i.isTech)

  const NarrativaContent = () => (
    narrative && !narrative._error ? (
      <div>
        <div style={{
          background: 'rgba(108,127,255,0.07)', border: '1px solid rgba(108,127,255,0.22)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 12,
        }}>
          {narrative.analysts_consensus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Consenso analistas</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: consensusColor(narrative.analysts_consensus) }}>
                {narrative.analysts_consensus}
              </span>
            </div>
          )}
          {narrative.technical_summary && (
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 8 }}>
              <span style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Técnico · </span>
              {narrative.technical_summary}
            </p>
          )}
          {narrative.fundamental_summary && (
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 8 }}>
              <span style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fundamental · </span>
              {narrative.fundamental_summary}
            </p>
          )}
          {narrative.analyst_summary && (
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
              <span style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Para el inversor · </span>
              {narrative.analyst_summary}
            </p>
          )}
        </div>
        {(narrative.key_opportunity || narrative.key_risk) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {narrative.key_opportunity && (
              <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Oportunidad</div>
                <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{narrative.key_opportunity}</p>
              </div>
            )}
            {narrative.key_risk && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Riesgo</div>
                <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{narrative.key_risk}</p>
              </div>
            )}
          </div>
        )}
      </div>
    ) : narrative?._error ? (
      <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--red)' }}>Error: {narrative._error}</p>
      </div>
    ) : (
      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
        Generando análisis con IA...
      </div>
    )
  )

  return (
    <div>
      {/* Header full width */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Syne', margin: 0 }}>{ticker}</h2>
            {companyName && companyName !== ticker && (
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>{companyName}</span>
            )}
          </div>
          {marketData?.sector && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {marketData.sector}
            </p>
          )}
        </div>
        {marketData?.price && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'DM Mono' }}>${marketData.price}</div>
            {marketData.priceChangeToday != null && (
              <div style={{ fontSize: 13, color: marketData.priceChangeToday >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {marketData.priceChangeToday >= 0 ? '+' : ''}{marketData.priceChangeToday}% hoy
              </div>
            )}
          </div>
        )}
      </div>

      {/* DESKTOP: 2 columnas */}
      <div className="result-desktop-grid">
        {/* Columna izquierda: gráfico + veredicto + métricas */}
        <div className="result-col-left">
          <PriceChart ticker={ticker} />

          <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ScoreRing score={score} sentiment={sentiment} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, fontFamily: 'Syne', marginBottom: 3 }}>{trend}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>
                  {bull} alcistas · {bear} bajistas · {neutral} neutrales
                </div>
                <span style={{ fontSize: 11, padding: '3px 12px', borderRadius: 999, fontWeight: 500, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                  {signal}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Score alcista', val: `${score}%`, color: colors.text },
              { label: 'Señales bull',  val: bull,        color: 'var(--green)' },
              { label: 'Señales bear',  val: bear,        color: 'var(--red)'   },
              { label: 'Confianza',     val: confidence,  color: 'var(--text)'  },
            ].map((m, i) => (
              <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: 'DM Mono' }}>{m.val}</div>
              </div>
            ))}
          </div>

          {marketData && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8 }}>Métricas clave</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  { label: 'RSI',       val: marketData.rsi     ? Number(marketData.rsi).toFixed(0) : 'N/D' },
                  { label: 'MA50',      val: marketData.ma50    ? '$' + marketData.ma50              : 'N/D' },
                  { label: 'MA200',     val: marketData.ma200   ? '$' + marketData.ma200             : 'N/D' },
                  { label: 'Máx 52W',  val: marketData.high52  ? '$' + marketData.high52            : 'N/D' },
                  { label: 'Mín 52W',  val: marketData.low52   ? '$' + marketData.low52             : 'N/D' },
                  { label: 'Cambio 1M', val: marketData.change1m != null ? (marketData.change1m > 0 ? '+' : '') + marketData.change1m + '%' : 'N/D' },
                ].map((m, i) => (
                  <div key={i} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '7px 8px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Mono' }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: narrativa IA + indicadores + noticias */}
        <div className="result-col-right">
          <SectionLabel>★ Narrativa IA</SectionLabel>
          <NarrativaContent />

          {techInds.length > 0 && (
            <div>
              <SectionLabel>Indicadores técnicos</SectionLabel>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
                {techInds.map((ind, i) => <IndicatorRow key={i} ind={ind} />)}
              </div>
            </div>
          )}

          {fundInds.length > 0 && (
            <div>
              <SectionLabel>Fundamentales</SectionLabel>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
                {fundInds.map((ind, i) => <IndicatorRow key={i} ind={ind} />)}
              </div>
            </div>
          )}

          {marketData?.news?.length > 0 && (
            <div>
              <SectionLabel>Noticias recientes</SectionLabel>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
                {marketData.news.map((n, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < marketData.news.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: 'block' }}>
                      {n.title}
                    </a>
                    <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                      {n.publisher} · {n.published?.split('T')[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE: 1 columna con tabs */}
      <div className="result-mobile">
        <PriceChart ticker={ticker} />

        <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScoreRing score={score} sentiment={sentiment} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, fontFamily: 'Syne' }}>{trend}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', margin: '3px 0 6px' }}>{bull} alc · {bear} baj · {neutral} neut</div>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>{signal}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {MOBILE_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: activeTab === t.id ? 'var(--bg3)' : 'transparent',
                color:      activeTab === t.id ? 'var(--text)' : 'var(--text2)',
                border:     `1px solid ${activeTab === t.id ? 'var(--border2)' : 'transparent'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'veredicto' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Score', val: `${score}%`, color: colors.text },
                { label: 'Bull',  val: bull,        color: 'var(--green)' },
                { label: 'Bear',  val: bear,        color: 'var(--red)'   },
                { label: 'Conf.', val: confidence,  color: 'var(--text)'  },
              ].map((m, i) => (
                <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: 'DM Mono' }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
              {techInds.map((ind, i) => <IndicatorRow key={i} ind={ind} />)}
            </div>
          </div>
        )}
        {activeTab === 'tecnico' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
            {[...techInds, ...fundInds].map((ind, i) => <IndicatorRow key={i} ind={ind} />)}
          </div>
        )}
        {activeTab === 'narrativa' && <NarrativaContent />}
        {activeTab === 'noticias' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px 8px' }}>
            {marketData?.news?.length > 0
              ? marketData.news.map((n, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < marketData.news.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: 'block' }}>{n.title}</a>
                    <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{n.publisher} · {n.published?.split('T')[0]}</p>
                  </div>
                ))
              : <p style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Sin noticias.</p>
            }
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 16 }}>
        ⚠️ Análisis informativo. No constituye asesoramiento financiero. Datos con delay de ~15 min.
      </p>
    </div>
  )
}
