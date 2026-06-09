'use client'

// Banner de urgencia: aparece cuando el usuario lleva 2+ días de racha
// y aún NO ha jugado hoy (día de Madrid). Lee la racha AUTORITATIVA del
// servidor (game_streaks vía useStreak) — antes leía la racha local del
// navegador, que podía divergir de la real. Se oculta si:
//  - No hay racha relevante (current < 2) o no hay sesión
//  - Ya ha jugado hoy (last_played_date === hoy en Madrid)
//  - El usuario lo cerró hoy (persistido en localStorage)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStreak } from '@/hooks/useGameState'
import { madridDayISO } from '@/lib/taka-time'

const HIDE_KEY = 'taka-streak-banner-hidden-on'

export default function StreakAtRiskBanner() {
  const { streak, loading } = useStreak()
  // undefined = aún no leído el flag de localStorage (evita flash SSR/CSR)
  const [hiddenOn, setHiddenOn] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let v: string | null = null
    try { v = window.localStorage.getItem(HIDE_KEY) } catch { /* ignore */ }
    setHiddenOn(v)
  }, [])

  // Esperar a tener racha del servidor Y el flag de "ocultado hoy".
  if (loading || !streak || hiddenOn === undefined) return null

  const today  = madridDayISO()
  const atRisk = streak.current_streak >= 2 && streak.last_played_date !== today
  if (!atRisk || hiddenOn === today) return null

  const handleHide = () => {
    const day = madridDayISO()
    try { window.localStorage.setItem(HIDE_KEY, day) } catch { /* ignore */ }
    setHiddenOn(day)
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
          Llevas <strong style={{ color: '#FCD34D' }}>{streak.current_streak} días seguidos</strong>. Juega cualquiera de hoy
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
