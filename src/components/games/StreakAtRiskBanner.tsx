'use client'

// Banner de urgencia: aparece cuando el usuario lleva 2+ días de racha
// activa y aún NO ha jugado nada hoy. Se oculta si:
//  - No hay racha relevante (current < 2)
//  - Ya ha jugado hoy (lastPlayedDate === today)
//  - El usuario lo cerró hoy (persistido en localStorage)
//
// Es client-only (lee localStorage) y self-contained.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadMeta, onMetaChange } from '@/lib/meta-progression'

const HIDE_KEY = 'taka-streak-banner-hidden-on'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function StreakAtRiskBanner() {
  // 'pending' antes del primer effect — evita flash y mismatch SSR/CSR.
  const [decision, setDecision] = useState<'pending' | 'show' | 'hide'>('pending')
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const evaluate = () => {
      const meta = loadMeta()
      const today = todayKey()
      const atRisk = meta.streak.current >= 2 && meta.streak.lastPlayedDate !== today
      const hidden = (() => {
        try { return window.localStorage.getItem(HIDE_KEY) === today } catch { return false }
      })()
      setStreak(meta.streak.current)
      setDecision(atRisk && !hidden ? 'show' : 'hide')
    }
    evaluate()
    const off = onMetaChange(evaluate)
    return off
  }, [])

  if (decision !== 'show') return null

  const handleHide = () => {
    try { window.localStorage.setItem(HIDE_KEY, todayKey()) } catch { /* ignore */ }
    setDecision('hide')
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-2xl flex items-center gap-3 sm:gap-4"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(252,211,77,0.06) 100%)',
        border: '1px solid rgba(239,68,68,0.35)',
        padding: 'var(--space-md) var(--space-lg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 28,
          lineHeight: 1,
          flexShrink: 0,
          filter: 'drop-shadow(0 0 12px rgba(252,211,77,0.45))',
        }}
      >
        🔥
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="section-label"
          style={{ color: '#FCA5A5', marginBottom: 4 }}
        >
          Racha en riesgo
        </p>
        <p
          style={{
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.45,
            fontWeight: 600,
          }}
        >
          Llevas <strong style={{ color: '#FCD34D' }}>{streak} días seguidos</strong>. Juega cualquiera de hoy
          antes de medianoche para no romperla.
        </p>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <Link
          href="/crackquiz"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 14px',
            background: 'var(--purple)',
            color: '#fff',
            border: '1px solid var(--purple)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sport)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Jugar ahora
        </Link>
        <button
          type="button"
          onClick={handleHide}
          aria-label="Ocultar este aviso hasta mañana"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
          style={{
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid transparent',
            fontFamily: 'var(--font-sport)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Hoy no
        </button>
      </div>
    </div>
  )
}
