'use client'

// Reto del día — acceso compacto en la portada que lleva de UN toque al primer
// juego diario pendiente de hoy (o a /juegos si ya están los 4 hechos).
// Reutiliza la misma lógica que "Tu día Taka" del hub (useMyPlayedGames +
// getGamePeriod). 0 KB de librerías, sin tocar la base de datos.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMyPlayedGames } from '@/hooks/useMyPlayedGames'
import { getGamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'

// Solo los juegos DIARIOS: el "Reto del día" cuenta atrás en horas y dice
// "vuelve mañana". Sopa de Cracks y Mi Once son SEMANALES (resetean el lunes),
// así que no encajan aquí — se juegan desde el hub /juegos.
const TILES: { id: GameId; name: string; href: string }[] = [
  { id: 'crackquiz',  name: 'CrackQuiz',      href: '/crackquiz' },
  { id: 'takagrid',   name: 'TakaGrid',       href: '/takagrid' },
]

function fmtCountdown(ms: number): string {
  if (ms <= 0) return ''
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export default function RetoDelDia() {
  const played = useMyPlayedGames()
  // La cuenta atrás depende de la hora actual → solo se pinta tras montar para
  // no provocar desajuste de hidratación (SSR vs cliente).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const doneCount = TILES.filter(t => played.has(t.id)).length
  const firstPending = TILES.find(t => !played.has(t.id))
  const allDone = doneCount === TILES.length

  const cdTarget = firstPending ?? TILES[0]
  const countdown = mounted ? fmtCountdown(getGamePeriod(cdTarget.id).nextResetMs) : ''

  const ctaHref = allDone ? '/juegos' : (firstPending?.href ?? '/juegos')
  const ctaLabel = allDone ? 'Ver juegos' : 'Jugar ahora'

  return (
    <Link
      href={ctaHref}
      aria-label={allDone ? 'Reto del día completado — ver juegos' : `Jugar el reto del día${firstPending ? `: ${firstPending.name}` : ''}`}
      className="group flex items-center gap-3 sm:gap-4 rounded-2xl p-4 mb-3 transition-all hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(110deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.06) 100%)',
        border: '1px solid rgba(124,58,237,0.4)',
        textDecoration: 'none',
      }}
    >
      {/* Icono — diana (acertar el reto) */}
      <span
        aria-hidden
        className="flex-shrink-0 flex items-center justify-center rounded-xl"
        style={{ width: 44, height: 44, background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.4)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="12" cy="12" r="0.7" fill="#A78BFA" />
        </svg>
      </span>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
          Reto del día · Hoy
        </p>
        <p className="text-sm sm:text-base font-black mt-0.5 truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          {allDone ? `¡Completado! ${TILES.length} de ${TILES.length}` : `Llevas ${doneCount} de ${TILES.length}`}
          {!allDone && countdown && (
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}> · cierra en {countdown}</span>
          )}
          {allDone && (
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}> · vuelve mañana</span>
          )}
        </p>
        {/* Puntos de progreso */}
        <div className="flex gap-1.5 mt-2" aria-hidden>
          {TILES.map((t, i) => (
            <span
              key={t.id}
              style={{ width: 22, height: 5, borderRadius: 999, background: i < doneCount ? '#3DF06B' : 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <span
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.12em] transition-transform group-hover:translate-x-0.5"
        style={{ background: '#7C3AED', color: '#fff', fontFamily: 'var(--font-sport)' }}
      >
        {ctaLabel}
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 5.5h6.5M5.5 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  )
}
