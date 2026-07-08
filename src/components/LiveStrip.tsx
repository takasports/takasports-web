'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { LiveEventCard, UpcomingEventCard, type LiveFixture, type UpcomingEvent } from '@/components/events/LiveEventCard'
// Fuente ÚNICA de "en juego" (denylist). Incluye 'Final' y también PRE_GAME/DELAYED/
// RAIN_DELAY, que la lista-permiso anterior no cubría (colaban como "en vivo").
import { isLiveStatus } from '@/lib/live-events'

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

export default function LiveStrip() {
  const [liveFixtures, setLiveFixtures] = useState<LiveFixture[]>([])
  const [upcoming,     setUpcoming]     = useState<UpcomingEvent[]>([])
  const [hidden,       setHidden]       = useState(false)
  const [fetchedAt,    setFetchedAt]    = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastYRef = useRef(0)

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

  // Ocultar en scroll-down, mostrar en scroll-up (solo mobile)
  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 1024) { setHidden(false); return }
      const y = window.scrollY
      if (y < 40) { setHidden(false); lastYRef.current = y; return }
      setHidden(y > lastYRef.current + 4)
      lastYRef.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
  const ageLabel = useRelativeTime(fetchedAt)
  // Prioridad: eventos en vivo > próximos destacados con hora
  const stripMode: 'live' | 'upcoming' = isLive ? 'live' : 'upcoming'

  return (
    <div
      role="region"
      aria-label={isLive ? 'Marcadores en vivo' : 'Próximos partidos'}
      aria-live="polite"
      aria-atomic="false"
      className="w-full transition-all duration-300"
      style={{
        background: 'rgba(9,9,15,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        maxHeight: hidden ? 0 : 48,
        overflow: 'hidden',
        opacity: hidden ? 0 : 1,
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
        <div className="flex items-center h-10 gap-4 overflow-x-auto snap-strip" style={{ scrollbarWidth: 'none' }}>

          {/* Label pill — EN VIVO / PRÓXIMO */}
          <div
            className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded"
            style={
              isLive
                ? { background: 'rgba(255,77,46,0.14)', border: '1px solid rgba(255,77,46,0.32)' }
                : { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }
            }
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: isLive ? 'var(--color-live)' : '#7C3AED',
                boxShadow:  isLive ? '0 0 7px var(--color-live)' : '0 0 6px #7C3AED',
              }}
            />
            <span
              className="text-[8px] font-black uppercase tracking-[0.2em]"
              style={{
                color: isLive ? 'var(--color-live)' : '#9B6DB5',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {isLive ? 'En Directo' : 'Próximo'}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

          {/* Events */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {stripMode === 'live'
              ? liveFixtures.map((fix, i) => (
                  <div key={`${fix.id}-${i}`} className="flex items-center gap-3 flex-shrink-0">
                    {i > 0 && <Sep />}
                    <LiveEventCard fix={fix} />
                  </div>
                ))
              : upcoming.slice(0, 6).map((ev, i) => (
                  <div key={`${ev.id}-${i}`} className="flex items-center gap-3 flex-shrink-0">
                    {i > 0 && <Sep />}
                    <UpcomingEventCard ev={ev} />
                  </div>
                ))
            }
          </div>

          {/* CTA + freshness */}
          <div className="ml-auto flex-shrink-0 flex items-center gap-2">
            {ageLabel && isLive && (
              <span
                className="hidden md:block text-[8px] tabular-nums"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                title="Última actualización de marcadores"
              >
                {ageLabel}
              </span>
            )}
            <Link href="/calendario" className="flex items-center gap-1 transition-opacity hover:opacity-70" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Ver calendario
              </span>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M2 4.5h5M4.5 2.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
