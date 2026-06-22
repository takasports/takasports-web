'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiveRefresh({
  isLive,
  startDate,
  liveIntervalMs = 20_000,
}: {
  isLive: boolean
  startDate?: string
  // Cadencia del refresco EN VIVO. En el camino de fútbol/baloncesto se sube a
  // 120s porque el MARCADOR ya se actualiza solo client-side (LiveScore.tsx) y
  // este refresco solo cubre comentario/stats/alineaciones (más barato). En el
  // resto de deportes (tenis/MMA/carrera) se queda en 20s (no hay sondeo de
  // marcador): este router.refresh() es su única vía de frescura en directo.
  liveIntervalMs?: number
}) {
  const router = useRouter()
  useEffect(() => {
    // Cadencia de auto-refresco:
    //  • EN VIVO → liveIntervalMs (20s por defecto; 120s donde hay sondeo).
    //  • POR EMPEZAR (de ~2h antes a 30min tras el saque) → 60s, para que las
    //    ALINEACIONES de ESPN (que se publican ~1h antes del saque) y el paso a
    //    "en vivo" aparezcan sin que el usuario tenga que recargar.
    let interval = 0
    if (isLive) {
      interval = liveIntervalMs
    } else if (startDate) {
      const startMs = Date.parse(startDate)
      if (!Number.isNaN(startMs)) {
        const now = Date.now()
        if (now >= startMs - 2 * 3_600_000 && now <= startMs + 30 * 60_000) interval = 60_000
      }
    }
    if (!interval) return

    let id: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!id) id = setInterval(() => router.refresh(), interval) }
    const stop  = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { router.refresh(); start() } else { stop() }
    }
    // El render llega vía ISR y puede venir cacheado/atrasado: refresca ya al montar.
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      router.refresh()
      start()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [isLive, startDate, router, liveIntervalMs])
  return null
}
