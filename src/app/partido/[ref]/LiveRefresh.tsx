'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiveRefresh({ isLive, startDate }: { isLive: boolean; startDate?: string }) {
  const router = useRouter()
  useEffect(() => {
    // Cadencia de auto-refresco:
    //  • EN VIVO → 20s (marcador alineado con la barra "En vivo").
    //  • POR EMPEZAR (de ~2h antes a 30min tras el saque) → 60s, para que las
    //    ALINEACIONES de ESPN (que se publican ~1h antes del saque) y el paso a
    //    "en vivo" aparezcan sin que el usuario tenga que recargar.
    let interval = 0
    if (isLive) {
      interval = 20_000
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
  }, [isLive, startDate, router])
  return null
}
