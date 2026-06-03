export default function Disclaimer({ variant = 'compact', style }) {
  if (variant === 'full') {
    return (
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        ...style,
      }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>
          ⚠️ Solo para uso informativo personal
        </p>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
          Los análisis son generados por IA y pueden contener errores. No constituyen asesoramiento financiero ni recomendación de inversión. Los datos tienen un delay de ~15 min. Consultá un asesor financiero antes de tomar decisiones de inversión.
        </p>
      </div>
    )
  }

  return (
    <p style={{ fontSize: 11, color: 'var(--text3)', ...style }}>
      ⚠️ Herramienta informativa — no constituye asesoramiento financiero ni recomendación de inversión.
    </p>
  )
}
