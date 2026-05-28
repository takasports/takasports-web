// Plantillas inline para el strip de eventos (LiveStrip).
// El render uniforme actual (home + score + away + status) no encaja con la
// semántica de tenis (sets), combate (versus) ni motor (sesión + GP). Aquí
// adaptamos la SEMÁNTICA visual aunque la fuente de datos sea la misma.
//
// Datos ESPN no traen sets ni rondas; las plantillas usan los campos
// existentes con etiquetas y disposición distinta por deporte.

import Link from 'next/link'
import { useState } from 'react'
import { getSportColor, getLiveLabel, isTennis, isCombat, isRacing } from '@/lib/competitions'
import { SportIcon } from '@/components/icons/GameIcons'

export interface LiveFixture {
  id: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  sport: string
  comp?: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  matchRef?: string
  clock?: string      // current set game score (tennis) or match clock
  setsStr?: string    // tennis: "6-4 7-5 *3-2" (* = active set)
}

export interface UpcomingEvent {
  id: string
  homeTeam: string
  awayTeam: string | null
  time: string
  dateLabel: string
  sport: string
  comp: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
}

// ── helpers internos ────────────────────────────────────────────

function TeamLogo({ logo, name, size = 14 }: { logo?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  return null
}

function short(name: string | null | undefined, abbr?: string): string {
  if (!name) return ''
  if (abbr) return abbr
  // Use the last word — more recognizable for both teams ("Manchester City" → "City")
  // and athletes ("Carlos Alcaraz" → "Alcaraz", "Lewis Hamilton" → "Hamilton")
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].slice(0, 9)
}

function Badge({ children, col }: { children: React.ReactNode; col: string }) {
  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ color: col, background: `${col}14`, border: `1px solid ${col}30`, fontFamily: 'var(--font-sport)' }}
    >
      {children}
    </span>
  )
}

// ── Plantilla genérica: fútbol, baloncesto, rugby, hockey, beisbol ──

function GenericLive({ fix, col }: { fix: LiveFixture; col: string }) {
  return (
    <>
      <TeamLogo logo={fix.homeLogo} name={fix.homeTeam} size={14} />
      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
        {short(fix.homeTeam, fix.homeAbbr)}
      </span>
      <span
        className="font-black tabular-nums text-[11px]"
        style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
      >
        {fix.homeGoals ?? 0} – {fix.awayGoals ?? 0}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
        {short(fix.awayTeam, fix.awayAbbr)}
      </span>
      <TeamLogo logo={fix.awayLogo} name={fix.awayTeam} size={14} />
      <Badge col={col}>{getLiveLabel(fix.status, fix.elapsed)}</Badge>
    </>
  )
}

// ── Tenis: jugadores + sets (mapeamos goals → "sets" visualmente) ──

function TennisSets({ setsStr, col }: { setsStr: string; col: string }) {
  const sets = setsStr.split(' ')
  return (
    <span
      className="font-black tabular-nums text-[10px]"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.02em',
      }}
      title="Parciales por set"
    >
      {sets.map((s, i) => {
        const isActive = s.startsWith('*')
        const display = isActive ? s.slice(1) : s
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {i > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 9, lineHeight: 1 }}>·</span>
            )}
            <span style={{ color: isActive ? col : '#F0F0F8' }}>
              {display}
            </span>
          </span>
        )
      })}
    </span>
  )
}

function TennisLive({ fix, col }: { fix: LiveFixture; col: string }) {
  // Pass sport context so getLiveLabel uses "Set N" instead of soccer labels
  const setLabel = getLiveLabel(fix.status, fix.elapsed, {
    sport: fix.sport,
    homeScore: fix.homeGoals,
    awayScore: fix.awayGoals,
  })
  return (
    <>
      <span style={{ color: col, flexShrink: 0 }}>
        <SportIcon sport="tenis" size={12} />
      </span>
      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
        {short(fix.homeTeam, fix.homeAbbr)}
      </span>
      {fix.setsStr ? (
        <TennisSets setsStr={fix.setsStr} col={col} />
      ) : (
        <span
          className="font-black tabular-nums text-[11px]"
          style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          title="Sets ganados"
        >
          {fix.homeGoals ?? 0} – {fix.awayGoals ?? 0}
        </span>
      )}
      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
        {short(fix.awayTeam, fix.awayAbbr)}
      </span>
      <Badge col={col}>{setLabel}</Badge>
    </>
  )
}

// ── Combate: versus prominente, sin score ──

function CombatLive({ fix, col }: { fix: LiveFixture; col: string }) {
  return (
    <>
      <span style={{ color: col, flexShrink: 0 }}>
        <SportIcon sport="ufc" size={12} />
      </span>
      <span className="text-[10px] font-semibold" style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
        {short(fix.homeTeam, fix.homeAbbr)}
      </span>
      <span
        className="text-[10px] font-black"
        style={{ color: col, fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
      >
        vs
      </span>
      <span className="text-[10px] font-semibold" style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
        {short(fix.awayTeam, fix.awayAbbr)}
      </span>
      <Badge col={col}>{fix.comp ? fix.comp.slice(0, 8) : 'EN VIVO'}</Badge>
    </>
  )
}

// ── Motor: GP + sesión, sin home/away ──

function RacingLive({ fix, col }: { fix: LiveFixture; col: string }) {
  // El nombre del GP suele venir como homeTeam ("Spanish GP") o comp.
  const gpName = fix.comp && fix.comp.length > 4 ? fix.comp : fix.homeTeam
  return (
    <>
      <span style={{ color: col, flexShrink: 0 }}>
        <SportIcon sport={fix.sport} size={12} />
      </span>
      <span className="text-[10px] font-semibold" style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
        {gpName}
      </span>
      <Badge col={col}>EN CARRERA · {getLiveLabel(fix.status, fix.elapsed)}</Badge>
    </>
  )
}

// ── Selector + wrapper exportado ────────────────────────────────

export function LiveEventCard({ fix }: { fix: LiveFixture }) {
  const col = getSportColor(fix.sport)
  const liveLabel = getLiveLabel(fix.status, fix.elapsed)

  let body: React.ReactNode
  let ariaLabel: string

  if (isCombat(fix.sport)) {
    body = <CombatLive fix={fix} col={col} />
    ariaLabel = `${fix.homeTeam} contra ${fix.awayTeam}, ${liveLabel}`
  } else if (isRacing(fix.sport)) {
    body = <RacingLive fix={fix} col={col} />
    ariaLabel = `${fix.homeTeam} en carrera, ${liveLabel}`
  } else if (isTennis(fix.sport)) {
    body = <TennisLive fix={fix} col={col} />
    ariaLabel = fix.setsStr
      ? `${fix.homeTeam} vs ${fix.awayTeam}, ${fix.setsStr.replace(/\*/g, '')}, ${liveLabel}`
      : `${fix.homeTeam} ${fix.homeGoals ?? 0} - ${fix.awayGoals ?? 0} ${fix.awayTeam} sets, ${liveLabel}`
  } else {
    body = <GenericLive fix={fix} col={col} />
    ariaLabel = `${fix.homeTeam} ${fix.homeGoals ?? 0} - ${fix.awayGoals ?? 0} ${fix.awayTeam}, ${liveLabel}`
  }

  const inner = (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1.5">
      {body}
    </div>
  )

  return fix.matchRef
    ? <Link href={`/partido/${fix.matchRef}`} className="hover:opacity-80 transition-opacity">{inner}</Link>
    : inner
}

// ── Upcoming (sin score, solo hora + fecha) ─────────────────────

export function UpcomingEventCard({ ev }: { ev: UpcomingEvent }) {
  const col = getSportColor(ev.sport)
  const racing = isRacing(ev.sport)
  const combat = isCombat(ev.sport)

  // Racing/Combat: GP name + sesión sin "vs"; resto: home vs away
  const label = racing
    ? (ev.comp && ev.comp.length > 4 ? ev.comp : ev.homeTeam)
    : combat
      ? `${short(ev.homeTeam, ev.homeAbbr)} vs ${short(ev.awayTeam ?? '', ev.awayAbbr)}`
      : ev.awayTeam
        ? `${short(ev.homeTeam, ev.homeAbbr)} vs ${short(ev.awayTeam, ev.awayAbbr)}`
        : ev.homeTeam

  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: col }}>
        <SportIcon sport={ev.sport} size={13} />
      </span>
      {!racing && <TeamLogo logo={ev.homeLogo} name={ev.homeTeam} size={13} />}
      <span className="text-[10px] font-semibold" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>
        {label}
      </span>
      {!racing && !combat && ev.awayTeam && <TeamLogo logo={ev.awayLogo} name={ev.awayTeam} size={13} />}
      <span
        className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded"
        style={{
          color: col,
          background: `${col}12`,
          border: `1px solid ${col}25`,
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.02em',
        }}
      >
        {ev.time}
      </span>
      <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
        {ev.dateLabel}
      </span>
    </div>
  )
}
