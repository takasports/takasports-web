'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { nameMatch } from '@/lib/quiniela'
import { isoToLocalDate } from '@/lib/calendar'
import { useFollowedSports } from '@/lib/useFollowedSports'
import { getStoredTZ } from '@/lib/timezone'
import { convertEventTime, SOURCE_TZ } from '@/lib/timezone'

// ─────────────────────────────────────────────────────────────────────────────
// "Tu día" — el único bloque de la portada que sabe quién eres.
//
// Hasta el 03/09/2026 la portada era idéntica para todo el mundo aunque ya
// hubieras elegido deportes y equipos en el perfil, y lo tuyo (reto pendiente,
// tu Jornada) vivía en el bloque 9 de 12.
//
// Va DEBAJO de las noticias, no encima: decisión de José Tomás al aprobar la
// maqueta. La portada sigue abriendo con la actualidad; lo personal viene
// justo después.
//
// Solo se pinta si la persona ha elegido algo. A quien no ha elegido nada no se
// le enseña un bloque vacío ni una promesa: sigue viendo la portada de siempre.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PARTIDOS = 3

// `events` son los partidos de HOY ya filtrados en el servidor (ver page.tsx):
// aquí solo queda cruzarlos con los equipos favoritos, que viven en el navegador.
export default function TuDia({ events }: { events: SportEvent[] }) {
  const { sports: deportesSeguidos } = useFollowedSports()
  const [equipos, setEquipos] = useState<string[] | null>(null)
  const [tz, setTz] = useState<string | null>(null)

  // Equipos favoritos: lo local pinta al instante, la nube lo completa.
  // Mismo patrón que el filtro "Mis equipos" de LiveEventsSection.
  useEffect(() => {
    let cancelado = false
    let local: string[] = []
    try {
      const v = JSON.parse(localStorage.getItem('ts_favorites') ?? '[]')
      local = Array.isArray(v) ? v : []
    } catch { /* almacén bloqueado */ }
    setEquipos(local)
    setTz(getStoredTZ())
    fetch('/api/rankings/favorites', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { favorites: [] }))
      .then((j: { favorites?: { entry_id: string }[] }) => {
        if (cancelado) return
        const nube = (j.favorites ?? [])
          .map(f => f.entry_id)
          .filter(id => id.startsWith('team:'))
          .map(id => id.slice(5))
        setEquipos([...new Set([...local, ...nube])])
      })
      .catch(() => { /* nos quedamos con lo local */ })
    return () => { cancelado = true }
  }, [])

  const misPartidos = useMemo(() => {
    const favs = (equipos ?? []).filter(Boolean)
    if (favs.length === 0) return []
    const hoy = isoToLocalDate(new Date().toISOString())
    return events
      .filter(ev => ev.isoDate && isoToLocalDate(ev.isoDate) === hoy)
      .filter(ev => favs.some(t => (ev.home && nameMatch(t, ev.home)) || (ev.away && nameMatch(t, ev.away))))
      .slice(0, MAX_PARTIDOS)
  }, [events, equipos])

  // `equipos === null` = aún no se ha leído el almacén: no parpadeamos el bloque.
  if (equipos === null) return null
  const haElegidoAlgo = equipos.length > 0 || deportesSeguidos.size > 0
  if (!haElegidoAlgo) return null

  const hoyLargo = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section aria-labelledby="tu-dia-titulo" className="mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2 id="tu-dia-titulo" className="section-label">Tu día</h2>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}>
          {hoyLargo}
        </span>
      </div>

      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: 'linear-gradient(160deg, rgba(124,58,237,0.09), var(--bg-card))',
          border: '1px solid rgba(124,58,237,0.22)',
        }}
      >
        {misPartidos.length > 0 ? (
          <ul className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {misPartidos.map((ev, i) => {
              // `SportEvent` ya trae su propio acento por competición, así que no
              // hay que volver a derivarlo del deporte.
              const acento = ev.accent || 'var(--purple)'
              // `convertEventTime` toma la HORA ("21:00"), no el ISO, y el ISO va
              // como ancla para que el cambio de hora europeo no desfase una hora.
              const hora = ev.timeTbd
                ? 'Sin hora'
                : tz && tz !== SOURCE_TZ
                  ? convertEventTime(ev.time, tz, ev.isoDate)
                  : ev.time
              return (
                <li
                  key={ev.id ?? `${ev.home}-${i}`}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                >
                  <Link
                    href={ev.matchRef ? `/partido/${ev.matchRef}` : '/calendario'}
                    prefetch={false}
                    className="flex items-center gap-2.5 transition-colors hover:bg-white/[0.03] rounded-lg"
                    style={{ padding: '9px 6px', textDecoration: 'none', minHeight: 44 }}
                  >
                    <span aria-hidden className="flex-shrink-0 rounded-sm" style={{ width: 3, height: 15, background: acento }} />
                    <span className="text-[13px] truncate" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {ev.home}{ev.away ? ` – ${ev.away}` : ''}
                    </span>
                    <span
                      className="ml-auto flex-shrink-0 text-[13px]"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-headline)', letterSpacing: '0.04em' }}
                    >
                      {hora}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Hoy no juega ninguno de tus equipos.{' '}
            <Link href="/calendario" style={{ color: 'var(--purple-light)' }}>Ver todo el calendario</Link>
          </p>
        )}

        <Link
          href="/predicciones"
          prefetch={false}
          className="flex items-center gap-3 rounded-xl transition-all hover:brightness-110"
          style={{
            padding: '10px 12px', textDecoration: 'none', minHeight: 44,
            background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.32)',
          }}
        >
          <span className="flex flex-col min-w-0">
            <span className="text-[13.5px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              La Jornada
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Acierta los partidos de la semana. Tu capitán vale doble.
            </span>
          </span>
          <span
            className="ml-auto flex-shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--purple)', color: '#fff', fontFamily: 'var(--font-sport)' }}
          >
            Jugar
          </span>
        </Link>
      </div>
    </section>
  )
}
