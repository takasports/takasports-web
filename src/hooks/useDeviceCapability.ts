'use client'

import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// useDeviceCapability — el "gate" que permite añadir motion/3D/IA SIN
// ralentizar la gama baja (objetivo del rediseño "La Señal").
//
// Devuelve 'full' | 'lite'. En 'lite' la estructura de la web es IDÉNTICA,
// solo se apagan los efectos decorativos pesados. Se considera 'lite' cuando:
//   · el usuario pide menos movimiento (prefers-reduced-motion)
//   · el navegador señala ahorro de datos (Save-Data)
//   · la conexión es lenta (effectiveType slow-2g / 2g / 3g)
//   · el dispositivo tiene poca RAM (deviceMemory ≤ 4) o pocos núcleos (≤ 4)
//
// SSR-safe: por defecto 'full' (el HTML servido no cambia; el posible
// "downgrade" a 'lite' ocurre tras montar en cliente, nunca afecta al LCP).
// ─────────────────────────────────────────────────────────────────────────

export type DeviceCapability = 'full' | 'lite'

interface NavigatorConnection {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (type: 'change', cb: () => void) => void
  removeEventListener?: (type: 'change', cb: () => void) => void
}

function getConnection(): NavigatorConnection | undefined {
  if (typeof navigator === 'undefined') return undefined
  const n = navigator as Navigator & { connection?: NavigatorConnection }
  return n.connection
}

export function computeDeviceCapability(): DeviceCapability {
  if (typeof window === 'undefined') return 'full'

  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'lite'
  } catch { /* matchMedia no disponible */ }

  const conn = getConnection()
  if (conn?.saveData) return 'lite'
  if (conn?.effectiveType && /(?:^|-)(?:slow-2g|2g|3g)$/.test(conn.effectiveType)) return 'lite'

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem > 0 && mem <= 4) return 'lite'

  const cores = navigator.hardwareConcurrency
  if (typeof cores === 'number' && cores > 0 && cores <= 4) return 'lite'

  return 'full'
}

/**
 * Hook reactivo para componentes cliente que quieran montar (o no) un efecto
 * pesado. Reevalúa si cambia la conexión o la preferencia de movimiento.
 */
export function useDeviceCapability(): DeviceCapability {
  const [cap, setCap] = useState<DeviceCapability>('full')

  useEffect(() => {
    const update = () => setCap(computeDeviceCapability())
    update()

    let mq: MediaQueryList | undefined
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener?.('change', update)
    } catch { /* noop */ }

    const conn = getConnection()
    conn?.addEventListener?.('change', update)

    return () => {
      mq?.removeEventListener?.('change', update)
      conn?.removeEventListener?.('change', update)
    }
  }, [])

  return cap
}
