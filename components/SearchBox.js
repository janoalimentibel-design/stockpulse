'use client'
import { useState, useEffect, useRef } from 'react'

export default function SearchBox({ ticker, setTicker, onSearch, loading, hasPolygon, polygonKey }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState(null)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query || query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!polygonKey) return
      setSearching(true)
      try {
        const res = await fetch('/api/search-ticker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, polygonKey })
        })
        const data = await res.json()
        setSuggestions(data.results || [])
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
      finally { setSearching(false) }
    }, 350)
  }, [query, polygonKey])

  function selectSuggestion(item) {
    setQuery(item.name)
    setSelectedTicker(item.ticker)
    setTicker(item.ticker)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleSearch() {
    const t = selectedTicker || query.toUpperCase().trim()
    setTicker(t)
    setShowSuggestions(false)
    onSearch(t)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !loading) handleSearch()
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  function handleInputChange(e) {
    setQuery(e.target.value)
    setSelectedTicker(null)
    setTicker(e.target.value.toUpperCase())
  }

  return (
    <div className="relative mb-2" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Escribi el nombre o ticker - Apple, Oracle, NVDA..."
            maxLength={60}
            disabled={loading}
            style={{
              fontFamily: 'Syne, sans-serif',
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: showSuggestions && suggestions.length > 0 ? '10px 10px 0 0' : '10px',
              color: 'var(--text)',
              fontSize: '15px',
              padding: '12px 16px',
              width: '100%',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-50 rounded-b-xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => selectSuggestion(s)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  style={{ borderTop: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{s.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded ml-3 shrink-0"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
                    {s.ticker}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSearch}
          disabled={loading || !query.trim() || !hasPolygon}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap' }}>
          {loading ? 'Analizando...' : 'Analizar'}
        </button>
      </div>
      {selectedTicker
        ? <p className="text-xs mt-2" style={{ color: 'var(--green)' }}>Ticker: <strong>{selectedTicker}</strong></p>
        : <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>Escribi el nombre de la empresa o el ticker. Ej: Apple, AAPL, Oracle, ORCL</p>
      }
    </div>
  )
}
