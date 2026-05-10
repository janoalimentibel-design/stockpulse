'use client'
// app/dashboard/page.js
import { useEffect, useState, useRef, useCallback } from 'react'

const REFRESH = 30

const sp = {
  bg:  '#0b0d12', bg2: '#12151c', bg3: '#1a1e28',
  border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
  text: '#edeef2', text2: '#8a8d9a', text3: '#484c5a',
  green: '#4ebb79', red: '#e05050', amber: '#d4954a', accent: '#6c7fff',
  greenBg: 'rgba(78,187,121,0.10)', greenBorder: 'rgba(78,187,121,0.28)',
  redBg:   'rgba(224,80,80,0.10)',  redBorder:   'rgba(224,80,80,0.28)',
  amberBg: 'rgba(212,149,74,0.10)', amberBorder: 'rgba(212,149,74,0.28)',
  accentBg:'rgba(108,127,255,0.10)',accentBorder:'rgba(108,127,255,0.28)',
}

const s = (styles) => Object.entries(styles).reduce((a,[k,v])=>({...a,[k]:v}),{})

function Card({ label, value, sub, color }) {
  return (
    <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:'10px 12px'})}>
      <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:5})}>{label}</p>
      <p style={s({fontSize:22,fontWeight:500,color:color||sp.text})}>{value}</p>
      {sub && <p style={s({fontSize:11,color:sp.text3,marginTop:2})}>{sub}</p>}
    </div>
  )
}

function TrendPill({ trend }) {
  const map = {
    alcista: { label:'Alcista', bg:sp.greenBg, color:sp.green, border:sp.greenBorder },
    bajista: { label:'Bajista', bg:sp.redBg,   color:sp.red,   border:sp.redBorder   },
    neutral: { label:'Neutral', bg:sp.amberBg, color:sp.amber, border:sp.amberBorder },
  }
  const t = map[(trend||'neutral').toLowerCase()] || map.neutral
  return (
    <span style={s({fontSize:10,padding:'1px 8px',borderRadius:999,background:t.bg,color:t.color,border:`1px solid ${t.border}`})}>
      {t.label}
    </span>
  )
}

function BarH({ label, count, max, color = sp.accent, right }) {
  return (
    <div style={s({display:'flex',alignItems:'center',gap:8,marginBottom:4})}>
      <span style={s({fontSize:12,fontWeight:500,color:sp.text,width:48,flexShrink:0})}>{label}</span>
      <div style={s({flex:1,height:4,background:sp.bg3,borderRadius:2,overflow:'hidden'})}>
        <div style={s({height:'100%',width:`${Math.round(count/max*100)}%`,background:color,opacity:.75,borderRadius:2,transition:'width .4s'})} />
      </div>
      <span style={s({fontSize:11,color:sp.text3,width:right||28,textAlign:'right',flexShrink:0})}>{count}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [secs,    setSecs]    = useState(0)
  const [tab,     setTab]     = useState('producto')   // 'producto' | 'usuarios'
  const timer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setSecs(0)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json()); setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    timer.current = setInterval(() => setSecs(s => { if (s+1>=REFRESH){load();return 0} return s+1 }), 1000)
    return () => clearInterval(timer.current)
  }, [load])

  if (!data && loading) return (
    <div style={s({minHeight:'100vh',background:sp.bg,display:'flex',alignItems:'center',justifyContent:'center',color:sp.text3,fontSize:13})}>
      Cargando métricas...
    </div>
  )
  if (error) return (
    <div style={s({minHeight:'100vh',background:sp.bg,display:'flex',alignItems:'center',justifyContent:'center',color:sp.red,fontSize:13})}>
      Error: {error}
    </div>
  )

  const d = data || {}
  const u = d.users || {}

  const maxTicker  = d.topTickers?.[0]?.count  || 1
  const maxDay     = Math.max(...(d.daily?.map(x=>x.count)||[1]))
  const totalTrend = Object.values(d.trendCounts||{}).reduce((a,b)=>a+b,0) || 1
  const maxFreq    = Math.max(...Object.values(u.freqBuckets||{1:1}))
  const maxPair    = u.topPairs?.[0]?.count || 1

  const navTab = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={s({
        padding:'6px 14px', fontSize:12, borderRadius:999, border:'1px solid',
        cursor:'pointer', transition:'all .15s',
        borderColor: tab===id ? sp.accent : sp.border2,
        background:  tab===id ? sp.accentBg : 'transparent',
        color:       tab===id ? sp.accent : sp.text2,
      })}
    >{label}</button>
  )

  return (
    <div style={s({minHeight:'100vh',background:sp.bg,color:sp.text,padding:16,fontFamily:'system-ui,sans-serif'})}>
      <div style={s({maxWidth:1060,margin:'0 auto'})}>

        {/* Header */}
        <div style={s({display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8})}>
          <div style={s({display:'flex',alignItems:'center',gap:10})}>
            <div style={s({width:26,height:26,background:sp.accent,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff'})}>S</div>
            <div>
              <p style={s({fontSize:14,fontWeight:500})}>StockPulse Analytics</p>
              <p style={s({fontSize:11,color:sp.text3})}>
                {d.generatedAt ? new Date(d.generatedAt).toLocaleTimeString('es') : '—'}
                {' · '}refresh en {REFRESH-secs}s
              </p>
            </div>
          </div>
          <div style={s({display:'flex',alignItems:'center',gap:8})}>
            <div style={s({width:6,height:6,borderRadius:'50%',background:sp.green,animation:'pulse 2s infinite'})}/>
            <button onClick={load} disabled={loading}
              style={s({padding:'5px 14px',fontSize:11,borderRadius:999,border:`1px solid ${sp.accentBorder}`,background:sp.accentBg,color:sp.accent,cursor:'pointer',opacity:loading?.4:1})}>
              {loading ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={s({display:'flex',gap:6,marginBottom:14})}>
          {navTab('producto', '📊 Producto')}
          {navTab('usuarios', '👥 Usuarios')}
        </div>

        {/* ─── TAB PRODUCTO ─── */}
        {tab === 'producto' && <>
          <div style={s({display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10})}>
            <Card label="Análisis hoy"    value={d.today?.toLocaleString('es') ?? '—'} sub="eventos" />
            <Card label="Últimos 7 días"  value={d.sevenDays?.toLocaleString('es') ?? '—'} sub={`${(d.sevenDays/7||0).toFixed(1)}/día`} />
            <Card label="Último mes"      value={d.thirtyDays?.toLocaleString('es') ?? '—'} sub="análisis totales" />
            <Card label="Tickers únicos"  value={d.uniqueTickers ?? '—'} sub="30 días" />
          </div>

          <div style={s({display:'grid',gridTemplateColumns:'1fr 200px',gap:8,marginBottom:10})}>
            {/* Daily bars */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:12})}>Análisis diarios — 7 días</p>
              <div style={s({display:'flex',alignItems:'flex-end',gap:6,height:100})}>
                {(d.daily||[]).map((day,i)=>(
                  <div key={i} style={s({flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'})}>
                    <span style={s({fontSize:10,color:sp.text3})}>{day.count}</span>
                    <div title={`${day.count} análisis`}
                      style={s({width:'100%',background:'rgba(108,127,255,.2)',border:'1px solid rgba(108,127,255,.45)',borderRadius:3,
                        height:`${Math.max(8,Math.round(day.count/maxDay*100))}%`,transition:'height .4s'})}/>
                    <span style={s({fontSize:10,color:sp.text3})}>{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Trend donut approx */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:10})}>Tendencia</p>
              {[
                {key:'alcista',label:'Alcista',color:sp.green},
                {key:'neutral',label:'Neutral',color:sp.amber},
                {key:'bajista',label:'Bajista',color:sp.red},
              ].map(({key,label,color})=>{
                const pct = Math.round((d.trendCounts?.[key]||0)/totalTrend*100)
                return (
                  <div key={key} style={s({marginBottom:8})}>
                    <div style={s({display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3})}>
                      <span style={{color,fontWeight:500}}>{label}</span>
                      <span style={{color:sp.text3}}>{pct}%</span>
                    </div>
                    <div style={s({height:4,background:sp.bg3,borderRadius:2,overflow:'hidden'})}>
                      <div style={s({height:'100%',width:`${pct}%`,background:color,opacity:.7,borderRadius:2})}/>
                    </div>
                  </div>
                )
              })}
              <div style={s({marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6})}>
                <div style={s({background:sp.accentBg,border:`1px solid ${sp.accentBorder}`,borderRadius:6,padding:'6px 8px',textAlign:'center'})}>
                  <p style={s({fontSize:16,fontWeight:500,color:sp.accent})}>{d.avgScore??'—'}</p>
                  <p style={s({fontSize:10,color:sp.text3})}>Score medio</p>
                </div>
                <div style={s({background:sp.greenBg,border:`1px solid ${sp.greenBorder}`,borderRadius:6,padding:'6px 8px',textAlign:'center'})}>
                  <p style={s({fontSize:16,fontWeight:500,color:sp.green})}>{d.narrativeRate??'—'}%</p>
                  <p style={s({fontSize:10,color:sp.text3})}>IA OK</p>
                </div>
              </div>
            </div>
          </div>

          <div style={s({display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10})}>
            {/* Top tickers */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:10})}>Top tickers — 7 días</p>
              {(d.topTickers||[]).map((t,i)=>(
                <div key={t.name} style={s({display:'flex',alignItems:'center',gap:8,marginBottom:4})}>
                  <span style={s({fontSize:10,color:sp.text3,width:14})}>{i+1}</span>
                  <span style={s({fontSize:12,fontWeight:500,width:44,color:sp.text})}>{t.name}</span>
                  <div style={s({flex:1,height:4,background:sp.bg3,borderRadius:2,overflow:'hidden'})}>
                    <div style={s({height:'100%',width:`${Math.round(t.count/maxTicker*100)}%`,background:sp.accent,opacity:.6,borderRadius:2})}/>
                  </div>
                  <span style={s({fontSize:11,color:sp.text3,width:24,textAlign:'right'})}>{t.count}</span>
                  {t.avgScore&&<span style={s({fontSize:11,color:sp.accent,width:30,textAlign:'right'})}>{t.avgScore}</span>}
                </div>
              ))}
            </div>
            {/* Live feed */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:10})}>Análisis recientes</p>
              {(d.recent||[]).slice(0,10).map((e,i)=>(
                <div key={i} style={s({display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'3px 0',borderBottom:`1px solid ${sp.border}`})}>
                  <span style={s({fontWeight:500,width:44})}>{e.ticker}</span>
                  <span style={s({color:sp.accent,width:24})}>{e.score??'—'}</span>
                  <TrendPill trend={e.trend}/>
                  <span style={s({color:sp.text3,fontSize:10,marginLeft:'auto'})}>
                    {new Date(e.timestamp).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ─── TAB USUARIOS ─── */}
        {tab === 'usuarios' && <>
          <div style={s({display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10})}>
            <Card label="Usuarios únicos (30d)" value={u.total??'—'} sub="por distinct_id" />
            <Card label="Activos hoy"  value={u.activeToday??'—'} sub={`de ${u.total??0} total`} color={sp.green} />
            <Card label="Activos 7 días" value={u.active7d??'—'} sub="al menos 1 análisis" />
            <Card label="Power users"  value={u.powerUsers??'—'} sub="≥5 análisis · Pro candidatos" color={sp.accent} />
          </div>

          <div style={s({display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10})}>
            {/* Frecuencia */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:10})}>Frecuencia de uso (análisis por usuario)</p>
              {Object.entries(u.freqBuckets||{}).map(([label,count])=>(
                <BarH key={label} label={label} count={count} max={maxFreq}
                  color={label==='10+'?sp.green:label==='5-9'?sp.accent:label==='2-4'?sp.amber:sp.text3} />
              ))}
              <div style={s({marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6})}>
                <div style={s({background:sp.accentBg,border:`1px solid ${sp.accentBorder}`,borderRadius:6,padding:'6px 8px',textAlign:'center'})}>
                  <p style={s({fontSize:16,fontWeight:500,color:sp.accent})}>{u.avgPerUser??'—'}</p>
                  <p style={s({fontSize:10,color:sp.text3})}>Análisis promedio</p>
                </div>
                <div style={s({background:sp.greenBg,border:`1px solid ${sp.greenBorder}`,borderRadius:6,padding:'6px 8px',textAlign:'center'})}>
                  <p style={s({fontSize:16,fontWeight:500,color:sp.green})}>{u.maxPerUser??'—'}</p>
                  <p style={s({fontSize:10,color:sp.text3})}>Máximo 1 usuario</p>
                </div>
              </div>
            </div>

            {/* Co-ocurrencia */}
            <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12})}>
              <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:4})}>Co-ocurrencia de tickers</p>
              <p style={s({fontSize:11,color:sp.text3,marginBottom:10})}>Pares buscados por el mismo usuario</p>
              {(u.topPairs||[]).map((pair,i)=>(
                <div key={i} style={s({display:'flex',alignItems:'center',gap:8,marginBottom:4})}>
                  <span style={s({fontSize:12,fontWeight:500,color:sp.text,width:80})}>
                    {pair.a} <span style={{color:sp.text3,fontWeight:400}}>+</span> {pair.b}
                  </span>
                  <div style={s({flex:1,height:4,background:sp.bg3,borderRadius:2,overflow:'hidden'})}>
                    <div style={s({height:'100%',width:`${Math.round(pair.count/maxPair*100)}%`,background:sp.purple||'#a78bfa',opacity:.7,borderRadius:2})}/>
                  </div>
                  <span style={s({fontSize:11,color:sp.text3,width:20,textAlign:'right'})}>{pair.count}</span>
                </div>
              ))}
              {(!u.topPairs||u.topPairs.length===0) && (
                <p style={s({fontSize:12,color:sp.text3,marginTop:16})}>Aún no hay suficientes datos de co-ocurrencia. Necesitás usuarios que busquen más de un ticker.</p>
              )}
            </div>
          </div>

          {/* Top usuarios por volumen */}
          <div style={s({background:sp.bg2,border:`1px solid ${sp.border2}`,borderRadius:8,padding:12,marginBottom:10})}>
            <p style={s({fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:sp.text3,marginBottom:10})}>Usuarios más activos (top 5 — ID anonimizado)</p>
            <div style={s({display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8})}>
              {(u.topByVolume||[]).map((usr,i)=>(
                <div key={i} style={s({background:sp.bg3,borderRadius:6,padding:'8px 10px'})}>
                  <div style={s({display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5})}>
                    <span style={s({fontSize:10,color:sp.text3})}>{usr.id}</span>
                    <span style={s({fontSize:12,fontWeight:500,color:sp.accent})}>{usr.analyses}</span>
                  </div>
                  <p style={s({fontSize:10,color:sp.text3,marginBottom:4})}>análisis · {usr.searches} búsquedas</p>
                  <div style={s({display:'flex',gap:3,flexWrap:'wrap'})}>
                    {(usr.tickers||[]).map(t=>(
                      <span key={t} style={s({fontSize:9,padding:'1px 5px',borderRadius:3,background:sp.accentBg,color:sp.accent,border:`1px solid ${sp.accentBorder}`})}>{t}</span>
                    ))}
                  </div>
                  <p style={s({fontSize:9,color:sp.text3,marginTop:4})}>
                    {usr.lastSeen ? new Date(usr.lastSeen).toLocaleDateString('es') : ''}
                  </p>
                </div>
              ))}
              {(!u.topByVolume||u.topByVolume.length===0) && (
                <p style={s({fontSize:12,color:sp.text3,gridColumn:'1/-1'})}>Sin datos de usuarios todavía. Asegurate de que el evento ticker_searched esté siendo capturado.</p>
              )}
            </div>
          </div>

          <div style={s({background:sp.amberBg,border:`1px solid ${sp.amberBorder}`,borderRadius:8,padding:12})}>
            <p style={s({fontSize:11,fontWeight:500,color:sp.amber,marginBottom:4})}>Motor de sugerencias — qué necesitás</p>
            <p style={s({fontSize:12,color:sp.text2,lineHeight:1.6})}>
              Con los datos de co-ocurrencia ya podés construir "usuarios como vos también analizaron X".
              Cuando implementes auth, un <code style={{background:sp.bg3,padding:'1px 5px',borderRadius:3,color:sp.accent,fontSize:11}}>posthog.identify(userId)</code> une la historia anónima al usuario real.
              Con ~200 usuarios activos tenés suficiente señal para el primer motor de recomendaciones sin ML.
            </p>
          </div>
        </>}

      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}
