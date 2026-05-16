'use client'

// Badge dinámico que se renderiza dentro de las cards de /juegos.
// Reemplaza el badge estático "Disponible" cuando hay datos reales:
//   · loading     -> "Disponible" (igual que hoy, evita flicker)
//   · played      -> "Jugado · 87 pts · #142"
//   · not_played  -> "Cierra en 4h 12m" (si daily/weekly) o "Disponible"
//
// El countdown se refresca cada segundo solo si quedan < 1h; cada minuto
// si queda > 1h. Se monta lazy y respeta SSR.

import { useEffect, useState } from 'react'
import { useGameState } from '@/hooks/useGameState'
import { formatCountdown, type GamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'

interface Props {
  gameId:    GameId
  period:    GamePeriod
  /** Si true, usa estilo verde (disponible). Si false, neutro. */
  variant?:  'live' | 'coming'
}

export default function GameStatusBadge({ gameId, period, variant = 'live' }: Props) {
  const isLive = variant === 'live'
  const enabled = period.cadence !== 'none' && !!period.period

  // useGameState siempre se llama (regla de hooks); si no hay periodo,
  // pasamos una string vacía pero ignoramos el resultado.
  const { status, play, position } = useGameState(gameId, period.period || '_skip_')

  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (period.cadence === 'none') return
    const tick = () => setNow(Date.now())
    const remainingMs = period.nextResetMs - (Date.now() - now)
    const intervalMs  = remainingMs > 60 * 60_000 ? 60_000 : 1_000
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.cadence, period.nextResetMs])

  // Fallback simple si juego sin sesión / sin datos / sin periodo cerrable.
  if (!enabled) {
    return <DotBadge live={isLive} label="Disponible" />
  }

  // Durante la primera hidratación, skeleton neutro. Evita el flicker
  // verde "Disponible" → "Jugado · 87 pts · #142" que se veía como
  // recarga visible.
  if (status === 'loading') {
    return <SkeletonBadge />
  }

  if (status === 'played' && play) {
    const positionLabel = position ? ` · #${position}` : ''
    return (
      <span
        className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
        style={{
          background: 'rgba(34,197,94,0.12)',
          color: '#4ade80',
          border: '1px solid rgba(34,197,94,0.25)',
          fontFamily: 'var(--font-sport)',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6l3 3 5-5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Jugado · {play.score} pts{positionLabel}
      </span>
    )
  }

  // not_played con countdown
  const remaining = Math.max(0, period.nextResetMs - (Date.now() - now))
  const cd = formatCountdown(remaining)
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
      style={{
        background: 'rgba(124,58,237,0.12)',
        color: '#A78BFA',
        border: '1px solid rgba(124,58,237,0.25)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      <span className="w-1 h-1 rounded-full bg-purple-300 animate-pulse inline-block" />
      Cierra en {cd}
    </span>
  )
}

function SkeletonBadge() {
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border:     '1px solid rgba(255,255,255,0.06)',
        color:      'transparent',
        // ancho fijo para que el layout no se desplace al hidratar
        minWidth: 90,
      }}
      aria-hidden
    >
      <span className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
      <span style={{ opacity: 0 }}>Cargando</span>
    </span>
  )
}

function DotBadge({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
      style={{
        background: live ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
        color: live ? '#4ade80' : '#3A3A5A',
        border: live ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      {live && <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse inline-block" />}
      {label}
    </span>
  )
}
