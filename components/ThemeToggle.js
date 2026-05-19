'use client'
import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light') {
      document.documentElement.classList.add('light')
      setLight(true)
    }
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    if (next) {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }
  }

  return (
    <button
      onClick={toggle}
      title={light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 50,
        width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        cursor: 'pointer', fontSize: 18, transition: 'all .15s',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
    >
      {light ? '🌙' : '☀️'}
    </button>
  )
}
