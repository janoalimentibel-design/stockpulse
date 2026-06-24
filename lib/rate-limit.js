// lib/rate-limit.js
import { supabase } from '@/lib/supabase'

// Límites por endpoint — ajustar cuando haya datos reales de uso
const LIMITS = {
  'narrative':     { max: 10, windowMinutes: 60 },  // 10 análisis por hora por IP
  'market-data':   { max: 30, windowMinutes: 60 },  // 30 datos por hora (cuida cuota Polygon)
  'price-history': { max: 60, windowMinutes: 60 },
  'search-ticker': { max: 60, windowMinutes: 60 },
  'events':        { max: 20, windowMinutes: 60 },  // 20 búsquedas/hora (caché 6h reduce llamadas reales)
}

/**
 * Extrae la IP real del request en Vercel.
 * x-forwarded-for puede tener múltiples IPs separadas por coma — la primera es la del cliente.
 */
export function getIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || '0.0.0.0'
}

/**
 * Verifica si la IP puede hacer una request al endpoint dado.
 * Devuelve { allowed: true } o { allowed: false, retryAfter: segundos }.
 * 
 * Si Supabase no está disponible, siempre permite (fail open).
 * Nunca bloquea por error de infraestructura.
 */
export async function checkRateLimit(ip, endpoint) {
  if (!supabase) return { allowed: true }

  const limit = LIMITS[endpoint]
  if (!limit) return { allowed: true }

  const windowStart = new Date(Date.now() - limit.windowMinutes * 60 * 1000).toISOString()

  try {
    // Contar requests de esta IP en la ventana de tiempo
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart)

    if (error) {
      console.error('[rate-limit] Error consultando Supabase:', error.message)
      return { allowed: true } // fail open
    }

    if (count >= limit.max) {
      return { allowed: false, retryAfter: limit.windowMinutes * 60 }
    }

    // Registrar la request actual
    await supabase.from('rate_limits').insert({
      ip,
      endpoint,
      created_at: new Date().toISOString(),
    })

    // Limpieza periódica: borrar registros viejos (no bloquea la respuesta)
    supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .then(() => {})
      .catch(() => {})

    return { allowed: true }
  } catch (err) {
    console.error('[rate-limit] Error inesperado:', err?.message)
    return { allowed: true } // nunca bloquear por error de infraestructura
  }
}
