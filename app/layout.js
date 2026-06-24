import './globals.css'
import { PostHogProvider } from '../components/PostHogProvider'
import ThemeToggle from '../components/ThemeToggle'

export const metadata = {
  title: 'Tu Asesor Financiero — Análisis de acciones en segundos',
  description: 'Análisis técnico y fundamental de acciones en español para el inversor hispanoparlante.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')}catch(e){}` }} />
      </head>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <footer className="text-center py-4 text-[11px]" style={{ color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
          Tu Asesor Financiero es solo informativo. No somos asesores financieros registrados.
        </footer>
        <ThemeToggle />
      </body>
    </html>
  )
}
