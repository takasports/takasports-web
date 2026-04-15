'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log en desarrollo; en producción conectar a Sentry u otro servicio
    console.error('[TakaSports error]', error)
  }, [error])

  return (
    <div
      style={{ background: 'var(--bg-base)', minHeight: '100vh' }}
      className="flex flex-col items-center justify-center px-6 text-center gap-6"
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 8v7M14 18v2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <circle cx="14" cy="14" r="12" stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h1
          className="font-black"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
            color: '#F0F0F5',
            letterSpacing: '-0.01em',
          }}
        >
          Algo salió mal
        </h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
          No se pudo cargar este contenido. Puede ser un problema temporal.
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
            letterSpacing: '0.06em',
            boxShadow: '0 4px 18px rgba(124,58,237,0.3)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-muted)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
