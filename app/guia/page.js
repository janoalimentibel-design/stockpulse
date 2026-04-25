'use client'
import Navbar from '../../components/Navbar'

const sentimentColors = {
  bull: { bg: 'rgba(78,187,121,0.10)', border: 'rgba(78,187,121,0.28)', text: '#4ebb79' },
  bear: { bg: 'rgba(224,80,80,0.10)',  border: 'rgba(224,80,80,0.28)',  text: '#e05050' },
}

function GuideItem({ name, tag, tagColor, desc, signals }) {
  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{name}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tagColor.bg, color: tagColor.text, border: `1px solid ${tagColor.border}` }}>
          {tag}
        </span>
      </div>
      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>{desc}</p>
      <div className="flex gap-2 flex-wrap">
        {signals.map((s, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full"
            style={{ background: s.bull ? sentimentColors.bull.bg : sentimentColors.bear.bg, color: s.bull ? sentimentColors.bull.text : sentimentColors.bear.text, border: `1px solid ${s.bull ? sentimentColors.bull.border : sentimentColors.bear.border}` }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const TECH_TAG  = { bg: 'rgba(108,127,255,0.12)', border: 'rgba(108,127,255,0.28)', text: '#6c7fff' }
const FUND_TAG  = { bg: 'rgba(212,149,74,0.12)',  border: 'rgba(212,149,74,0.28)',  text: '#d4954a' }

export default function GuiaPage() {
  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[900px] mx-auto px-5 pb-20 pt-6">

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Guía de indicadores</h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Cómo leer cada señal y qué combinaciones importan.</p>
        </div>

        {/* Técnicos */}
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indicadores técnicos</p>

          <GuideItem name="Precio vs MA50 y MA200" tag="Técnico" tagColor={TECH_TAG}
            desc="Las medias móviles suavizan el precio a lo largo del tiempo. La MA50 refleja la tendencia de corto-medio plazo; la MA200 la de largo plazo. La posición del precio respecto a ellas es una de las señales más usadas en el mundo."
            signals={[{ bull: true, label: 'Alcista: precio > MA50 y MA200' }, { bull: false, label: 'Bajista: precio < MA50 y MA200' }]} />

          <GuideItem name="Golden Cross / Death Cross" tag="Técnico" tagColor={TECH_TAG}
            desc="Cuando la MA50 cruza por encima de la MA200 se llama Golden Cross — señal clásica de cambio de tendencia a alcista. Lo contrario es el Death Cross — señal bajista de largo plazo."
            signals={[{ bull: true, label: 'Golden Cross: MA50 > MA200' }, { bull: false, label: 'Death Cross: MA50 < MA200' }]} />

          <GuideItem name="RSI — Relative Strength Index" tag="Técnico" tagColor={TECH_TAG}
            desc="Mide la velocidad y magnitud de los movimientos de precio en una escala de 0 a 100. Valores extremos sugieren que el mercado exageró en una dirección y puede corregir."
            signals={[{ bull: true, label: 'Sobrevendido: RSI < 30 → posible rebote' }, { bull: false, label: 'Sobrecomprado: RSI > 70 → posible corrección' }]} />

          <GuideItem name="MACD — Moving Average Convergence Divergence" tag="Técnico" tagColor={TECH_TAG}
            desc="Compara dos medias móviles exponenciales para detectar cambios de momentum. La línea MACD vs la Señal genera cruces que indican posibles entradas y salidas."
            signals={[{ bull: true, label: 'Alcista: MACD > Señal MACD' }, { bull: false, label: 'Bajista: MACD < Señal MACD' }]} />

          <GuideItem name="Volumen relativo" tag="Técnico" tagColor={TECH_TAG}
            desc="Compara el volumen actual contra el promedio histórico. Un movimiento de precio acompañado de alto volumen tiene más convicción; sin volumen, puede ser ruido."
            signals={[{ bull: true, label: 'Confirmación: volumen > 1.2x promedio' }, { bull: false, label: 'Debilidad: volumen < 0.8x promedio' }]} />

          <div style={{ borderBottom: 'none' }}>
            <GuideItem name="Posición en rango 52 semanas" tag="Técnico" tagColor={TECH_TAG}
              desc="Indica dónde está el precio dentro del rango del último año. Un precio en la zona alta sugiere fortaleza; en la zona baja puede indicar debilidad o posible oportunidad."
              signals={[{ bull: true, label: 'Fortaleza: precio en 60–100% del rango' }, { bull: false, label: 'Debilidad: precio en 0–40% del rango' }]} />
          </div>
        </div>

        {/* Fundamentales */}
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indicadores fundamentales</p>

          <GuideItem name="P/E ratio vs sector" tag="Fundamental" tagColor={FUND_TAG}
            desc="El Price-to-Earnings compara el precio de la acción con las ganancias por acción. Solo cobra sentido comparado contra el sector: una empresa puede tener P/E alto pero si el sector lo es más, está relativamente barata."
            signals={[{ bull: true, label: 'Subvaluada: P/E empresa < 85% del sector' }, { bull: false, label: 'Sobrevaluada: P/E empresa > 120% del sector' }]} />

          <GuideItem name="Crecimiento EPS" tag="Fundamental" tagColor={FUND_TAG}
            desc="El Earnings Per Share creciendo año a año indica que la empresa genera más valor. Es uno de los mejores indicadores de la salud real del negocio."
            signals={[{ bull: true, label: 'Fuerte: EPS > +10% anual' }, { bull: false, label: 'Alerta: EPS negativo o en caída' }]} />

          <GuideItem name="Margen neto" tag="Fundamental" tagColor={FUND_TAG}
            desc="Porcentaje de cada peso de venta que queda como ganancia final. Un margen alto implica poder de fijación de precios y eficiencia operativa."
            signals={[{ bull: true, label: 'Saludable: margen > 12%' }, { bull: false, label: 'Vulnerable: margen < 5%' }]} />

          <GuideItem name="Deuda/Patrimonio (D/E)" tag="Fundamental" tagColor={FUND_TAG}
            desc="Mide cuánta deuda tiene la empresa por cada peso de capital propio. Un ratio bajo indica solidez financiera y resistencia a subidas de tasas."
            signals={[{ bull: true, label: 'Sólido: D/E < 0.5' }, { bull: false, label: 'Riesgo financiero: D/E > 1.5' }]} />

          <GuideItem name="ROE — Return on Equity" tag="Fundamental" tagColor={FUND_TAG}
            desc="Mide cuánta ganancia genera la empresa por cada peso de capital propio. Un ROE alto y sostenido es señal de ventaja competitiva. Warren Buffett lo considera uno de los indicadores más importantes."
            signals={[{ bull: true, label: 'Excelente: ROE > 15%' }, { bull: false, label: 'Bajo: ROE < 8%' }]} />

          <div style={{ borderBottom: 'none' }}>
            <GuideItem name="Dividend yield" tag="Fundamental" tagColor={FUND_TAG}
              desc="Porcentaje del precio pagado anualmente como dividendo. Un yield alto puede indicar valor o puede ser señal de que el precio bajó mucho. Siempre verificar que el dividendo sea sostenible."
              signals={[{ bull: true, label: 'Atractivo: yield > 3% con payout sostenible' }, { bull: false, label: 'Alerta: yield muy alto (>8%) puede ser insostenible' }]} />
          </div>
        </div>

        {/* Combinaciones */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-medium mb-4" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Combinaciones clave</p>

          <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--bg3)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Señales alcistas fuertes</p>
            {[
              { bold: 'Golden Cross + Precio > MA200 + RSI entre 50–65:', rest: ' tendencia alcista consolidada sin sobrecompra. El escenario ideal de entrada.' },
              { bold: 'MACD cruza por encima de señal + volumen > 1.2x:', rest: ' nuevo impulso alcista con convicción del mercado.' },
              { bold: 'RSI < 30 + precio cerca de mínimo 52W + EPS creciendo:', rest: ' sobrecastigo temporal en empresa sólida. Posible oportunidad de valor.' },
              { bold: 'P/E < sector + ROE > 15% + D/E < 0.5:', rest: ' empresa subvaluada, rentable y sin deuda excesiva.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-2.5 py-2" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--green)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--text)' }}>{item.bold}</strong>{item.rest}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--bg3)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Señales bajistas / alerta</p>
            {[
              { bold: 'Death Cross + Precio < MA50 y MA200 + volumen alto:', rest: ' tendencia bajista confirmada con convicción. Señal de salida o espera.' },
              { bold: 'RSI > 70 + precio en máximo 52W + MACD divergiendo:', rest: ' sobrecompra con posible agotamiento. Momento de cautela.' },
              { bold: 'EPS negativo + D/E > 1.5 + márgenes cayendo:', rest: ' deterioro fundamental real. La baja del precio puede estar justificada.' },
              { bold: 'P/E muy por encima del sector + crecimiento desacelerando:', rest: ' valuación inflada. Riesgo de re-rating a la baja.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-2.5 py-2" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--red)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--text)' }}>{item.bold}</strong>{item.rest}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4" style={{ background: 'var(--bg3)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Señales contradictorias</p>
            {[
              { bold: 'Técnico alcista + fundamentales débiles:', rest: ' posible rebote de corto plazo en empresa con problemas reales. Alta especulación.' },
              { bold: 'Fundamentales sólidos + técnico bajista:', rest: ' empresa buena en momento de presión. Puede ser oportunidad de acumulación gradual.' },
              { bold: 'RSI sobrevendido + Death Cross activo:', rest: ' señales contradictorias. El mercado puede seguir bajando aunque esté "barato".' },
            ].map((item, i) => (
              <div key={i} className="flex gap-2.5 py-2" style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--amber)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--text)' }}>{item.bold}</strong>{item.rest}
                </p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
