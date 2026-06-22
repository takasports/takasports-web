'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { ScoreFlip } from './ScoreFlip'

// Estados ESPN considerados "en vivo" — espejo de page.tsx:LIVE_STATUSES.
const LIVE_STATUSES = new Set([
  'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF',
  'STATUS_END_PERIOD', 'STATUS_OVERTIME', 'STATUS_SHOOTOUT',
])
const isLiveStatus = (s: unknown) => typeof s === 'string' && LIVE_STATUSES.has(s)

export interface LiveScoreState {
  homeScore: number | null
  awayScore: number | null
  statusLabel: string
  live: boolean
}

const LiveScoreContext = createContext<LiveScoreState | null>(null)

// Proveedor del marcador en vivo. Sondea /api/match/<ref> (cacheado en CDN,
// s-maxage=15) cada 20s cuando el partido está EN VIVO o a punto de empezar, y
// expone el marcador/estado a los hijos (héroe + barra sticky). SUSTITUYE al
// router.refresh() cada 20s (que re-renderizaba TODO el árbol del servidor) por
// una actualización SOLO del marcador en el cliente. El comentario/stats/
// alineaciones siguen refrescando vía LiveRefresh, pero a 120s (más barato).
// Decide internamente si sondear usando la hora REAL del cliente (el render del
// servidor es ISR y su "ahora" puede venir atrasado).
export function LiveMatchProvider({
  matchRef,
  live,
  startDate,
  initial,
  children,
}: {
  matchRef: string
  live: boolean
  startDate?: string
  initial: LiveScoreState
  children: React.ReactNode
}) {
  const [state, setState] = useState<LiveScoreState>(initial)

  useEffect(() => {
    const shouldPoll = () => {
      if (live) return true
      if (!startDate) return false
      const startMs = Date.parse(startDate)
      if (Number.isNaN(startMs)) return false
      const now = Date.now()
      // Desde 2h antes hasta 30 min después del inicio (ventana de "casi en vivo").
      return now >= startMs - 2 * 3_600_000 && now <= startMs + 30 * 60_000
    }
    if (!shouldPoll()) return

    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/match/${matchRef}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const d = await res.json()
        if (!d || cancelled) return
        setState({
          homeScore: typeof d.homeScore === 'number' ? d.homeScore : null,
          awayScore: typeof d.awayScore === 'number' ? d.awayScore : null,
          statusLabel: typeof d.statusLabel === 'string' ? d.statusLabel : initial.statusLabel,
          live: isLiveStatus(d.status),
        })
      } catch {
        /* mantiene el valor previo: nunca rompe el marcador */
      }
    }

    tick()
    const id = setInterval(tick, 20_000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [matchRef, live, startDate, initial.statusLabel])

  return <LiveScoreContext.Provider value={state}>{children}</LiveScoreContext.Provider>
}

// Marcador vivo del context, o null si no hay proveedor (los consumidores caen a
// sus valores iniciales = comportamiento previo, sin riesgo).
export function useLiveScore(): LiveScoreState | null {
  return useContext(LiveScoreContext)
}

// Centro del marcador del héroe (TeamScoreboard). Lee el estado vivo del context
// —sembrado con los valores del servidor, así el SSR es idéntico— y se actualiza
// solo en cliente. Réplica EXACTA del bloque que vivía inline en page.tsx; si no
// hubiera context (no debería), cae a los valores iniciales de props.
export function HeroLiveCenter({
  accent,
  initialHomeScore,
  initialAwayScore,
  initialStatusLabel,
  initialLive,
}: {
  accent: string
  initialHomeScore: number | null
  initialAwayScore: number | null
  initialStatusLabel: string
  initialLive: boolean
}) {
  const ctx = useContext(LiveScoreContext)
  const homeScore = ctx ? ctx.homeScore : initialHomeScore
  const awayScore = ctx ? ctx.awayScore : initialAwayScore
  const statusLabel = ctx ? ctx.statusLabel : initialStatusLabel
  const live = ctx ? ctx.live : initialLive
  const hasScore = homeScore != null && awayScore != null

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      {live && (
        <span className="flex items-center gap-1.5 leading-none">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] tabular-nums" style={{ color: '#EF4444', fontFamily: 'var(--font-sport)' }}>
            {statusLabel}
          </span>
        </span>
      )}
      {hasScore ? (
        <ScoreFlip home={homeScore!} away={awayScore!} variant="hero" />
      ) : (
        // "VS" broadcast: diagonal + acento del DEPORTE (no de los clubes,
        // que los datos no traen → no inventamos colores). Gesto de cartel.
        <div className="relative flex items-center justify-center" style={{ width: 'clamp(46px, 13vw, 68px)', height: 'clamp(38px, 9vw, 50px)' }}>
          <span aria-hidden="true" className="absolute" style={{ width: 2.5, height: '128%', background: `linear-gradient(${accent}, ${accent}00)`, transform: 'rotate(22deg)', borderRadius: 2, opacity: 0.6 }} />
          <span className="relative font-black italic"
            style={{ color: accent, fontFamily: 'var(--font-headline)', fontSize: 'clamp(26px, 6vw, 38px)', lineHeight: 1, textShadow: `0 2px 14px ${accent}45` }}>
            VS
          </span>
        </div>
      )}
      {!live && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded"
          style={{
            color: '#7A7A8E',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'var(--font-sport)',
          }}>
          {statusLabel}
        </span>
      )}
    </div>
  )
}
