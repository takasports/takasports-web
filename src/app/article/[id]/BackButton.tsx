'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export default function BackButton() {
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
