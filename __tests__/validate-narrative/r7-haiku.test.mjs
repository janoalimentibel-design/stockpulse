import { test } from 'node:test'
import assert from 'node:assert/strict'
import { r7HaikuSanityCheck } from '../../lib/validate-narrative.js'

// Helper to build a minimal Anthropic API response with the given text
function makeAnthropicResponse(text) {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text }],
    }),
  }
}

const SAMPLE_NARRATIVE = {
  technical_summary: 'La acción muestra momentum positivo con RSI en zona neutral.',
  fundamental_summary: 'Los fundamentales son sólidos con un P/E razonable.',
  analyst_summary: 'Los analistas mantienen una visión constructiva.',
  key_opportunity: 'Ruptura de resistencia clave podría impulsar el precio.',
  key_risk: 'Desaceleración macro podría presionar los márgenes.',
}

const SAMPLE_DATASET = {
  ticker: 'AAPL',
  price: 195,
  rsi: 65,
  ma50: 190,
  ma200: 180,
  change1m: 5,
  panelTrend: 'Tendencia alcista',
  macd: 1.2,
  macdSignal: 0.8,
}

// ── Test 1: Haiku returns no issues ──────────────────────────────────────────
test('r7HaikuSanityCheck — Haiku returns no issues', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key'
  globalThis.fetch = async () => makeAnthropicResponse('{"hasIssues": false, "issues": []}')
  try {
    const result = await r7HaikuSanityCheck(SAMPLE_NARRATIVE, SAMPLE_DATASET)
    assert.deepEqual(result, { hasIssues: false, issues: [] })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  }
})

// ── Test 2: Haiku detects an issue ───────────────────────────────────────────
test('r7HaikuSanityCheck — Haiku detects an issue', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key'
  globalThis.fetch = async () =>
    makeAnthropicResponse(
      '{"hasIssues": true, "issues": ["afirma P/E de 25 pero no está en el dataset"]}'
    )
  try {
    const result = await r7HaikuSanityCheck(SAMPLE_NARRATIVE, SAMPLE_DATASET)
    assert.deepEqual(result, {
      hasIssues: true,
      issues: ['R7: afirma P/E de 25 pero no está en el dataset'],
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  }
})

// ── Test 3: Network error — non-blocking ─────────────────────────────────────
test('r7HaikuSanityCheck — network error is non-blocking', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key'
  globalThis.fetch = async () => { throw new Error('network') }
  try {
    const result = await r7HaikuSanityCheck(SAMPLE_NARRATIVE, SAMPLE_DATASET)
    assert.deepEqual(result, { hasIssues: false, issues: [] })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  }
})

// ── Test 4: Malformed JSON from Haiku ────────────────────────────────────────
test('r7HaikuSanityCheck — malformed JSON from Haiku is non-blocking', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key'
  globalThis.fetch = async () =>
    makeAnthropicResponse('Lo siento, no puedo analizar esto')
  try {
    const result = await r7HaikuSanityCheck(SAMPLE_NARRATIVE, SAMPLE_DATASET)
    assert.deepEqual(result, { hasIssues: false, issues: [] })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  }
})

// ── Test 5: API key absent ───────────────────────────────────────────────────
test('r7HaikuSanityCheck — missing API key is non-blocking', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    const result = await r7HaikuSanityCheck(SAMPLE_NARRATIVE, SAMPLE_DATASET)
    assert.deepEqual(result, { hasIssues: false, issues: [] })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey
    }
  }
})
