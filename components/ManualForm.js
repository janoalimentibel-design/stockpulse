'use client'
import { useState } from 'react'

const fields = [
  { id: 'pe', label: 'P/E ratio', placeholder: 'ej. 23' },
  { id: 'peSector', label: 'P/E del sector', placeholder: 'ej. 28' },
  { id: 'epsGrowth', label: 'Crecimiento EPS (%)', placeholder: 'ej. 20' },
  { id: 'netMargin', label: 'Margen neto (%)', placeholder: 'ej. 17' },
  { id: 'de', label: 'Deuda/Patrimonio D/E', placeholder: 'ej. 0.30' },
  { id: 'roe', label: 'ROE (%)', placeholder: 'ej. 12' },
  { id: 'divYield', label: 'Dividend yield (%)', placeholder: 'ej. 0.97' },
]

export default function ManualForm({ values, onChange, onAnalyze }) {
  const [open, setOpen] = useState(false)

  const handleChange = (id, val) => {
    onChange({ ...values, [id]: val === '' ? undefined : parseFloat(val) })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors"
        style={{ color: 'var(--text2)' }}
      >
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Datos fundamentales manuales</span>
          <span className="text-xs ml-2" style={{ color: 'var(--text3)' }}>P/E, márgenes, ROE — opcionales</span>
        </div>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
          {open ? 'Cerrar ↑' : 'Abrir ↓'}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mt-3 mb-4" style={{ color: 'var(--text3)' }}>
            Polygon free no incluye fundamentales. Ingresalos desde Yahoo Finance, Macrotrends o tu broker.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fields.map(f => (
              <div key={f.id}>
                <label className="block text-[11px] mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={f.placeholder}
                  value={values[f.id] ?? ''}
                  onChange={e => handleChange(f.id, e.target.value)}
                />
              </div>
            ))}
          </div>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
            >
              Recalcular con datos fundamentales →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
