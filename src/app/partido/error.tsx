'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureException } from '@/lib/monitoring'
import { StadiumIcon } from '@/components/icons/GameIcons'

export default function PartidoError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest, route: 'partido/[ref]' })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
      >
        <StadiumIcon size={26} />
      </div>
      <div className="flex flex-col gap-2">
        <h2
          className="font-black text-lg"
          style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5' }}
        >
          No se pudo cargar este partido
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Puede ser un problema temporal con la conexión.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#6025C0)',
            color: '#fff',
            fontFamily: 'var(--font-sport)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
        <Link
          href="/calendario"
          className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-muted)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'var(--font-sport)',
            textDecoration: 'none',
          }}
        >
          Ver calendario
        </Link>
      </div>
    </div>
  )
}
