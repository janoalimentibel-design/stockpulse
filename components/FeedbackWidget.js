'use client'
import { useState } from 'react'

export default function FeedbackWidget({ ticker }) {
  const [state, setState] = useState('idle') // 'idle' | 'loading' | 'done'
  const [voted, setVoted] = useState(null)   // 'up' | 'down'

  async function handleVote(rating) {
    if (state !== 'idle') return
    setState('loading')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, rating }),
      })
      if (!res.ok) throw new Error('Request failed')
      setVoted(rating)
      setState('done')
    } catch {
      // Feedback is optional — fail silently
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
        {voted === 'up' ? '👍' : '👎'} ¡Gracias por el feedback!
      </div>
    )
  }

  const isLoading = state === 'loading'

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
        ¿Te fue útil este análisis?
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => handleVote('up')}
          disabled={isLoading}
          style={{
            fontSize: 12,
            padding: '5px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text2)',
            cursor: isLoading ? 'default' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          👍 Útil
        </button>
        <button
          type="button"
          onClick={() => handleVote('down')}
          disabled={isLoading}
          style={{
            fontSize: 12,
            padding: '5px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text2)',
            cursor: isLoading ? 'default' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          👎 No útil
        </button>
      </div>
    </div>
  )
}
