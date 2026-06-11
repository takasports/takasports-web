'use client'

import { useEffect } from 'react'
import { computeDeviceCapability } from '@/hooks/useDeviceCapability'

// Marca <html data-cap="full|lite"> tras montar para que el CSS pueda gatear
// los efectos decorativos pesados sin JS:
//   html[data-cap="full"] .mi-efecto { /* solo aquí */ }
// No afecta al HTML inicial (SSR) ni al LCP: corre después de la hidratación,
// y los efectos viven por debajo del pliegue. Reevalúa si cambia la conexión
// o la preferencia de movimiento. Devuelve null (no pinta nada).
export default function DeviceCapInit() {
  useEffect(() => {
    const apply = () => {
      try {
        document.documentElement.dataset.cap = computeDeviceCapability()
      } catch { /* noop */ }
    }
    apply()

    let mq: MediaQueryList | undefined
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener?.('change', apply)
    } catch { /* noop */ }

    const conn = (navigator as Navigator & {
      connection?: { addEventListener?: (t: 'change', cb: () => void) => void; removeEventListener?: (t: 'change', cb: () => void) => void }
    }).connection
    conn?.addEventListener?.('change', apply)

    return () => {
      mq?.removeEventListener?.('change', apply)
      conn?.removeEventListener?.('change', apply)
    }
  }, [])

  return null
}
