import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-[64px] font-black leading-none mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.06)' }}>404</div>
      <h1 className="text-xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Liga no encontrada
      </h1>
      <p className="text-[13px] text-[#5A5A6A] mb-8">
        La liga que buscas no está disponible.
      </p>
      <Link href="/estadisticas?sport=futbol"
        className="px-5 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-wide"
        style={{ background: 'rgba(124,58,237,0.2)', color: '#C4B5FD',
          border: '1px solid rgba(124,58,237,0.3)', fontFamily: 'var(--font-sport)' }}>
        Ver estadísticas
      </Link>
    </div>
  )
}
