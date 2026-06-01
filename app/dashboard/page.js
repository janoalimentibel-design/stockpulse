'use client'
// app/dashboard/page.js
import { useEffect, useState, useRef, useCallback } from 'react'

const REFRESH = 30

const C = {
  bg:'#0b0d12', bg2:'#12151c', bg3:'#1a1e28', bg4:'#222633',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  text:'#edeef2', text2:'#8a8d9a', text3:'#484c5a',
  green:'#4ebb79', red:'#e05050', amber:'#d4954a', accent:'#6c7fff', purple:'#a78bfa',
  greenBg:'rgba(78,187,121,0.10)',   greenBd:'rgba(78,187,121,0.28)',
  redBg:'rgba(224,80,80,0.10)',      redBd:'rgba(224,80,80,0.28)',
  amberBg:'rgba(212,149,74,0.10)',   amberBd:'rgba(212,149,74,0.28)',
  accentBg:'rgba(108,127,255,0.10)', accentBd:'rgba(108,127,255,0.28)',
  purpleBg:'rgba(167,139,250,0.10)', purpleBd:'rgba(167,139,250,0.28)',
}

function Box({ children, style }) {
  return <div style={{ background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:10, padding:'14px 16px', ...style }}>{children}</div>
}

function Label({ children }) {
  return <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:C.text3, marginBottom:6 }}>{children}</p>
}

function Hint({ children }) {
  return <p style={{ fontSize:11, color:C.text3, marginTop:4, lineHeight:1.5 }}>{children}</p>
}

function BigNum({ value, color, size = 26 }) {
  return <p style={{ fontSize:size, fontWeight:500, color:color||C.text, margin:'4px 0' }}>{value ?? '—'}</p>
}

function Pill({ label, bg, color, border }) {
  return (
    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, background:bg, color, border:`1px solid ${border}`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

function TrendPill({ trend }) {
  const map = {
    alcista:{ label:'Alcista', bg:C.greenBg, color:C.green, border:C.greenBd },
    bajista:{ label:'Bajista', bg:C.redBg,   color:C.red,   border:C.redBd   },
    neutral:{ label:'Neutral', bg:C.amberBg, color:C.amber, border:C.amberBd },
  }
  const t = map[(trend||'neutral').toLowerCase()] || map.neutral
  return <Pill label={t.label} bg={t.bg} color={t.color} border={t.border} />
}

function NavTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:'7px 16px', fontSize:12, borderRadius:999, border:'1px solid',
      cursor:'pointer', transition:'all .15s',
      borderColor: active ? C.accent : C.border2,
      background:  active ? C.accentBg : 'transparent',
      color:       active ? C.accent : C.text2,
    }}>{label}</button>
  )
}

function InsightBox({ icon, title, body, color, bg, border }) {
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:8, padding:'12px 14px' }}>
      <p style={{ fontSize:11, fontWeight:500, color, marginBottom:5 }}>{icon} {title}</p>
      <p style={{ fontSize:12, color:C.text2, lineHeight:1.6 }}>{body}</p>
    </div>
  )
}

const scoreColor = (s) => s >= 65 ? C.green : s >= 40 ? C.amber : C.red

export default function DashboardPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [secs,    setSecs]    = useState(0)
  const [tab,     setTab]     = useState('producto')
  const timer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setSecs(0)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json()); setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    timer.current = setInterval(() => setSecs(s => { if(s+1>=REFRESH){load();return 0} return s+1 }), 1000)
    return () => clearInterval(timer.current)
  }, [load])

  if (!data && loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', color:C.text3, fontSize:13, fontFamily:'system-ui,sans-serif' }}>
      Cargando métricas...
    </div>
  )
  if (error) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', color:C.red, fontSize:13, fontFamily:'system-ui,sans-serif' }}>
      Error: {error}
    </div>
  )

  const d = data || {}
  const u = d.users || {}
  const maxTicker  = d.topTickers?.[0]?.count || 1
  const maxDay     = Math.max(...(d.daily?.map(x=>x.count)||[1]), 1)
  const maxFreq    = Math.max(...Object.values(u.freqBuckets||{'1':1}), 1)
  const maxPair    = u.topPairs?.[0]?.count || 1
  const totalTrend = Object.values(d.trendCounts||{}).reduce((a,b)=>a+b,0) || 1
  const genTime    = d.generatedAt ? new Date(d.generatedAt).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—'

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, padding:'16px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ maxWidth:1060, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, background:C.accent, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>S</div>
            <div>
              <p style={{ fontSize:14, fontWeight:500 }}>StockPulse Analytics</p>
              <p style={{ fontSize:11, color:C.text3 }}>Actualizado {genTime} · refresh en {REFRESH-secs}s</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block' }} />
            <a href="/dashboard/qa" style={{ padding:'5px 14px', fontSize:11, borderRadius:999, border:`1px solid ${C.border2}`, background:'transparent', color:C.text2, textDecoration:'none' }}>
              Ver QA
            </a>
            <button onClick={load} disabled={loading} style={{ padding:'5px 14px', fontSize:11, borderRadius:999, border:`1px solid ${C.accentBd}`, background:C.accentBg, color:C.accent, cursor:'pointer', opacity:loading?0.4:1 }}>
              {loading ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          <NavTab label="📊 Producto" active={tab==='producto'} onClick={()=>setTab('producto')} />
          <NavTab label="👥 Usuarios" active={tab==='usuarios'} onClick={()=>setTab('usuarios')} />
        </div>

        {/* ── TAB PRODUCTO ── */}
        {tab === 'producto' && <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
            <Box>
              <Label>Usos hoy</Label>
              <BigNum value={d.today} color={d.today > 0 ? C.green : C.text} />
              <Hint>Análisis completados desde medianoche</Hint>
            </Box>
            <Box>
              <Label>Esta semana</Label>
              <BigNum value={d.sevenDays} />
              <Hint>{d.sevenDays ? `${(d.sevenDays/7).toFixed(1)} por día en promedio` : 'Sin datos'}</Hint>
            </Box>
            <Box>
              <Label>Este mes</Label>
              <BigNum value={d.thirtyDays} />
              <Hint>Análisis completados en 30 días</Hint>
            </Box>
            <Box>
              <Label>Acciones distintas</Label>
              <BigNum value={d.uniqueTickers} color={C.accent} />
              <Hint>Tickers únicos analizados en 30 días</Hint>
            </Box>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 230px', gap:8, marginBottom:10 }}>
            <Box>
              <Label>Actividad diaria — análisis completados por día</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>Cada barra es un día. Altura = cantidad de análisis terminados ese día.</p>
              <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:90 }}>
                {(d.daily||[]).map((day,i) => {
                  const h = Math.max(6, Math.round(day.count/maxDay*100))
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, height:'100%', justifyContent:'flex-end' }}>
                      {day.count > 0 && <span style={{ fontSize:10, color:C.text3 }}>{day.count}</span>}
                      <div style={{ width:'100%', background:'rgba(108,127,255,.25)', border:'1px solid rgba(108,127,255,.5)', borderRadius:3, height:`${h}%`, transition:'height .4s' }} title={`${day.count} análisis`} />
                      <span style={{ fontSize:10, color:C.text3 }}>{day.label}</span>
                    </div>
                  )
                })}
              </div>
            </Box>

            <Box>
              <Label>Sentimiento del mercado</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>Resultado de los análisis completados esta semana</p>
              {[
                { key:'alcista', label:'Alcista', color:C.green,  hint:'señal de compra' },
                { key:'neutral', label:'Neutral', color:C.amber,  hint:'esperar' },
                { key:'bajista', label:'Bajista', color:C.red,    hint:'señal de venta' },
              ].map(({ key, label, color, hint }) => {
                const count = d.trendCounts?.[key] || 0
                const pct   = Math.round(count/totalTrend*100)
                return (
                  <div key={key} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color, fontWeight:500 }}>{label} <span style={{ color:C.text3, fontWeight:400, fontSize:10 }}>({hint})</span></span>
                      <span style={{ color:C.text3 }}>{count} · {pct}%</span>
                    </div>
                    <div style={{ height:4, background:C.bg3, borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, opacity:.75, borderRadius:2 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ background:C.accentBg, border:`1px solid ${C.accentBd}`, borderRadius:6, padding:'6px 8px', textAlign:'center' }}>
                  <p style={{ fontSize:16, fontWeight:500, color:C.accent }}>{d.avgScore ?? '—'}</p>
                  <p style={{ fontSize:10, color:C.text3 }}>Score promedio</p>
                  <p style={{ fontSize:9, color:C.text3 }}>(100 = muy alcista)</p>
                </div>
                <div style={{ background:C.greenBg, border:`1px solid ${C.greenBd}`, borderRadius:6, padding:'6px 8px', textAlign:'center' }}>
                  <p style={{ fontSize:16, fontWeight:500, color:C.green }}>{d.narrativeRate ?? '—'}%</p>
                  <p style={{ fontSize:10, color:C.text3 }}>Análisis IA OK</p>
                  <p style={{ fontSize:9, color:C.text3 }}>sin errores de Claude</p>
                </div>
              </div>
            </Box>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <Box>
              <Label>Acciones más analizadas — 7 días</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>Las que más buscaron tus usuarios. Usalas para elegir qué publicar en redes.</p>
              <div style={{ display:'grid', gridTemplateColumns:'16px 48px 1fr 36px 32px', gap:'0 6px', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:9, color:C.text3 }}>#</span>
                <span style={{ fontSize:9, color:C.text3 }}>Ticker</span>
                <span />
                <span style={{ fontSize:9, color:C.text3, textAlign:'right' }}>Búsq.</span>
                <span style={{ fontSize:9, color:C.accent, textAlign:'right' }}>Score</span>
              </div>
              {(d.topTickers||[]).map((t,i) => (
                <div key={t.name} style={{ display:'grid', gridTemplateColumns:'16px 48px 1fr 36px 32px', gap:'0 6px', alignItems:'center', marginBottom:5 }}>
                  <span style={{ fontSize:10, color:C.text3 }}>{i+1}</span>
                  <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{t.name}</span>
                  <div style={{ height:4, background:C.bg3, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(t.count/maxTicker*100)}%`, background:C.accent, opacity:.6, borderRadius:2 }} />
                  </div>
                  <span style={{ fontSize:11, color:C.text3, textAlign:'right' }}>{t.count}</span>
                  <span style={{ fontSize:11, color:t.avgScore ? scoreColor(t.avgScore) : C.text3, textAlign:'right', fontWeight:500 }}>
                    {t.avgScore ?? '—'}
                  </span>
                </div>
              ))}
              {(!d.topTickers || d.topTickers.length === 0) && <p style={{ fontSize:12, color:C.text3 }}>Sin búsquedas aún.</p>}
            </Box>

            <Box>
              <Label>Análisis recientes</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>Score = tendencia de 0 (muy bajista) a 100 (muy alcista). Verde ≥65, rojo ≤35.</p>
              {(d.recent||[]).slice(0,10).map((e,i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'44px 32px 70px 1fr', gap:8, alignItems:'center', fontSize:12, padding:'4px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontWeight:500 }}>{e.ticker}</span>
                  <span style={{ color: e.score != null ? scoreColor(e.score) : C.text3, fontWeight:500 }}>{e.score ?? '—'}</span>
                  <TrendPill trend={e.trend} />
                  <span style={{ color:C.text3, fontSize:10, textAlign:'right' }}>
                    {new Date(e.timestamp).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              ))}
              {(!d.recent || d.recent.length === 0) && <p style={{ fontSize:12, color:C.text3 }}>Sin análisis aún.</p>}
            </Box>
          </div>

          <InsightBox
            icon="💡" title="Qué hacer con estos datos ahora"
            color={C.accent} bg={C.accentBg} border={C.accentBd}
            body={`Las acciones del top son tus mejores ideas de contenido para redes. Si AAPL aparece 18 veces, publicá un análisis de AAPL esta semana — ya sabés que tu audiencia la quiere ver. El score promedio (${d.avgScore ?? 0}/100) te dice si el mercado está en modo optimista o defensivo esta semana.`}
          />
        </>}

        {/* ── TAB USUARIOS ── */}
        {tab === 'usuarios' && <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
            <Box>
              <Label>Usuarios únicos (30 días)</Label>
              <BigNum value={u.total} />
              <Hint>Identificados por cookie de navegador, sin necesidad de login</Hint>
            </Box>
            <Box>
              <Label>Activos hoy</Label>
              <BigNum value={u.activeToday} color={u.activeToday > 0 ? C.green : C.text} />
              <Hint>Hicieron al menos 1 análisis hoy</Hint>
            </Box>
            <Box>
              <Label>Activos esta semana</Label>
              <BigNum value={u.active7d} />
              <Hint>Volvieron en los últimos 7 días</Hint>
            </Box>
            <Box>
              <Label>Power users</Label>
              <BigNum value={u.powerUsers} color={C.accent} />
              <Hint>≥5 análisis · máximos candidatos al plan Pro</Hint>
            </Box>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <Box>
              <Label>Frecuencia de uso — análisis por usuario</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>Cuántos usuarios usaron la app 1 vez, 2-4 veces, etc. Los de 5+ son tu audiencia pagadora.</p>
              {[
                { key:'1',   label:'1 análisis',     color:C.text3,  hint:'probaron y no volvieron' },
                { key:'2-4', label:'2 a 4 análisis',  color:C.amber,  hint:'interesados, aún no enganchados' },
                { key:'5-9', label:'5 a 9 análisis',  color:C.accent, hint:'comprometidos — mostrales el Pro' },
                { key:'10+', label:'10+ análisis',    color:C.green,  hint:'power users — van a pagar' },
              ].map(({ key, label, color, hint }) => {
                const count = u.freqBuckets?.[key] || 0
                return (
                  <div key={key} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color, fontWeight:500 }}>{label}</span>
                      <span style={{ color:C.text3 }}>{count} usuario{count!==1?'s':''} <span style={{ fontSize:10 }}>({hint})</span></span>
                    </div>
                    <div style={{ height:5, background:C.bg3, borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.round(count/maxFreq*100)}%`, background:color, opacity:.7, borderRadius:2 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:C.accentBg, border:`1px solid ${C.accentBd}`, borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:18, fontWeight:500, color:C.accent }}>{u.avgPerUser ?? '—'}</p>
                  <p style={{ fontSize:10, color:C.text3 }}>Análisis por usuario promedio</p>
                </div>
                <div style={{ background:C.greenBg, border:`1px solid ${C.greenBd}`, borderRadius:6, padding:'8px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:18, fontWeight:500, color:C.green }}>{u.maxPerUser ?? '—'}</p>
                  <p style={{ fontSize:10, color:C.text3 }}>Máximo de 1 usuario</p>
                </div>
              </div>
            </Box>

            <Box>
              <Label>Power users — quiénes son</Label>
              <p style={{ fontSize:11, color:C.text3, marginBottom:10 }}>
                ID anonimizado (primeros 8 caracteres de la cookie). Las acciones que buscó cada uno son su perfil de interés.
              </p>
              {(u.topByVolume||[]).map((usr,i) => (
                <div key={i} style={{ background:C.bg3, borderRadius:7, padding:'8px 10px', marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontFamily:'monospace', fontSize:11, color:C.text2 }}>{usr.id}</span>
                    <Pill label={`${usr.analyses} análisis`} bg={C.accentBg} color={C.accent} border={C.accentBd} />
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
                    {(usr.tickers||[]).map(t => (
                      <span key={t} style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:C.bg4, color:C.text2, border:`1px solid ${C.border2}` }}>{t}</span>
                    ))}
                  </div>
                  <p style={{ fontSize:10, color:C.text3 }}>
                    Último análisis: {usr.lastSeen ? new Date(usr.lastSeen).toLocaleDateString('es',{day:'numeric',month:'short'}) : '—'}
                  </p>
                </div>
              ))}
              {(!u.topByVolume || u.topByVolume.length === 0) && (
                <p style={{ fontSize:12, color:C.text3 }}>Sin usuarios con historial aún.</p>
              )}
            </Box>
          </div>

          <Box style={{ marginBottom:10 }}>
            <Label>Pares de acciones — qué comparan tus usuarios</Label>
            <p style={{ fontSize:11, color:C.text3, marginBottom:12 }}>
              Cuando el mismo usuario busca dos acciones, ese par aparece aquí. Base del motor de recomendaciones: "si buscaste X, mirá también Y".
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {(u.topPairs||[]).map((pair,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, fontWeight:500, color:C.text, width:110, flexShrink:0 }}>
                    {pair.a} <span style={{ color:C.text3, fontWeight:400 }}>+</span> {pair.b}
                  </span>
                  <div style={{ flex:1, height:4, background:C.bg3, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round(pair.count/maxPair*100)}%`, background:C.purple, opacity:.75, borderRadius:2 }} />
                  </div>
                  <span style={{ fontSize:11, color:C.text3, width:18, textAlign:'right' }}>{pair.count}</span>
                </div>
              ))}
            </div>
            {(!u.topPairs || u.topPairs.length === 0) && (
              <p style={{ fontSize:12, color:C.text3 }}>Sin pares aún. Necesitás usuarios que busquen más de una acción.</p>
            )}
          </Box>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <InsightBox
              icon="🎯" title="Cuándo activar el paywall"
              color={C.accent} bg={C.accentBg} border={C.accentBd}
              body={`Tenés ${u.powerUsers ?? 0} usuarios con 5+ análisis. Esos son tus compradores naturales del plan Pro. Activá el límite de 3/día cuando llegues a 10+ power users — antes es prematuro y puede frenar el crecimiento.`}
            />
            <InsightBox
              icon="📣" title="Estrategia de contenido con co-ocurrencia"
              color={C.purple} bg={C.purpleBg} border={C.purpleBd}
              body="Los pares más frecuentes son tus mejores ideas de posts comparativos: 'MELI vs TSLA: cuál conviene ahora'. Ese formato genera engagement porque tus usuarios ya están comparando esas dos en StockPulse."
            />
          </div>
        </>}

      </div>
    </div>
  )
}
