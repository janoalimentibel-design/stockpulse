import './globals.css'

export const metadata = {
  title: 'StockPulse — Análisis de acciones en español',
  description: 'Análisis técnico y fundamental de acciones en español. Veredicto, narrativa IA, gráfico histórico y noticias en 15 segundos.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
