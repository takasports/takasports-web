'use client'

import { useEffect } from 'react'
import { TZ_KEY, TZ_SOURCE_KEY, setStoredTZ, getStoredTZSource } from '@/lib/timezone'

/**
 * Detecta la zona horaria del browser y la mantiene sincronizada con
 * localStorage + cookie. Si el usuario eligió una TZ a mano en el selector
 * (source='manual'), se respeta. Si la guardada es 'auto' o no tiene marca
 * de origen (visitas previas a este sistema), se re-detecta y actualiza
 * cuando el navegador reporta una TZ distinta — así un caché viejo de
 * `Europe/London` se corrige al volver a Madrid.
 */
export default function AutoTZInit() {
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!detected) return

      const stored = localStorage.getItem(TZ_KEY)
      const source = getStoredTZSource()

      if (source === 'manual') return

      if (stored !== detected) {
        setStoredTZ(detected, 'auto')
      } else if (!localStorage.getItem(TZ_SOURCE_KEY)) {
        localStorage.setItem(TZ_SOURCE_KEY, 'auto')
      }
    } catch { /* noop — Safari privado, SSR */ }
  }, [])

  return null
}
