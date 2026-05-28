'use client'

import { useEffect } from 'react'
import { TZ_KEY } from '@/lib/timezone'

/**
 * Detecta la zona horaria del browser en la primera visita y la guarda
 * en localStorage + cookie antes de que cualquier componente de calendario
 * haga un fetch. Así el SSR de la siguiente petición ya usa la TZ real
 * del usuario, sin necesidad de que seleccione nada manualmente.
 */
export default function AutoTZInit() {
  useEffect(() => {
    try {
      if (localStorage.getItem(TZ_KEY)) return
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tz) return
      localStorage.setItem(TZ_KEY, tz)
      document.cookie = `${TZ_KEY}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
    } catch { /* noop — Safari privado, SSR */ }
  }, [])

  return null
}
