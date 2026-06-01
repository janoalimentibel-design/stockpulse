# Sprint 1.2 — Haiku Sanity Check Second-Pass

**Date:** 2026-06-01
**Branch:** feature/haiku-sanity-check
**Scope:** Sub-tarea 1.2 del Sprint 1 (Validador de narrativa cerrado)

---

## Contexto

Sprint 1.1 ya implementó `lib/validate-narrative.js` con 7 reglas (R1–R7).
R7 existe pero es un **stub** que siempre devuelve `{ hasIssues: false, issues: [] }`.

Además, `app/api/narrative/route.js` todavía usa una **función inline** propia `validateNarrative`
que no importa del lib. Esta tarea cierra ambas deudas.

---

## Cambios requeridos

### 1. `lib/validate-narrative.js` — Implementar `r7HaikuSanityCheck`

Reemplazar el stub (líneas ~201-205):

```js
async function r7HaikuSanityCheck(_narrative, _dataset) {
  return { hasIssues: false, issues: [] }
}
```

Con una llamada real a Claude Haiku.

**Spec de la función:**

```js
async function r7HaikuSanityCheck(narrative, dataset)
  → Promise<{ hasIssues: boolean, issues: string[] }>
```

- API: `POST https://api.anthropic.com/v1/messages`
- Key: `process.env.ANTHROPIC_API_KEY` (puede estar ausente)
- Model: `claude-haiku-4-20250307`
- max_tokens: 300
- Headers: `{ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }`
- **Non-blocking**: cualquier error (key ausente, network, HTTP non-ok, JSON inválido) → loguear
  warning y retornar `{ hasIssues: false, issues: [] }`. Nunca lanzar excepción al caller.

**Prompt a Haiku:**

```
Sos un revisor de calidad financiera. El siguiente análisis fue generado automáticamente.

DATASET (datos reales del mercado):
{{datasetContext}}

ANÁLISIS GENERADO:
{{narrativeText}}

Verificá si el análisis hace alguna afirmación que:
- Contradiga un dato numérico explícito del dataset
- Cite un número que no existe en el dataset
- Describa una tendencia opuesta a la que muestran los indicadores

Respondé SOLO con JSON válido, sin markdown, sin texto adicional:
{"hasIssues": boolean, "issues": ["descripción breve del problema 1", ...]}

Si no encontrás problemas: {"hasIssues": false, "issues": []}
```

**`datasetContext`** — string compacto generado desde el dataset:

```
Ticker: {ticker} | Precio: ${price} | RSI: {rsi} | MA50: ${ma50} | MA200: ${ma200}
Cruce: {Golden Cross | Death Cross | N/D} | Tendencia panel: {panelTrend}
Cambio 1m: {change1m}% | MACD: {macd} vs señal {macdSignal}
```

Solo incluir campos no-null.

**`narrativeText`** — concatenación de los campos de la narrativa:

```
TÉCNICO: {technical_summary}
FUNDAMENTAL: {fundamental_summary}
ANALISTA: {analyst_summary}
OPORTUNIDAD: {key_opportunity}
RIESGO: {key_risk}
```

**Parseo de respuesta Haiku:**

```js
const raw = anthropicData.content?.find(b => b.type === 'text')?.text || ''
const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
if (s === -1 || e === -1) return { hasIssues: false, issues: [] }  // graceful
const parsed = JSON.parse(raw.slice(s, e + 1))
return {
  hasIssues: Boolean(parsed.hasIssues),
  issues: Array.isArray(parsed.issues)
    ? parsed.issues.map(i => `R7: ${i}`).slice(0, 5)
    : []
}
```

---

### 2. `app/api/narrative/route.js` — Integrar lib

**Agregar import** al inicio del archivo (después de los imports existentes):

```js
import { validateNarrative } from '@/lib/validate-narrative'
```

**Eliminar** la función inline `validateNarrative` (líneas ~97-135) del archivo.

**Eliminar** la función `buildPanelContext` (líneas ~137-145) — puede migrar a lib si se necesita,
o eliminarse si solo se usaba para el retry prompt.

**Reemplazar** el bloque de validación en el POST handler (actualmente líneas ~343-367):

```js
// ANTES (inline, síncrono):
if (panelData) {
  const issues = validateNarrative(parsed, validationInput)
  if (issues.length > 0) { /* retry */ }
}

// DESPUÉS (lib, async):
const validationDataset = {
  ticker,
  price, ma50, ma200, rsi, change1m,
  panelTrend: panelData?.trend,
  macd, macdSignal,
  nextEarningsDate, nextEarningsDays,
  news: news || [],
}
const firstResult = await validateNarrative({ narrative: parsed, dataset: validationDataset, ticker })
if (firstResult.shouldRegenerate) {
  console.warn(`[narrative] Validación lib fallida para ${ticker}:`, firstResult.issues)
  const firstParsed = parsed
  const retryPrompt = `${prompt}\n\n━━━ CORRECCIÓN NECESARIA ━━━\nProblemas detectados:\n${firstResult.issues.map(i => `• ${i}`).join('\n')}\n\nReescribí la narrativa corrigiendo estos problemas.`
  try {
    parsed = await callClaude(retryPrompt)
    const retryResult = await validateNarrative({ narrative: parsed, dataset: validationDataset, ticker })
    if (retryResult.shouldRegenerate) {
      console.warn(`[narrative] Segundo intento también falló — usando primera respuesta con warning`)
      parsed = firstParsed
      validationWarning = true
    }
  } catch (retryErr) {
    console.error(`[narrative] Error en reintento:`, retryErr.message)
  }
}
```

Declarar `let validationWarning = false` antes del bloque de validación.

**Respuesta con warning flag:**

```js
const sanitized = sanitizeNarrative(parsed)
if (validationWarning) sanitized._validation_warning = true
await setCached(cacheKey, sanitized)
return Response.json(sanitized)
```

---

### 3. `__tests__/validate-narrative/r7-haiku.test.mjs` — Tests unitarios

Formato: ESM (`.mjs`), `node:test` + `node:assert/strict`.
Run: `node --test '__tests__/validate-narrative/*.test.mjs'`

**Tests mínimos (5 casos):**

1. **Haiku dice no hay issues** — mock fetch devuelve `{"hasIssues": false, "issues": []}`
   → r7 retorna `{ hasIssues: false, issues: [] }`

2. **Haiku detecta problema** — mock devuelve `{"hasIssues": true, "issues": ["afirma PE de 25 pero no está en dataset"]}`
   → r7 retorna `{ hasIssues: true, issues: ['R7: afirma PE de 25 pero no está en dataset'] }`

3. **Error de red (fetch rechaza)** → r7 retorna `{ hasIssues: false, issues: [] }` (non-blocking)

4. **JSON malformado de Haiku** — mock devuelve texto libre → r7 retorna `{ hasIssues: false, issues: [] }`

5. **API key ausente** — `delete process.env.ANTHROPIC_API_KEY` → r7 retorna `{ hasIssues: false, issues: [] }`

**Importación para test:** importar la función `r7HaikuSanityCheck` si es exportada,
o testear indirectamente via `validateNarrative` con un dataset que Haiku debería rechazar.
Si `r7HaikuSanityCheck` no es exportada, exportarla con `export` para poder testearla en aislamiento.

---

## Archivos creados/modificados

| Path | Acción |
|---|---|
| `lib/validate-narrative.js` | Modificar (reemplazar stub r7) |
| `app/api/narrative/route.js` | Modificar (importar lib, eliminar inline, actualizar flujo) |
| `__tests__/validate-narrative/r7-haiku.test.mjs` | Crear |
| `docs/superpowers/specs/2026-06-01-haiku-sanity-check.md` | Crear (este archivo) |

---

## Acceptance criteria

- `node --test '__tests__/validate-narrative/*.test.mjs'` → 5/5 passing
- `app/api/narrative/route.js` no contiene función inline `validateNarrative`
- `lib/validate-narrative.js` llama a Haiku (no stub)
- Haiku errors no bloquean la generación de narrativa
- Si Haiku detecta issues y el reintento también falla, la respuesta incluye `_validation_warning: true`

---

## Branch

```bash
git checkout main
git checkout -b feature/haiku-sanity-check
```

Commits incrementales:
1. `feat: implement r7HaikuSanityCheck in validate-narrative lib (Task 1.2a)`
2. `feat: integrate lib/validate-narrative into narrative route (Task 1.2b)`
3. `test: add r7 haiku sanity check unit tests (Task 1.2c)`
