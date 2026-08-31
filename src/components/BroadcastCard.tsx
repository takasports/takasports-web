'use client'

import { useEffect, useState } from 'react'
import { formatInstantInZone, getStoredTZ, TZ_CHANGE_EVENT } from '@/lib/timezone'
import {
  COUNTRY_FLAGS,
  COUNTRY_TZ,
  countryFromTimeZone,
  type BroadcastRow,
} from '@/lib/broadcast-countries'

// Bloque "Dónde verlo": una fila por país, con el canal y la hora local de cada uno.
//
// CLAVE SEO — se renderizan TODOS los países, siempre, en el mismo orden en el HTML.
// El reordenado (subir arriba el país del lector) ocurre solo en el navegador, tras
// hidratar. Nunca se sirve HTML distinto según quién entra: Googlebot rastrea casi
// siempre desde Estados Unidos, así que geo-variar el HTML haría que Google indexara
// la variante estadounidense y el resto no existiría para el buscador. Con la tabla
// entera dentro, en cambio, entramos en la cola larga de cada país ("dónde ver el
// clásico en chile") y el lector sigue viendo lo suyo primero.
export default function BroadcastCard({
  rows,
  kickoffIso,
  competitionLabel,
  accent = '#7c3aed',
}: {
  rows: BroadcastRow[]
  kickoffIso?: string | null
  competitionLabel?: string | null
  accent?: string
}) {
  // Arranca en null para que el primer render del cliente sea idéntico al del
  // servidor; el país solo se conoce tras el efecto.
  const [myCountry, setMyCountry] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setMyCountry(countryFromTimeZone(getStoredTZ()))
    read()
    window.addEventListener(TZ_CHANGE_EVENT, read)
    return () => window.removeEventListener(TZ_CHANGE_EVENT, read)
  }, [])

  if (!rows || rows.length === 0) return null

  const ordered = myCountry
    ? [...rows].sort((a, b) =>
        a.countryCode === myCountry ? -1 : b.countryCode === myCountry ? 1 : 0,
      )
    : rows

  return (
    <section
      className="ts-bcast mb-8 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${accent}33`, maxWidth: 680 }}
      aria-label="Dónde ver el partido por país"
    >
      <div
        className="flex items-center gap-2.5 px-5 py-2.5"
        style={{ borderBottom: `1px solid ${accent}22`, background: `${accent}10` }}
      >
        <TvIcon color={accent} />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          Dónde verlo
        </span>
        {competitionLabel ? (
          <span className="ml-auto text-[11px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
            {competitionLabel}
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col px-5 py-2">
        {ordered.map((r) => {
          const mine = r.countryCode === myCountry
          const zt = kickoffIso ? formatInstantInZone(kickoffIso, COUNTRY_TZ[r.countryCode] ?? 'UTC') : null
          return (
            <li
              key={r.countryCode}
              className="flex items-baseline justify-between gap-3 py-2.5"
              style={{
                borderTop: `1px solid ${accent}14`,
                background: mine ? `${accent}12` : undefined,
                marginInline: mine ? '-1.25rem' : undefined,
                paddingInline: mine ? '1.25rem' : undefined,
              }}
            >
              <span
                className="text-[14px] shrink-0"
                style={{ color: mine ? accent : undefined, fontWeight: mine ? 700 : 400 }}
              >
                <span aria-hidden>{COUNTRY_FLAGS[r.countryCode] ?? '🏳️'}</span> {r.country}
              </span>

              <span className="text-right">
                <span className="text-[14px]" style={{ color: mine ? accent : 'var(--body-lede, #9aa0aa)' }}>
                  {zt ? (
                    <>
                      <span className="tabular-nums font-bold">{zt.time}</span>
                      {zt.dayLabel ? (
                        <span className="text-[11px] font-normal opacity-70"> · {zt.dayLabel}</span>
                      ) : null}
                      <span className="opacity-50"> · </span>
                    </>
                  ) : null}
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {r.channels.join(' / ')}
                    </a>
                  ) : (
                    r.channels.join(' / ')
                  )}
                </span>
                {r.note ? (
                  <span className="block text-[11px] opacity-60">{r.note}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TvIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="m8 3 4 4 4-4" />
    </svg>
  )
}
