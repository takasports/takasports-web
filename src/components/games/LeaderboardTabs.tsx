'use client'

// Sección "Top de la semana" con tabs entre los 5 juegos jugables.
// Cada tab usa el periodo "actual" según games-periods (daily / weekly /
// jornada). Striker Rush queda fuera (cadence 'none').

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import Leaderboard from './Leaderboard'
import { getGamePeriod } from '@/lib/games-periods'
import { trackGameEvent } from '@/lib/games-telemetry'
import type { GameId } from '@/lib/games-store'

interface TabSpec {
  id:     GameId
  label:  string
  accent: string
}

const TABS: TabSpec[] = [
  { id: 'quiniela',   label: 'Quiniela',  accent: '#A78BFA' },
  { id: 'crackquiz',  label: 'CrackQuiz', accent: '#FCD34D' },
  { id: 'mionce',     label: 'Mi Once',   accent: '#93C5FD' },
  { id: 'sopacracks', label: 'Sopa',      accent: '#6EE7B7' },
  { id: 'takagrid',   label: 'TakaGrid',  accent: '#FDBA74' },
]

interface Props {
  /** Jornada actual de Quiniela (e.g. "laliga-J38"). Si no se pasa,
   *  el tab Quiniela mostrará el ranking con periodo "unknown" (vacío). */
  quinielaJornada?: string
}

export default function LeaderboardTabs({ quinielaJornada }: Props) {
  const [active, setActive] = useState<GameId>('quiniela')

  const period = useMemo(
    () => getGamePeriod(active, quinielaJornada).period,
    [active, quinielaJornada],
  )
  const accent = TABS.find(t => t.id === active)?.accent ?? '#A78BFA'

  useEffect(() => {
    if (!period) return
    trackGameEvent({ gameId: active, event: 'leaderboard_view', period })
  }, [active, period])

  // Navegación por teclado del tablist (patrón WAI-ARIA tabs): flechas mueven
  // entre tabs y trasladan el foco al recién activado; Home/End a los extremos.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    const t = TABS[next]
    setActive(t.id)
    if (typeof document !== 'undefined') document.getElementById(`lbtab-${t.id}`)?.focus()
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="section-accent" />
          <h2 className="section-label">Rankings</h2>
        </div>
        <Link
          href={`/juegos/leaderboard/${active}`}
          className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          Ver completo →
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" role="tablist" aria-label="Rankings por juego">
        {TABS.map((t, idx) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              id={`lbtab-${t.id}`}
              role="tab"
              aria-selected={on}
              aria-controls="lbpanel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={e => onTabKeyDown(e, idx)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{
                background:   on ? `${t.accent}18` : 'rgba(255,255,255,0.03)',
                color:        on ? t.accent : '#5A5A7A',
                border:       on ? `1px solid ${t.accent}40` : '1px solid rgba(255,255,255,0.04)',
                fontFamily:   'var(--font-sport)',
                letterSpacing:'0.06em',
                cursor:       'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="lbpanel" aria-labelledby={`lbtab-${active}`} tabIndex={0} className="focus-visible:outline-none">
        <Leaderboard
          gameId={active}
          period={period}
          limit={10}
          accent={accent}
          // Quiniela usa la etiqueta humana de la jornada como periodo
          // ("Champions · LaLiga · Premier") — más larga que las semanas
          // ISO. Para el header usamos una versión normalizada estándar.
          periodLabel={active === 'quiniela' && period && period !== 'unknown' ? 'Jornada actual' : undefined}
        />
      </div>
    </section>
  )
}
