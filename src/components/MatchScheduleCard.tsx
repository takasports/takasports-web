'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { accentTexto } from '@/lib/sports'
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
      className="cas cas--data cas-sched"
      style={{ '--acc': accent, '--acc-text': accentTexto(accent) } as CSSProperties}
      aria-label="Horario del partido por país"
    >
      <header className="cas__head">
        <ClockIcon />
        <span className="cas__label">Horario del partido</span>
        {kickoff.approx ? (
          <span className="cas__chip" title="Hora tomada de la noticia; puede no ser exacta">
            aproximada
          </span>
        ) : null}
      </header>

      <div className="cas__body">
        {subtitle && <p className="cas-sched__sub">{subtitle}</p>}

        {/* España — referencia central: la hora grande, sin caja propia */}
        <div className="cas-sched__main">
          <div className="cas-sched__ref">
            <span className="cas-sched__where">🇪🇸 España (peninsular)</span>
            <span className="cas-sched__note">
              referencia central{canarias ? ` · Canarias ${canarias.time}` : ''}
            </span>
          </div>
          <span className="cas-sched__time">{madrid.time}</span>
        </div>

        {/* Tu hora local (auto-detectada en cliente) */}
        {userZT && (
          <div className="cas-sched__mine">
            <span className="cas-sched__mine-label">
              <PinIcon /> Tu hora local · {userZT.city}
            </span>
            <span className="cas-sched__t">
              {userZT.time}
              {userZT.dayLabel ? <em> · {userZT.dayLabel}</em> : null}
            </span>
          </div>
        )}

        {/* Lista de países: rejilla tipo panel de salidas (2 columnas en móvil) */}
        <ul className="cas-sched__list">
          {rows.map((z) => (
            <li key={z.iana}>
              <span className="cas-sched__city">
                <span aria-hidden>{z.flag}</span> {z.city}
              </span>
              <span className="cas-sched__t">
                {z.time}
                <small> · {z.offset}</small>
                {z.dayLabel ? <em> · {z.dayLabel}</em> : null}
              </span>
            </li>
          ))}
        </ul>

        {/* Selector de cualquier país */}
        <div className="cas-sched__other">
          <label>Ver en otro país</label>
          <div className="cas-sched__picker">
            <TimezoneSelector value={selTZ} onChange={setSelTZ} compact />
          </div>
          <span className="cas-sched__t cas-sched__t--sel">
            {selZT ? selZT.time : '—'}
            {selZT?.dayLabel ? <em> · {selZT.dayLabel}</em> : null}
          </span>
        </div>

        <p className="cas__foot">
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

function ClockIcon() {
  return (
    <svg className="cas__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6-5.7-6-10a6 6 0 1 1 12 0c0 4.3-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}
