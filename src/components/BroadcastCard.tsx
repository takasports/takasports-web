'use client'

import { useEffect, useState } from 'react'
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
      className="ts-bcast mb-8 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${accent}33`, background: `${accent}0a`, maxWidth: 680 }}
      aria-label="Dónde ver el partido por país"
    >
      <header
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${accent}33`, background: `${accent}16` }}
      >
        <span className="block rounded-sm" style={{ width: 3, height: 13, background: accent }} aria-hidden />
        <span
          className="text-[11px] font-black uppercase"
          style={{ color: accent, letterSpacing: '0.16em', fontFamily: 'var(--font-sport), sans-serif' }}
        >
          Dónde verlo
        </span>
        {subtitulo && (
          <span
            className="ml-auto text-[12px] truncate"
            style={{ color: 'var(--text-muted, #7C7C8C)', fontFamily: 'var(--font-headline), sans-serif' }}
          >
            {subtitulo}
          </span>
        )}
      </header>

      <ul className="flex flex-col">
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
            <li
              key={r.countryCode}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderTop: `1px solid ${accent}14`,
                borderLeft: mine ? `3px solid ${accent}` : '3px solid transparent',
                background: mine ? `${accent}12` : undefined,
                paddingLeft: mine ? 13 : undefined,
              }}
            >
              <span aria-hidden className="text-[13px] shrink-0">
                {COUNTRY_FLAGS[r.countryCode] ?? '🏳️'}
              </span>

              <span
                className="shrink-0 text-[16px]"
                style={{
                  width: 96,
                  color: mine ? accent : 'var(--text-primary, #EBEBF5)',
                  fontWeight: mine ? 600 : 400,
                  letterSpacing: '0.02em',
                  fontFamily: 'var(--font-headline), sans-serif',
                }}
              >
                {r.country}
              </span>

              <span
                className="rounded-md px-2 py-0.5 text-[12px] min-w-0 truncate"
                style={{
                  border: `1px solid ${mine ? `${accent}55` : 'rgba(255,255,255,0.09)'}`,
                  color: mine ? accent : 'var(--body-lede, #9090A4)',
                }}
              >
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.channels.join(' · ')}
                  </a>
                ) : (
                  r.channels.join(' · ')
                )}
              </span>

              {desfase && (
                <span
                  className="ml-auto shrink-0 text-[11px] uppercase"
                  style={{
                    color: mine ? accent : 'var(--text-muted, #7C7C8C)',
                    opacity: mine ? 0.75 : 1,
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-headline), sans-serif',
                  }}
                >
                  {desfase}
                </span>
              )}

              {zt && (
                <span
                  className={desfase ? 'shrink-0 text-right' : 'ml-auto shrink-0 text-right'}
                  style={{
                    minWidth: 58,
                    fontFamily: 'var(--font-sport), sans-serif',
                    fontSize: mine ? 23 : 20,
                    fontWeight: mine ? 800 : 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: mine ? accent : 'var(--text-primary, #EBEBF5)',
                  }}
                >
                  {zt.time}
                  {zt.dayLabel && (
                    <em className="not-italic block text-[10px] font-normal opacity-60">{zt.dayLabel}</em>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {hayCorte && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="w-full py-2.5 text-[13px]"
          style={{
            borderTop: `1px solid ${accent}14`,
            color: 'var(--text-muted, #7C7C8C)',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-headline), sans-serif',
          }}
        >
          Ver los {ordered.length} países ›
        </button>
      )}
    </section>
  )
}
