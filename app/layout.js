import './globals.css'
import { PostHogProvider } from '../components/PostHogProvider'

export const metadata = {
  title: 'StockPulse — Análisis de acciones en segundos',
  description: 'Análisis técnico y fundamental de acciones en español para el inversor hispanoparlante.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <footer className="text-center py-4 text-[11px]" style={{ color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
          StockPulse es solo informativo. No somos asesores financieros registrados.
        </footer>
      </body>
    </html>
  )
}
