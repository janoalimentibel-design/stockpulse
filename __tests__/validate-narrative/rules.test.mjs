import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateNarrative } from '../../lib/validate-narrative.js'

function makeNarrative(overrides = {}) {
  return {
    technical_summary: 'El precio muestra momentum neutro con RSI en zona neutral.',
    fundamental_summary: 'Los fundamentales son sólidos con márgenes saludables.',
    analyst_summary: 'Sin catalizadores específicos en las últimas semanas.',
    key_opportunity: 'Posible recuperación técnica.',
    key_risk: 'Volatilidad del mercado.',
    what_to_do: { tienes: 'Mantener.', entras: 'Esperar señal.', sales: 'Revisar stop.' },
    ...overrides,
  }
}

function makeDataset(overrides = {}) {
  return {
    price: 150,
    ma50: 145,
    ma200: 140,
    rsi: 55,
    change1m: 3.5,
    panelTrend: 'Tendencia alcista',
    nextEarningsDate: null,
    nextEarningsDays: null,
    news: [],
    analystTargets: [],
    ...overrides,
  }
}

// ─── Baseline ───────────────────────────────────────────────────────────────

test('1. Narrativa limpia con dataset neutro → valid:true, issues:[], shouldRegenerate:false', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative(),
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  assert.equal(result.valid, true)
  assert.deepEqual(result.issues, [])
  assert.equal(result.shouldRegenerate, false)
})

test('2. Narrativa null → valid:false, shouldRegenerate:true', async () => {
  const result = await validateNarrative({
    narrative: null,
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  assert.equal(result.valid, false)
  assert.equal(result.shouldRegenerate, true)
})

// ─── R1 — peer numbers ───────────────────────────────────────────────────────

test('3. R1: narrativa menciona "MSFT creció 25%" con ticker AAPL → issue R1, shouldRegenerate:true', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'MSFT creció 25% en el último trimestre.',
    }),
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  assert.equal(result.valid, false)
  assert.equal(result.shouldRegenerate, true)
  assert.ok(result.issues.some(i => i.startsWith('R1:')), `Expected R1 issue, got: ${JSON.stringify(result.issues)}`)
})

test('4. R1: narrativa menciona "RSI en 55" (RSI es NON_TICKER_WORD) → sin issue R1', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'El RSI en 55 indica zona neutral para el activo.',
    }),
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  const r1Issues = result.issues.filter(i => i.startsWith('R1:'))
  assert.deepEqual(r1Issues, [])
})

// ─── R2 — cross-validación numérica ─────────────────────────────────────────

test('5. R2: narrativa dice "RSI 90" con dataset.rsi=55 → issue R2, shouldRegenerate:true', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'El RSI 90 muestra sobrecompra extrema en el activo.',
    }),
    dataset: makeDataset({ rsi: 55 }),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, true)
  assert.ok(result.issues.some(i => i.startsWith('R2:')), `Expected R2 issue, got: ${JSON.stringify(result.issues)}`)
})

test('6. R2: narrativa dice "RSI 55.5" con dataset.rsi=55 → sin issue R2 (dentro de ±2%)', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'El RSI 55.5 indica momentum moderado en el activo.',
    }),
    dataset: makeDataset({ rsi: 55 }),
    ticker: 'AAPL',
  })
  const r2Issues = result.issues.filter(i => i.startsWith('R2:'))
  assert.deepEqual(r2Issues, [])
})

// ─── R3 — consistencia de tendencia ─────────────────────────────────────────

test('7. R3: narrativa dice "tendencia alcista" con rsi=30 y price=100 < ma200=150 → issue R3, shouldRegenerate:true', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'La tendencia alcista continúa mostrando fuerza.',
    }),
    dataset: makeDataset({ rsi: 30, price: 100, ma200: 150 }),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, true)
  assert.ok(result.issues.some(i => i.startsWith('R3:')), `Expected R3 issue, got: ${JSON.stringify(result.issues)}`)
})

test('8. R3: panelTrend="Tendencia bajista" y narrativa dice "señal de compra" → issue R3', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'Se observa una señal de compra clara en los indicadores.',
    }),
    dataset: makeDataset({ panelTrend: 'Tendencia bajista' }),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, true)
  assert.ok(result.issues.some(i => i.startsWith('R3:')), `Expected R3 issue, got: ${JSON.stringify(result.issues)}`)
})

// ─── R4 — recomendaciones directas ──────────────────────────────────────────

test('9. R4: narrativa dice "comprá ahora esta acción" → issue R4, shouldRegenerate:true', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      what_to_do: {
        tienes: 'Mantener posición.',
        entras: 'Comprá ahora esta acción sin dudarlo.',
        sales: 'Revisar stop.',
      },
    }),
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, true)
  assert.ok(result.issues.some(i => i.startsWith('R4:')), `Expected R4 issue, got: ${JSON.stringify(result.issues)}`)
})

test('10. R4: narrativa dice "podés considerar comprar si baja" → sin issue R4', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      what_to_do: {
        tienes: 'Mantener posición.',
        entras: 'Podés considerar comprar si baja a soporte.',
        sales: 'Revisar stop.',
      },
    }),
    dataset: makeDataset(),
    ticker: 'AAPL',
  })
  const r4Issues = result.issues.filter(i => i.startsWith('R4:'))
  assert.deepEqual(r4Issues, [])
})

// ─── R5 — fechas ─────────────────────────────────────────────────────────────

test('11. R5: nextEarningsDays=-5 y narrativa dice "el próximo earnings en 3 días" → issue R5, shouldRegenerate:false', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative({
      technical_summary: 'El próximo earnings es en 3 días y generará volatilidad.',
    }),
    dataset: makeDataset({
      nextEarningsDate: '2026-01-01',
      nextEarningsDays: -5,
    }),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, false)
  assert.ok(result.issues.some(i => i.startsWith('R5:')), `Expected R5 issue, got: ${JSON.stringify(result.issues)}`)
})

// ─── R6 — dispersión analistas ────────────────────────────────────────────────

test('12. R6: analystTargets=[100,180,200,90] (alta dispersión) sin mencionar "consenso disperso" → issue R6, shouldRegenerate:false', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative(),
    dataset: makeDataset({ analystTargets: [100, 180, 200, 90] }),
    ticker: 'AAPL',
  })
  assert.equal(result.shouldRegenerate, false)
  assert.ok(result.issues.some(i => i.startsWith('R6:')), `Expected R6 issue, got: ${JSON.stringify(result.issues)}`)
})

test('13. R6: analystTargets=[148,150,152] (baja dispersión) → sin issue R6', async () => {
  const result = await validateNarrative({
    narrative: makeNarrative(),
    dataset: makeDataset({ analystTargets: [148, 150, 152] }),
    ticker: 'AAPL',
  })
  const r6Issues = result.issues.filter(i => i.startsWith('R6:'))
  assert.deepEqual(r6Issues, [])
})
