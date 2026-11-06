'use client'

// Salida al calendario en la página de la tarjeta roja. Esa página recibe casi la
// mitad de los clics de Google porque mucha gente busca con ese nombre dónde ver un
// partido, y se marchaba sin nada. Se ofrece el calendario legal; nunca se nombran
// otras webs. Ver el informe del 06/11/2026.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { trackOferta } from '@/lib/analytics'
import { useVistoUnaVez } from '@/lib/use-visto-una-vez'

export default function SalidaPartidosHoy() {
  const ref = useRef<HTMLDivElement>(null)
  const [href, setHref] = useState('/calendario')
  useVistoUnaVez(ref, () => trackOferta({ oferta: 'salida_glosario', accion: 'visto', origen: 'tarjeta_roja' }))

  // La página es estática: el día se calcula en el navegador, en hora de España.
  useEffect(() => {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
    setHref(`/calendario/dia/${dia}`)
  }, [])

  return (
    <div
      ref={ref}
      className="mb-8 flex flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ maxWidth: 680, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="min-w-0">
        <p className="text-[16px] font-black leading-tight" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          ¿Buscas los partidos de hoy?
        </p>
        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Horarios en tu hora y dónde verlos.
        </p>
      </div>
      <Link
        href={href}
        prefetch={false}
        onClick={() => trackOferta({ oferta: 'salida_glosario', accion: 'pulsado', origen: 'tarjeta_roja' })}
        className="flex-shrink-0 rounded-xl px-4 py-2.5 text-center text-[14px] font-bold no-underline"
        style={{ background: '#7C3AED', color: '#FFFFFF', fontFamily: 'var(--font-sport)' }}
      >
        Ver los partidos de hoy
      </Link>
    </div>
  )
}
