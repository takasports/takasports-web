'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export default function BackButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()

  const handleBack = useCallback(() => {
    // Si hay un referrer interno → ir atrás en la historia
    // Si no (acceso directo, bookmark, etc.) → fallback a /noticias
    const isInternal =
      typeof document !== 'undefined' &&
      document.referrer.length > 0 &&
      document.referrer.includes(window.location.hostname)

    if (isInternal && window.history.length > 1) {
      router.back()
    } else {
      router.push('/noticias')
    }
  }, [router])

  if (compact) {
    // Solo el icono, para la fila de metadatos del móvil. 32 px de diana táctil.
    return (
      <button
        onClick={handleBack}
        aria-label="Volver"
        className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
        style={{ width: 32, height: 32, marginLeft: -8, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )
  }

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Volver
    </button>
  )
}
