/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Evita que el navegador "adivine" el tipo de archivo — previene ataques MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Impide que la app se muestre dentro de un iframe en otro sitio (anti-clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },

  // Activa el filtro XSS del navegador en browsers legacy
  { key: 'X-XSS-Protection', value: '1; mode=block' },

  // Controla cuánta info de la URL actual se envía al hacer requests a terceros
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Deshabilita acceso a hardware sensible que esta app no necesita
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

  // Content Security Policy: declara exactamente qué puede cargar y ejecutar el navegador.
  // 'unsafe-inline' y 'unsafe-eval' son requeridos por Next.js en su modo actual.
  // connect-src lista explícitamente las APIs externas que la app puede llamar desde el navegador.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://eu.posthog.com https://eu.i.posthog.com https://app.posthog.com https://us.i.posthog.com",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
