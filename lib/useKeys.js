'use client'
import { useState, useEffect } from 'react'

export function useKeys() {
  const [polygonKey, setPolygonKeyState] = useState('')
  const [claudeKey, setClaudeKeyState] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPolygonKeyState(localStorage.getItem('sp_polygon_key') || '')
    setClaudeKeyState(localStorage.getItem('sp_claude_key') || '')
    setLoaded(true)
  }, [])

  const savePolygonKey = (k) => {
    localStorage.setItem('sp_polygon_key', k)
    setPolygonKeyState(k)
  }
  const saveClaudeKey = (k) => {
    localStorage.setItem('sp_claude_key', k)
    setClaudeKeyState(k)
  }

  const hasPolygon = loaded && polygonKey.length > 10
  const hasClaude = loaded && claudeKey.startsWith('sk-ant-')

  return { polygonKey, claudeKey, savePolygonKey, saveClaudeKey, hasPolygon, hasClaude, loaded }
}
