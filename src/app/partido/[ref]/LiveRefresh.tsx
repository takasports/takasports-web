'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiveRefresh({ isLive }: { isLive: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!isLive) return
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!id) id = setInterval(() => router.refresh(), 30_000) }
    const stop  = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { router.refresh(); start() } else { stop() }
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [isLive, router])
  return null
}
