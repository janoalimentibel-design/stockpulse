// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_KEY

if (!url || !key) {
  // El error aparece en los logs de Vercel, no llega al usuario
  console.error('[supabase] SUPABASE_URL o SUPABASE_KEY no configuradas. La caché no funcionará.')
}

// Si las vars no están, supabase queda null — cada función que lo use debe manejarlo
export const supabase = (url && key) ? createClient(url, key) : null
