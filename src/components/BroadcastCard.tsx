'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { accentTexto } from '@/lib/sports'
import { formatInstantInZone, getStoredTZ, TZ_CHANGE_EVENT } from '@/lib/timezone'
import {
  COUNTRY_FLAGS,
  COUNTRY_TZ,
  countryFromTimeZone,
  offsetLabel,
  type BroadcastRow,
} from '@/lib/broadcast-countries'

// Bloque "Dónde verlo": una fila por país, con canal, hora local y el desfase
// respecto a la hora del lector.
//
// CLAVE SEO — se renderizan TODOS los países, siempre, en el mismo orden en el
// HTML. El reordenado (subir arriba el país del lector) ocurre solo en el
// navegador, tras hidratar. Nunca se sirve HTML distinto según quién entra:
// Googlebot rastrea casi siempre desde Estados Unidos, así que geo-variar el HTML
// haría que Google indexara la variante estadounidense y el resto no existiría
// para el buscador. Con la tabla entera dentro entramos en la cola larga de cada
// país ("dónde ver el clásico en chile") y el lector sigue viendo lo suyo primero.
//
// El desfase ("+5 h", "igual") es lo que convierte esto en algo más que una lista:
// deja claro que todas las filas son EL MISMO INSTANTE visto desde sitios
// distintos. Solo aparece cuando sabemos de dónde lee, porque sin referencia no
// significa nada.
export default function BroadcastCard({
  rows,
  kickoffIso,
  competitionLabel,
  matchLabel,
  accent = '#7c3aed',
  visibleByDefault = 4,
}: {
  rows: BroadcastRow[]
  kickoffIso?: string | null
  competitionLabel?: string | null
  matchLabel?: string | null
  accent?: string
  visibleByDefault?: number
}) {
  // Arranca en null para que el primer render del cliente sea idéntico al del
  // servidor; el país solo se conoce tras el efecto.
  const [myCountry, setMyCountry] = useState<string | null>(null)
  const [myTZ, setMyTZ] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    const read = () => {
      const tz = getStoredTZ()
      setMyTZ(tz)
      setMyCountry(countryFromTimeZone(tz))
    }
    read()
    window.addEventListener(TZ_CHANGE_EVENT, read)
    return () => window.removeEventListener(TZ_CHANGE_EVENT, read)
  }, [])

  if (!rows || rows.length === 0) return null

  const ordered = myCountry
    ? [...rows].sort((a, b) => (a.countryCode === myCountry ? -1 : b.countryCode === myCountry ? 1 : 0))
    : rows

  // El corte solo se aplica una vez sabemos el país: si cortáramos en servidor,
  // Google vería media tabla y perderíamos justo la cola larga que buscamos.
  const hayCorte = Boolean(myCountry) && !expandido && ordered.length > visibleByDefault
  const visibles = hayCorte ? ordered.slice(0, visibleByDefault) : ordered
  const subtitulo = [matchLabel, competitionLabel].filter(Boolean).join(' · ')

  return (
    <section
      className="cas cas--data cas-bcast"
      style={{ '--acc': accent, '--acc-text': accentTexto(accent) } as CSSProperties}
      aria-label="Dónde ver el partido por país"
    >
      <header className="cas__head">
        <TvIcon />
        <span className="cas__label">Dónde verlo</span>
        {subtitulo && <span className="cas__meta">{subtitulo}</span>}
      </header>

      <ul className="cas-bcast__list">
        {visibles.map((r) => {
          const mine = r.countryCode === myCountry
          const tz = COUNTRY_TZ[r.countryCode]
          const zt = kickoffIso && tz ? formatInstantInZone(kickoffIso, tz) : null
          const desfase = mine
            ? 'Tu hora'
            : kickoffIso && tz && myTZ
              ? offsetLabel(kickoffIso, tz, myTZ)
              : null

          return (
            <li key={r.countryCode} className={mine ? 'is-mine' : undefined}>
              <span aria-hidden className="cas-bcast__flag">
                {COUNTRY_FLAGS[r.countryCode] ?? '🏳️'}
              </span>

              <span className="cas-bcast__country">{r.country}</span>

              <span className="cas-bcast__channels">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.channels.join(' · ')}
                  </a>
                ) : (
                  r.channels.join(' · ')
                )}
              </span>

              {desfase && <span className="cas-bcast__offset">{desfase}</span>}

              {zt && (
                <span className={desfase ? 'cas-bcast__time' : 'cas-bcast__time cas-bcast__time--solo'}>
                  {zt.time}
                  {zt.dayLabel && <em>{zt.dayLabel}</em>}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {hayCorte && (
        <button type="button" onClick={() => setExpandido(true)} className="cas__more">
          Ver los {ordered.length} países ›
        </button>
      )}
    </section>
  )
}

function TvIcon() {
  return (
    <svg className="cas__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 21h8M9 3l3 3 3-3" />
    </svg>
  )
}
