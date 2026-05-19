'use client'

function Bone({ w = '100%', h = 12, radius = 6, style = {} }) {
  return (
    <div className="skeleton-shimmer" style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0, ...style,
    }} />
  )
}

export default function SkeletonCard({ message }) {
  return (
    <div style={{ marginTop: 24 }}>
      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-soft 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bone w={100} h={26} radius={6} />
          <Bone w={150} h={11} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Bone w={90} h={26} radius={6} />
          <Bone w={60} h={11} />
        </div>
      </div>

      {/* Score card */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 68, height: 68, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Bone w="55%" h={15} />
            <Bone w="38%" h={11} />
            <Bone w={88} h={22} radius={999} />
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px 8px' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', gap: 8,
          }}>
            <Bone w="42%" h={11} />
            <Bone w={48} h={11} />
            <Bone w={58} h={20} radius={999} />
          </div>
        ))}
      </div>
    </div>
  )
}
