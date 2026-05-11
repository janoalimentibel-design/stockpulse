'use client'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import MoversSection from '../../components/MoversSection'

export default function MovimientosPage() {
  const router = useRouter()
  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main className="max-w-[900px] mx-auto px-5 pb-20 pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Movimientos del día
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            Hacé clic en cualquier acción para ver el análisis completo.
          </p>
        </div>
        <MoversSection onSelect={ticker => router.push(`/?ticker=${ticker}`)} />
      </main>
    </div>
  )
}
