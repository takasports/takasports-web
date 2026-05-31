'use client'

// ── MundialClient ────────────────────────────────────────────────────────
// Interfaz de predicciones para el Mundial 2026.
// Estética dorada. Matches agrupados por fecha.
// Pick 1 / X / 2 — bloqueado una vez iniciado el partido.
// Muestra puntos acreditados si el partido ya se resolvió.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'

// ── Types ────────────────────────────────────────────────────────────────

interface RankedEvent {
  id:          string
  sport:       string
  competition: string
  event_date:  string
  team_home:   string | null
  team_away:   string | null
  featured:    boolean
  status:      'open' | 'closed' | 'resolved'
  result:      { winner: '1' | 'X' | '2'; home_score?: number; away_score?: number } | null
  meta:        { group?: string; venue?: string; city?: string }
}

interface PredictionRow {
  event_id:       string
  prediction:     { pick: '1' | 'X' | '2' }
  points_awarded: number | null
  is_correct:     boolean | null
}

type PredMap = Record<string, PredictionRow>

// ── Flag emojis ──────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  // Americas
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'México': '🇲🇽', 'Mexico': '🇲🇽',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Canada': '🇨🇦',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Peru': '🇵🇪', 'Chile': '🇨🇱',
  'Uruguay': '🇺🇾', 'Venezuela': '🇻🇪', 'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Panama': '🇵🇦',
  'Jamaica': '🇯🇲', 'Trinidad and Tobago': '🇹🇹',
  'Haiti': '🇭🇹', 'Curacao': '🇨🇼', 'Curaçao': '🇨🇼',
  'Guatemala': '🇬🇹', 'El Salvador': '🇸🇻', 'Cuba': '🇨🇺',
  'Antigua and Barbuda': '🇦🇬', 'Martinique': '🏴', 'Guadeloupe': '🏴',
  // Europe
  'Spain': '🇪🇸', 'France': '🇫🇷', 'Germany': '🇩🇪', 'Portugal': '🇵🇹',
  'Netherlands': '🇳🇱', 'Italy': '🇮🇹', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷',
  'Belgium': '🇧🇪', 'Denmark': '🇩🇰', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Poland': '🇵🇱', 'Serbia': '🇷🇸', 'Turkey': '🇹🇷', 'Türkiye': '🇹🇷', 'Romania': '🇷🇴',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Hungary': '🇭🇺',
  'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Albania': '🇦🇱', 'Georgia': '🇬🇪', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Iceland': '🇮🇸',
  'Bosnia': '🇧🇦', 'Bosnia-Herzegovina': '🇧🇦', 'Bosnia and Herzegovina': '🇧🇦',
  'North Macedonia': '🇲🇰', 'Montenegro': '🇲🇪', 'Kosovo': '🇽🇰',
  'Luxembourg': '🇱🇺', 'Belarus': '🇧🇾', 'Bulgaria': '🇧🇬',
  // Africa
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
  'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Ivory Coast': '🇨🇮', 'Cote d\'Ivoire': '🇨🇮',
  'Tunisia': '🇹🇳', 'South Africa': '🇿🇦', 'Algeria': '🇩🇿',
  'Mali': '🇲🇱', 'Congo': '🇨🇩', 'Congo DR': '🇨🇩', 'DR Congo': '🇨🇩',
  'Cape Verde': '🇨🇻', 'Cabo Verde': '🇨🇻',
  'Zambia': '🇿🇲', 'Uganda': '🇺🇬', 'Tanzania': '🇹🇿', 'Kenya': '🇰🇪',
  'Libya': '🇱🇾', 'Ethiopia': '🇪🇹', 'Angola': '🇦🇴', 'Mozambique': '🇲🇿',
  'Burkina Faso': '🇧🇫', 'Guinea': '🇬🇳', 'Equatorial Guinea': '🇬🇶',
  // Asia
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺', 'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'China': '🇨🇳', 'Indonesia': '🇮🇩',
  'Jordan': '🇯🇴', 'Iraq': '🇮🇶', 'Uzbekistan': '🇺🇿', 'Bahrain': '🇧🇭',
  'Oman': '🇴🇲', 'Palestine': '🇵🇸', 'Syria': '🇸🇾', 'Vietnam': '🇻🇳',
  'Thailand': '🇹🇭', 'Malaysia': '🇲🇾', 'Philippines': '🇵🇭',
  'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪', 'Kuwait': '🇰🇼',
  // Oceania / Other
  'New Zealand': '🇳🇿', 'Fiji': '🇫🇯', 'Papua New Guinea': '🇵🇬',
}

function flag(team: string | null): string {
  if (!team) return '🏳️'
  return FLAGS[team] ?? '🏴'
}

/** Trunca nombres largos para los botones de pick */
function shortName(name: string, max = 12): string {
  if (!name || name.length <= max) return name
  return name.slice(0, max - 1) + '…'
}

// ── Date helpers ─────────────────────────────────────────────────────────

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function toDateLabel(iso: string): string {
  const d = new Date(iso)
  const day  = DAYS_ES[d.getUTCDay()]
  const date = d.getUTCDate()
  const mon  = MONTHS_ES[d.getUTCMonth()]
  return `${day} ${date} ${mon}`
}

function toTimeLabel(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

// ── Constants ────────────────────────────────────────────────────────────

const GOLD   = '#FBBF24'
const GOLD2  = '#F59E0B'
const GOLD_D = '#92400E'

// ── CSS animations ────────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes mundialFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes mundialFadeInUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes mundialFloat {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%      { transform: translateY(-7px) rotate(-2deg); }
    66%      { transform: translateY(-4px) rotate(2deg); }
  }
  @keyframes mundialGoldPulse {
    0%, 100% { box-shadow: 0 0 20px #FBBF2415, 0 0 0 0 transparent; }
    50%      { box-shadow: 0 0 48px #FBBF2428, 0 0 80px #FBBF2412; }
  }
  @keyframes mundialCountNum {
    0%   { transform: scale(1); }
    10%  { transform: scale(1.06); }
    20%  { transform: scale(1); }
    100% { transform: scale(1); }
  }
  @keyframes mundialCardIn {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes mundialShimmer {
    0%   { background-position: -300% center; }
    100% { background-position: 300% center; }
  }
  @keyframes mundialLivePulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
  }

  .mundial-hero       { animation: mundialFadeIn 0.5s ease-out both; }
  .mundial-title      { animation: mundialFadeInUp 0.55s ease-out 0.05s both; }
  .mundial-flags      { animation: mundialFadeInUp 0.55s ease-out 0.12s both; }
  .mundial-strip      { animation: mundialFadeInUp 0.55s ease-out 0.18s both; }
  .mundial-cta        { animation: mundialFadeInUp 0.55s ease-out 0.24s both; }
  .trophy-float       { animation: mundialFloat 4s ease-in-out infinite; display: inline-block; }
  .countdown-glow     { animation: mundialGoldPulse 2.5s ease-in-out infinite; }
  .countdown-num      { animation: mundialCountNum 1s ease-out; }
  .live-dot           { animation: mundialLivePulse 1.2s ease-in-out infinite; }

  .pick-btn {
    transition: transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease !important;
    will-change: transform;
  }
  .pick-btn:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02) !important;
    filter: brightness(1.2) !important;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35) !important;
  }
  .pick-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.96) !important;
    filter: brightness(0.95) !important;
  }

  .match-card {
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important;
    will-change: transform;
  }
  .match-card:hover {
    transform: translateY(-3px) !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important;
  }

  .date-group {
    animation: mundialFadeInUp 0.45s ease-out both;
  }
`

// ── Sub-components ───────────────────────────────────────────────────────

function PickButton({
  label,
  sublabel,
  active,
  correct,
  wrong,
  disabled,
  onClick,
}: {
  label:     string
  sublabel?: string
  active:    boolean
  correct:   boolean
  wrong:     boolean
  disabled:  boolean
  onClick:   () => void
}) {
  let bg       = 'rgba(255,255,255,0.04)'
  let border   = 'rgba(255,255,255,0.1)'
  let color    = 'rgba(255,255,255,0.5)'
  let subColor = 'rgba(255,255,255,0.22)'
  let shadow   = 'none'

  if (correct) {
    bg = 'rgba(74,222,128,0.16)'; border = 'rgba(74,222,128,0.45)'; color = '#4ADE80'
    subColor = 'rgba(74,222,128,0.65)'; shadow = '0 0 16px rgba(74,222,128,0.12)'
  } else if (wrong) {
    bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.5)'
    subColor = 'rgba(239,68,68,0.35)'
  } else if (active) {
    bg = `${GOLD}1E`; border = `${GOLD}70`; color = GOLD; subColor = GOLD2
    shadow = `0 0 20px ${GOLD}18`
  }

  return (
    <button
      className="pick-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '14px 8px',
        borderRadius: 14,
        background: bg,
        border: `1.5px solid ${border}`,
        color,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-sport)',
        minWidth: 0,
        minHeight: 68,
        boxShadow: shadow,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      {sublabel && (
        <span
          style={{
            fontSize: 9,
            color: subColor,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            maxWidth: 72,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {shortName(sublabel)}
        </span>
      )}
    </button>
  )
}

function MatchCard({
  event,
  pred,
  submitting,
  onPick,
  animDelay = 0,
}: {
  event:      RankedEvent
  pred:       PredictionRow | undefined
  submitting: boolean
  onPick:     (eventId: string, pick: '1' | 'X' | '2') => void
  animDelay?: number
}) {
  const myPick     = pred?.prediction?.pick ?? null
  const isOpen     = event.status === 'open'
  const isClosed   = event.status === 'closed'
  const isResolved = event.status === 'resolved'
  const winner     = event.result?.winner ?? null
  const pts        = pred?.points_awarded ?? null
  const [shared,   setShared] = useState(false)

  const picks: { label: string; sub: string; val: '1' | 'X' | '2' }[] = [
    { label: 'Local',  sub: event.team_home ?? '', val: '1' },
    { label: 'X',      sub: 'Empate',              val: 'X' },
    { label: 'Visita', sub: event.team_away ?? '', val: '2' },
  ]

  return (
    <div
      className="match-card"
      style={{
        background: event.featured
          ? `linear-gradient(135deg, ${GOLD}10 0%, ${GOLD}07 50%, rgba(255,255,255,0.015) 100%)`
          : 'rgba(255,255,255,0.035)',
        border: `1px solid ${event.featured ? `${GOLD}45` : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 18,
        padding: '16px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: event.featured
          ? `0 0 32px ${GOLD}0C, inset 0 1px 0 ${GOLD}15`
          : `0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`,
        animation: `mundialCardIn 0.4s ease-out ${animDelay}ms both`,
      }}
    >
      {/* Header: grupo + featured badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
        {event.featured && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              padding: '3px 8px',
              borderRadius: 6,
              background: `linear-gradient(90deg, ${GOLD}2A 0%, ${GOLD}18 100%)`,
              border: `1px solid ${GOLD}50`,
              color: GOLD,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.07em',
            }}
          >
            ⭐ DOBLE PUNTOS
          </span>
        )}
        {(event.meta?.group || event.meta?.city) && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'var(--font-sport)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {event.meta.group || event.meta.city}
          </span>
        )}
        {isClosed && (
          <span className="live-dot" style={{ fontSize: 9, color: '#F87171', fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: '0.06em' }}>
            🔴 EN VIVO
          </span>
        )}
      </div>

      {/* Teams — centered layout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Home team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>{flag(event.team_home)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              lineHeight: 1.2,
              textAlign: 'right',
            }}
          >
            {event.team_home ?? '—'}
          </span>
        </div>

        {/* Center: VS / score / live */}
        <div
          style={{
            width: 60,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {isResolved && event.result ? (
            <>
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: GOLD,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {event.result.home_score ?? '?'}–{event.result.away_score ?? '?'}
              </span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Final
              </span>
            </>
          ) : (
            <>
              <span
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.22)',
                  fontFamily: 'var(--font-sport)',
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                }}
              >
                VS
              </span>
              <span
                style={{
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.22)',
                  fontFamily: 'var(--font-sport)',
                  textAlign: 'center',
                  lineHeight: 1.35,
                }}
              >
                {toTimeLabel(event.event_date)}
              </span>
            </>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>{flag(event.team_away)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              lineHeight: 1.2,
              textAlign: 'left',
            }}
          >
            {event.team_away ?? '—'}
          </span>
        </div>
      </div>

      {/* Pick buttons */}
      <div style={{ display: 'flex', gap: 7 }}>
        {picks.map(p => {
          const isActive  = myPick === p.val
          const isCorrect = isResolved && winner === p.val && isActive
          const isWrong   = isResolved && isActive && !isCorrect
          const isWinRow  = isResolved && winner === p.val && !isActive

          return (
            <PickButton
              key={p.val}
              label={p.label}
              sublabel={p.sub}
              active={isActive}
              correct={isCorrect || isWinRow}
              wrong={isWrong}
              disabled={!isOpen || submitting}
              onClick={() => onPick(event.id, p.val)}
            />
          )
        })}
      </div>

      {/* Points earned */}
      {isResolved && myPick && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pts != null && pts > 0 ? (
            <>
              <TakaPoint size={13} />
              <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)' }}>
                +{pts} pts
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>
                ¡Acertaste!
              </span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
              Fallaste — el resultado fue {winner === '1' ? event.team_home : winner === '2' ? event.team_away : 'Empate'}
            </span>
          )}
        </div>
      )}

      {/* Share pick — visible cuando hay pick pero el partido aún no cerró */}
      {myPick && isOpen && (
        <button
          onClick={async () => {
            await sharePick(event.team_home, event.team_away, myPick)
            setShared(true)
            setTimeout(() => setShared(false), 3000)
          }}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 8,
            background: `${GOLD}10`,
            border: `1px solid ${GOLD}25`,
            color: GOLD_D,
            fontSize: 9,
            fontWeight: 900,
            fontFamily: 'var(--font-sport)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          {shared ? '✓ Copiado' : '↗ Compartir pick'}
        </button>
      )}

      {/* Estado si no hay pick y partido no abierto */}
      {!myPick && !isOpen && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}>
          {isClosed ? 'Predicciones cerradas' : 'Sin predicción'}
        </span>
      )}
    </div>
  )
}

// ── Share helper ─────────────────────────────────────────────────────────

async function sharePick(teamHome: string | null, teamAway: string | null, pick: '1' | 'X' | '2') {
  const pickLabel = pick === '1' ? `${teamHome ?? 'Local'}` : pick === '2' ? `${teamAway ?? 'Visita'}` : 'Empate'
  const text = `Predigo: ${pickLabel} en ${teamHome ?? '?'} vs ${teamAway ?? '?'} — ¿Quién acierta más? 🏆`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Mi predicción en TakaSports', text, url: 'https://takasportsmedia.com/predicciones' })
    } catch { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(`${text} takasportsmedia.com/predicciones`)
  }
}

// ── Countdown helpers ─────────────────────────────────────────────────────

function daysUntilKickoff(): number | null {
  const kickoff = new Date('2026-06-11T19:00:00Z')
  const now     = new Date()
  if (now >= kickoff) return null
  return Math.ceil((kickoff.getTime() - now.getTime()) / 86_400_000)
}

/** Devuelve tiempo hasta el próximo evento open (en ms), o null si ya empezó el torneo */
function msUntilNextOpen(events: RankedEvent[]): number | null {
  const now   = Date.now()
  const opens = events
    .filter(e => e.status === 'open')
    .map(e => new Date(e.event_date).getTime())
    .filter(t => t > now)
    .sort((a, b) => a - b)
  if (opens.length === 0) return null
  const ms = opens[0] - now
  return ms < 86_400_000 ? ms : null
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Main component ───────────────────────────────────────────────────────

export default function MundialClient() {
  const [events,     setEvents]     = useState<RankedEvent[]>([])
  const [preds,      setPreds]      = useState<PredMap>({})
  const [loading,    setLoading]    = useState(true)
  const [loggedIn,   setLoggedIn]   = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showLogin,  setShowLogin]  = useState(false)
  const [tick,       setTick]       = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch events + predictions ───────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [evRes, predRes] = await Promise.all([
        fetch('/api/ranked/events?sport=mundial'),
        fetch('/api/ranked/predictions?sport=mundial'),
      ])
      const evData   = await evRes.json()   as { events?: RankedEvent[] }
      const predData = await predRes.json() as { predictions?: PredMap; reason?: string }
      setEvents(evData.events  ?? [])
      setPreds(predData.predictions ?? {})
      setLoggedIn(predData.reason !== 'no_session')
    } catch {
      setError('Error cargando partidos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  // ── Submit pick ──────────────────────────────────────────────────
  const handlePick = useCallback(async (eventId: string, pick: '1' | 'X' | '2') => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res  = await fetch('/api/ranked/predictions', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, pick }),
      })
      if (res.status === 401) {
        setShowLogin(true)
        return
      }
      if (res.status === 409) {
        await load()
        return
      }
      if (!res.ok) throw new Error('error')
      const data = await res.json() as { prediction?: { event_id: string; prediction: { pick: '1'|'X'|'2' } } }
      if (data.prediction) {
        setPreds(prev => ({
          ...prev,
          [eventId]: {
            ...(prev[eventId] ?? {}),
            event_id:       eventId,
            prediction:     data.prediction!.prediction,
            points_awarded: prev[eventId]?.points_awarded ?? null,
            is_correct:     prev[eventId]?.is_correct     ?? null,
          },
        }))
      }
    } catch {
      setError('No se pudo guardar la predicción.')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, load])

  // ── Group events by date ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; events: RankedEvent[] }>()
    for (const ev of events) {
      const key = toDateKey(ev.event_date)
      if (!map.has(key)) map.set(key, { label: toDateLabel(ev.event_date), events: [] })
      map.get(key)!.events.push(ev)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  // ── Stats + countdown ────────────────────────────────────────────
  const totalPts    = Object.values(preds).reduce((acc, p) => acc + (p.points_awarded ?? 0), 0)
  const myPicks     = Object.keys(preds).length
  const openCount   = events.filter(e => e.status === 'open').length
  const daysLeft    = daysUntilKickoff()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextMatchMs = useMemo(() => msUntilNextOpen(events), [events, tick])

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16">

      {/* Inyección de keyframes y clases CSS */}
      <style>{ANIMATIONS}</style>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div
        className="mundial-hero relative rounded-2xl overflow-hidden mt-4 mb-8"
        style={{
          background: 'linear-gradient(160deg, #0A0600 0%, #1C0E00 30%, #120900 60%, #060402 100%)',
          border: `1px solid ${GOLD}22`,
          boxShadow: `0 0 0 1px ${GOLD}08, 0 24px 80px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Decoración: "2026" masivo de fondo */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -24,
            bottom: -32,
            fontSize: 'clamp(7rem, 22vw, 18rem)',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            color: 'transparent',
            WebkitTextStroke: `2px ${GOLD}0D`,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          2026
        </div>

        {/* Campo de fútbol SVG — watermark */}
        <svg
          aria-hidden
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 220, height: 160, opacity: 0.07, pointerEvents: 'none' }}
          viewBox="0 0 400 280" fill="none" xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="4" width="392" height="272" stroke="white" strokeWidth="2.5"/>
          <line x1="200" y1="4" x2="200" y2="276" stroke="white" strokeWidth="2.5"/>
          <circle cx="200" cy="140" r="42" stroke="white" strokeWidth="2.5"/>
          <circle cx="200" cy="140" r="4" fill="white"/>
          <rect x="4" y="88" width="62" height="104" stroke="white" strokeWidth="2"/>
          <rect x="4" y="112" width="24" height="56" stroke="white" strokeWidth="2"/>
          <rect x="334" y="88" width="62" height="104" stroke="white" strokeWidth="2"/>
          <rect x="372" y="112" width="24" height="56" stroke="white" strokeWidth="2"/>
          <path d="M62 88 A42 42 0 0 1 62 192" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M338 88 A42 42 0 0 0 338 192" stroke="white" strokeWidth="2" fill="none"/>
        </svg>

        {/* Glow áureo izquierda */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: -60, left: '15%',
            width: 420, height: 420,
            background: `radial-gradient(ellipse, ${GOLD}10 0%, transparent 62%)`,
            pointerEvents: 'none',
          }}
        />
        {/* Glow derecho secundario */}
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: -40, right: '20%',
            width: 280, height: 280,
            background: `radial-gradient(ellipse, ${GOLD}07 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Textura de césped */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent, transparent 30px,
              rgba(255,255,255,0.010) 30px, rgba(255,255,255,0.010) 60px
            )`,
          }}
        />

        {/* Content */}
        <div className="relative px-6 pt-7 pb-0 flex flex-col gap-5">

          {/* Fila superior: título + countdown */}
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Título */}
            <div className="mundial-title flex flex-col gap-2">
              <p style={{
                fontSize: 9, fontWeight: 900, fontFamily: 'var(--font-sport)',
                color: `${GOLD}80`, textTransform: 'uppercase', letterSpacing: '0.22em',
              }}>
                48 PARTIDOS · 1 CAMPEÓN · TUS PICKS
              </p>

              <div className="flex items-end gap-3">
                <span className="trophy-float" style={{ fontSize: 50, lineHeight: 1 }}>🏆</span>
                <div>
                  <h1
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(2.2rem, 5.5vw, 3.8rem)',
                      fontWeight: 900,
                      color: GOLD,
                      letterSpacing: '-0.035em',
                      lineHeight: 0.88,
                      textShadow: `0 0 60px ${GOLD}40`,
                    }}
                  >
                    MUNDIAL
                  </h1>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1rem, 2.5vw, 1.7rem)',
                      fontWeight: 900,
                      color: `${GOLD}45`,
                      letterSpacing: '0.18em',
                      lineHeight: 1.1,
                      marginTop: 2,
                    }}
                  >
                    2026
                  </p>
                </div>
              </div>

              {/* Host nations */}
              <div className="mundial-flags flex items-center gap-0 flex-wrap mt-1">
                {[
                  { emoji: '🇺🇸', name: 'USA' },
                  { emoji: '🇨🇦', name: 'CANADA' },
                  { emoji: '🇲🇽', name: 'MEXICO' },
                ].map(({ emoji, name }, i) => (
                  <div key={name} className="flex items-center">
                    {i > 0 && (
                      <span style={{ color: `${GOLD}30`, fontSize: 11, margin: '0 9px' }}>·</span>
                    )}
                    <span style={{ fontSize: 17 }}>{emoji}</span>
                    <span
                      style={{
                        fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)',
                        fontFamily: 'var(--font-sport)', letterSpacing: '0.12em', marginLeft: 5,
                      }}
                    >
                      {name}
                    </span>
                  </div>
                ))}
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-sport)', marginLeft: 14 }}>
                  11 Jun – 19 Jul 2026
                </span>
              </div>
            </div>

            {/* Columna derecha: countdown + stats */}
            <div className="flex flex-col items-end gap-3 flex-shrink-0">

              {/* Countdown badge */}
              {(daysLeft !== null || nextMatchMs !== null) && (
                <div
                  className="countdown-glow flex flex-col items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(145deg, ${GOLD}20 0%, ${GOLD}0C 100%)`,
                    border: `1.5px solid ${GOLD}38`,
                    padding: '16px 26px',
                    minWidth: 100,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {daysLeft !== null ? (
                    <>
                      <span
                        key={daysLeft}
                        className="countdown-num"
                        style={{
                          fontSize: 52,
                          fontWeight: 900,
                          color: GOLD,
                          fontFamily: 'var(--font-display)',
                          lineHeight: 1,
                          letterSpacing: '-0.05em',
                          textShadow: `0 0 40px ${GOLD}60`,
                        }}
                      >
                        {daysLeft}
                      </span>
                      <span style={{ fontSize: 8, color: GOLD2, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 4 }}>
                        {daysLeft === 1 ? 'día' : 'días'}
                      </span>
                    </>
                  ) : nextMatchMs !== null ? (
                    <>
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                          color: GOLD,
                          fontFamily: 'var(--font-display)',
                          lineHeight: 1,
                          letterSpacing: '-0.02em',
                          textShadow: `0 0 30px ${GOLD}50`,
                        }}
                      >
                        {formatCountdown(nextMatchMs)}
                      </span>
                      <span style={{ fontSize: 7.5, color: GOLD2, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>
                        próximo pick
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              {/* Stats inline — solo tras el primer pick o cuando el torneo arrancó */}
              {myPicks > 0 && daysLeft === null && (
                <div
                  className="flex items-center gap-5 px-5 py-3 rounded-2xl"
                  style={{ background: `${GOLD}0E`, border: `1px solid ${GOLD}22` }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                      {myPicks}
                    </p>
                    <p style={{ fontSize: 8, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>picks</p>
                  </div>
                  {totalPts > 0 && (
                    <>
                      <div style={{ width: 1, height: 30, background: `${GOLD}20` }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 24, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                          {totalPts}
                        </p>
                        <p style={{ fontSize: 8, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>pts</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Puntos info strip */}
          <div className="mundial-strip relative flex items-center gap-4 flex-wrap pb-5">
            {[
              { icon: '⚽', text: 'Resultado correcto', pts: '3 pts' },
              { icon: '⭐', text: 'Partido destacado',  pts: '6 pts' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-1.5">
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-sport)' }}>
                  {item.text}
                </span>
                <span
                  style={{
                    fontSize: 10, fontWeight: 900, color: GOLD,
                    fontFamily: 'var(--font-sport)',
                    background: `${GOLD}14`,
                    padding: '1px 6px', borderRadius: 5,
                  }}
                >
                  {item.pts}
                </span>
              </div>
            ))}

            {totalPts > 0 && (
              <a
                href={`/api/og/mundial-stats?picks=${myPicks}&correct=${Object.values(preds).filter(p => p.is_correct).length}&pts=${totalPts}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 'auto',
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 8,
                  background: `${GOLD}12`, border: `1px solid ${GOLD}28`,
                  color: GOLD_D, fontSize: 9, fontWeight: 900,
                  fontFamily: 'var(--font-sport)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', textDecoration: 'none', cursor: 'pointer',
                }}
              >
                🖼 Compartir mis stats
              </a>
            )}
          </div>

          {/* CTA registro — usuarios no logueados */}
          {loggedIn === false && !loading && (
            <div
              className="mundial-cta"
              style={{
                margin: '0 -24px',
                padding: '14px 24px 16px',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                background: `linear-gradient(90deg, ${GOLD}0C 0%, ${GOLD}06 100%)`,
                borderTop: `1px solid ${GOLD}20`,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 900, color: '#F2F2F8', fontFamily: 'var(--font-sport)', lineHeight: 1.3 }}>
                  Crea tu cuenta y empieza a predecir gratis
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-sport)', marginTop: 3 }}>
                  Guarda tus picks · Acumula puntos · Compite en el ranking
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href="/auth/login"
                  style={{
                    padding: '9px 18px', borderRadius: 11,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 11, fontWeight: 900, fontFamily: 'var(--font-sport)',
                    textDecoration: 'none', letterSpacing: '0.04em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Iniciar sesión
                </a>
                <a
                  href="/auth/register"
                  style={{
                    padding: '9px 18px', borderRadius: 11,
                    background: GOLD,
                    border: `1px solid ${GOLD}`,
                    color: '#000',
                    fontSize: 11, fontWeight: 900, fontFamily: 'var(--font-sport)',
                    textDecoration: 'none', letterSpacing: '0.04em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                    boxShadow: `0 4px 20px ${GOLD}30`,
                  }}
                >
                  Registro gratis →
                </a>
              </div>
            </div>
          )}

        </div>{/* end content wrapper */}
      </div>{/* end hero */}

      {/* ── Login CTA ─────────────────────────────────────────── */}
      {showLogin && (
        <div
          className="mb-4 px-5 py-4 rounded-2xl flex flex-col gap-3"
          style={{
            background: `linear-gradient(135deg, ${GOLD}08 0%, rgba(0,0,0,0.2) 100%)`,
            border: `1px solid ${GOLD}32`,
            boxShadow: `0 0 40px ${GOLD}08`,
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22 }}>🏆</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)' }}>
                Inicia sesión para predecir
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)', marginTop: 1 }}>
                Crea una cuenta gratis y compite en el Mundial 2026
              </p>
            </div>
            <button
              onClick={() => setShowLogin(false)}
              style={{ marginLeft: 'auto', opacity: 0.4, background: 'none', border: 'none', color: '#F0F0F8', cursor: 'pointer', fontSize: 16 }}
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href="/auth/login"
              style={{
                flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 11,
                background: `${GOLD}1E`, border: `1px solid ${GOLD}55`,
                color: GOLD, fontSize: 11, fontWeight: 900, fontFamily: 'var(--font-sport)',
                textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}
            >
              Iniciar sesión
            </a>
            <a
              href="/auth/register"
              style={{
                flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 11,
                background: GOLD, border: `1px solid ${GOLD}`,
                color: '#000', fontSize: 11, fontWeight: 900, fontFamily: 'var(--font-sport)',
                textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase',
                boxShadow: `0 4px 20px ${GOLD}30`,
              }}
            >
              Crear cuenta gratis
            </a>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', opacity: 0.6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `2px solid ${GOLD}20`, borderTopColor: GOLD }}
          />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span style={{ fontSize: 52 }}>🏆</span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
              color: GOLD, letterSpacing: '-0.02em',
            }}
          >
            Cargando partidos…
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, maxWidth: 360 }}>
            Los fixtures del Mundial se están sincronizando. Recarga en unos segundos.
          </p>
        </div>
      )}

      {/* ── Match groups ─────────────────────────────────────── */}
      {!loading && grouped.length > 0 && (
        <div className="flex flex-col gap-10">
          {grouped.map(([dateKey, { label, events: dayEvents }], groupIdx) => (
            <section
              key={dateKey}
              className="date-group"
              style={{ animationDelay: `${groupIdx * 60}ms` }}
            >
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  style={{
                    width: 4, height: 22, borderRadius: 2, flexShrink: 0,
                    background: `linear-gradient(to bottom, ${GOLD}, ${GOLD2}40)`,
                    boxShadow: `0 0 8px ${GOLD}30`,
                  }}
                />
                <span
                  style={{
                    fontSize: 13, fontWeight: 900, color: '#F0F0F8',
                    fontFamily: 'var(--font-sport)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}
                >
                  {label}
                </span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${GOLD}20, transparent)` }} />
                {dayEvents.filter(e => e.status === 'open').length > 0 && (
                  <span
                    style={{
                      fontSize: 9, fontWeight: 700, color: GOLD2,
                      fontFamily: 'var(--font-sport)',
                      background: `${GOLD}10`, padding: '3px 9px',
                      borderRadius: 10, border: `1px solid ${GOLD}22`,
                    }}
                  >
                    {dayEvents.filter(e => e.status === 'open').length} pendientes
                  </span>
                )}
              </div>

              {/* Match cards grid */}
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: dayEvents.length === 1
                    ? 'minmax(280px, 420px)'
                    : 'repeat(auto-fill, minmax(280px, 1fr))',
                }}
              >
                {dayEvents.map((ev, cardIdx) => (
                  <MatchCard
                    key={ev.id}
                    event={ev}
                    pred={preds[ev.id]}
                    submitting={submitting}
                    onPick={handlePick}
                    animDelay={groupIdx * 60 + cardIdx * 50}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Footer note ───────────────────────────────────────── */}
      {!loading && openCount > 0 && (
        <p
          className="text-center mt-12"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-sport)' }}
        >
          Las predicciones se bloquean al inicio de cada partido · Sin cambios una vez guardadas
        </p>
      )}
    </div>
  )
}
