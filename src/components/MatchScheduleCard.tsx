'use client'

import { useEffect, useState } from 'react'
import {
  SOURCE_TZ,
  TZ_CHANGE_EVENT,
  getStoredTZ,
  formatInstantInZone,
  formatInstantForZones,
  MATCH_AUDIENCE_ZONES,
} from '@/lib/timezone'
import TimezoneSelector from '@/components/TimezoneSelector'

export interface MatchKickoffData {
  iso: string
  home?: string | null
  away?: string | null
  competition?: string | null
  approx?: boolean | null
}

// Tarjeta "Horario del partido": parte de UN instante exacto (ISO-8601 UTC) y lo
// expresa en España (referencia central) + los principales países + la hora local
// del lector + un selector para cualquier país. Toda la conversión es determinista;
// ninguna IA calcula horas. Si el instante no es válido, no se renderiza nada.
export default function MatchScheduleCard({
  kickoff,
  accent = '#7c3aed',
  audienceZones = MATCH_AUDIENCE_ZONES,
}: {
  kickoff: MatchKickoffData
  accent?: string
  audienceZones?: string[]
}) {
  const iso = kickoff?.iso
  const madrid = iso ? formatInstantInZone(iso, SOURCE_TZ) : null
  const canarias = iso ? formatInstantInZone(iso, 'Atlantic/Canary') : null
  const rows = iso ? formatInstantForZones(iso, audienceZones) : []

  const [userTZ, setUserTZ] = useState<string>(SOURCE_TZ)
  const [selTZ, setSelTZ] = useState<string>(SOURCE_TZ)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const tz = getStoredTZ()
    setUserTZ(tz)
    setSelTZ(tz)
    setReady(true)
    const onChange = () => setUserTZ(getStoredTZ())
    window.addEventListener(TZ_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(TZ_CHANGE_EVENT, onChange)
  }, [])

  if (!iso || !madrid) return null

  const userZT = ready ? formatInstantInZone(iso, userTZ) : null
  const selZT = formatInstantInZone(iso, selTZ)

  const dateLabel = new Intl.DateTimeFormat('es-ES', {
    timeZone: SOURCE_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))

  const teams = kickoff.home && kickoff.away ? `${kickoff.home} – ${kickoff.away}` : null
  const subtitle = [teams, kickoff.competition, capitalize(dateLabel)].filter(Boolean).join(' · ')

  return (
    <section
      className="ts-sched mb-8 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${accent}33`, maxWidth: 680 }}
      aria-label="Horario del partido por país"
    >
      {/* Cabecera */}
      <div
        className="flex items-center gap-2.5 px-5 py-2.5"
        style={{ borderBottom: `1px solid ${accent}22`, background: `${accent}10` }}
      >
        <ClockIcon color={accent} />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          Horario del partido
        </span>
        {kickoff.approx ? (
          <span
            className="ml-auto text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
            style={{ color: accent, background: `${accent}18` }}
            title="Hora tomada de la noticia; puede no ser exacta"
          >
            aproximada
          </span>
        ) : null}
      </div>

      <div className="px-5 py-4">
        {subtitle && (
          <p className="text-[13px] mb-3" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
            {subtitle}
          </p>
        )}

        {/* España — referencia central */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
          style={{ background: `${accent}12` }}
        >
          <div>
            <div className="text-[14px] font-bold" style={{ color: accent }}>
              🇪🇸 España (peninsular)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
              referencia central{canarias ? ` · Canarias ${canarias.time}` : ''}
            </div>
          </div>
          <div className="text-[22px] font-black tabular-nums" style={{ color: accent }}>
            {madrid.time}
          </div>
        </div>

        {/* Tu hora local (auto-detectada en cliente) */}
        {userZT && (
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2 mb-3"
            style={{ border: `1px dashed ${accent}44` }}
          >
            <span className="text-[13px] flex items-center gap-1.5" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
              <PinIcon color={accent} /> Tu hora local · {userZT.city}
            </span>
            <span className="text-[14px] font-bold tabular-nums">
              {userZT.time}
              {userZT.dayLabel ? <em className="not-italic text-[11px] font-normal opacity-70"> · {userZT.dayLabel}</em> : null}
            </span>
          </div>
        )}

        {/* Lista de países */}
        <ul className="flex flex-col">
          {rows.map((z) => (
            <li
              key={z.iana}
              className="flex items-center justify-between py-1.5"
              style={{ borderTop: `1px solid ${accent}14` }}
            >
              <span className="text-[14px]">
                <span aria-hidden>{z.flag}</span> {z.city}
                <span className="text-[11px] opacity-60"> · {z.offset}</span>
              </span>
              <span className="text-[14px] tabular-nums" style={{ color: 'var(--body-list, inherit)' }}>
                {z.time}
                {z.dayLabel ? <em className="not-italic text-[11px] opacity-70"> · {z.dayLabel}</em> : null}
              </span>
            </li>
          ))}
        </ul>

        {/* Selector de cualquier país */}
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${accent}22` }}>
          <label className="text-[11px] block mb-1.5" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
            Ver en otro país
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <TimezoneSelector value={selTZ} onChange={setSelTZ} compact />
            </div>
            <span className="text-[15px] font-bold tabular-nums whitespace-nowrap">
              {selZT ? selZT.time : '—'}
              {selZT?.dayLabel ? <em className="not-italic text-[11px] font-normal opacity-70"> · {selZT.dayLabel}</em> : null}
            </span>
          </div>
        </div>

        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--body-lede, #8b8b93)' }}>
          {kickoff.approx
            ? 'Hora tomada de la noticia y convertida a cada país; puede variar respecto a la oficial.'
            : 'Hora exacta de la ficha del partido, convertida automáticamente a cada país.'}
        </p>
      </div>
    </section>
  )
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function PinIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6-5.7-6-10a6 6 0 1 1 12 0c0 4.3-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}
