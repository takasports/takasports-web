import Link from 'next/link'
import { SearchIcon } from '@/components/icons/GameIcons'

export default function NotFound() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="mb-4 flex justify-center" style={{ color: '#7A7A92' }}><SearchIcon size={64} /></p>
        <h1 className="text-3xl sm:text-4xl font-black mb-3"
          style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          Entry no encontrada
        </h1>
        <p className="text-sm mb-6"
          style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
          Esta entrada del Ranking Taka no existe o aún no ha sido publicada.
          Puede que haya cambiado de slug o que la edición de este mes no la incluya.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/rankings"
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125"
            style={{
              background: 'rgba(124,58,237,0.12)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.3)',
              fontFamily: 'var(--font-sport)',
            }}>
            ← Volver a Rankings
          </Link>
          <Link
            href="/rankings/comparar"
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125"
            style={{
              background: 'rgba(34,211,238,0.1)',
              color: '#67e8f9',
              border: '1px solid rgba(34,211,238,0.3)',
              fontFamily: 'var(--font-sport)',
            }}>
            ⚖️ Ir al comparador
          </Link>
        </div>
      </div>
    </div>
  )
}
