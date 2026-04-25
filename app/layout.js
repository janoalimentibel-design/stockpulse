import './globals.css'

export const metadata = {
  title: 'StockPulse — Análisis de acciones en segundos',
  description: 'Análisis técnico y fundamental de acciones en español para el inversor hispanoparlante.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
