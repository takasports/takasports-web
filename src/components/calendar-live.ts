'use client'

// Tipos y hooks de datos EN VIVO del calendario (polling visible, fixtures y marcadores).
// Extraído del monolito CalendarioContent.

import { useCallback, useEffect, useState } from 'react'
import type { SportEvent } from '@/lib/types'
import { namesMatch } from '@/lib/calendar'
import { isLiveStatus } from '@/lib/live-events'

export interface RawLiveFixture {
  id: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  sport: string
  comp?: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homePhoto?: string
  awayPhoto?: string
  matchRef?: string
  clock?: string
}

export interface LiveScore {
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  clock?: string   // current set score for tennis e.g. "4-2"
}


// Modo Destacados: cuántos partidos mostrar por día.
//   · MIN  → mínimo garantizado aunque el día sea flojo.
//   · ELITE→ umbral de "cartel top": en días de Mundial/Champions casi todos los
//            partidos llegan a 12, así que se muestran todos (no se cortan a 4).
//   · MAX  → tope de seguridad para días desbordados (amistosos masivos, etc.).

// ─── Hooks ────────────────────────────────────────────────────────────────
// Helper: ejecuta `tick` cada `ms` solo cuando la pestaña está visible.
// Al volver de oculto-a-visible hace un fetch inmediato.
export function useVisiblePolling(tick: () => void, ms: number) {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!timer) timer = setInterval(tick, ms) }
    const stop  = () => { if (timer) { clearInterval(timer); timer = null } }
    const onVis = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { tick(); start() } else { stop() }
    }
    tick()
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [tick, ms])
}

// Caché compartida a nivel módulo: ambos hooks (useLiveFixtures y useLiveScores)
// consumen los mismos datos del endpoint /api/events/live. Sin esto, montar
// CalendarioContent dispara DOS fetch idénticos cada 30s (uno por hook), con
// posibles races al actualizar estado. Con la caché, una sola request alimenta
// a ambos hooks.
let _liveCache: { data: RawLiveFixture[]; ts: number } | null = null
let _liveInflight: Promise<RawLiveFixture[]> | null = null
export const LIVE_CACHE_TTL = 15_000  // 15s: cubre el solapamiento entre los dos hooks

async function fetchLiveSharedCached(): Promise<RawLiveFixture[]> {
  const now = Date.now()
  if (_liveCache && now - _liveCache.ts < LIVE_CACHE_TTL) return _liveCache.data
  if (_liveInflight) return _liveInflight
  _liveInflight = (async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return _liveCache?.data ?? []
      const data: RawLiveFixture[] = await res.json()
      _liveCache = { data, ts: Date.now() }
      return data
    } catch {
      return _liveCache?.data ?? []
    } finally {
      _liveInflight = null
    }
  })()
  return _liveInflight
}

// Cadencia del polling: 30s con partidos en juego, 60s sin ellos. La mayor
// parte del día no hay nada en vivo → la mitad de peticiones sin que se note.
export function livePollMs(data: RawLiveFixture[]): number {
  return data.some(f => isLiveStatus(f.status)) ? 30_000 : 60_000
}

export function useLiveFixtures() {
  const [fixtures, setFixtures] = useState<RawLiveFixture[]>([])
  const [pollMs, setPollMs] = useState(30_000)

  const fetch_ = useCallback(async () => {
    const data = await fetchLiveSharedCached()
    setFixtures(data.filter(f => isLiveStatus(f.status)))
    setPollMs(livePollMs(data))
  }, [])

  useVisiblePolling(fetch_, pollMs)

  return fixtures
}

export function useLiveScores(events: SportEvent[]) {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map())
  const [pollMs, setPollMs] = useState(30_000)

  const fetch_ = useCallback(async () => {
    try {
      const fixtures = await fetchLiveSharedCached()
      setPollMs(livePollMs(fixtures))
      const byRef = new Map<string, RawLiveFixture>()
      for (const f of fixtures) if (f.matchRef) byRef.set(f.matchRef, f)
      const next = new Map<string, LiveScore>()
      for (const ev of events) {
        // Primario: matchRef (clave exacta). Fallback por nombre SOLO si es
        // INEQUÍVOCO (una única fixture casa): con substring varias podían
        // casar y se pegaba el marcador al partido equivocado.
        let m = (ev.matchRef && byRef.get(ev.matchRef)) || undefined
        if (!m) {
          const cands = fixtures.filter(f => namesMatch(f.homeTeam, ev.home) && namesMatch(f.awayTeam, ev.away ?? ''))
          if (cands.length === 1) m = cands[0]
        }
        if (m) {
          next.set(ev.id, {
            homeGoals: m.homeGoals,
            awayGoals: m.awayGoals,
            status:    m.status,
            elapsed:   m.elapsed,
            clock:     m.clock,
          })
        }
      }
      setScores(next)
    } catch { /* ignore */ }
  }, [events])

  useVisiblePolling(fetch_, pollMs)

  return scores
}
