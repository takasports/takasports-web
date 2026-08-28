'use client'

// Cuándo se juega, en la zona horaria del usuario.
//
// La ficha NO lo decía en ninguna parte: ni fecha ni hora, solo la etiqueta
// "Programado". Comprobado en producción el 27/08/2026 buscando la hora en el
// HTML de un Racing–Elche del día siguiente: no aparecía. La app sí lo enseña
// ("Vie, 28 ago, 13:00"), así que además había disparidad entre plataformas.
//
// Va en cliente porque la zona vive en localStorage y la página es SSR: el
// servidor pinta la hora de Madrid (queda en el HTML, que es lo que ve Google) y
// al montar se ajusta a la zona elegida. De ahí el suppressHydrationWarning.

import { useEffect, useState } from 'react'
import { SOURCE_TZ, TZ_CHANGE_EVENT, getStoredTZ } from '@/lib/timezone'

export function Kickoff({ isoDate }: { isoDate: string }) {
  const [tz, setTz] = useState(SOURCE_TZ)

  useEffect(() => {
    setTz(getStoredTZ())
    const alCambiar = () => setTz(getStoredTZ())
    window.addEventListener(TZ_CHANGE_EVENT, alCambiar)
    return () => window.removeEventListener(TZ_CHANGE_EVENT, alCambiar)
  }, [])

  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null

  const texto = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)

  return (
    <span
      suppressHydrationWarning
      className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.04)',
        color: '#9A9AB0',
        border: '1px solid rgba(255,255,255,0.07)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {texto}
    </span>
  )
}
