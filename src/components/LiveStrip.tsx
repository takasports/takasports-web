'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { LiveEventCard, UpcomingEventCard, type LiveFixture, type UpcomingEvent } from '@/components/events/LiveEventCard'
// Fuente ÚNICA de "en juego" (denylist). Incluye 'Final' y también PRE_GAME/DELAYED/
// RAIN_DELAY, que la lista-permiso anterior no cubría (colaban como "en vivo").
import { isLiveStatus } from '@/lib/live-events'
import { filterByFollowed } from '@/lib/calendar-curate'
import { useFollowedSports } from '@/lib/useFollowedSports'

function useRelativeTime(ts: number | null): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!ts) { setLabel(''); return }
    const update = () => {
      const diff = Math.floor((Date.now() - ts) / 1000)
      if (diff < 60)        setLabel(`hace ${diff}s`)
      else if (diff < 3600) setLabel(`hace ${Math.floor(diff / 60)}m`)
      else                  setLabel(`hace ${Math.floor(diff / 3600)}h`)
    }
    update()
    const id = setInterval(update, 15_000)
    return () => clearInterval(id)
  }, [ts])
  return label
}

// Separador vertical inline entre eventos
function Sep() {
  return (
    <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)', flexShrink: 0, display: 'inline-block' }} />
  )
}

export default function LiveStrip({
  onLiveChange,
}: {
  /** Avisa de si hay algún partido EN JUEGO. La consola lo usa para enseñar
   *  una sola tira: con directo, «Último momento» se retira. */
  onLiveChange?: (hayDirecto: boolean) => void
} = {}) {
  const [liveFixtures, setLiveFixtures] = useState<LiveFixture[]>([])
  const [upcoming,     setUpcoming]     = useState<UpcomingEvent[]>([])
  const [fetchedAt,    setFetchedAt]    = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { sports: followedSports } = useFollowedSports()

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const all: LiveFixture[] = await res.json()

      // Solo eventos realmente en juego (excluir FT, NS, etc.)
      const live = all.filter(f => isLiveStatus(f.status))

      // Deduplicar por id → fallback a homeTeam|awayTeam
      const seen = new Set<string>()
      setLiveFixtures(live.filter(f => {
        const k = f.id || `${f.homeTeam}|${f.awayTeam}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      }))
      setFetchedAt(Date.now())
    } catch { /* ignore */ }
  }, [])

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch('/api/events/upcoming', { cache: 'no-store' })
      if (!res.ok) return
      setUpcoming(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchLive()
    fetchUpcoming()
  }, [fetchLive, fetchUpcoming])

  // Nota: LiveStrip ("En directo") se mantiene SIEMPRE visible al scrollear; el que
  // se oculta al bajar es "Último momento" (BreakingNewsBar). [José Tomás, 2026-07-20]

  // Polling con pausa cuando la pestaña no está visible.
  useEffect(() => {
    const interval = liveFixtures.length > 0 ? 30_000 : 300_000

    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => { fetchLive(); fetchUpcoming() }, interval)
    }
    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    const onVisibility = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { fetchLive(); fetchUpcoming(); start() }
      else stop()
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [liveFixtures.length, fetchLive, fetchUpcoming])

  const isLive   = liveFixtures.length > 0
  useEffect(() => { onLiveChange?.(isLive) }, [isLive, onLiveChange])
  const ageLabel = useRelativeTime(fetchedAt)
  // Prioridad: eventos en vivo > próximos destacados con hora
  const stripMode: 'live' | 'upcoming' = isLive ? 'live' : 'upcoming'
  // Personalización: los PRÓXIMOS se filtran por los deportes seguidos (el Mundial
  // entra igual; sin nada seguido → todos). Los DIRECTOS se muestran siempre.
  const curatedUpcoming = filterByFollowed(upcoming, { deportesSeguidos: [...followedSports] })

  return (
    // Una tira de 40 px (maqueta 1 de noviembre). En móvil enseña UN solo
    // partido —el directo si lo hay, si no el próximo— y la pastilla; el resto
    // de eventos sale a partir de 768 px. Letras: 11 px los rótulos, 13 los
    // nombres, 14 la hora (antes 8, 10 y 9: ilegibles en un teléfono real).
    <div
      role="region"
      aria-label={isLive ? 'Marcadores en vivo' : 'Próximos partidos'}
      aria-live="polite"
      aria-atomic="false"
      className="w-full"
      style={{
        background: 'rgba(9,9,15,0.92)',
        borderBottom: '1px solid var(--border)',
        height: 40,
        overflow: 'hidden',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
        <div className="flex items-center h-10 gap-2.5 md:gap-3">

          {/* Pastilla — EN DIRECTO / PRÓXIMO */}
          <div
            className="flex items-center gap-1.5 flex-shrink-0 rounded-md"
            style={{
              height: 22,
              padding: '0 8px',
              background: isLive ? 'rgba(255,77,46,0.16)' : 'rgba(124,58,237,0.18)',
              border: `1px solid ${isLive ? 'rgba(255,77,46,0.32)' : 'rgba(124,58,237,0.28)'}`,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: isLive ? 'var(--color-live)' : 'var(--purple)',
                boxShadow:  isLive ? '0 0 6px var(--color-live)' : '0 0 6px var(--purple)',
              }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap"
              style={{
                color: isLive ? 'var(--color-live)' : 'var(--text-primary)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {isLive ? 'En directo' : 'Próximo'}
            </span>
          </div>

          {/* Eventos. El primero siempre; los demás solo en escritorio. Cada uno
              va con flex-shrink:0 y sin recortes: el «Ho» de «Hoy» (V-03) venía
              de un contenedor con overflow que se comía el final. */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {stripMode === 'live'
              ? liveFixtures.slice(0, 8).map((fix, i) => (
                  <div key={`${fix.id}-${i}`} className={`${i > 0 ? 'hidden md:flex' : 'flex'} items-center gap-3 flex-shrink-0`}>
                    {i > 0 && <Sep />}
                    <LiveEventCard fix={fix} />
                  </div>
                ))
              : curatedUpcoming.slice(0, 6).map((ev, i) => (
                  <div key={`${ev.id}-${i}`} className={`${i > 0 ? 'hidden md:flex' : 'flex'} items-center gap-3 flex-shrink-0`}>
                    {i > 0 && <Sep />}
                    <UpcomingEventCard ev={ev} />
                  </div>
                ))
            }
          </div>

          {/* CTA + frescura */}
          <div className="ml-auto flex-shrink-0 flex items-center gap-2">
            {ageLabel && isLive && (
              <span
                className="hidden md:block text-[11px] tabular-nums"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                title="Última actualización de marcadores"
              >
                {ageLabel}
              </span>
            )}
            <Link href="/calendario" className="flex items-center gap-1 whitespace-nowrap transition-opacity hover:opacity-70" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Ver calendario
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
